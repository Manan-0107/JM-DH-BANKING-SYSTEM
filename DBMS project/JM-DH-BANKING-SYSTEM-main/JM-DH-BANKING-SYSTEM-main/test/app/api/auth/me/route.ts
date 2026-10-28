import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth, sanitizeCustomer, sanitizeAccounts } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request, 'Unauthorized: Valid token required');
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const db = await getDb();
    const [custRows] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [authUser.customer_id]);
    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (custRows[0].status !== 'Active') {
      const currentStatus = (custRows[0].status || 'inactive').toLowerCase();
      return NextResponse.json({ error: `Account is currently ${currentStatus}` }, { status: 403 });
    }

    const customer = sanitizeCustomer(custRows[0]);

    const [accounts] = await db.query(
      'SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC',
      [customer!.customer_id]
    );

    const sanitizedAccounts = sanitizeAccounts(accounts);

    return NextResponse.json({
      customer,
      accounts: sanitizedAccounts,
    });
  } catch (err: any) {
    console.error('Get me error:', err);
    return NextResponse.json({ error: 'Failed to fetch user session' }, { status: 500 });
  }
}
