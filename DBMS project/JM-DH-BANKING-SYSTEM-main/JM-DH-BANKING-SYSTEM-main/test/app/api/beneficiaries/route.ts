import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const db = await getDb();
    const [beneficiaries] = await db.query(
      `SELECT * FROM beneficiaries WHERE customer_id = ? ORDER BY created_at DESC`,
      [authUser.customer_id]
    );

    return NextResponse.json({
      beneficiaries: beneficiaries || [],
      total: (beneficiaries || []).length,
    });
  } catch (err: any) {
    console.error('Fetch beneficiaries error:', err);
    return NextResponse.json({ error: 'Failed to fetch saved beneficiaries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json();
    const { beneficiary_name, account_number, ifsc_code, bank_name, transfer_limit } = body;

    if (!beneficiary_name || !beneficiary_name.trim()) {
      return NextResponse.json({ error: 'Beneficiary name is required' }, { status: 400 });
    }

    if (!account_number || !account_number.trim()) {
      return NextResponse.json({ error: 'Beneficiary account number is required' }, { status: 400 });
    }

    const cleanAcc = account_number.trim();
    const cleanIfsc = (ifsc_code || 'BTBI0001024').trim().toUpperCase();

    const db = await getDb();

    // Verify customer is not adding their own account
    const [myAccounts] = await db.query(
      `SELECT account_number FROM accounts WHERE customer_id = ? AND account_number = ?`,
      [authUser.customer_id, cleanAcc]
    );
    if (myAccounts && myAccounts.length > 0) {
      return NextResponse.json({ error: 'You cannot add your own account as a beneficiary.' }, { status: 400 });
    }

    // Check if duplicate
    const [existing] = await db.query(
      `SELECT beneficiary_id FROM beneficiaries WHERE customer_id = ? AND account_number = ?`,
      [authUser.customer_id, cleanAcc]
    );
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'This beneficiary is already registered in your payee list.' }, { status: 400 });
    }

    // Generate unique ID
    const benId = `BEN-${Date.now().toString().slice(-6)}`;
    
    // Set 2 hours security cooling period (allows up to ₹25,000 during cooling for anti-fraud)
    const coolingUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const finalBank = bank_name || 'Bharat Trust Bank';
    const limit = parseFloat(transfer_limit) || 100000.0;

    await db.query(
      `INSERT INTO beneficiaries (beneficiary_id, customer_id, beneficiary_name, account_number, ifsc_code, bank_name, transfer_limit, cooling_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [benId, authUser.customer_id, beneficiary_name.trim(), cleanAcc, cleanIfsc, finalBank, limit, coolingUntil]
    );

    const [created] = await db.query(`SELECT * FROM beneficiaries WHERE beneficiary_id = ?`, [benId]);

    return NextResponse.json({
      message: `Beneficiary "${beneficiary_name.trim()}" registered successfully with a 2-hour security cooling limit.`,
      beneficiary: created[0],
    }, { status: 201 });
  } catch (err: any) {
    console.error('Add beneficiary error:', err);
    return NextResponse.json({ error: err.message || 'Failed to add beneficiary' }, { status: 500 });
  }
}
