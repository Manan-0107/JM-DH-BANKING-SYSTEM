const path = require('path');
const TEST_DIR = path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));
const fs = require('fs');

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const testDb = 'bankist_opt_eval_' + Date.now();

  const conn = await mysql.createConnection({
    host, port, user, password,
    multipleStatements: true
  });

  try {
    await conn.query(`CREATE DATABASE \`${testDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${testDb}\``);

    // Load schema and migration
    const ddl = fs.readFileSync(path.resolve(__dirname, '../DBMS project/bankist_normalized.sql'), 'utf8');
    await conn.query(ddl);

    const migration = fs.readFileSync(path.resolve(__dirname, '../DBMS project/bankist_migration.sql'), 'utf8');
    await conn.query(`SET @MIGRATION_SRC_DB = 'bankist';`);
    await conn.query(migration);

    console.log(`[OPTIMIZATION AUDIT] Test database ${testDb} populated.`);

    const queries = [
      {
        name: 'Q1: Customer Account & Card Authentication Join',
        sql: `EXPLAIN ANALYZE SELECT a.account_number, a.customer_id, a.account_type, a.balance, c.card_pin_hash, c.status 
              FROM accounts a 
              JOIN account_card_credentials c ON a.account_number = c.account_number 
              WHERE a.account_number = 'ACC-772910'`
      },
      {
        name: 'Q2: Paginated Transaction Ledger by Account',
        sql: `EXPLAIN ANALYZE SELECT transaction_id, sender_account, receiver_account, amount, channel, date_time 
              FROM transactions 
              WHERE sender_account = 'ACC-772910' OR receiver_account = 'ACC-772910' 
              ORDER BY date_time DESC LIMIT 10`
      },
      {
        name: 'Q3: Customer Portfolio Aggregation View',
        sql: `EXPLAIN ANALYZE SELECT customer_id, full_name, total_liquid_balance, total_deposits_principal, total_net_worth 
              FROM v_customer_portfolio 
              WHERE customer_id = 'CUST-101'`
      },
      {
        name: 'Q4: Strict Mode Customer Nominee Projection View',
        sql: `EXPLAIN ANALYZE SELECT customer_id, full_name, nominee_name, nominee_relation, nominee_dob 
              FROM v_customers_legacy 
              WHERE customer_id = 'CUST-107'`
      },
      {
        name: 'Q5: Active Lien Check for Over-Withdrawal Protection',
        sql: `EXPLAIN ANALYZE SELECT lien_id, lien_amount, lien_reason 
              FROM account_lien_records 
              WHERE account_number = 'ACC-772910'`
      },
      {
        name: 'Q6: Active Beneficiary Payee Lookup',
        sql: `EXPLAIN ANALYZE SELECT beneficiary_id, beneficiary_name, account_number, transfer_limit 
              FROM beneficiaries 
              WHERE customer_id = 'CUST-101' AND is_active = 1`
      }
    ];

    const results = [];
    for (const q of queries) {
      const [rows] = await conn.query(q.sql);
      const plan = rows.map(r => Object.values(r)[0]).join('\n');
      console.log(`\n=== ${q.name} ===`);
      console.log(plan);
      results.push({ name: q.name, plan });
    }

    // Inspect index utilization
    const [indexStats] = await conn.query(`
      SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = '${testDb}' 
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `);
    console.log(`\n[INDEX STATS] Total indexes in normalized schema: ${indexStats.length}`);

    const scratchDir = path.resolve(__dirname, '../scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

    fs.writeFileSync(
      path.resolve(scratchDir, 'query_optimization_results.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), queries: results, index_count: indexStats.length }, null, 2),
      'utf8'
    );
  } finally {
    await conn.query(`DROP DATABASE IF EXISTS \`${testDb}\``);
    await conn.end();
    console.log(`\n[OPTIMIZATION AUDIT] Test database ${testDb} dropped.`);
  }
}

main().catch(err => {
  console.error('[OPTIMIZATION ERROR]', err);
  process.exit(1);
});
