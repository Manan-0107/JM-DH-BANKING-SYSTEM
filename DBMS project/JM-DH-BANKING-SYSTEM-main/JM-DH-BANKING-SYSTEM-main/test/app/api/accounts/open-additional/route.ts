import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, verifyTransactionPin, generateTransactionReference } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { account_type, branch_name, pin } = body;

    const validTypes = ['Savings Account', 'Current Account', 'Salary Account', 'Student Savings'];
    const chosenType = validTypes.includes(account_type) ? account_type : 'Savings Account';

    const db = await getDb();

    // 1. Verify PIN
    const [custRows] = await db.query(
      `SELECT password_hash, card_pin, card_pin_hash FROM customers WHERE customer_id = ?`,
      [authUser.customer_id]
    );

    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer record not found' }, { status: 404 });
    }

    const isValidPin = verifyTransactionPin(pin, custRows[0]);
    if (!isValidPin) {
      return NextResponse.json({ error: 'Invalid 4-digit Debit Card PIN entered' }, { status: 401 });
    }

    // 2. Generate unique account number and reference
    const randomSuffix = crypto.randomInt(100000, 999999);
    const accNum = `ACC-${randomSuffix}`;
    const branch = branch_name || 'Mumbai Nariman Point Hub';
    const ifsc = 'BTBI0001024';
    const initialGrant = chosenType === 'Current Account' ? 25000.0 : 10000.0;
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const { txnId, referenceNumber } = generateTransactionReference('TXN-GRANT');
    const pinHashToUse = custRows[0].card_pin_hash || null;
    const plainPinToUse = custRows[0].card_pin || '1234';

    await db.transaction(async (conn) => {
      // 1. Create account
      await conn.query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status, card_pin, card_pin_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [accNum, authUser.customer_id, chosenType, initialGrant, ifsc, branch, nowTime, plainPinToUse, pinHashToUse]
      );

      // 2. Initial welcome funding transaction
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', ?, ?)`,
        [txnId, accNum, initialGrant, nowTime, `Welcome Activation Credit - ${chosenType}`, referenceNumber]
      );

      // 3. Record audit log
      const auditId = `AUD-${Date.now().toString().slice(-6)}`;
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'OPEN_ADDITIONAL_ACCOUNT', 'ACCOUNT', ?, ?, ?)`,
        [auditId, authUser.customer_id, accNum, `Opened new ${chosenType} with ₹${initialGrant} opening balance. Ref: ${referenceNumber}`, nowTime]
      );
    });

    const [newAccount] = await db.query(`SELECT * FROM accounts WHERE account_number = ?`, [accNum]);
    delete newAccount[0].card_pin;
    delete newAccount[0].card_pin_hash;

    return NextResponse.json({
      message: `Congratulations! Your new ${chosenType} (${accNum}) is now active with ₹${initialGrant.toLocaleString('en-IN')} opening balance.`,
      account: newAccount[0],
    }, { status: 201 });
  } catch (err: any) {
    console.error('Open additional account error:', err);
    return NextResponse.json({ error: 'Failed to create new account. Please try again.' }, { status: 500 });
  }
}
