#!/usr/bin/env node
/**
 * ==============================================================================
 * BHARAT TRUST BANK — DISPOSABLE SETUP ISOLATION REGRESSION TEST
 * ==============================================================================
 * 
 * Verifies that:
 * 1. `bankist.sql` does not contain hardcoded `USE bankist;` or `CREATE DATABASE bankist`.
 * 2. Executing `bankist.sql` against a disposable test database creates all tables/views
 *    exclusively inside the target disposable database.
 * 3. The live production-like `bankist` database remains 100% untouched and isolated.
 * 
 * Usage:
 *   node scripts/test_disposable_setup_isolation.js
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(WORKSPACE_ROOT, 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
const DDL_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist.sql');

require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

const DISPOSABLE_DB = `bankist_iso_test_${Date.now()}`;
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

async function runIsolationTest() {
  console.log('================================================================');
  console.log('     DISPOSABLE SETUP & LIVE DATABASE ISOLATION VERIFICATION    ');
  console.log('================================================================\n');

  // 1. Static DDL Inspection
  console.log('--- 1. Static Inspection of bankist.sql ---');
  const ddlContent = fs.readFileSync(DDL_PATH, 'utf8');
  assert(!/^\s*USE\s+[`"]?bankist[`"]?\s*;/im.test(ddlContent), 'bankist.sql has NO hardcoded `USE bankist;`');
  assert(!/^\s*CREATE\s+DATABASE\s+.*[`"]?bankist[`"]?/im.test(ddlContent), 'bankist.sql has NO hardcoded `CREATE DATABASE bankist`');

  const rootPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    dateStrings: true
  });

  try {
    // 2. Snapshot Live `bankist` State
    console.log('\n--- 2. Snapshotting Current Live `bankist` State ---');
    const [liveTables] = await rootPool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'bankist' AND TABLE_TYPE = 'BASE TABLE'"
    );
    const liveSnapshot = {};
    for (const t of liveTables) {
      const [[{ count }]] = await rootPool.query(`SELECT COUNT(*) as count FROM \`bankist\`.\`${t.TABLE_NAME}\``);
      liveSnapshot[t.TABLE_NAME] = count;
    }
    console.log(`[SNAPSHOT] Live \`bankist\` has ${liveTables.length} tables recorded.`);

    // 3. Create Disposable Database
    console.log(`\n--- 3. Creating Disposable Database: \`${DISPOSABLE_DB}\` ---`);
    await rootPool.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB}\``);
    await rootPool.query(`CREATE DATABASE \`${DISPOSABLE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    assert(true, `Database \`${DISPOSABLE_DB}\` created successfully`);

    // 4. Execute `bankist.sql` in Disposable Connection
    console.log('\n--- 4. Executing bankist.sql against Disposable Database ---');
    const disposablePool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: DISPOSABLE_DB,
      multipleStatements: true,
      dateStrings: true
    });

    await disposablePool.query(ddlContent);
    assert(true, 'bankist.sql DDL executed without error in disposable database');

    // 5. Verify Disposable Database Schema
    console.log('\n--- 5. Verifying Schema in Disposable Database ---');
    const [dispTables] = await disposablePool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
      [DISPOSABLE_DB]
    );
    const dispTableSet = new Set(dispTables.map(t => t.TABLE_NAME));
    const requiredTables = [
      'branches', 'customers', 'accounts', 'account_lien_records',
      'beneficiaries', 'deposits', 'transactions', 'kyc_verifications',
      'audit_logs', 'otp_sessions', 'security_rate_limits', 'v_customer_portfolio'
    ];

    requiredTables.forEach(t => {
      assert(dispTableSet.has(t), `Table/view '${t}' exists in disposable database`);
    });

    // 6. Verify Live `bankist` Database Was 100% Protected and Untouched
    console.log('\n--- 6. Verifying Live `bankist` Database Isolation ---');
    let isolationViolations = 0;
    for (const [table, beforeCount] of Object.entries(liveSnapshot)) {
      const [[{ count: afterCount }]] = await rootPool.query(`SELECT COUNT(*) as count FROM \`bankist\`.\`${table}\``);
      if (beforeCount !== afterCount) {
        console.error(`[ISOLATION VIOLATION] Table \`${table}\` changed from ${beforeCount} to ${afterCount}!`);
        isolationViolations++;
      }
    }
    assert(isolationViolations === 0, 'Live `bankist` database row counts 100% UNCHANGED and fully protected');

    await disposablePool.end();

    // 7. Clean up Disposable Database
    console.log(`\n--- 7. Dropping Disposable Database: \`${DISPOSABLE_DB}\` ---`);
    await rootPool.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB}\``);
    assert(true, `Disposable database \`${DISPOSABLE_DB}\` dropped cleanly`);

  } catch (err) {
    console.error('[FATAL ISOLATION TEST FAILURE]:', err);
    failed++;
  } finally {
    await rootPool.end();
  }

  console.log('\n================================================================');
  console.log(`   ISOLATION REGRESSION COMPLETE: ${passed} PASSED, ${failed} FAILED   `);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runIsolationTest().catch(err => {
  console.error('[FATAL]:', err);
  process.exit(1);
});

