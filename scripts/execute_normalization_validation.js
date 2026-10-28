#!/usr/bin/env node
/**
 * ==============================================================================
 * BHARAT TRUST BANK — AUTHORITATIVE NORMALIZATION VALIDATION RUNNER
 * ==============================================================================
 * 
 * Safety & Integrity Features:
 * 1. Strict Database Context Validation:
 *    - Destination database must be an explicitly generated, disposable database.
 *    - Hardcoded refusal to execute if target == 'bankist' or target == source.
 * 2. Cryptographic Pre-flight & Post-flight Fingerprinting:
 *    - Captures schema structure and row checksums of live `bankist` before any test.
 *    - Compares live database fingerprints before and after execution to prove zero mutation.
 * 3. Overwrite Rejection Verification:
 *    - Tests that attempting a rerun on populated destination is rejected with SIGNAL '45000'.
 * 4. Exact 37-Assertion Test Suite Execution:
 *    - Executes all 37 SQL assertions from `bankist_normalization_tests.sql`.
 *    - Reconciles expected assertions (37 expected, 37 executed).
 *    - Exits with non-zero exit code (code 1) on any test failure or safety violation.
 * 5. Safe Cleanup:
 *    - Safely drops disposable target database after execution.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(WORKSPACE_ROOT, 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

const SOURCE_DB = process.env.SOURCE_DB || 'bankist';
const DISPOSABLE_TARGET_DB = `bankist_norm_eval_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const DDL_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_normalized.sql');
const MIGRATION_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_migration.sql');
const TESTS_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist_normalization_tests.sql');

const EXPECTED_ASSERTIONS_COUNT = 37;

async function computeLiveDbFingerprint(conn, dbName) {
  const [tables] = await conn.query(`SHOW FULL TABLES FROM \`${dbName}\` WHERE Table_type = 'BASE TABLE'`);
  const tableNames = tables.map(r => Object.values(r)[0]).sort();
  
  const fingerprint = {
    database: dbName,
    table_count: tableNames.length,
    tables: {}
  };

  let combinedHashInput = '';
  for (const t of tableNames) {
    const [[{ cnt }]] = await conn.query(`SELECT COUNT(1) as cnt FROM \`${dbName}\`.\`${t}\``);
    const [cols] = await conn.query(`DESCRIBE \`${dbName}\`.\`${t}\``);
    const colSignature = cols.map(c => `${c.Field}:${c.Type}:${c.Null}:${c.Key}`).join('|');
    
    // Checksum table data
    const [chk] = await conn.query(`CHECKSUM TABLE \`${dbName}\`.\`${t}\``);
    const checksumVal = chk[0].Checksum || 0;

    fingerprint.tables[t] = {
      count: cnt,
      checksum: checksumVal,
      schema_hash: crypto.createHash('sha256').update(colSignature).digest('hex')
    };

    combinedHashInput += `${t}:${cnt}:${checksumVal}:${colSignature};`;
  }

  fingerprint.overall_hash = crypto.createHash('sha256').update(combinedHashInput).digest('hex');
  return fingerprint;
}

async function runValidation() {
  console.log('====================================================================');
  console.log('   BHARAT TRUST BANK — SECURE NORMALIZATION & INTEGRITY VALIDATOR   ');
  console.log('====================================================================');
  console.log(`Configured Source Database: ${SOURCE_DB}`);
  console.log(`Disposable Target Database: ${DISPOSABLE_TARGET_DB}`);

  // Safety Assertion 1: Distinct database check
  if (SOURCE_DB.toLowerCase() === DISPOSABLE_TARGET_DB.toLowerCase()) {
    console.error('[CRITICAL ABORT] Source database and Target database are identical! Aborting to prevent data destruction.');
    process.exit(1);
  }

  // Safety Assertion 2: Target cannot be live production
  if (DISPOSABLE_TARGET_DB.toLowerCase() === 'bankist') {
    console.error('[CRITICAL ABORT] Target database is live "bankist"! Direct mutation of live database is strictly forbidden.');
    process.exit(1);
  }

  const adminConn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    multipleStatements: true
  });

  let disposableCreated = false;

  try {
    // 1. Capture Pre-flight Live Database Fingerprint
    console.log(`\n[1/8] Capturing Pre-flight Cryptographic Fingerprint of Live Database '${SOURCE_DB}'...`);
    const preFlightFingerprint = await computeLiveDbFingerprint(adminConn, SOURCE_DB);
    console.log(`  Live '${SOURCE_DB}' Base Tables: ${preFlightFingerprint.table_count}`);
    console.log(`  Live '${SOURCE_DB}' Overall Cryptographic Hash: ${preFlightFingerprint.overall_hash}`);

    // Verify source database integrity before migration
    if (preFlightFingerprint.table_count < 11) {
      throw new Error(`Source database '${SOURCE_DB}' contains insufficient tables (${preFlightFingerprint.table_count} found, 11 expected).`);
    }

    // 2. Create Disposable Target Database
    console.log(`\n[2/8] Creating disposable target database \`${DISPOSABLE_TARGET_DB}\`...`);
    await adminConn.query(`CREATE DATABASE \`${DISPOSABLE_TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    disposableCreated = true;
    console.log('  Disposable database created cleanly.');

    // 3. Apply Normalized BCNF Schema
    console.log(`\n[3/8] Applying normalized schema DDL (${DDL_PATH})...`);
    const testConn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '3306'),
      database: DISPOSABLE_TARGET_DB,
      multipleStatements: true
    });

    const ddlContent = fs.readFileSync(DDL_PATH, 'utf8');
    await testConn.query(ddlContent);
    console.log('  Normalized schema DDL applied successfully.');

    // 4. Apply Lossless Data Migration Script
    console.log(`\n[4/8] Applying safe data migration (${MIGRATION_PATH})...`);
    await testConn.query(`SET @MIGRATION_SRC_DB = '${SOURCE_DB}';`);
    const migrationContent = fs.readFileSync(MIGRATION_PATH, 'utf8');
    await testConn.query(migrationContent);
    console.log('  Data migration completed successfully.');

    // 5. Test Overwrite Prevention (Rerun Guard Assertion)
    console.log(`\n[5/8] Testing Overwrite Prevention & Rerun Rejection Guard...`);
    let rerunRejected = false;
    try {
      await testConn.query(migrationContent);
    } catch (rerunErr) {
      if (rerunErr.message.includes('Destination has existing records')) {
        rerunRejected = true;
        console.log(`  [PASS] Migration rerun correctly blocked by pre-flight guard: "${rerunErr.message}"`);
      } else {
        throw rerunErr;
      }
    }
    if (!rerunRejected) {
      throw new Error('CRITICAL FLAW: Migration rerun was not rejected on populated destination!');
    }

    // 6. Execute 37-Assertion Test Suite
    console.log(`\n[6/8] Executing test assertions from ${TESTS_PATH}...`);
    const testsContent = fs.readFileSync(TESTS_PATH, 'utf8');
    
    // Parse statements while stripping comments
    const queries = testsContent
      .split(';')
      .map(q => q.replace(/--.*$/gm, '').trim())
      .filter(q => q.length > 0 && (q.toUpperCase().startsWith('SELECT') || q.toUpperCase().startsWith('SET')));

    let totalAssertions = 0;
    let passedAssertions = 0;
    let failedAssertions = 0;
    const testResults = [];

    for (const q of queries) {
      if (q.toUpperCase().startsWith('SET')) {
        await testConn.query(q);
        continue;
      }
      const [rows] = await testConn.query(q);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          totalAssertions++;
          const status = row.status || 'FAIL';
          if (status === 'PASS') {
            passedAssertions++;
            console.log(`  [PASS] ${row.test_name}: ${JSON.stringify(row)}`);
          } else {
            failedAssertions++;
            console.error(`  [FAIL] ${row.test_name}: ${JSON.stringify(row)}`);
          }
          testResults.push(row);
        }
      }
    }

    console.log(`\n--- Test Execution Summary ---`);
    console.log(`Total Assertions Executed: ${totalAssertions}`);
    console.log(`Expected Assertions: ${EXPECTED_ASSERTIONS_COUNT}`);
    console.log(`Passed: ${passedAssertions}`);
    console.log(`Failed: ${failedAssertions}`);

    if (totalAssertions !== EXPECTED_ASSERTIONS_COUNT) {
      throw new Error(`Assertion count mismatch: ${totalAssertions} executed, expected exactly ${EXPECTED_ASSERTIONS_COUNT}.`);
    }

    if (failedAssertions > 0) {
      throw new Error(`${failedAssertions} assertion(s) failed during validation.`);
    }

    // 7. Cleanup Disposable Database
    console.log(`\n[7/8] Safely dropping disposable target database \`${DISPOSABLE_TARGET_DB}\`...`);
    await testConn.end();
    await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_TARGET_DB}\`;`);
    disposableCreated = false;
    console.log('  Disposable database dropped cleanly.');

    // 8. Verify Post-flight Live Database Fingerprint
    console.log(`\n[8/8] Capturing Post-flight Cryptographic Fingerprint of Live Database '${SOURCE_DB}'...`);
    const postFlightFingerprint = await computeLiveDbFingerprint(adminConn, SOURCE_DB);
    console.log(`  Live '${SOURCE_DB}' Post-flight Overall Hash: ${postFlightFingerprint.overall_hash}`);

    if (preFlightFingerprint.overall_hash !== postFlightFingerprint.overall_hash) {
      console.error('[CRITICAL FAILURE] Live database fingerprint mismatch! Live database was mutated!');
      process.exit(1);
    } else {
      console.log('  [VERIFIED] Live database cryptographic fingerprint matches 100% (Bit-for-bit identical, zero mutation).');
    }

    // Save test results artifact
    const scratchDir = path.resolve('C:/Users/MANAN/.gemini/antigravity/brain/ea3fc8f6-b56a-484e-aae2-e0dc4502e50e/scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    fs.writeFileSync(
      path.resolve(scratchDir, 'normalization_audit_results.json'),
      JSON.stringify({
        validated_at: new Date().toISOString(),
        source_db: SOURCE_DB,
        pre_flight_hash: preFlightFingerprint.overall_hash,
        post_flight_hash: postFlightFingerprint.overall_hash,
        fingerprints_match: true,
        total_assertions: totalAssertions,
        passed_assertions: passedAssertions,
        failed_assertions: failedAssertions,
        results: testResults
      }, null, 2)
    );
    console.log(`\nAudit results persisted to scratch/normalization_audit_results.json`);
    console.log('\n[ALL CHECKS PASSED] Normalization schema, safe migration, and zero-overwrite guards successfully validated!');

  } catch (err) {
    console.error('\n[VALIDATION FAILED]', err.message);
    if (disposableCreated) {
      try {
        console.log(`Emergency cleanup: Dropping \`${DISPOSABLE_TARGET_DB}\`...`);
        await adminConn.query(`DROP DATABASE IF EXISTS \`${DISPOSABLE_TARGET_DB}\`;`);
      } catch (e) {}
    }
    process.exit(1);
  } finally {
    await adminConn.end();
  }
}

runValidation();
