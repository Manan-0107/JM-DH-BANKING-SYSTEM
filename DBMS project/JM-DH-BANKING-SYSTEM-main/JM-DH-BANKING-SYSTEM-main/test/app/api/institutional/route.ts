import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();

    // 1. Fetch branches from relational database table
    const [branchRows] = await db.query(
      `SELECT branch_id, branch_name as name, ifsc_code as ifsc, city, address, timing, phone 
       FROM branches 
       WHERE status = 'Active' 
       ORDER BY city ASC`
    );

    return NextResponse.json({
      branches: branchRows || [],
      deposit_rates: [
        { tenure: '7 - 45 Days', general_rate: 3.50, senior_rate: 4.00 },
        { tenure: '46 - 179 Days', general_rate: 4.75, senior_rate: 5.25 },
        { tenure: '180 - 210 Days', general_rate: 6.00, senior_rate: 6.50 },
        { tenure: '211 - 364 Days', general_rate: 6.25, senior_rate: 6.75 },
        { tenure: '1 Year - < 2 Years', general_rate: 7.50, senior_rate: 8.00 },
        { tenure: '2 Years - < 3 Years', general_rate: 7.25, senior_rate: 7.75 },
        { tenure: '3 Years - 5 Years', general_rate: 7.00, senior_rate: 7.50 },
        { tenure: '5 Years - 10 Years', general_rate: 6.80, senior_rate: 7.30 },
      ],
      disclaimer: 'Institutional directory data served directly from relational database.',
    });
  } catch (err: any) {
    console.error('Institutional API error:', err);
    return NextResponse.json({ error: 'Failed to fetch institutional catalog' }, { status: 500 });
  }
}
