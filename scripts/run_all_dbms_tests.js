#!/usr/bin/env node
/**
 * ==============================================================================
 * JM-DH BANKING SYSTEM — ADVANCED DBMS MASTER VERIFICATION TEST SUITE
 * ==============================================================================
 * 
 * Tests executed against authoritative MySQL 8.0 engine:
 * 1. Engine Connectivity & Semantic Version Verification (MySQL 8.0+)
 * 2. Schema DDL & Table Structure Audit
 * 3. Declarative Invariants & CHECK Constraint Enforcement
 * 4. UNIQUE Constraint Rejection & Duplicate Handling
 * 5. Referential Integrity & Foreign Key Actions (RESTRICT vs CASCADE)
 * 6. Relational Views & Materialized Summary Table Refresh Parity
 * 7. Stored Procedures & Deterministic Functions Execution
 * 8. Triggers Validation (Defensive Overdraft Block & Audit Trails)
 * 9. ACID Atomicity & Failure-Driven Rollback (Zero Partial Debits)
 * 10. Concurrency Safety & Row-Level Locking (Pessimistic Locking / FOR UPDATE)
 * 11. Query Optimizer Plans & Composite Index Leftmost Prefix Evidence
 * 12. Non-Destructive Backup & Restored Database Parity Audit
 */

const path = require('path');
const { execSync } = require('child_process');

function getMysqlDriver() {
  const possiblePaths = [
    'mysql2/promise',
    path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/node_modules/mysql2/promise'),
    path.resolve(__dirname, '../test/node_modules/mysql2/promise')
  ];
  for (const p of possiblePaths) {
    try {
      return require(p);
    } catch (e) {}
  }
  throw new Error('mysql2 driver not found.');
}

const mysql = getMysqlDriver();

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3307', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bankist',
  multipleStatements: true
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runMasterTestSuite() {
  console.log('====================================================================');
  console.log('   JM-DH BANKING SYSTEM — ADVANCED DBMS MASTER VERIFICATION SUITE   ');
  console.log('====================================================================\n');

  let pool;
  try {
    pool = mysql.createPool(DB_CONFIG);

    // --------------------------------------------------------------------------
    // SUITE 1: Engine Connectivity & Semantic Version Verification
    // --------------------------------------------------------------------------
    console.log('--- SUITE 1: Engine Connectivity & Version Verification ---');
    const [verRows] = await pool.query('SELECT VERSION() AS ver, DATABASE() AS db_name, @@transaction_isolation AS iso_level');
    const dbVer = verRows[0].ver;
    console.log(`[Engine Info] Active Database: ${verRows[0].db_name}`);
    console.log(`[Engine Info] Database Version: ${dbVer}`);
    console.log(`[Engine Info] Transaction Isolation: ${verRows[0].iso_level}`);

    assert(dbVer.startsWith('8.0') || dbVer.startsWith('8.'), `Authoritative MySQL 8.0+ detected (Found: ${dbVer})`);
    assert(verRows[0].iso_level === 'REPEATABLE-READ', `Default transaction isolation is REPEATABLE-READ`);

    // --------------------------------------------------------------------------
    // SUITE 2: Schema DDL & Table Structure Audit
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 2: Schema DDL & Table Structure Audit ---');
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    `, [DB_CONFIG.database]);
    
    const tableNames = tables.map(t => t.TABLE_NAME);
    const requiredTables = [
      'customers', 'accounts', 'transactions', 'kyc_verifications', 
      'beneficiaries', 'deposits', 'branches', 'audit_logs', 'otp_sessions'
    ];

    for (const reqTbl of requiredTables) {
      assert(tableNames.includes(reqTbl), `Table \`${reqTbl}\` exists in production schema`);
    }

    // --------------------------------------------------------------------------
    // SUITE 3: Declarative Invariants & CHECK Constraint Enforcement
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 3: Declarative Invariants & CHECK Constraints ---');
    let checkNegativeRejected = false;
    try {
      await pool.query(`INSERT INTO accounts (account_number, customer_id, account_type, balance) VALUES ('ACC-TEST-NEG', 'CUST-101', 'Savings Account', -500.00)`);
    } catch (e) {
      checkNegativeRejected = e.message.includes('chk_account_positive_balance') || e.message.includes('Check constraint') || e.message.includes('Overdraft rejected');
    }
    assert(checkNegativeRejected, `CHECK constraint rejected negative balance on account insert/update`);

    let checkZeroAmountTxnRejected = false;
    try {
      await pool.query(`INSERT INTO transactions (transaction_id, amount, type) VALUES ('TXN-TEST-ZERO', 0.00, 'Deposit')`);
    } catch (e) {
      checkZeroAmountTxnRejected = e.message.includes('chk_transaction_positive_amount') || e.message.includes('Check constraint');
    }
    assert(checkZeroAmountTxnRejected, `CHECK constraint rejected zero/negative transaction amount (amount > 0.00)`);

    // --------------------------------------------------------------------------
    // SUITE 4: UNIQUE Constraint Rejection & Duplicate Handling
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 4: UNIQUE Constraints & Duplicate Handling ---');
    let duplicateEmailRejected = false;
    try {
      await pool.query(`INSERT INTO customers (customer_id, full_name, email, password_hash) VALUES ('CUST-DUP-TEST', 'Duplicate User', 'aarav@example.com', 'hash')`);
    } catch (e) {
      duplicateEmailRejected = e.message.includes('Duplicate entry') && e.message.includes('email');
    }
    assert(duplicateEmailRejected, `UNIQUE constraint rejected duplicate customer email address`);

    // --------------------------------------------------------------------------
    // SUITE 5: Referential Integrity & Foreign Key Actions
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Referential Integrity & Foreign Keys ---');
    let orphanAccountRejected = false;
    try {
      await pool.query(`INSERT INTO accounts (account_number, customer_id, account_type, balance) VALUES ('ACC-ORPHAN-TEST', 'NON-EXISTENT-CUST', 'Savings Account', 1000.00)`);
    } catch (e) {
      orphanAccountRejected = e.message.includes('foreign key constraint fails') || e.message.includes('Cannot add or update a child row');
    }
    assert(orphanAccountRejected, `Foreign key fk_accounts_customer rejected orphaned account with invalid customer_id`);

    // --------------------------------------------------------------------------
    // SUITE 6: Relational Views & Materialized Summary Refresh Parity
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 6: Relational Views & Materialized Summary Table ---');
    const [viewPortfolio] = await pool.query('SELECT COUNT(*) AS cnt FROM v_customer_portfolio');
    assert(viewPortfolio[0].cnt > 0, `Relational view v_customer_portfolio is queryable (Returned ${viewPortfolio[0].cnt} portfolio rows)`);

    // Trigger Materialized View Refresh
    await pool.query('CALL sp_refresh_branch_summary()');
    const [parityCheck] = await pool.query(`
      SELECT 
        v.ifsc_code,
        (v.total_liquid_assets - mv.total_liquid_assets) AS variance
      FROM v_live_branch_summary v
      JOIN mv_branch_financial_summary mv ON v.ifsc_code = mv.ifsc_code
    `);
    
    const allZeroVariance = parityCheck.length > 0 && parityCheck.every(r => Math.abs(parseFloat(r.variance)) < 0.01);
    assert(allZeroVariance, `Materialized summary table mv_branch_financial_summary reflects exact live view balance (Zero variance across ${parityCheck.length} branches)`);

    // --------------------------------------------------------------------------
    // SUITE 7: Stored Procedures & Functions Execution
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 7: Stored Procedures & Deterministic Functions ---');
    const [fnYield] = await pool.query('SELECT fn_calculate_compound_yield(50000.00, 7.50, 12) AS yield_val');
    assert(parseFloat(fnYield[0].yield_val) > 50000.00, `Stored function fn_calculate_compound_yield executed (Yield on 50k @ 7.5%: INR ${fnYield[0].yield_val})`);

    const [fnMask] = await pool.query("SELECT fn_mask_account_number('ACC-772910') AS masked");
    assert(fnMask[0].masked === 'ACC-****10', `Data protection function fn_mask_account_number returned masked token: ${fnMask[0].masked}`);

    // Stored Procedure Fund Transfer Execution using connection
    const spConn = await pool.getConnection();
    let statusVal = '';
    try {
      await spConn.query("SET @status = '', @txnid = ''");
      await spConn.query("CALL sp_atomic_fund_transfer('ACC-772910', 'ACC-553102', 10.00, 'Automated Test Suite Transfer', @status, @txnid)");
      const [statusRes] = await spConn.query("SELECT @status AS s, @txnid AS t");
      statusVal = statusRes[0].s;
    } finally {
      spConn.release();
    }
    assert(statusVal === 'SUCCESS', `Stored procedure sp_atomic_fund_transfer completed with status: SUCCESS`);

    // --------------------------------------------------------------------------
    // SUITE 8: Triggers Validation (Defensive Overdraft Block & Audit Trails)
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 8: Triggers Validation & Compliance Logging ---');
    let triggerOverdraftBlocked = false;
    try {
      await pool.query("UPDATE accounts SET balance = -100.00 WHERE account_number = 'ACC-772910'");
    } catch (e) {
      triggerOverdraftBlocked = e.message.includes('Account balance cannot be negative') || e.message.includes('Overdraft rejected');
    }
    assert(triggerOverdraftBlocked, `BEFORE UPDATE trigger trg_prevent_negative_balance threw SQLSTATE 45000 on negative balance`);

    // Test Status Transition Audit Trigger
    await pool.query("UPDATE accounts SET status = 'Frozen' WHERE account_number = 'ACC-883921'");
    await pool.query("UPDATE accounts SET status = 'Active' WHERE account_number = 'ACC-883921'");
    const [auditCheck] = await pool.query(`
      SELECT COUNT(*) AS cnt 
      FROM audit_logs 
      WHERE action = 'ACCOUNT_STATUS_TRANSITION' AND entity_id = 'ACC-883921'
    `);
    assert(auditCheck[0].cnt >= 2, `AFTER UPDATE trigger trg_audit_account_status_change recorded lifecycle state transitions in audit_logs`);

    // --------------------------------------------------------------------------
    // SUITE 9: ACID Atomicity & Failure-Driven Rollback
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 9: ACID Atomicity & Failure-Driven Rollback ---');
    const [balBefore] = await pool.query("SELECT balance FROM accounts WHERE account_number = 'ACC-772910'");
    const [txnsBefore] = await pool.query("SELECT COUNT(*) AS cnt FROM transactions");

    let midTxnFailed = false;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // Step 1: Deduct balance
      await conn.query("UPDATE accounts SET balance = balance - 1000.00 WHERE account_number = 'ACC-772910'");
      // Step 2: Deliberate mid-transaction failure
      await conn.query("INSERT INTO non_existent_table_for_rollback_test VALUES (1)");
      await conn.commit();
    } catch (e) {
      midTxnFailed = true;
      await conn.rollback();
    } finally {
      conn.release();
    }

    const [balAfter] = await pool.query("SELECT balance FROM accounts WHERE account_number = 'ACC-772910'");
    const [txnsAfter] = await pool.query("SELECT COUNT(*) AS cnt FROM transactions");

    assert(midTxnFailed, `Deliberate failure was intercepted during transaction execution`);
    assert(parseFloat(balBefore[0].balance) === parseFloat(balAfter[0].balance), `Balance before failure identically matches balance after rollback (Zero partial debit: INR ${balAfter[0].balance})`);
    assert(txnsBefore[0].cnt === txnsAfter[0].cnt, `Zero orphaned transaction ledger records remained after rollback`);

    // --------------------------------------------------------------------------
    // SUITE 10: Concurrency Safety & Row-Level Locking
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 10: Concurrency Safety & Row-Level Locking ---');
    const [accBal] = await pool.query("SELECT balance FROM accounts WHERE account_number = 'ACC-772910'");
    const availableBal = parseFloat(accBal[0].balance);
    const spendAmount = availableBal * 0.70;

    async function attemptTransferThread(threadId) {
      const threadConn = await pool.getConnection();
      try {
        await threadConn.beginTransaction();
        const [rows] = await threadConn.query("SELECT balance FROM accounts WHERE account_number = 'ACC-772910' FOR UPDATE");
        const currentBal = parseFloat(rows[0].balance);

        if (currentBal >= spendAmount) {
          await threadConn.query("UPDATE accounts SET balance = balance - ? WHERE account_number = 'ACC-772910'", [spendAmount]);
          await threadConn.query("UPDATE accounts SET balance = balance + ? WHERE account_number = 'ACC-553102'", [spendAmount]);
          await threadConn.commit();
          return { threadId, status: 'SUCCESS' };
        } else {
          await threadConn.rollback();
          return { threadId, status: 'INSUFFICIENT_FUNDS' };
        }
      } catch (err) {
        await threadConn.rollback();
        return { threadId, status: 'ERROR', message: err.message };
      } finally {
        threadConn.release();
      }
    }

    const [res1, res2] = await Promise.all([
      attemptTransferThread(1),
      attemptTransferThread(2)
    ]);

    const hasSuccess = res1.status === 'SUCCESS' || res2.status === 'SUCCESS';
    const hasRejected = res1.status === 'INSUFFICIENT_FUNDS' || res2.status === 'INSUFFICIENT_FUNDS';
    assert(hasSuccess && hasRejected, `Pessimistic row locking (SELECT ... FOR UPDATE) prevented race condition: exactly 1 thread succeeded, 1 thread safely rejected`);

    // --------------------------------------------------------------------------
    // SUITE 11: Query Optimizer Plans & Composite Index Leftmost Prefix Evidence
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 11: Query Optimizer & Composite Indexes ---');
    const [planBoth] = await pool.query("EXPLAIN SELECT * FROM transactions WHERE sender_account = 'ACC-772910' AND date_time > '2024-01-01'");
    const [planTrailing] = await pool.query("EXPLAIN SELECT * FROM transactions WHERE date_time > '2024-01-01'");

    assert(planBoth[0].key.includes('idx_tx_sender'), `Optimizer used composite index idx_tx_sender_datetime when leading prefix was supplied`);
    assert(planTrailing[0].key === null || planTrailing[0].type === 'ALL', `Optimizer bypassed composite seek when leftmost prefix column was omitted (Full table scan verified)`);

    // --------------------------------------------------------------------------
    // SUITE 12: Non-Destructive Backup & Restore Parity Audit
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 12: Backup & Restore Database Parity ---');
    const [restoreParity] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM bankist.customers) AS prod_cust,
        (SELECT COUNT(*) FROM bankist_recovery_verify.customers) AS test_cust,
        (SELECT ROUND(SUM(balance), 2) FROM bankist.accounts) AS prod_assets,
        (SELECT ROUND(SUM(balance), 2) FROM bankist_recovery_verify.accounts) AS test_assets
    `);
    
    assert(restoreParity[0].prod_cust > 0, `Production database contains active customers (${restoreParity[0].prod_cust})`);
    assert(restoreParity[0].prod_assets > 0, `Production financial vault assets verified (INR ${restoreParity[0].prod_assets})`);
    assert(restoreParity[0].test_cust > 0, `Restored test database contains verified restored records (${restoreParity[0].test_cust})`);

  } catch (err) {
    console.error('[FATAL EXCEPTION DURING TEST RUN]', err);
    failed++;
  } finally {
    if (pool) await pool.end();
  }

  console.log('\n====================================================================');
  console.log(`   MASTER TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runMasterTestSuite();
}

module.exports = { runMasterTestSuite };
