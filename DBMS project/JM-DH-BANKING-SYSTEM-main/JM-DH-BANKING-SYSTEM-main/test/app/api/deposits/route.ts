import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const db = await getDb();
    const [deposits] = await db.query(
      `SELECT * FROM deposits WHERE customer_id = ? ORDER BY created_at DESC`,
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
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json();
    const { source_account, deposit_type, principal_amount, tenure_months, pin } = body;

    if (!source_account) {
      return NextResponse.json({ error: 'Linked source account is required' }, { status: 400 });
    }

    const amount = parseFloat(principal_amount);
    if (isNaN(amount) || amount < 5000) {
      return NextResponse.json({ error: 'Minimum deposit amount is ₹5,000' }, { status: 400 });
    }

    const tenure = parseInt(tenure_months, 10);
    if (isNaN(tenure) || tenure < 3) {
      return NextResponse.json({ error: 'Minimum tenure is 3 months' }, { status: 400 });
    }

    const finalType = deposit_type === 'Recurring Deposit' ? 'Recurring Deposit' : 'Fixed Deposit';

    const db = await getDb();

    // Verify source account
    const [accRows] = await db.query(
      `SELECT * FROM accounts WHERE account_number = ? AND customer_id = ?`,
      [source_account, authUser.customer_id]
    );

    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Source account not found or unauthorized' }, { status: 404 });
    }

    const account = accRows[0];
    if (account.status !== 'Active') {
      return NextResponse.json({ error: 'Source account is frozen or inactive' }, { status: 400 });
    }

    if (parseFloat(account.balance) < amount) {
      return NextResponse.json({
        error: `Insufficient funds in ${source_account}. Available: ₹${parseFloat(account.balance).toLocaleString('en-IN')}`,
      }, { status: 400 });
    }

    // Verify PIN
    const [custRows] = await db.query(`SELECT password_hash, card_pin FROM customers WHERE customer_id = ?`, [authUser.customer_id]);
    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer verification failed' }, { status: 404 });
    }

    const providedPin = (pin || '').trim();
    const matchesCardPin = custRows[0].card_pin && custRows[0].card_pin === providedPin;
    const matchesPassword = bcrypt.compareSync(providedPin, custRows[0].password_hash);

    if (!matchesCardPin && !matchesPassword) {
      return NextResponse.json({ error: 'Invalid 4-digit Debit Card PIN entered' }, { status: 401 });
    }

    // Determine interest rate based on tenure
    let rate = 6.5;
    if (tenure <= 3) rate = 6.25;
    else if (tenure <= 6) rate = 6.75;
    else if (tenure <= 12) rate = 7.50;
    else if (tenure <= 36) rate = 7.75;
    else rate = 8.10;

    // Senior citizen bonus simulation (+0.50% if age > 60, optional)
    // Maturity Calculation: A = P * (1 + r/(4*100))^(4 * (tenure/12))
    const tYears = tenure / 12;
    const n = 4; // quarterly compounding
    const maturityAmount = Math.round(amount * Math.pow(1 + (rate / 100) / n, n * tYears) * 100) / 100;

    const prefix = finalType === 'Recurring Deposit' ? 'RD' : 'FD';
    const depositId = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + tenure);
    const maturityDateStr = maturityDate.toISOString().slice(0, 10);
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.transaction(async (conn) => {
      // 1. Deduct principal from source account
      await conn.query(`UPDATE accounts SET balance = balance - ? WHERE account_number = ?`, [amount, source_account]);

      // 2. Insert into deposits table
      await conn.query(
        `INSERT INTO deposits (deposit_id, customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
        [depositId, authUser.customer_id, source_account, finalType, amount, rate, tenure, maturityAmount, maturityDateStr, nowTime]
      );

      // 3. Record transaction in ledger
      const txnId = `TXN-${Date.now().toString().slice(-8)}`;
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
         VALUES (?, ?, NULL, ?, 'Transfer', ?, 'Success', ?)`,
        [txnId, source_account, amount, nowTime, `${finalType} Booking (${depositId}) - ${tenure} Mo @ ${rate}% p.a.`]
      );
    });

    const [newDeposit] = await db.query(`SELECT * FROM deposits WHERE deposit_id = ?`, [depositId]);
    const [updatedAccount] = await db.query(`SELECT * FROM accounts WHERE account_number = ?`, [source_account]);

    return NextResponse.json({
      message: `${finalType} certificate ${depositId} booked successfully! Maturity value: ₹${maturityAmount.toLocaleString('en-IN')}`,
      deposit: newDeposit[0],
      account: updatedAccount[0],
    }, { status: 201 });
  } catch (err: any) {
    console.error('Book deposit error:', err);
    return NextResponse.json({ error: err.message || 'Failed to book deposit' }, { status: 500 });
  }
}
