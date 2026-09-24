import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;
    const db = await getDb();

    const [accRows] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [accountId]);
    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = accRows[0];
    if (account.customer_id !== authUser.customer_id) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
    }

    const newStatus = account.status === 'Frozen' ? 'Active' : 'Frozen';
    await db.query("UPDATE accounts SET status = ? WHERE account_number = ?", [newStatus, accountId]);

    const [updated] = await db.query("SELECT * FROM accounts WHERE account_number = ?", [accountId]);

    return NextResponse.json({
      message: `Card and account status changed to ${newStatus}`,
      account: updated[0]
    });
  } catch (err: any) {
    console.error('Freeze toggle error:', err);
    return NextResponse.json({ error: 'Failed to update account status' }, { status: 500 });
  }
}
