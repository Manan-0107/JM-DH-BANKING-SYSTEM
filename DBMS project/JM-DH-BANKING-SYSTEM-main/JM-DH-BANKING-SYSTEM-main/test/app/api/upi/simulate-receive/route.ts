import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, generateAuditId, validateMonetaryAmount } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { account_number, amount, payer_vpa, payer_name, remarks } = body;

    if (!account_number) {
      return NextResponse.json({ error: 'Account number is required' }, { status: 400 });
    }

    const amountVal = validateMonetaryAmount(amount, {
      min: 1,
      max: 100000,
      fieldName: 'UPI credit amount',
    });
    if (!amountVal.valid) {
      return NextResponse.json({ error: amountVal.error }, { status: 400 });
    }
    const numAmount = amountVal.amount!;

    const db = await getDb();

    // 1. Verify recipient account exists and belongs to authenticated user
    const [accRows] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [account_number]);
    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = accRows[0];
    if (account.customer_id !== authUser.customer_id) {
      return NextResponse.json({ error: 'Access Denied: You cannot receive into an account you do not own.' }, { status: 403 });
    }

    if (account.status !== 'Active') {
      return NextResponse.json({ error: 'Account is currently frozen or inactive. Please unfreeze before receiving funds.' }, { status: 400 });
    }

    // 2. Generate simulated NPCI UPI UTR (12 digits) and TXN ID
    const randomRrnSuffix = crypto.randomInt(10000000, 99999999);
    const utr = `4256${randomRrnSuffix}`;
    const txnId = `TXN-UPI${Date.now().toString().slice(-8)}`;
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const vpa = payer_vpa || 'payer@okhdfcbank';
    const senderName = payer_name || 'Simulated UPI Payer';
    const note = remarks ? remarks.trim() : 'Instant UPI Payment';
    const description = `UPI Credit: ${note} (from ${senderName} [${vpa}] | UTR: ${utr})`;

    // 3. Run database updates in transaction
    const result = await db.transaction(async (conn) => {
      // 1. Credit account balance
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE account_number = ?', [numAmount, account_number]);

      // 2. Insert transaction entry
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, ?, ?, ?, 'Deposit', ?, 'Success', ?, ?)`,
        [txnId, vpa, account_number, numAmount, nowTime, description, utr]
      );

      // 3. Record audit log
      const auditId = generateAuditId();
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'UPI_RECEIVE', 'ACCOUNT', ?, ?, ?)`,
        [auditId, authUser.customer_id, account_number, `Received UPI credit ₹${numAmount} from ${vpa}. UTR: ${utr}`, nowTime]
      );

      // 4. Fetch new balance
      const [updatedAccRows] = await conn.query('SELECT balance FROM accounts WHERE account_number = ?', [account_number]);
      return {
        newBalance: updatedAccRows[0]?.balance ?? (parseFloat(account.balance) + numAmount),
      };
    });

    return NextResponse.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} received successfully via UPI!`,
      utr,
      transaction_id: txnId,
      new_balance: result.newBalance,
      payer_vpa: vpa,
      payer_name: senderName,
      amount: numAmount,
      disclaimer: 'College DBMS Project Simulation: UPI transaction simulated via internal database ledger.',
    });
  } catch (error: any) {
    console.error('UPI Receive Error:', error);
    return NextResponse.json({ error: 'Internal server error during UPI transaction' }, { status: 500 });
  }
}
