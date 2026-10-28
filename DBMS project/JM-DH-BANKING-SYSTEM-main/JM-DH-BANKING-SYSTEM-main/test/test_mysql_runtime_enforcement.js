/**
 * Automated Test Suite: MySQL Runtime Selection & Fallback Prevention
 *
 * Verifies:
 * 1. MySQL is selected as the exclusive and unconditional runtime database engine.
 * 2. All 11 core tables and the portfolio view exist and are queryable in MySQL.
 * 3. Any connection or configuration failure in MySQL strictly throws a fatal error
 *    and NEVER activates silent fallback to SQLite, even if ALLOW_SQLITE_FALLBACK=true.
 * 4. Transaction rollback semantics operate properly on MySQL without partial writes.
 */

const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert');

// Load environment variables from .env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

let passed = 0;
let failed = 0;

function report(condition, testName, detail = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('   BTB MYSQL EXCLUSIVE RUNTIME ENFORCEMENT & INTEGRITY SUITE   ');
  console.log('================================================================\n');

  // TEST 1: Verify Direct MySQL Connection and Active Engine Properties
  console.log('--- 1. Testing Unconditional MySQL Engine Connection ---');
  try {
    const { getDb } = require('./lib/db.ts');
    const db = await getDb();

    report(db.isSqlite === false, 'Runtime adapter explicitly reports isSqlite = false');
    report(typeof db.query === 'function', 'Database adapter query() function is present');
    report(typeof db.transaction === 'function', 'Database adapter transaction() function is present');

    // Verify all 11 core tables are queryable in MySQL
    const tables = [
      'customers',
      'accounts',
      'transactions',
      'kyc_verifications',
      'beneficiaries',
      'deposits',
      'branches',
      'audit_logs',
      'otp_sessions',
      'security_rate_limits',
      'account_lien_records'
    ];

    for (const table of tables) {
      const [rows] = await db.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
      const count = rows[0]?.cnt ?? 0;
      report(typeof count === 'number' && count >= 0, `MySQL table \`${table}\` queried successfully (${count} rows)`);
    }

    // Verify v_customer_portfolio view exists
    const [viewRows] = await db.query('SELECT COUNT(*) as cnt FROM v_customer_portfolio');
    report(viewRows && viewRows.length > 0, `MySQL view \`v_customer_portfolio\` is queryable`);
  } catch (err) {
    report(false, 'Direct MySQL engine connection test', err.message);
  }

  // TEST 2: Verify Fail-Closed Behavior on Unreachable MySQL (Port Misconfigured)
  console.log('\n--- 2. Testing MySQL Failure Prevents SQLite Fallback ---');
  const failClosedScript = `
    process.env.DB_PORT = '59999';
    const { getDb } = require('./lib/db.ts');
    getDb().then(db => {
      console.log('UNEXPECTED_FALLBACK:' + db.isSqlite);
      process.exit(1);
    }).catch(err => {
      if (err.message.includes('Failed to connect to MySQL database') &&
          err.message.includes('MySQL 8.0+ is the sole runtime database engine')) {
        console.log('EXPECTED_FATAL_ERROR_CONFIRMED');
        process.exit(0);
      }
      console.error('WRONG_ERROR:' + err.message);
      process.exit(2);
    });
  `;

  const child1 = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '-e', failClosedScript],
    {
      cwd: __dirname,
      encoding: 'utf8',
      env: { ...process.env, DB_PORT: '59999' }
    }
  );

  const out1 = (child1.stdout || '') + (child1.stderr || '');
  report(
    child1.status === 0 && out1.includes('EXPECTED_FATAL_ERROR_CONFIRMED'),
    'MySQL connection failure throws fatal error and strictly prohibits SQLite fallback'
  );
  report(
    !out1.includes('UNEXPECTED_FALLBACK'),
    'No SQLite adapter returned when MySQL connection fails'
  );

  // TEST 3: Verify Obsolete ALLOW_SQLITE_FALLBACK Cannot Revive SQLite
  console.log('\n--- 3. Testing Obsolete Fallback Flags Cannot Revive SQLite ---');
  const bypassAttemptScript = `
    process.env.ALLOW_SQLITE_FALLBACK = 'true';
    process.env.DB_PORT = '59999';
    const { getDb } = require('./lib/db.ts');
    getDb().then(db => {
      console.log('UNEXPECTED_FALLBACK:' + db.isSqlite);
      process.exit(1);
    }).catch(err => {
      if (err.message.includes('Failed to connect to MySQL database') &&
          err.message.includes('MySQL 8.0+ is the sole runtime database engine')) {
        console.log('EXPECTED_FATAL_ERROR_STILL_ENFORCED');
        process.exit(0);
      }
      console.error('WRONG_ERROR:' + err.message);
      process.exit(2);
    });
  `;

  const child2 = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '-e', bypassAttemptScript],
    {
      cwd: __dirname,
      encoding: 'utf8',
      env: { ...process.env, ALLOW_SQLITE_FALLBACK: 'true', DB_PORT: '59999' }
    }
  );

  const out2 = (child2.stdout || '') + (child2.stderr || '');
  report(
    child2.status === 0 && out2.includes('EXPECTED_FATAL_ERROR_STILL_ENFORCED'),
    'Obsolete ALLOW_SQLITE_FALLBACK=true cannot override unconditional MySQL initialization'
  );

  // TEST 4: Verify Atomic Transaction Rollback on MySQL
  console.log('\n--- 4. Testing Atomic Transaction Rollback on MySQL ---');
  try {
    const { getDb } = require('./lib/db.ts');
    const db = await getDb();

    // Query an account to test transaction rollback
    const [accs] = await db.query('SELECT account_number, balance FROM accounts LIMIT 1');
    if (accs && accs.length > 0) {
      const testAccount = accs[0].account_number;
      const initialBalance = parseFloat(accs[0].balance);

      let caughtRollback = false;
      try {
        await db.transaction(async (conn) => {
          await conn.query('UPDATE accounts SET balance = balance - 100 WHERE account_number = ?', [testAccount]);
          // Deliberate error to trigger rollback
          await conn.query('INSERT INTO deliberate_invalid_table_rollback_probe (invalid_col) VALUES (1)');
        });
      } catch (txErr) {
        caughtRollback = true;
      }

      report(caughtRollback, 'Transaction error caught and triggered rollback');

      // Re-query balance to verify postcondition
      const [postAccs] = await db.query('SELECT balance FROM accounts WHERE account_number = ?', [testAccount]);
      const postBalance = parseFloat(postAccs[0]?.balance || '0');
      report(
        initialBalance === postBalance,
        `Account balance restored atomically after MySQL rollback (${initialBalance} === ${postBalance})`
      );
    } else {
      report(false, 'Transaction rollback test', 'No accounts found in MySQL to test');
    }
  } catch (err) {
    report(false, 'MySQL transaction rollback test', err.message);
  }

  // Summary
  console.log('\n================================================================');
  console.log(`TOTAL ASSERTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});

