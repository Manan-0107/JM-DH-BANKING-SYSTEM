import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json();
    const { account_number, amount, payer_vpa, payer_name, remarks } = body;

    if (!account_number) {
      return NextResponse.json({ error: 'Account number is required' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Transfer amount must be a positive number' }, { status: 400 });
    }

    if (numAmount > 100000) {
      return NextResponse.json({ error: 'NPCI UPI single-transaction limit is ₹1,00,000' }, { status: 400 });
    }

    const db = await getDb();

    // Verify recipient account exists and belongs to authenticated user
    const [accRows] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [account_number]);
    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = accRows[0];
    if (account.customer_id !== authUser.customer_id) {
      return NextResponse.json({ error: 'Access Denied: You cannot receive into an account you do not own.' }, { status: 403 });
    }

    if (account.status !== 'Active') {
      return NextResponse.json({ error: 'Account is currently frozen or inactive. Please unfreeze before receiving funds.' }, { status: 400 });
    }

    // Generate authentic Indian NPCI UPI UTR (12 digits) and TXN ID
    const randomRrnSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const utr = `4256${randomRrnSuffix}`;
    const txnId = `TXN-UPI${Date.now().toString().slice(-8)}`;

    const vpa = payer_vpa || 'payer@okhdfcbank';
    const senderName = payer_name || 'Simulated UPI Payer';
    const note = remarks ? remarks.trim() : 'Instant UPI Payment';
    const description = `UPI Credit: ${note} (from ${senderName} [${vpa}] | UTR: ${utr})`;

    // Run database updates in transaction
    const result = await db.transaction(async (conn) => {
      // 1. Credit account balance
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE account_number = ?', [numAmount, account_number]);

      // 2. Insert transaction entry
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, status, description)
         VALUES (?, ?, ?, ?, 'Deposit', 'Success', ?)`,
        [txnId, vpa, account_number, numAmount, description]
      );

      // 3. Fetch new balance
      const [updatedAccRows] = await conn.query('SELECT balance FROM accounts WHERE account_number = ?', [account_number]);
      return {
        newBalance: updatedAccRows[0]?.balance ?? (parseFloat(account.balance) + numAmount),
      };
    });

    return NextResponse.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} received successfully via UPI!`,
      utr,
      transaction_id: txnId,
      new_balance: result.newBalance,
      payer_vpa: vpa,
      payer_name: senderName,
      amount: numAmount,
    });
  } catch (error: any) {
    console.error('UPI Receive Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error during UPI transaction' }, { status: 500 });
  }
}
