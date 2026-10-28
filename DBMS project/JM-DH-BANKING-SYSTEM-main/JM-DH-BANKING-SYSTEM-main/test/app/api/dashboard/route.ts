import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Require Server-Side Authentication
    const auth = requireAuth(request, 'Unauthorized: Session invalid or expired');
    if (auth.errorResponse) {
      return auth.errorResponse;
    }
    const user = auth.user;

    // 2. Enforce Administrative Authorization (Server-Side Role Verification)
    // Possession of an ordinary customer JWT is strictly forbidden from viewing administrative metrics.
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || 'admin@bharatbank.com,admin@btb.internal')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isExplicitAdminRole = user.role === 'admin' || user.role === 'bank_admin';
    const isConfiguredAdminEmail = Boolean(user.email && configuredAdminEmails.includes(user.email.toLowerCase()));

    if (!isExplicitAdminRole && !isConfiguredAdminEmail) {
      return NextResponse.json(
        { error: 'Forbidden: Administrative privilege required to access aggregate bank metrics and audit logs.' },
        { status: 403 }
      );
    }

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

    // 5. Recent system audit logs - Data Minimization:
    // Strip raw customer identifiers and internal detail blobs to protect privacy
    const [recentAudits] = await db.query(`
      SELECT log_id, action, entity_type, timestamp
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
      source: 'MySQL 8.0 Cluster',
    });
  } catch (err: any) {
    console.error('Dashboard Stats API Error:', err);
    return NextResponse.json({ error: 'Failed to calculate administrative metrics' }, { status: 500 });
  }
}
