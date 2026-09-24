import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json();
    const { from_account, to_account, amount, description, pin } = body;

    if (!from_account || !to_account) {
      return NextResponse.json({ error: 'Both sender and beneficiary account numbers are required' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Transfer amount must be a positive number' }, { status: 400 });
    }

    if (numAmount > 500000) {
      return NextResponse.json({ error: 'Maximum IMPS transfer limit is ₹5,00,000 per transaction' }, { status: 400 });
    }

    const db = await getDb();

    // Verify sender account exists and is owned by authUser
    const [senderRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [from_account]);
    if (!senderRows || senderRows.length === 0) {
      return NextResponse.json({ error: 'Sender account not found' }, { status: 404 });
    }

    const senderAcc = senderRows[0];
    if (senderAcc.customer_id !== authUser.customer_id) {
      return NextResponse.json({ error: 'Access Denied: You can only transfer funds from your own verified account.' }, { status: 403 });
    }

    if (senderAcc.status !== 'Active') {
      return NextResponse.json({ error: 'Sender account is currently frozen or inactive. Please unfreeze before transacting.' }, { status: 400 });
    }

    if (parseFloat(senderAcc.balance) < numAmount) {
      return NextResponse.json({ error: `Insufficient funds. Available balance: ₹${parseFloat(senderAcc.balance).toLocaleString('en-IN')}` }, { status: 400 });
    }

    // Verify receiver account exists
    const [receiverRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [to_account]);
    if (!receiverRows || receiverRows.length === 0) {
      return NextResponse.json({ error: 'Beneficiary/Receiver account not found. Please verify the account number.' }, { status: 404 });
    }

    const receiverAcc = receiverRows[0];
    if (receiverAcc.status !== 'Active') {
      return NextResponse.json({ error: 'Beneficiary account is currently inactive.' }, { status: 400 });
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

    // Generate unique transaction ID
    const txnId = `TXN-${Date.now().toString().slice(-8)}`;
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.transaction(async (conn) => {
      await conn.query("UPDATE accounts SET balance = balance - ? WHERE account_number = ?", [numAmount, from_account]);
      await conn.query("UPDATE accounts SET balance = balance + ? WHERE account_number = ?", [numAmount, to_account]);
      await conn.query(`
        INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
        VALUES (?, ?, ?, ?, 'Transfer', ?, 'Success', ?)
      `, [txnId, from_account, to_account, numAmount, nowTime, description || `IMPS Transfer to ${to_account}`]);
    });

    const [updatedSender] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [from_account]);

    return NextResponse.json({
      message: `₹${numAmount.toLocaleString('en-IN')} transferred successfully to ${to_account}`,
      transaction: {
        transaction_id: txnId,
        sender_account: from_account,
        receiver_account: to_account,
        amount: numAmount,
        type: 'Transfer',
        date_time: nowTime,
        status: 'Success',
        description: description || `IMPS Transfer to ${to_account}`
      },
      sender: updatedSender[0]
    });
  } catch (err: any) {
    console.error('Transfer error:', err);
    return NextResponse.json({ error: err.message || 'Transfer failed' }, { status: 500 });
  }
}
