import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { pin } = body;

    const db = await getDb();

    // Verify deposit ownership
    const [depRows] = await db.query(
      `SELECT * FROM deposits WHERE deposit_id = ? AND customer_id = ?`,
      [id, authUser.customer_id]
    );

    if (!depRows || depRows.length === 0) {
      return NextResponse.json({ error: 'Deposit certificate not found or unauthorized' }, { status: 404 });
    }

    const deposit = depRows[0];
    if (deposit.status !== 'Active') {
      return NextResponse.json({ error: `This deposit is already ${deposit.status.toLowerCase()}.` }, { status: 400 });
    }

    // Verify PIN if provided
    const [custRows] = await db.query(`SELECT password_hash, card_pin FROM customers WHERE customer_id = ?`, [authUser.customer_id]);
    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'Customer verification failed' }, { status: 404 });
    }

    const providedPin = (pin || '').trim();
    if (providedPin) {
      const matchesCardPin = custRows[0].card_pin && custRows[0].card_pin === providedPin;
      const matchesPassword = bcrypt.compareSync(providedPin, custRows[0].password_hash);
      if (!matchesCardPin && !matchesPassword) {
        return NextResponse.json({ error: 'Invalid PIN entered for liquidation' }, { status: 401 });
      }
    }

    // Payout calculation: Principal + proportional interest (less 0.5% premature penalty)
    const principal = parseFloat(deposit.principal_amount);
    const nominalRate = Math.max(3.5, parseFloat(deposit.interest_rate) - 0.5); // Penalty deducted
    const prematureInterest = Math.round((principal * (nominalRate / 100) * 0.5) * 100) / 100; // simulated 6-mo accrual
    const totalPayout = principal + prematureInterest;

    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const targetAccount = deposit.linked_account;

    await db.transaction(async (conn) => {
      // 1. Mark deposit as Liquidated
      await conn.query(`UPDATE deposits SET status = 'Liquidated' WHERE deposit_id = ?`, [id]);

      // 2. Credit payout back to linked account
      await conn.query(`UPDATE accounts SET balance = balance + ? WHERE account_number = ?`, [totalPayout, targetAccount]);

      // 3. Record transaction in ledger
      const txnId = `TXN-${Date.now().toString().slice(-8)}`;
      await conn.query(
        `INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description)
         VALUES (?, NULL, ?, ?, 'Deposit', ?, 'Success', ?)`,
        [txnId, targetAccount, totalPayout, nowTime, `Premature Liquidation Refund - ${id} (Principal: ₹${principal} + Net Int: ₹${prematureInterest})`]
      );
    });

    const [updatedAccount] = await db.query(`SELECT * FROM accounts WHERE account_number = ?`, [targetAccount]);

    return NextResponse.json({
      message: `Deposit ${id} successfully liquidated. ₹${totalPayout.toLocaleString('en-IN')} credited to ${targetAccount}`,
      payout: totalPayout,
      account: updatedAccount[0],
    });
  } catch (err: any) {
    console.error('Break deposit error:', err);
    return NextResponse.json({ error: err.message || 'Failed to liquidate deposit' }, { status: 500 });
  }
}
