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
      return NextResponse.json({ error: 'Deposit amount must be a positive number' }, { status: 400 });
    }

    if (numAmount > 500000) {
      return NextResponse.json({ error: 'Maximum deposit limit is ₹5,00,000 per transaction' }, { status: 400 });
    }

    if (!pin) {
      return NextResponse.json({ error: 'Transaction PIN is required for deposits' }, { status: 400 });
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
      return NextResponse.json({ error: 'Account is frozen or inactive' }, { status: 400 });
    }

    // Verify user Card PIN / Authorization PIN
    const [custRows] = await db.query("SELECT password_hash, card_pin FROM customers WHERE customer_id = ?", [authUser.customer_id]);
    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const providedPin = (pin || '').trim();
    const matchesCardPin = custRows[0].card_pin && custRows[0].card_pin === providedPin;
    const matchesPassword = bcrypt.compareSync(providedPin, custRows[0].password_hash);

    if (!matchesCardPin && !matchesPassword) {
      return NextResponse.json({ error: 'Invalid 4-digit Debit Card PIN entered' }, { status: 401 });
    }

    const txnId = `TXN-${Date.now().toString().slice(-8)}`;
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.transaction(async (conn) => {
      await conn.query("UPDATE accounts SET balance = balance + ? WHERE account_number = ?", [numAmount, accountId]);
      await conn.query(`
        INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
        VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', ?)
      `, [txnId, accountId, numAmount, nowTime, description || 'Direct Cash / Cheque Deposit']);
    });

    const [updatedAcc] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [accountId]);

    return NextResponse.json({
      message: `₹${numAmount.toLocaleString('en-IN')} deposited successfully`,
      transaction: {
        transaction_id: txnId,
        sender_account: null,
        receiver_account: accountId,
        amount: numAmount,
        type: 'Deposit',
        date_time: nowTime,
        status: 'Success',
        description: description || 'Direct Cash / Cheque Deposit'
      },
      account: updatedAcc[0]
    });
  } catch (err: any) {
    console.error('Deposit error:', err);
    return NextResponse.json({ error: err.message || 'Deposit failed' }, { status: 500 });
  }
}
