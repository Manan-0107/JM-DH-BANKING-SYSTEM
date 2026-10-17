import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, verifyTransactionPin, generateTransactionReference } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid or expired' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { from_account, to_account, amount, description, pin } = body;

    // 1. Strict Input Validation
    if (!from_account || typeof from_account !== 'string' || !from_account.trim()) {
      return NextResponse.json({ error: 'Sender account number is required' }, { status: 400 });
    }

    if (!to_account || typeof to_account !== 'string' || !to_account.trim()) {
      return NextResponse.json({ error: 'Beneficiary account number is required' }, { status: 400 });
    }

    const cleanFrom = from_account.trim();
    const cleanTo = to_account.trim();

    if (cleanFrom === cleanTo) {
      return NextResponse.json({ error: 'Sender and beneficiary accounts cannot be identical' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Transfer amount must be a positive number' }, { status: 400 });
    }

    if (numAmount > 500000) {
      return NextResponse.json({ error: 'Maximum IMPS transfer limit is ₹5,00,000 per transaction' }, { status: 400 });
    }

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return NextResponse.json({ error: 'Debit Card 4-Digit PIN is required for authorization' }, { status: 400 });
    }

    const db = await getDb();

    // 2. Sender Account Ownership & Status Verification
    const [senderRows] = await db.query(
      'SELECT account_number, customer_id, balance, status FROM accounts WHERE account_number = ?',
      [cleanFrom]
    );

    if (!senderRows || senderRows.length === 0) {
      return NextResponse.json({ error: 'Sender account not found' }, { status: 404 });
    }

    const senderAcc = senderRows[0];
    if (senderAcc.customer_id !== authUser.customer_id) {
      return NextResponse.json({ error: 'Access Denied: You can only transfer funds from your own verified account.' }, { status: 403 });
    }

    if (senderAcc.status !== 'Active') {
      return NextResponse.json({ error: `Sender account is currently ${senderAcc.status.toLowerCase()}. Please unfreeze before transacting.` }, { status: 400 });
    }

    if (parseFloat(senderAcc.balance) < numAmount) {
      return NextResponse.json({
        error: `Insufficient funds. Available balance: ₹${parseFloat(senderAcc.balance).toLocaleString('en-IN')}`,
      }, { status: 400 });
    }

    // 3. Beneficiary Account Existence & Status Verification
    const [receiverRows] = await db.query(
      'SELECT account_number, status, customer_id FROM accounts WHERE account_number = ?',
      [cleanTo]
    );

    if (!receiverRows || receiverRows.length === 0) {
      return NextResponse.json({ error: 'Beneficiary account not found. Please verify the account number.' }, { status: 404 });
    }

    const receiverAcc = receiverRows[0];
    if (receiverAcc.status !== 'Active') {
      return NextResponse.json({ error: 'Beneficiary account is currently inactive.' }, { status: 400 });
    }

    // 4. Verify Customer PIN or NetBanking Password
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

    // 5. Generate Collision-Proof Transaction Reference
    const { txnId, referenceNumber } = generateTransactionReference('TXN');
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const finalDesc = description ? description.trim() : `IMPS Fund Transfer to ${cleanTo}`;

    // 6. Execute Concurrency-Safe Atomic Transfer
    await db.transaction(async (conn) => {
      // Conditional atomic debit: prevents race condition / negative balance under concurrent requests
      const [debitResult] = await conn.query(
        'UPDATE accounts SET balance = balance - ? WHERE account_number = ? AND balance >= ? AND status = ?',
        [numAmount, cleanFrom, numAmount, 'Active']
      );

      const affected = (debitResult as any)?.affectedRows ?? (debitResult as any)?.changes ?? 0;
      if (affected === 0) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      // Credit receiver account
      await conn.query(
        'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
        [numAmount, cleanTo]
      );

      // Insert transaction ledger record
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number)
         VALUES (?, ?, ?, ?, 'Transfer', ?, 'Success', ?, ?)`,
        [txnId, cleanFrom, cleanTo, numAmount, nowTime, finalDesc, referenceNumber]
      );

      // Record administrative audit trail
      const auditId = `AUD-${Date.now().toString().slice(-6)}`;
      await conn.query(
        `INSERT INTO audit_logs (log_id, customer_id, action, entity_type, entity_id, details, timestamp)
         VALUES (?, ?, 'FUND_TRANSFER', 'TRANSACTION', ?, ?, ?)`,
        [auditId, authUser.customer_id, txnId, `Transferred ₹${numAmount} from ${cleanFrom} to ${cleanTo}. Ref: ${referenceNumber}`, nowTime]
      );
    });

    // Fetch updated sender account
    const [updatedSender] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [cleanFrom]);

    return NextResponse.json({
      message: `₹${numAmount.toLocaleString('en-IN')} transferred successfully to ${cleanTo}`,
      transaction: {
        transaction_id: txnId,
        reference_number: referenceNumber,
        sender_account: cleanFrom,
        receiver_account: cleanTo,
        amount: numAmount,
        type: 'Transfer',
        date_time: nowTime,
        status: 'Success',
        description: finalDesc,
      },
      sender: updatedSender[0],
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Transfer failed: Insufficient account balance or concurrent transaction update.' }, { status: 400 });
    }
    console.error('Transfer API Error:', err);
    return NextResponse.json({ error: 'Unable to process fund transfer. Please try again.' }, { status: 500 });
  }
}
