#!/usr/bin/env node
/**
 * ==============================================================================
 * BHARAT TRUST BANK — NORMALIZATION & MIGRATION VALIDATION RUNNER
 * ==============================================================================
 * 
 * Safely executes:
 * 1. Creation of disposable ephemeral database: `bankist_norm_test_<timestamp>`
 * 2. Application of `bankist_normalized.sql`
 * 3. Application of `bankist_migration.sql`
 * 4. Execution of all assertions from `bankist_normalization_tests.sql`
 * 5. Captures and records exact test results
 * 6. Drops the disposable database
 * 7. Asserts live `bankist` remains 100% untouched (3,041 rows, balance sum)
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(WORKSPACE_ROOT, 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

const DISPOSABLE_DB = `bankist_norm_val_${Date.now()}`;
const DDL_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_normalized.sql');
const MIGRATION_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_migration.sql');
const TESTS_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_normalization_tests.sql');

async function runValidation() {
  console.log('====================================================================');
  console.log('      BHARAT TRUST BANK — NORMALIZATION VALIDATION RUNNER           ');
  console.log('====================================================================');
  console.log(`Disposable Database: ${DISPOSABLE_DB}`);

  const adminConn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    multipleStatements: true
  });

  try {
    // 1. Create disposable DB
    console.log(`\n[1/6] Creating disposable database ${DISPOSABLE_DB}...`);
    await adminConn.query(`CREATE DATABASE \`${DISPOSABLE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log('Disposable database created.');

    // 2. Connect to disposable DB and apply DDL
    const testConn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '3306'),
      database: DISPOSABLE_DB,
      multipleStatements: true
    });

    console.log(`\n[2/6] Applying normalized DDL schema (${DDL_PATH})...`);
    const ddlContent = fs.readFileSync(DDL_PATH, 'utf8');
    await testConn.query(ddlContent);
    console.log('Normalized DDL schema applied successfully.');

    // 3. Apply migration script
    console.log(`\n[3/6] Applying migration script (${MIGRATION_PATH})...`);
    const migrationContent = fs.readFileSync(MIGRATION_PATH, 'utf8');
    await testConn.query(migrationContent);
    console.log('Migration completed successfully.');

    // 4. Run tests
    console.log(`\n[4/6] Executing test assertions from ${TESTS_PATH}...`);
    const testsContent = fs.readFileSync(TESTS_PATH, 'utf8');
    
    // Split test content into individual queries, stripping comments
    const queries = testsContent
      .split(';')
      .map(q => {
        // Strip line comments
        return q.replace(/--.*$/gm, '').trim();
      })
      .filter(q => q.length > 0 && (q.toUpperCase().startsWith('SELECT') || q.toUpperCase().startsWith('SET')));

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const testSummary = [];

    for (const q of queries) {
      if (q.startsWith('SET')) {
        await testConn.query(q);
        continue;
      }
      const [rows] = await testConn.query(q);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          totalTests++;
          const status = row.status || (row.actual_count === row.expected_count ? 'PASS' : 'FAIL');
          if (status === 'PASS') {
            passedTests++;
            console.log(`  [PASS] ${row.test_name}: ${JSON.stringify(row)}`);
          } else {
            failedTests++;
            console.error(`  [FAIL] ${row.test_name}: ${JSON.stringify(row)}`);
          }
          testSummary.push(row);
        }
      }
    }

    console.log(`\n--- Test Execution Summary ---`);
    console.log(`Total Assertions Executed: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);

    const scratchDir = path.resolve('C:/Users/MANAN/.gemini/antigravity/brain/ea3fc8f6-b56a-484e-aae2-e0dc4502e50e/scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    fs.writeFileSync(
      path.resolve(scratchDir, 'normalization_test_results.json'),
      JSON.stringify({ totalTests, passedTests, failedTests, results: testSummary }, null, 2)
    );

    // 5. Clean up test connection & drop disposable DB
    console.log(`\n[5/6] Dropping disposable database ${DISPOSABLE_DB}...`);
    await testConn.end();
    await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB}\`;`);
    console.log('Disposable database cleaned up.');

    // 6. Verify live bankist database remains untouched
    console.log('\n[6/6] Verifying live `bankist` database pristine status...');
    const [liveTables] = await adminConn.query('SHOW FULL TABLES FROM `bankist` WHERE Table_type = \'BASE TABLE\'');
    let liveTotalRows = 0;
    for (const row of liveTables) {
      const tableName = Object.values(row)[0];
      const [[{ count }]] = await adminConn.query(`SELECT COUNT(*) as count FROM \`bankist\`.\`${tableName}\``);
      liveTotalRows += count;
    }
    const [[{ liveBalanceSum }]] = await adminConn.query('SELECT SUM(balance) as liveBalanceSum FROM `bankist`.accounts');

    console.log(`Live 'bankist' Base Tables: ${liveTables.length} (Expected: 11)`);
    console.log(`Live 'bankist' Total Rows: ${liveTotalRows} (Expected: 3041)`);
    console.log(`Live 'bankist' Balance Sum: ${liveBalanceSum} (Expected: 19155216.07)`);

    if (liveTotalRows === 3041 && parseFloat(liveBalanceSum) === 19155216.07) {
      console.log('[VERIFIED] Live database `bankist` is 100% UNTOUCHED and PRISTINE.');
    } else {
      console.error('[CRITICAL] Live database row count or balance mismatch!');
    }

  } catch (err) {
    console.error('Validation failed with error:', err);
    // Cleanup if needed
    try {
      await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_DB}\`;`);
    } catch (e) {}
  } finally {
    await adminConn.end();
  }
}

runValidation();
