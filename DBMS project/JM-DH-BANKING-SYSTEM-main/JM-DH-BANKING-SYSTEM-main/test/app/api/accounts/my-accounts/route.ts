import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session expired or invalid' }, { status: 401 });
    }

    const db = await getDb();
    const [accounts] = await db.query(
      "SELECT * FROM accounts WHERE customer_id = ? ORDER BY opening_date DESC",
      [authUser.customer_id]
    );

    return NextResponse.json({
      accounts: accounts || [],
      total: (accounts || []).length
    });
  } catch (err: any) {
    console.error('Get my-accounts error:', err);
    return NextResponse.json({ error: 'Failed to fetch personal accounts' }, { status: 500 });
  }
}
