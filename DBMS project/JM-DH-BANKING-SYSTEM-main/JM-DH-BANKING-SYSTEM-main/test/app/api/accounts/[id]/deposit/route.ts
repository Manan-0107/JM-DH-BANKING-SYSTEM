import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTransactionReference, generateAuditId, validateMonetaryAmount } from '@/lib/auth';
import { requireAuth, verifyAccountOwnership, verifyCustomerCredentials, formatDbDateTime, sanitizeAccount } from '@/lib/api-helpers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(request);
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const accountId = params.id;
    const body = await request.json().catch(() => ({}));
    const { amount, description, pin } = body;

    const amountVal = validateMonetaryAmount(amount, { min: 1, max: 500000, fieldName: 'Deposit amount' });
    if (!amountVal.valid) {
      return NextResponse.json({ error: amountVal.error }, { status: 400 });
    }
    const numAmount = amountVal.amount!;

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return NextResponse.json({ error: 'Debit Card PIN is required for authorization' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Verify account exists & ownership & active status
    const accCheck = await verifyAccountOwnership(db, accountId, authUser.customer_id, {
      requireActive: true,
      activeActionName: 'depositing',
    });
    if (accCheck.errorResponse) return accCheck.errorResponse;

    // 2. Verify PIN
    const credCheck = await verifyCustomerCredentials(db, authUser.customer_id, pin);
    if (credCheck.errorResponse) return credCheck.errorResponse;

    // 3. Generate Reference
    const { txnId, referenceNumber } = generateTransactionReference('TXN-DEP');
    const nowTime = formatDbDateTime();
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

      const auditId = generateAuditId();
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'CASH_DEPOSIT', 'ACCOUNT', ?, ?, ?)`,
        [auditId, authUser.customer_id, accountId, `Deposited ₹${numAmount}. Ref: ${referenceNumber}`, nowTime]
      );
    });

    const [updatedAcc] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accountId]);
    const cleanAccount = sanitizeAccount(updatedAcc?.[0]);

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
      account: cleanAccount,
    });
  } catch (err: any) {
    console.error('Deposit API Error:', err);
    return NextResponse.json({ error: 'Unable to process deposit. Please try again.' }, { status: 500 });
  }
}
