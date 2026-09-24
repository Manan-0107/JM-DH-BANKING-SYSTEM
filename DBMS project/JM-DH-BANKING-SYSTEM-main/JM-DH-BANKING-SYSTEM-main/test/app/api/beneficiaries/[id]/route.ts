import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const { id } = params;
    const db = await getDb();

    // Verify ownership
    const [rows] = await db.query(
      `SELECT * FROM beneficiaries WHERE beneficiary_id = ? AND customer_id = ?`,
      [id, authUser.customer_id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Beneficiary not found or access denied' }, { status: 404 });
    }

    await db.query(`DELETE FROM beneficiaries WHERE beneficiary_id = ?`, [id]);

    return NextResponse.json({
      message: 'Beneficiary removed from your payee registry.',
    });
  } catch (err: any) {
    console.error('Delete beneficiary error:', err);
    return NextResponse.json({ error: 'Failed to delete beneficiary' }, { status: 500 });
  }
}
