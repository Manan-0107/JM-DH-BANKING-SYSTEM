import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTransactionReference, generateAuditId, validateMonetaryAmount } from '@/lib/auth';
import { requireAuth, verifyAccountOwnership, verifyCustomerCredentials, formatDbDateTime, sanitizeAccount } from '@/lib/api-helpers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const { id: accountId } = await params;
    const body = await request.json().catch(() => ({}));
    const { amount, description, pin } = body;

    const amountVal = validateMonetaryAmount(amount, { min: 1, max: 50000, fieldName: 'Withdrawal amount' });
    if (!amountVal.valid) {
      return NextResponse.json({ error: amountVal.error }, { status: 400 });
    }
    const numAmount = amountVal.amount!;

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return NextResponse.json({ error: 'Debit Card 4-Digit PIN is required for ATM withdrawals' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Verify account exists, belongs to user, and is active
    const accCheck = await verifyAccountOwnership(db, accountId, authUser.customer_id, {
      requireActive: true,
      activeActionName: 'withdrawing',
    });
    if (accCheck.errorResponse) return accCheck.errorResponse;
    const account = accCheck.account;

    if (parseFloat(account.balance) < numAmount) {
      return NextResponse.json({
        error: `Insufficient balance. Available: ₹${parseFloat(account.balance).toLocaleString('en-IN')}`,
      }, { status: 400 });
    }

    // 2. Verify PIN
    const credCheck = await verifyCustomerCredentials(db, authUser.customer_id, pin, 'Invalid 4-digit Debit Card ATM PIN');
    if (credCheck.errorResponse) return credCheck.errorResponse;

    // 3. Generate Reference
    const { txnId, referenceNumber } = generateTransactionReference('TXN-ATM');
    const nowTime = formatDbDateTime();
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
    const cleanAccount = sanitizeAccount(updatedAcc?.[0]);

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
      account: cleanAccount,
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Withdrawal failed: Insufficient account balance or concurrent update.' }, { status: 400 });
    }
    console.error('Withdrawal API Error:', err);
    return NextResponse.json({ error: 'Unable to process withdrawal. Please try again.' }, { status: 500 });
  }
}
