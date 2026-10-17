import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, verifyTransactionPin, generateTransactionReference } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid or expired' }, { status: 401 });
    }

    const accountId = params.id;
    const body = await request.json().catch(() => ({}));
    const { amount, description, pin } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Deposit amount must be a positive number' }, { status: 400 });
    }

    if (numAmount > 500000) {
      return NextResponse.json({ error: 'Maximum single deposit limit is ₹5,00,000' }, { status: 400 });
    }

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return NextResponse.json({ error: 'Debit Card PIN is required for authorization' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Verify account exists & ownership
    const [accRows] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accountId]);
    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = accRows[0];
    if (account.customer_id !== authUser.customer_id) {
      return NextResponse.json({ error: 'Access Denied: You do not own this account' }, { status: 403 });
    }

    if (account.status !== 'Active') {
      return NextResponse.json({ error: `Account is ${account.status.toLowerCase()}. Please unfreeze before depositing.` }, { status: 400 });
    }

    // 2. Verify PIN
    const [custRows] = await db.query(
      'SELECT password_hash, card_pin, card_pin_hash FROM customers WHERE customer_id = ?',
      [authUser.customer_id]
    );

    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer verification failed' }, { status: 404 });
    }

    const isValidPin = verifyTransactionPin(pin, custRows[0]);
    if (!isValidPin) {
      return NextResponse.json({ error: 'Invalid 4-digit Debit Card PIN entered' }, { status: 401 });
    }

    // 3. Generate Reference
    const { txnId, referenceNumber } = generateTransactionReference('TXN-DEP');
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const finalDesc = description ? description.trim() : 'Direct Cash / Cheque Deposit';

    // 4. Atomic Execution
    await db.transaction(async (conn) => {
      await conn.query(
        'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
        [numAmount, accountId]
      );

      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', ?, ?)`,
        [txnId, accountId, numAmount, nowTime, finalDesc, referenceNumber]
      );

      const auditId = `AUD-${Date.now().toString().slice(-6)}`;
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'CASH_DEPOSIT', 'ACCOUNT', ?, ?, ?)`,
        [auditId, authUser.customer_id, accountId, `Deposited ₹${numAmount}. Ref: ${referenceNumber}`, nowTime]
      );
    });

    const [updatedAcc] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accountId]);

    return NextResponse.json({
      message: `₹${numAmount.toLocaleString('en-IN')} deposited successfully into ${accountId}`,
      transaction: {
        transaction_id: txnId,
        reference_number: referenceNumber,
        sender_account: null,
        receiver_account: accountId,
        amount: numAmount,
        type: 'Deposit',
        date_time: nowTime,
        status: 'Success',
        description: finalDesc,
      },
      account: updatedAcc[0],
    });
  } catch (err: any) {
    console.error('Deposit API Error:', err);
    return NextResponse.json({ error: 'Unable to process deposit. Please try again.' }, { status: 500 });
  }
}
