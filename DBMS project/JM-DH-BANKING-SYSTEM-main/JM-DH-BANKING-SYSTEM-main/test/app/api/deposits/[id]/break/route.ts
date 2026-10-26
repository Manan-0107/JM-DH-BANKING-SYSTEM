import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTransactionReference, generateAuditId } from '@/lib/auth';
import { requireAuth, verifyCustomerCredentials, formatDbDateTime, sanitizeAccount } from '@/lib/api-helpers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(request, 'Unauthorized: Session invalid');
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { pin } = body;

    const db = await getDb();

    // 1. Verify deposit ownership
    const [depRows] = await db.query(
      'SELECT * FROM deposits WHERE deposit_id = ? AND customer_id = ?',
      [id, authUser.customer_id]
    );

    if (!depRows || depRows.length === 0) {
      return NextResponse.json({ error: 'Deposit certificate not found or unauthorized' }, { status: 404 });
    }

    const deposit = depRows[0];
    if (deposit.status !== 'Active') {
      return NextResponse.json({ error: `This deposit certificate is already ${deposit.status.toLowerCase()}.` }, { status: 400 });
    }

    // 2. Verify PIN if provided
    if (pin) {
      const credCheck = await verifyCustomerCredentials(db, authUser.customer_id, pin, 'Invalid PIN entered for liquidation');
      if (credCheck.errorResponse) return credCheck.errorResponse;
    }

    // 3. Payout calculation
    const principal = parseFloat(deposit.principal_amount);
    const nominalRate = Math.max(3.5, parseFloat(deposit.interest_rate) - 0.5); // 0.5% premature deduction
    const prematureInterest = Math.round((principal * (nominalRate / 100) * 0.5) * 100) / 100;
    const totalPayout = principal + prematureInterest;

    const nowTime = formatDbDateTime();
    const targetAccount = deposit.linked_account;

    const { txnId, referenceNumber } = generateTransactionReference('TXN-LIQ');

    // 4. Atomic Execution
    await db.transaction(async (conn) => {
      // Ensure deposit is still Active
      const [updateDep] = await conn.query(
        `UPDATE deposits SET status = 'Liquidated' WHERE deposit_id = ? AND status = 'Active'`,
        [id]
      );
      const affected = (updateDep as any)?.affectedRows ?? (updateDep as any)?.changes ?? 0;
      if (affected === 0) {
        throw new Error('ALREADY_LIQUIDATED');
      }

      await conn.query('UPDATE accounts SET balance = balance + ? WHERE account_number = ?', [totalPayout, targetAccount]);

      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', ?, ?)`,
        [txnId, targetAccount, totalPayout, nowTime, `Premature Liquidation Refund - ${id} (Principal: ₹${principal} + Net Int: ₹${prematureInterest})`, referenceNumber]
      );

      const auditId = generateAuditId();
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'DEPOSIT_LIQUIDATION', 'DEPOSIT', ?, ?, ?)`,
        [auditId, authUser.customer_id, id, `Liquidated ${id} for ₹${totalPayout} into ${targetAccount}. Ref: ${referenceNumber}`, nowTime]
      );
    });

    const [updatedAccount] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [targetAccount]);
    const cleanAccount = sanitizeAccount(updatedAccount?.[0]);

    return NextResponse.json({
      message: `Deposit ${id} successfully liquidated. ₹${totalPayout.toLocaleString('en-IN')} credited to ${targetAccount}`,
      payout: totalPayout,
      account: cleanAccount,
    });
  } catch (err: any) {
    if (err.message === 'ALREADY_LIQUIDATED') {
      return NextResponse.json({ error: 'This deposit has already been liquidated.' }, { status: 400 });
    }
    console.error('Break deposit error:', err);
    return NextResponse.json({ error: 'Failed to liquidate deposit. Please try again.' }, { status: 500 });
  }
}
