import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, verifyTransactionPin, generateTransactionReference, generateAuditId } from '@/lib/auth';

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
      return NextResponse.json({ error: 'Withdrawal amount must be a positive number' }, { status: 400 });
    }

    if (numAmount > 50000) {
      return NextResponse.json({ error: 'Maximum ATM single withdrawal limit is ₹50,000' }, { status: 400 });
    }

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return NextResponse.json({ error: 'Debit Card 4-Digit PIN is required for ATM withdrawals' }, { status: 400 });
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
      return NextResponse.json({ error: `Account is ${account.status.toLowerCase()}. Please unfreeze before withdrawing.` }, { status: 400 });
    }

    if (parseFloat(account.balance) < numAmount) {
      return NextResponse.json({
        error: `Insufficient balance. Available: ₹${parseFloat(account.balance).toLocaleString('en-IN')}`,
      }, { status: 400 });
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
      return NextResponse.json({ error: 'Invalid 4-digit Debit Card ATM PIN' }, { status: 401 });
    }

    // 3. Generate Reference
    const { txnId, referenceNumber } = generateTransactionReference('TXN-ATM');
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const finalDesc = description ? description.trim() : 'ATM Instant Cash Withdrawal';

    // 4. Atomic Execution
    await db.transaction(async (conn) => {
      const [debitResult] = await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND balance >= ? AND status = ?',
        [numAmount, accountId, numAmount, 'Active']
      );

      const affected = (debitResult as any)?.affectedRows ?? (debitResult as any)?.changes ?? 0;
      if (affected === 0) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, ?, NULL, ?, 'Withdrawal', ?, 'Success', ?, ?)`,
        [txnId, accountId, numAmount, nowTime, finalDesc, referenceNumber]
      );

      const auditId = generateAuditId();
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'ATM_WITHDRAWAL', 'ACCOUNT', ?, ?, ?)`,
        [auditId, authUser.customer_id, accountId, `Withdrew ₹${numAmount} at ATM. Ref: ${referenceNumber}`, nowTime]
      );
    });

    const [updatedAcc] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accountId]);

    return NextResponse.json({
      message: `₹${numAmount.toLocaleString('en-IN')} cash withdrawal completed successfully`,
      transaction: {
        transaction_id: txnId,
        reference_number: referenceNumber,
        sender_account: accountId,
        receiver_account: null,
        amount: numAmount,
        type: 'Withdrawal',
        date_time: nowTime,
        status: 'Success',
        description: finalDesc,
      },
      account: updatedAcc[0],
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Withdrawal failed: Insufficient account balance or concurrent update.' }, { status: 400 });
    }
    console.error('Withdrawal API Error:', err);
    return NextResponse.json({ error: 'Unable to process withdrawal. Please try again.' }, { status: 500 });
  }
}
