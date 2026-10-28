import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTransactionReference, generateAuditId, validateMonetaryAmount } from '@/lib/auth';
import { requireAuth, verifyCustomerCredentials, formatDbDateTime, sanitizeAccount } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request, 'Unauthorized: Session invalid');
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const db = await getDb();
    const [deposits] = await db.query(
      `SELECT d.*, a.customer_id 
       FROM deposits d 
       JOIN accounts a ON d.linked_account = a.account_number 
       WHERE a.customer_id = ? 
       ORDER BY d.created_at DESC`,
      [authUser.customer_id]
    );

    return NextResponse.json({
      deposits: deposits || [],
      total: (deposits || []).length,
    });
  } catch (err: any) {
    console.error('Fetch deposits error:', err);
    return NextResponse.json({ error: 'Failed to fetch deposits portfolio' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request, 'Unauthorized: Session invalid');
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const body = await request.json().catch(() => ({}));
    const { source_account, deposit_type, principal_amount, tenure_months, pin } = body;

    if (!source_account) {
      return NextResponse.json({ error: 'Linked source account is required' }, { status: 400 });
    }

    const amountVal = validateMonetaryAmount(principal_amount, {
      min: 5000,
      max: 10000000,
      fieldName: 'Principal deposit amount',
    });
    if (!amountVal.valid) {
      return NextResponse.json({ error: amountVal.error }, { status: 400 });
    }
    const amount = amountVal.amount!;

    const tenure = parseInt(tenure_months, 10);
    if (isNaN(tenure) || tenure < 3) {
      return NextResponse.json({ error: 'Minimum tenure is 3 months' }, { status: 400 });
    }

    const finalType = deposit_type === 'Recurring Deposit' ? 'Recurring Deposit' : 'Fixed Deposit';

    const db = await getDb();

    // 1. Verify source account
    const [accRows] = await db.query(
      'SELECT * FROM accounts WHERE account_number = ? AND customer_id = ?',
      [source_account, authUser.customer_id]
    );

    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Source account not found or unauthorized' }, { status: 404 });
    }

    const account = accRows[0];
    if (account.status !== 'Active') {
      return NextResponse.json({ error: 'Source account is frozen or inactive' }, { status: 400 });
    }

    // Check Legal Liens / Encumbrance Holds
    let totalLien = 0;
    try {
      const [lienRows] = await db.query(
        'SELECT COALESCE(SUM(lien_amount), 0) AS total_lien FROM account_lien_records WHERE account_number = ?',
        [source_account]
      );
      totalLien = parseFloat(lienRows?.[0]?.total_lien || 0);
    } catch (e) {}

    const currentBal = parseFloat(account.balance);
    const availableBal = currentBal - totalLien;

    if (availableBal < amount) {
      const errorMsg = totalLien > 0
        ? `Insufficient funds in ${source_account}: ₹${totalLien.toLocaleString('en-IN')} held under active legal lien. Available: ₹${Math.max(0, availableBal).toLocaleString('en-IN')}`
        : `Insufficient funds in ${source_account}. Available: ₹${currentBal.toLocaleString('en-IN')}`;
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // 2. Verify PIN
    const credCheck = await verifyCustomerCredentials(db, authUser.customer_id, pin);
    if (credCheck.errorResponse) return credCheck.errorResponse;

    // 3. Determine Interest Rate
    let rate = 6.5;
    if (tenure <= 3) rate = 6.25;
    else if (tenure <= 6) rate = 6.75;
    else if (tenure <= 12) rate = 7.50;
    else if (tenure <= 36) rate = 7.75;
    else rate = 8.10;

    const tYears = tenure / 12;
    const n = 4; // quarterly compounding
    const maturityAmount = Math.round(amount * Math.pow(1 + (rate / 100) / n, n * tYears) * 100) / 100;

    const prefix = finalType === 'Recurring Deposit' ? 'RD' : 'FD';
    const depositId = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + tenure);
    const maturityDateStr = maturityDate.toISOString().slice(0, 10);
    const nowTime = formatDbDateTime();

    const { txnId, referenceNumber } = generateTransactionReference('TXN-BOOK');

    // 4. Atomic Execution with Concurrency Protection
    await db.transaction(async (conn) => {
      const [debitResult] = await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND (balance - ?) >= ? AND status = ?',
        [amount, source_account, totalLien, amount, 'Active']
      );

      const affected = (debitResult as any)?.affectedRows ?? (debitResult as any)?.changes ?? 0;
      if (affected === 0) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      // Insert deposit into normalized BCNF schema without redundant customer_id
      try {
        await conn.query(
          `INSERT INTO deposits (deposit_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
          [depositId, source_account, finalType, amount, rate, tenure, maturityAmount, maturityDateStr, nowTime]
        );
      } catch (e: any) {
        // Fallback for legacy tables containing customer_id column
        await conn.query(
          `INSERT INTO deposits (deposit_id, customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
          [depositId, authUser.customer_id, source_account, finalType, amount, rate, tenure, maturityAmount, maturityDateStr, nowTime]
        );
      }

      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, ?, NULL, ?, 'Transfer', ?, 'Success', ?, ?)`,
        [txnId, source_account, amount, nowTime, `${finalType} Booking (${depositId}) - ${tenure} Mo @ ${rate}% p.a.`, referenceNumber]
      );

      const auditId = generateAuditId();
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'DEPOSIT_BOOKING', 'DEPOSIT', ?, ?, ?)`,
        [auditId, authUser.customer_id, depositId, `Booked ${finalType} ₹${amount}. Ref: ${referenceNumber}`, nowTime]
      );
    });

    let [newDeposit] = await db.query(
      `SELECT d.*, a.customer_id 
       FROM deposits d 
       JOIN accounts a ON d.linked_account = a.account_number 
       WHERE d.deposit_id = ?`,
      [depositId]
    );
    if (!newDeposit || (newDeposit as any[]).length === 0) {
      const [rawDep] = await db.query('SELECT * FROM deposits WHERE deposit_id = ?', [depositId]);
      newDeposit = rawDep;
    }
    const [updatedAccount] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [source_account]);
    const cleanAccount = sanitizeAccount(updatedAccount?.[0]);

    return NextResponse.json({
      message: `${finalType} certificate ${depositId} booked successfully! Maturity value: ₹${maturityAmount.toLocaleString('en-IN')}`,
      deposit: newDeposit[0],
      account: cleanAccount,
    }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Deposit booking failed: Insufficient funds in source account.' }, { status: 400 });
    }
    console.error('Book deposit error:', err);
    return NextResponse.json({ error: 'Failed to book term deposit. Please try again.' }, { status: 500 });
  }
}
