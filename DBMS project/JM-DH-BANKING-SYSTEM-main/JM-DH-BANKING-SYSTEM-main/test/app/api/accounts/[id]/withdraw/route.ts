import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const accountId = params.id;
    const body = await request.json();
    const { amount, description, pin } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Withdrawal amount must be a positive number' }, { status: 400 });
    }

    if (numAmount > 50000) {
      return NextResponse.json({ error: 'Maximum ATM withdrawal limit is ₹50,000 per transaction' }, { status: 400 });
    }

    if (!pin) {
      return NextResponse.json({ error: 'Transaction PIN is required for ATM withdrawals' }, { status: 400 });
    }

    const db = await getDb();

    // Verify account exists & ownership
    const [accRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [accountId]);
    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = accRows[0];
    if (account.customer_id !== authUser.customer_id) {
      return NextResponse.json({ error: 'Access Denied: You do not own this account' }, { status: 403 });
    }

    if (account.status !== 'Active') {
      return NextResponse.json({ error: 'Account is frozen or inactive. Please unfreeze before withdrawing.' }, { status: 400 });
    }

    if (parseFloat(account.balance) < numAmount) {
      return NextResponse.json({ error: `Insufficient balance. Available: ₹${parseFloat(account.balance).toLocaleString('en-IN')}` }, { status: 400 });
    }

    // Verify user Card PIN / Authorization PIN
    const [custRows] = await db.query("SELECT password_hash, card_pin FROM customers WHERE customer_id = ?", [authUser.customer_id]);
    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const providedPin = (pin || '').trim();
    const matchesCardPin = custRows[0].card_pin && custRows[0].card_pin === providedPin;
    const matchesPassword = bcrypt.compareSync(providedPin, custRows[0].password_hash);

    if (!matchesCardPin && !matchesPassword) {
      return NextResponse.json({ error: 'Invalid 4-digit Debit Card ATM PIN' }, { status: 401 });
    }

    const txnId = `TXN-${Date.now().toString().slice(-8)}`;
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.transaction(async (conn) => {
      await conn.query("UPDATE accounts SET balance = balance - ? WHERE account_number = ?", [numAmount, accountId]);
      await conn.query(`
        INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
        VALUES (?, ?, NULL, ?, 'Withdrawal', ?, 'Success', ?)
      `, [txnId, accountId, numAmount, nowTime, description || 'ATM Instant Cash Withdrawal']);
    });

    const [updatedAcc] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [accountId]);

    return NextResponse.json({
      message: `₹${numAmount.toLocaleString('en-IN')} cashout completed successfully`,
      transaction: {
        transaction_id: txnId,
        sender_account: accountId,
        receiver_account: null,
        amount: numAmount,
        type: 'Withdrawal',
        date_time: nowTime,
        status: 'Success',
        description: description || 'ATM Instant Cash Withdrawal'
      },
      account: updatedAcc[0]
    });
  } catch (err: any) {
    console.error('Withdrawal error:', err);
    return NextResponse.json({ error: err.message || 'Withdrawal failed' }, { status: 500 });
  }
}
