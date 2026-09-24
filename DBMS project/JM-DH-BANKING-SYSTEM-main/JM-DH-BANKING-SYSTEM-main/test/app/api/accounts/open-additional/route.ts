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
    const { account_type, branch_name, pin } = body;

    const validTypes = ['Savings Account', 'Current Account', 'Salary Account', 'Student Savings'];
    const chosenType = validTypes.includes(account_type) ? account_type : 'Savings Account';

    const db = await getDb();

    // Verify PIN
    const [custRows] = await db.query(
      `SELECT password_hash, card_pin FROM customers WHERE customer_id = ?`,
      [authUser.customer_id]
    );

    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const providedPin = (pin || '').trim();
    const matchesCardPin = custRows[0].card_pin && custRows[0].card_pin === providedPin;
    const matchesPassword = bcrypt.compareSync(providedPin, custRows[0].password_hash);

    if (!matchesCardPin && !matchesPassword) {
      return NextResponse.json({ error: 'Invalid 4-digit Debit Card PIN entered' }, { status: 401 });
    }

    // Generate unique account number
    const accNum = `ACC-${Math.floor(100000 + Math.random() * 900000)}`;
    const branch = branch_name || 'Mumbai Nariman Point Hub';
    const ifsc = 'BTBI0001024';
    const initialGrant = chosenType === 'Current Account' ? 25000.0 : 10000.0;
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.transaction(async (conn) => {
      // 1. Create account
      await conn.query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status, card_pin)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
        [accNum, authUser.customer_id, chosenType, initialGrant, ifsc, branch, nowTime, custRows[0].card_pin || '1234']
      );

      // 2. Initial welcome funding transaction
      const txnId = `TXN-${Date.now().toString().slice(-8)}`;
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
         VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', ?)`,
        [txnId, accNum, initialGrant, nowTime, `Welcome Activation Credit - ${chosenType}`]
      );
    });

    const [newAccount] = await db.query(`SELECT * FROM accounts WHERE account_number = ?`, [accNum]);

    return NextResponse.json({
      message: `Congratulations! Your new ${chosenType} (${accNum}) is now active with ₹${initialGrant.toLocaleString('en-IN')} opening balance.`,
      account: newAccount[0],
    }, { status: 201 });
  } catch (err: any) {
    console.error('Open additional account error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create new account' }, { status: 500 });
  }
}
