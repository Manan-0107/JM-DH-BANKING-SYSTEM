import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth, verifyAccountOwnership, sanitizeAccount } from '@/lib/api-helpers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(request, 'Unauthorized');
    if (auth.errorResponse) return auth.errorResponse;
    const authUser = auth.user;

    const accountId = params.id;
    const db = await getDb();

    const accCheck = await verifyAccountOwnership(db, accountId, authUser.customer_id);
    if (accCheck.errorResponse) return accCheck.errorResponse;
    const account = accCheck.account;

    const newStatus = account.status === 'Frozen' ? 'Active' : 'Frozen';
    await db.query('UPDATE accounts SET status = ? WHERE account_number = ?', [newStatus, accountId]);

    const [updated] = await db.query('SELECT * FROM accounts WHERE account_number = ?', [accountId]);
    const cleanAccount = sanitizeAccount(updated?.[0]);

    return NextResponse.json({
      message: `Card and account status changed to ${newStatus}`,
      account: cleanAccount,
    });
  } catch (err: any) {
    console.error('Freeze toggle error:', err);
    return NextResponse.json({ error: 'Failed to update account status' }, { status: 500 });
  }
}
