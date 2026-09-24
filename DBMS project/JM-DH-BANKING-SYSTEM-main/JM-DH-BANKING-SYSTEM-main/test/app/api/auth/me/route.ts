import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Valid token required' }, { status: 401 });
    }

    const db = await getDb();
    const [custRows] = await db.query("SELECT * FROM customers WHERE customer_id = ?", [authUser.customer_id]);
    if (!custRows || custRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const customer = custRows[0];
    delete customer.password_hash;

    const [accounts] = await db.query(
      "SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC",
      [customer.customer_id]
    );

    return NextResponse.json({
      customer,
      accounts: accounts || []
    });
  } catch (err: any) {
    console.error('Get me error:', err);
    return NextResponse.json({ error: 'Failed to fetch user session' }, { status: 500 });
  }
}
