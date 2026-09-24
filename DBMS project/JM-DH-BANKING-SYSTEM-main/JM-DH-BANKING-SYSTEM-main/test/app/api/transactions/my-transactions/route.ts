import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const [userAccounts] = await db.query(
      "SELECT account_number FROM accounts WHERE customer_id = ?",
      [authUser.customer_id]
    );

    if (!userAccounts || userAccounts.length === 0) {
      return NextResponse.json({ transactions: [], total: 0 });
    }

    const accountNumbers: string[] = userAccounts.map((a: any) => a.account_number);
    const placeholders = accountNumbers.map(() => '?').join(', ');

    const querySql = `
      SELECT t.*,
        CASE
          WHEN t.sender_account IN (${placeholders}) AND t.receiver_account IN (${placeholders}) THEN 'Self Transfer'
          WHEN t.receiver_account IN (${placeholders}) THEN 'Credit'
          ELSE 'Debit'
        END AS flow
      FROM transactions t
      WHERE t.sender_account IN (${placeholders}) OR t.receiver_account IN (${placeholders})
      ORDER BY t.date_time DESC
      LIMIT 100
    `;

    const params = [...accountNumbers, ...accountNumbers, ...accountNumbers, ...accountNumbers];
    const [transactions] = await db.query(querySql, params);

    return NextResponse.json({
      transactions: transactions || [],
      total: (transactions || []).length
    });
  } catch (err: any) {
    console.error('Get my-transactions error:', err);
    return NextResponse.json({ error: 'Failed to fetch personal transactions' }, { status: 500 });
  }
}
