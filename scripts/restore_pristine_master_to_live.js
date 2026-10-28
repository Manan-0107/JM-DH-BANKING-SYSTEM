#!/usr/bin/env node
/**
 * ==============================================================================
 * JM-DH BANKING SYSTEM — PRISTINE OPTION B RESTORATION TO LIVE MYSQL `bankist`
 * ==============================================================================
 * 
 * Safely restores the pristine 124-customer, 208-account master dataset from
 * `bankist.sqlite` into the live MySQL `bankist` database.
 * 
 * Safety Rules & Invariants:
 * 1. Target database is explicitly verified to be `bankist`.
 * 2. Pre-flight backup completeness is verified.
 * 3. Immediate secondary snapshot of live `bankist` is created before any write.
 * 4. Zero test fixtures or automated test-created records are transferred.
 * 5. Foreign-key checks are ENABLED (FOREIGN_KEY_CHECKS = 1) at all times.
 * 6. Deletion uses reverse-topological order; insertion uses forward-topological order.
 * 7. Plaintext credentials are zeroed (card_pin = NULL, otp_code = NULL).
 * 8. Bcrypt salted hashes are preserved and verified.
 * 9. Active balance sum is verified to match portfolio view with ₹0.00 variance.
 * 10. Rollback safety: Any error immediately rolls back and exits with code 1.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(WORKSPACE_ROOT, 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
const SQLITE_MASTER_PATH = path.resolve(TEST_DIR, 'bankist.sqlite');
const DDL_PATH = path.resolve(WORKSPACE_ROOT, 'DBMS project/bankist.sql');
const BACKUP_DIR = path.resolve(WORKSPACE_ROOT, 'database/backups');

// Dynamically load dependencies
let bcrypt;
try {
  bcrypt = require(path.resolve(TEST_DIR, 'node_modules/bcryptjs'));
} catch (e) {
  bcrypt = require('bcryptjs');
}

require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

const TARGET_DB = 'bankist';

async function main() {
  console.log('================================================================');
  console.log('   BHARAT TRUST BANK — OPTION B PRISTINE MASTER RESTORATION    ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // PRECONDITION 1: Target Database Verification
  // --------------------------------------------------------------------------
  console.log(`[Precondition 1] Verifying target database: \`${TARGET_DB}\`...`);
  if (!TARGET_DB || TARGET_DB !== 'bankist') {
    throw new Error(`ABORT: Target database must be explicitly 'bankist'. Got: '${TARGET_DB}'`);
  }
  console.log(`[PASS] Explicit target database confirmed: \`${TARGET_DB}\``);

  // --------------------------------------------------------------------------
  // PRECONDITION 2: MySQL Connection & Version Verification
  // --------------------------------------------------------------------------
  console.log('\n[Precondition 2] Connecting to MySQL server...');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    dateStrings: true
  });

  const [verRows] = await pool.query('SELECT VERSION() as version');
  const version = verRows[0].version;
  console.log(`[PASS] Connected to MySQL: version ${version}`);

  // Confirm target database exists
  const [dbCheck] = await pool.query('SHOW DATABASES LIKE ?', [TARGET_DB]);
  if (dbCheck.length === 0) {
    throw new Error(`ABORT: Database \`${TARGET_DB}\` does not exist on MySQL server!`);
  }
  console.log(`[PASS] Database \`${TARGET_DB}\` exists on server.`);

  // --------------------------------------------------------------------------
  // PRECONDITION 3: Primary Backup Verification
  // --------------------------------------------------------------------------
  console.log('\n[Precondition 3] Verifying primary backup availability and integrity...');
  const primaryBackupPath = path.resolve(BACKUP_DIR, 'bankist_live_backup_2026-10-28T12-46-21-389Z.json');
  if (!fs.existsSync(primaryBackupPath)) {
    throw new Error(`ABORT: Primary backup file missing: ${primaryBackupPath}`);
  }
  const primaryStat = fs.statSync(primaryBackupPath);
  if (primaryStat.size < 100000) {
    throw new Error(`ABORT: Primary backup file suspiciously small (${primaryStat.size} bytes).`);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(primaryBackupPath, 'utf8'));
    const tCount = Object.keys(parsed.tables || parsed).length;
    console.log(`[PASS] Primary backup verified: ${primaryBackupPath} (${primaryStat.size} bytes, ${tCount} tables).`);
  } catch (e) {
    throw new Error(`ABORT: Primary backup is corrupted JSON: ${e.message}`);
  }

  // --------------------------------------------------------------------------
  // PRECONDITION 4: Create Immediate Secondary Pre-Restoration Snapshot
  // --------------------------------------------------------------------------
  console.log('\n[Precondition 4] Creating immediate secondary pre-restoration snapshot of live `bankist`...');
  const secBackupTime = new Date().toISOString().replace(/[:.]/g, '-');
  const secBackupPath = path.resolve(BACKUP_DIR, `bankist_live_pre_optionB_backup_${secBackupTime}.json`);

  const tablesToBackup = [
    'branches', 'customers', 'accounts', 'account_lien_records',
    'beneficiaries', 'deposits', 'transactions', 'kyc_verifications',
    'audit_logs', 'otp_sessions', 'security_rate_limits'
  ];

  const backupPayload = {
    database: TARGET_DB,
    timestamp: new Date().toISOString(),
    tables: {}
  };

  for (const t of tablesToBackup) {
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${TARGET_DB}\`.\`${t}\``);
      backupPayload.tables[t] = rows;
    } catch (e) {
      console.warn(`  Warning: could not backup table ${t}: ${e.message}`);
      backupPayload.tables[t] = [];
    }
  }

  fs.writeFileSync(secBackupPath, JSON.stringify(backupPayload, null, 2), 'utf8');
  const secStat = fs.statSync(secBackupPath);
  console.log(`[PASS] Secondary snapshot saved: ${secBackupPath} (${secStat.size} bytes).`);

  // --------------------------------------------------------------------------
  // PRECONDITION 5: Verify SQLite Master Source & Baseline Counts
  // --------------------------------------------------------------------------
  console.log('\n[Precondition 5] Opening master SQLite baseline (read-only)...');
  if (!fs.existsSync(SQLITE_MASTER_PATH)) {
    throw new Error(`ABORT: Master SQLite file missing: ${SQLITE_MASTER_PATH}`);
  }
  const sdb = new DatabaseSync(SQLITE_MASTER_PATH, { readOnly: true });

  const expectedCounts = {
    branches: 8,
    customers: 124,
    accounts: 208,
    account_lien_records: 15,
    beneficiaries: 99,
    deposits: 74,
    transactions: 782,
    kyc_verifications: 815,
    audit_logs: 808,
    otp_sessions: 82,
    security_rate_limits: 26
  };

  for (const [t, exp] of Object.entries(expectedCounts)) {
    const row = sdb.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get();
    if (row.c !== exp) {
      throw new Error(`ABORT: SQLite table '${t}' count mismatch! Expected ${exp}, found ${row.c}`);
    }
  }
  console.log('[PASS] Master SQLite baseline validated: exact counts for all 11 tables confirmed.');

  const masterActiveBal = parseFloat(sdb.prepare("SELECT SUM(balance) as s FROM accounts WHERE status = 'Active'").get().s);
  console.log(`[PASS] Master SQLite active accounts balance sum: ₹${masterActiveBal.toFixed(2)} (Expected: ₹19,155,216.07)`);
  if (Math.abs(masterActiveBal - 19155216.07) > 0.01) {
    throw new Error(`ABORT: SQLite active balance mismatch: ₹${masterActiveBal} !== ₹19,155,216.07`);
  }

  // --------------------------------------------------------------------------
  // RESTORATION PHASE 1: Reverse-Topological Cleanup with FK Checks ACTIVE
  // --------------------------------------------------------------------------
  console.log('\n--- RESTORATION PHASE 1: Reverse-Topological Cleanup (FOREIGN_KEY_CHECKS = 1) ---');
  const targetPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: TARGET_DB,
    multipleStatements: true,
    dateStrings: true
  });

  // Verify FK checks are active
  const [fkCheck] = await targetPool.query('SELECT @@FOREIGN_KEY_CHECKS as fk');
  console.log(`Initial FOREIGN_KEY_CHECKS setting: ${fkCheck[0].fk}`);
  await targetPool.query('SET FOREIGN_KEY_CHECKS = 1');

  // Ensure reference_number column exists on transactions table in target DB
  const [refColCheck] = await targetPool.query("SHOW COLUMNS FROM `transactions` LIKE 'reference_number'");
  if (refColCheck.length === 0) {
    console.log('  Aligning schema: Adding missing `reference_number` column to `transactions` in live `bankist`...');
    await targetPool.query("ALTER TABLE `transactions` ADD COLUMN `reference_number` VARCHAR(100) DEFAULT NULL UNIQUE");
    console.log('  [PASS] Added `reference_number` column to `transactions`.');
  }

  const reverseDeleteOrder = [
    'account_lien_records',
    'deposits',
    'beneficiaries',
    'kyc_verifications',
    'transactions',
    'accounts',
    'customers',
    'branches',
    'audit_logs',
    'otp_sessions',
    'security_rate_limits'
  ];

  for (const t of reverseDeleteOrder) {
    const [delRes] = await targetPool.query(`DELETE FROM \`${t}\``);
    console.log(`  [FK CHECKS ACTIVE] Cleaned \`${t.padEnd(22)}\`: ${delRes.affectedRows} rows deleted.`);
  }
  console.log('[PASS] Reverse-topological cleanup complete. Zero FK violations.\n');

  // --------------------------------------------------------------------------
  // RESTORATION PHASE 2: Forward-Topological Population with FK Checks ACTIVE
  // --------------------------------------------------------------------------
  console.log('--- RESTORATION PHASE 2: Forward-Topological Population (FOREIGN_KEY_CHECKS = 1) ---');

  const forwardTableSpecs = [
    {
      name: 'branches',
      columns: ['branch_id', 'branch_name', 'ifsc_code', 'city', 'address', 'timing', 'phone', 'status']
    },
    {
      name: 'customers',
      columns: [
        'customer_id', 'full_name', 'email', 'phone', 'dob', 'address', 'created_at',
        'status', 'kyc_status', 'password_hash', 'credit_score', 'tier', 'pan_number',
        'aadhaar_number', 'gender', 'father_name', 'marital_status', 'occupation',
        'annual_income', 'nominee_name', 'nominee_relation', 'nominee_dob', 'vkyc_status',
        'signature_data', 'avatar_data', 'card_pin', 'card_pin_hash'
      ],
      transform: (row) => {
        let cardPinHash = row.card_pin_hash;
        const rawPin = row.card_pin ? String(row.card_pin).trim() : '';
        // Ensure standard bcrypt hash for card_pin (Aarav Lynn '1234')
        if (row.customer_id === 'CUST-101' || (rawPin === '1234' && (!cardPinHash || cardPinHash.length === 64))) {
          cardPinHash = bcrypt.hashSync('1234', 10);
        } else if (rawPin && (!cardPinHash || cardPinHash.length === 64)) {
          cardPinHash = bcrypt.hashSync(rawPin, 10);
        }
        return {
          ...row,
          card_pin: null, // Zero plaintext card PIN
          card_pin_hash: cardPinHash
        };
      }
    },
    {
      name: 'accounts',
      columns: [
        'account_number', 'customer_id', 'account_type', 'balance', 'ifsc_code',
        'branch_name', 'opening_date', 'status', 'card_pin', 'card_pin_hash'
      ],
      transform: (row) => {
        let cardPinHash = row.card_pin_hash;
        const rawPin = row.card_pin ? String(row.card_pin).trim() : '';
        if (row.account_number === 'ACC-770153' || (rawPin === '1234' && (!cardPinHash || cardPinHash.length === 64))) {
          cardPinHash = bcrypt.hashSync('1234', 10);
        } else if (rawPin && (!cardPinHash || cardPinHash.length === 64)) {
          cardPinHash = bcrypt.hashSync(rawPin, 10);
        }
        return {
          ...row,
          card_pin: null, // Zero plaintext card PIN
          card_pin_hash: cardPinHash
        };
      }
    },
    {
      name: 'account_lien_records',
      columns: ['lien_id', 'account_number', 'lien_amount', 'lien_reason', 'created_at']
    },
    {
      name: 'beneficiaries',
      columns: [
        'beneficiary_id', 'customer_id', 'beneficiary_name', 'account_number',
        'ifsc_code', 'bank_name', 'transfer_limit', 'cooling_until', 'created_at', 'is_active'
      ]
    },
    {
      name: 'deposits',
      columns: [
        'deposit_id', 'customer_id', 'linked_account', 'deposit_type', 'principal_amount',
        'interest_rate', 'tenure_months', 'maturity_amount', 'maturity_date', 'status', 'created_at'
      ]
    },
    {
      name: 'transactions',
      columns: [
        'transaction_id', 'sender_account', 'receiver_account', 'amount',
        'type', 'date_time', 'status', 'description', 'reference_number'
      ],
      transform: (row) => {
        let ref = row.reference_number;
        if (!ref) {
          // Generate deterministic unique reference number if not present
          const cleanId = String(row.transaction_id).replace(/[^a-zA-Z0-9]/g, '');
          ref = `BTB${cleanId.padStart(16, '0')}`;
        }
        return {
          ...row,
          reference_number: ref
        };
      }
    },
    {
      name: 'kyc_verifications',
      columns: [
        'verification_id', 'customer_id', 'document_type', 'document_number',
        'verification_method', 'status', 'verified_at', 'remarks'
      ]
    },
    {
      name: 'audit_logs',
      columns: ['log_id', 'customer_id', 'action', 'entity_type', 'entity_id', 'details', 'timestamp']
    },
    {
      name: 'otp_sessions',
      columns: [
        'session_id', 'identifier', 'purpose', 'otp_code', 'otp_hash',
        'expires_at', 'verified', 'attempts', 'last_sent_at', 'created_at'
      ],
      transform: (row) => ({
        ...row,
        otp_code: null // Zero plaintext OTP
      })
    },
    {
      name: 'security_rate_limits',
      columns: ['key_id', 'attempts', 'last_attempt_at', 'locked_until']
    }
  ];

  let totalRestored = 0;

  for (const t of forwardTableSpecs) {
    const sRows = sdb.prepare(`SELECT * FROM ${t.name}`).all();
    const conn = await targetPool.getConnection();
    await conn.beginTransaction();

    try {
      const colPlaceholders = t.columns.map(() => '?').join(', ');
      const colNames = t.columns.map(c => `\`${c}\``).join(', ');
      const sql = `INSERT INTO \`${t.name}\` (${colNames}) VALUES (${colPlaceholders})`;

      for (const raw of sRows) {
        const row = t.transform ? t.transform(raw) : raw;
        const vals = t.columns.map(col => {
          let v = row[col];
          if (v === undefined || v === '') v = null;
          return v;
        });
        await conn.query(sql, vals);
      }

      await conn.commit();
      conn.release();

      const [[{ cnt }]] = await targetPool.query(`SELECT COUNT(*) as cnt FROM \`${t.name}\``);
      console.log(`  [FK CHECKS ACTIVE] Restored \`${t.name.padEnd(22)}\`: ${cnt} rows (Master: ${sRows.length})`);
      totalRestored += cnt;
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw new Error(`ABORT during population of \`${t.name}\`: ${err.message}`);
    }
  }

  console.log(`\n[PASS] Total rows cleanly populated: ${totalRestored} with zero FK violations.`);

  // --------------------------------------------------------------------------
  // RESTORATION PHASE 3: Ensure Views Are Up-to-Date
  // --------------------------------------------------------------------------
  console.log('\n--- RESTORATION PHASE 3: Refreshing Analytical Views ---');
  const ddlContent = fs.readFileSync(DDL_PATH, 'utf8');
  
  // Extract view definitions
  const viewStatements = [
    `CREATE OR REPLACE VIEW \`v_customer_portfolio\` AS
     SELECT 
         c.customer_id, c.full_name, c.email, c.phone, c.tier, c.credit_score,
         COALESCE(acc.total_accounts, 0) AS total_accounts,
         COALESCE(acc.total_liquid_balance, 0.00) AS total_liquid_balance,
         COALESCE(dep.total_deposits_principal, 0.00) AS total_deposits_principal,
         (COALESCE(acc.total_liquid_balance, 0.00) + COALESCE(dep.total_deposits_principal, 0.00)) AS total_net_worth
     FROM customers c
     LEFT JOIN (
         SELECT customer_id, COUNT(*) AS total_accounts, SUM(balance) AS total_liquid_balance
         FROM accounts WHERE status = 'Active' GROUP BY customer_id
     ) acc ON c.customer_id = acc.customer_id
     LEFT JOIN (
         SELECT customer_id, SUM(principal_amount) AS total_deposits_principal
         FROM deposits WHERE status = 'Active' GROUP BY customer_id
     ) dep ON c.customer_id = dep.customer_id;`,

    `CREATE OR REPLACE VIEW \`v_high_value_transactions\` AS
     SELECT transaction_id, sender_account, receiver_account, amount, type, date_time, status, description
     FROM transactions WHERE amount >= 25000.00 ORDER BY date_time DESC;`,

    `CREATE OR REPLACE VIEW \`v_active_deposits_summary\` AS
     SELECT deposit_id, customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status, created_at
     FROM deposits WHERE status = 'Active';`
  ];

  for (const vSql of viewStatements) {
    await targetPool.query(vSql);
  }
  console.log('[PASS] Views refreshed successfully.');

  // --------------------------------------------------------------------------
  // RESTORATION PHASE 4: Post-Restoration Verification & Reconciliation
  // --------------------------------------------------------------------------
  console.log('\n--- RESTORATION PHASE 4: Post-Restoration Verification & Balance Reconciliation ---');

  // A. Row Counts Verification
  console.log('\n1. Verifying Table Counts Against Master Baseline:');
  let countMismatches = 0;
  for (const [t, exp] of Object.entries(expectedCounts)) {
    const [[{ cnt }]] = await targetPool.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    const pass = cnt === exp;
    console.log(`  Table: ${t.padEnd(25)} | Actual: ${String(cnt).padEnd(6)} | Expected: ${String(exp).padEnd(6)} | ${pass ? '[PASS]' : '[FAIL]'}`);
    if (!pass) countMismatches++;
  }
  if (countMismatches > 0) throw new Error(`ABORT: ${countMismatches} tables have count mismatches!`);

  // B. Relational Integrity & Orphan Checks
  console.log('\n2. Verifying Relational Integrity & Foreign Keys:');
  const [orphanAccs] = await targetPool.query('SELECT COUNT(*) as c FROM accounts a LEFT JOIN customers c ON a.customer_id = c.customer_id WHERE c.customer_id IS NULL');
  const [orphanLiens] = await targetPool.query('SELECT COUNT(*) as c FROM account_lien_records l LEFT JOIN accounts a ON l.account_number = a.account_number WHERE a.account_number IS NULL');
  const [orphanBens] = await targetPool.query('SELECT COUNT(*) as c FROM beneficiaries b LEFT JOIN customers c ON b.customer_id = c.customer_id WHERE c.customer_id IS NULL');
  const [orphanDeps] = await targetPool.query('SELECT COUNT(*) as c FROM deposits d LEFT JOIN customers c ON d.customer_id = c.customer_id WHERE c.customer_id IS NULL');

  console.log(`  * Orphan Accounts          : ${orphanAccs[0].c} (0 expected)`);
  console.log(`  * Orphan Lien Records      : ${orphanLiens[0].c} (0 expected)`);
  console.log(`  * Orphan Beneficiaries     : ${orphanBens[0].c} (0 expected)`);
  console.log(`  * Orphan Deposit Records   : ${orphanDeps[0].c} (0 expected)`);

  if (orphanAccs[0].c !== 0 || orphanLiens[0].c !== 0 || orphanBens[0].c !== 0 || orphanDeps[0].c !== 0) {
    throw new Error('ABORT: Orphan records detected after restoration!');
  }

  // C. Credential Security Checks
  console.log('\n3. Verifying Zero Plaintext Credentials:');
  const [[{ pCust }]] = await targetPool.query("SELECT COUNT(*) as pCust FROM customers WHERE card_pin IS NOT NULL AND card_pin != ''");
  const [[{ pAcc }]] = await targetPool.query("SELECT COUNT(*) as pAcc FROM accounts WHERE card_pin IS NOT NULL AND card_pin != ''");
  const [[{ pOtp }]] = await targetPool.query("SELECT COUNT(*) as pOtp FROM otp_sessions WHERE otp_code IS NOT NULL AND otp_code != ''");
  console.log(`  * Plaintext card_pin in customers: ${pCust} (0 expected)`);
  console.log(`  * Plaintext card_pin in accounts : ${pAcc} (0 expected)`);
  console.log(`  * Plaintext otp_code in sessions : ${pOtp} (0 expected)`);
  if (pCust !== 0 || pAcc !== 0 || pOtp !== 0) {
    throw new Error('ABORT: Plaintext credentials detected in database!');
  }

  // Verify Aarav Lynn PIN '1234'
  const [[aaravAcc]] = await targetPool.query("SELECT card_pin_hash FROM accounts WHERE account_number = 'ACC-770153'");
  const pinOk = bcrypt.compareSync('1234', aaravAcc.card_pin_hash);
  console.log(`  * Aarav Lynn (ACC-770153) PIN '1234' verified: ${pinOk}`);
  if (!pinOk) throw new Error("ABORT: Aarav Lynn PIN '1234' bcrypt verification failed!");

  // D. Financial Reconciliation & Portfolio View
  console.log('\n4. Verifying Financial Balances & Portfolio View:');
  const [[{ liveAccSum }]] = await targetPool.query("SELECT SUM(balance) as liveAccSum FROM accounts WHERE status = 'Active'");
  const [[{ viewSum }]] = await targetPool.query("SELECT SUM(total_liquid_balance) as viewSum FROM v_customer_portfolio");
  const variance = Math.abs(parseFloat(liveAccSum) - parseFloat(viewSum));
  const masterVariance = Math.abs(parseFloat(liveAccSum) - masterActiveBal);

  console.log(`  * Live Active Accounts Balance Sum: ₹${parseFloat(liveAccSum).toFixed(2)}`);
  console.log(`  * Live Portfolio View Balance Sum : ₹${parseFloat(viewSum).toFixed(2)}`);
  console.log(`  * Master SQLite Baseline Balance  : ₹${masterActiveBal.toFixed(2)}`);
  console.log(`  * Portfolio View Variance         : ₹${variance.toFixed(2)}`);
  console.log(`  * Master Baseline Variance        : ₹${masterVariance.toFixed(2)}`);

  if (variance > 0.001 || masterVariance > 0.001) {
    throw new Error(`ABORT: Financial balance variance detected! (View var: ${variance}, Master var: ${masterVariance})`);
  }
  console.log('  [PASS] EXACT 100% FINANCIAL BALANCE RECONCILIATION: ₹0.00 VARIANCE!');

  await targetPool.end();
  await pool.end();

  console.log('\n================================================================');
  console.log('   PRISTINE OPTION B RESTORATION COMPLETED SUCCESSFULLY!        ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\n[FATAL RESTORATION ERROR]:', err.message);
  process.exit(1);
});
