import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();

    // 1. Customer statistics
    const [custStats] = await db.query(`
      SELECT 
        COUNT(*) as total_customers,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_customers,
        SUM(CASE WHEN kyc_status = 'Verified' THEN 1 ELSE 0 END) as verified_customers
      FROM customers
    `);

    // 2. Account & Liquidity statistics
    const [accStats] = await db.query(`
      SELECT 
        COUNT(*) as total_accounts,
        COALESCE(SUM(balance), 0.00) as total_liquid_balance,
        AVG(balance) as avg_account_balance
      FROM accounts
      WHERE status = 'Active'
    `);

    // 3. Term Deposits portfolio
    const [depStats] = await db.query(`
      SELECT 
        COUNT(*) as total_deposits,
        COALESCE(SUM(principal_amount), 0.00) as total_deposit_principal,
        COALESCE(SUM(maturity_amount), 0.00) as total_maturity_liability
      FROM deposits
      WHERE status = 'Active'
    `);

    // 4. Ledger & Transaction velocity
    const [txStats] = await db.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0.00) as total_transaction_volume,
        SUM(CASE WHEN type = 'Transfer' THEN 1 ELSE 0 END) as transfer_count,
        SUM(CASE WHEN type = 'Deposit' THEN 1 ELSE 0 END) as deposit_count,
        SUM(CASE WHEN type = 'Withdrawal' THEN 1 ELSE 0 END) as withdrawal_count
      FROM transactions
      WHERE status = 'Success'
    `);

    // 5. Recent system audit logs
    const [recentAudits] = await db.query(`
      SELECT log_id, customer_id, action, entity_type, details, timestamp
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    return NextResponse.json({
      metrics: {
        customers: custStats[0] || {},
        accounts: accStats[0] || {},
        deposits: depStats[0] || {},
        transactions: txStats[0] || {},
      },
      recent_audits: recentAudits || [],
      calculated_at: new Date().toISOString(),
      source: db.isSqlite ? 'SQLite Embedded Database' : 'MySQL 8.0 Cluster',
    });
  } catch (err: any) {
    console.error('Dashboard Stats API Error:', err);
    return NextResponse.json({ error: 'Failed to calculate administrative metrics' }, { status: 500 });
  }
}
