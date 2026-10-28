import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth, sanitizeAccounts } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request, 'Unauthorized: Session expired or invalid');
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const db = await getDb();
    const [accounts] = await db.query(
      `SELECT a.*, b.branch_name, b.bank_name, b.city AS branch_city 
       FROM accounts a 
       LEFT JOIN branches b ON a.ifsc_code = b.ifsc_code 
       WHERE a.customer_id = ? 
       ORDER BY a.opening_date DESC`,
      [authUser.customer_id]
    );

    const sanitizedAccounts = sanitizeAccounts(accounts);

    return NextResponse.json({
      accounts: sanitizedAccounts,
      total: sanitizedAccounts.length,
    });
  } catch (err: any) {
    console.error('Get my-accounts error:', err);
    return NextResponse.json({ error: 'Failed to fetch personal accounts' }, { status: 500 });
  }
}
