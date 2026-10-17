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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const filterType = (searchParams.get('type') || '').trim();
    const filterFlow = (searchParams.get('flow') || '').trim().toLowerCase();
    const searchQuery = (searchParams.get('search') || '').trim().toLowerCase();
    const startDate = (searchParams.get('startDate') || '').trim();
    const endDate = (searchParams.get('endDate') || '').trim();

    const db = await getDb();

    // 1. Fetch user account numbers
    const [userAccounts] = await db.query(
      'SELECT account_number FROM accounts WHERE customer_id = ?',
      [authUser.customer_id]
    );

    if (!userAccounts || userAccounts.length === 0) {
      return NextResponse.json({
        transactions: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }

    const accountNumbers: string[] = userAccounts.map((a: any) => a.account_number);
    const placeholders = accountNumbers.map(() => '?').join(', ');

    // 2. Build parameterized query
    let whereClause = `(t.sender_account IN (${placeholders}) OR t.receiver_account IN (${placeholders}))`;
    const params: any[] = [...accountNumbers, ...accountNumbers];

    if (filterType) {
      whereClause += ` AND t.type = ?`;
      params.push(filterType);
    }

    if (startDate) {
      whereClause += ` AND date(t.date_time) >= date(?)`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND date(t.date_time) <= date(?)`;
      params.push(endDate);
    }

    if (searchQuery) {
      whereClause += ` AND (LOWER(t.description) LIKE ? OR LOWER(t.transaction_id) LIKE ? OR LOWER(COALESCE(t.reference_number, '')) LIKE ?)`;
      params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
    }

    // 3. Count total matching records
    const countSql = `SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`;
    const [countRows] = await db.query(countSql, params);
    const total = countRows[0]?.total || 0;

    // 4. Fetch Paginated Records with Flow calculation
    const querySql = `
      SELECT t.*,
        CASE
          WHEN t.sender_account IN (${placeholders}) AND t.receiver_account IN (${placeholders}) THEN 'Self Transfer'
          WHEN t.receiver_account IN (${placeholders}) THEN 'Credit'
          ELSE 'Debit'
        END AS flow
      FROM transactions t
      WHERE ${whereClause}
      ORDER BY t.date_time DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...accountNumbers, ...accountNumbers, ...params, limit, offset];
    const [transactions] = await db.query(querySql, queryParams);

    // Optional flow filtering in memory if database dialect doesn't support HAVING flow
    let filteredTxns = transactions || [];
    if (filterFlow === 'credit') {
      filteredTxns = filteredTxns.filter((t: any) => t.flow === 'Credit');
    } else if (filterFlow === 'debit') {
      filteredTxns = filteredTxns.filter((t: any) => t.flow === 'Debit');
    }

    return NextResponse.json({
      transactions: filteredTxns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('Get my-transactions error:', err);
    return NextResponse.json({ error: 'Failed to fetch personal transaction ledger' }, { status: 500 });
  }
}
