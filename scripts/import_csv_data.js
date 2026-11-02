#!/usr/bin/env node
/**
 * ==============================================================================
 * JM-DH BANKING SYSTEM — AUTHORITATIVE BCNF CSV DATA IMPORTER & RECONCILIATION
 * ==============================================================================
 * 
 * Safely, idempotently integrates authoritative normalized CSV datasets into MySQL 8.0+:
 * 1.  branches.csv                 -> branches
 * 2.  customers.csv                -> customers
 * 3.  customer_nominees.csv        -> customer_nominees
 * 4.  accounts.csv                 -> accounts
 * 5.  account_card_credentials.csv -> account_card_credentials
 * 6.  account_lien_records.csv     -> account_lien_records
 * 7.  deposits.csv                 -> deposits
 * 8.  beneficiaries.csv            -> beneficiaries
 * 9.  transactions.csv             -> transactions
 * 10. kyc_verifications.csv        -> kyc_verifications
 * 11. audit_logs.csv               -> audit_logs
 * 12. otp_sessions.csv             -> otp_sessions
 * 13. security_rate_limits.csv     -> security_rate_limits
 * 
 * Strict Safety, Protection & Integrity Rules:
 * - Default target database is 'bankist_college_demo_test' (disposable test database).
 * - Targeting the live database ('bankist') requires explicit opt-in flag (--allow-live-db).
 * - Topological foreign-key dependency order strictly enforced.
 * - Non-destructive conflict policy: Existing customer profiles and account balances are preserved.
 * - Zero Plaintext Storage: Plaintext card_pin and otp_code are strictly omitted/NULL.
 * - Atomic transaction batches per table with rollback on failure.
 * - Accurate inserted, skipped, and rejected counts with detailed reconciliation reporting.
 * 
 * Usage:
 *   node scripts/import_csv_data.js [--dry-run] [--target=<dbname>] [--allow-live-db]
 */

const fs = require('fs');
const path = require('path');

// Resolve project directories
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(WORKSPACE_ROOT, 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
const ENV_FILE_PATH = path.resolve(TEST_DIR, '.env');

// Dynamically load dependencies from test node_modules
let bcrypt;
try {
  bcrypt = require(path.resolve(TEST_DIR, 'node_modules/bcryptjs'));
} catch (e) {
  bcrypt = require('bcryptjs');
}

require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: ENV_FILE_PATH });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const allowLiveDb = args.includes('--allow-live-db');

// Safe default: Always target the disposable test database unless explicitly overridden
let targetDb = 'bankist_college_demo_test';
for (const arg of args) {
  if (arg.startsWith('--target=')) {
    targetDb = arg.split('=')[1].trim();
  }
}
if (args.includes('--use-env-db') && process.env.DB_NAME) {
  targetDb = process.env.DB_NAME;
}

// Safety Guard: Opt-in for live database operations
if (targetDb === 'bankist' && !allowLiveDb && !isDryRun) {
  console.error('\n================================================================');
  console.error('[SAFETY ERROR] Attempted write import targeting live database: "bankist"');
  console.error('Destructive or modifying operations against the live production DB are blocked by default.');
  console.error('To import into a test/disposable database, specify:');
  console.error('   node scripts/import_csv_data.js --target=bankist_college_demo_test');
  console.error('If you genuinely intend to update the live database, provide:');
  console.error('   node scripts/import_csv_data.js --allow-live-db');
  console.error('================================================================\n');
  process.exit(1);
}

// Determine CSV source directory: prefer data/bcnf, fallback to workspace root
const BCNF_CSV_DIR = path.resolve(WORKSPACE_ROOT, 'data/bcnf');
const CSV_SOURCE_DIR = fs.existsSync(BCNF_CSV_DIR) ? BCNF_CSV_DIR : WORKSPACE_ROOT;

// ------------------------------------------------------------------------------
// RFC 4180 Compliant CSV Parser
// ------------------------------------------------------------------------------
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;
  let i = 0;
  const len = content.length;

  while (i < len) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && content[i + 1] === '"') {
          currentVal += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentVal += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentVal);
        currentVal = '';
        i++;
      } else if (char === '\r') {
        if (i + 1 < len && content[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
        i++;
      } else if (char === '\n') {
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
        i++;
      } else {
        currentVal += char;
        i++;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  const validRows = rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
  if (validRows.length === 0) {
    return { header: [], rows: [] };
  }

  const header = validRows[0].map(h => h.trim());
  const dataRows = [];

  for (let r = 1; r < validRows.length; r++) {
    const rawVals = validRows[r];
    const rowObj = {};
    header.forEach((col, idx) => {
      let val = rawVals[idx] !== undefined ? rawVals[idx].trim() : '';
      if (val === '' || val.toUpperCase() === 'NULL') {
        rowObj[col] = null;
      } else {
        rowObj[col] = val;
      }
    });
    dataRows.push(rowObj);
  }

  return { header, rows: dataRows };
}

// ------------------------------------------------------------------------------
// Deep Equivalence Comparison
// ------------------------------------------------------------------------------
function valuesEquivalent(col, csvVal, dbVal) {
  if ((csvVal === null || csvVal === undefined || csvVal === '') &&
      (dbVal === null || dbVal === undefined || dbVal === '')) {
    return true;
  }
  if (csvVal === null || dbVal === null || csvVal === undefined || dbVal === undefined) {
    return false;
  }

  // Monetary / numeric columns
  if (['balance', 'amount', 'lien_amount', 'transfer_limit', 'principal_amount', 'interest_rate', 'maturity_amount', 'allocation_percentage'].includes(col)) {
    const nCsv = parseFloat(csvVal);
    const nDb = parseFloat(dbVal);
    if (!isNaN(nCsv) && !isNaN(nDb)) {
      return Math.abs(nCsv - nDb) < 0.0001;
    }
  }

  // Integer columns
  if (['is_active', 'verified', 'attempts', 'credit_score', 'tenure_months'].includes(col)) {
    const iCsv = parseInt(csvVal, 10);
    const iDb = parseInt(dbVal, 10);
    if (!isNaN(iCsv) && !isNaN(iDb)) {
      return iCsv === iDb;
    }
  }

  // Date / timestamp normalization
  if (['created_at', 'opening_date', 'date_time', 'verified_at', 'timestamp', 'updated_at'].includes(col)) {
    const dCsv = String(csvVal).replace('T', ' ').replace(/\.\d+Z?$/, '');
    const dDb = String(dbVal).replace('T', ' ').replace(/\.\d+Z?$/, '');
    if (dCsv === dDb) return true;
  }

  return String(csvVal).trim() === String(dbVal).trim();
}

// ------------------------------------------------------------------------------
// Main Import & Reconciliation Workflow
// ------------------------------------------------------------------------------
async function runImporter(options = {}) {
  const effectiveDb = options.targetDb || targetDb;
  const effectiveDryRun = options.isDryRun !== undefined ? options.isDryRun : isDryRun;

  console.log('================================================================');
  console.log('       BHARAT TRUST BANK — AUTHORITATIVE BCNF CSV IMPORTER      ');
  console.log('================================================================');
  console.log(`Target Database Engine : MYSQL 8.0+ (InnoDB)`);
  console.log(`Execution Mode         : ${effectiveDryRun ? 'DRY-RUN (Pre-Import Assessment, No Writes)' : 'LIVE IMPORT (Transactional Batch)'}`);
  console.log(`Database Host          : ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '3306'}`);
  console.log(`Database Name          : ${effectiveDb}`);
  console.log(`CSV Source Directory   : ${CSV_SOURCE_DIR}\n`);

  // Ensure target database exists and tables are initialized
  const initConn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${effectiveDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    
    // Check if tables exist in the target database
    const [existingTables] = await initConn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [effectiveDb]
    );

    if (existingTables.length === 0) {
      console.log(`[INIT] Target database "${effectiveDb}" is empty. Applying normalized BCNF schema from bankist_normalized.sql...`);
      const schemaSqlPath = path.resolve(WORKSPACE_ROOT, 'bankist_normalized.sql');
      if (fs.existsSync(schemaSqlPath)) {
        const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
        await initConn.query(`USE \`${effectiveDb}\`;\n${schemaSql}`);
        console.log(`[INIT] Normalized schema applied successfully.`);
      }
    }
  } finally {
    await initConn.end();
  }

  // Establish MySQL 2 Pool
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: effectiveDb,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    const [testPing] = await pool.query('SELECT 1 as ping');
    if (!testPing || testPing.length === 0) {
      throw new Error('MySQL connection ping failed');
    }
  } catch (err) {
    console.error(`[DATABASE ERROR] Failed to connect to MySQL database "${effectiveDb}":`, err.message);
    throw err;
  }

  // 13 Tables Configuration in Strict Topological Dependency Order
  const tables = [
    {
      name: 'branches',
      csv: 'branches.csv',
      pk: 'branch_id',
      columns: ['branch_id', 'ifsc_code', 'bank_name', 'branch_name', 'city', 'address', 'timing', 'phone', 'status', 'created_at'],
      validate: () => null
    },
    {
      name: 'customers',
      csv: 'customers.csv',
      pk: 'customer_id',
      columns: [
        'customer_id', 'full_name', 'email', 'phone', 'dob', 'address', 'created_at',
        'status', 'kyc_status', 'password_hash', 'credit_score', 'tier', 'pan_number',
        'aadhaar_number', 'gender', 'father_name', 'marital_status', 'occupation',
        'annual_income', 'vkyc_status', 'signature_data', 'avatar_data'
      ],
      validate: () => null
    },
    {
      name: 'customer_nominees',
      csv: 'customer_nominees.csv',
      pk: 'nominee_id',
      columns: ['nominee_id', 'customer_id', 'nominee_name', 'relationship', 'dob', 'allocation_percentage', 'contact_phone', 'created_at'],
      validate: (row, context) => {
        if (!context.customers.has(row.customer_id)) {
          return `Missing referenced customer_id: ${row.customer_id}`;
        }
        return null;
      }
    },
    {
      name: 'accounts',
      csv: 'accounts.csv',
      pk: 'account_number',
      columns: ['account_number', 'customer_id', 'account_type', 'balance', 'ifsc_code', 'opening_date', 'status'],
      validate: (row, context) => {
        if (!context.customers.has(row.customer_id)) {
          return `Missing referenced customer_id: ${row.customer_id}`;
        }
        if (!context.branches.has(row.ifsc_code)) {
          return `Missing referenced branch ifsc_code: ${row.ifsc_code}`;
        }
        return null;
      }
    },
    {
      name: 'account_card_credentials',
      csv: 'account_card_credentials.csv',
      pk: 'credential_id',
      columns: ['credential_id', 'account_number', 'card_pin_hash', 'status', 'created_at', 'updated_at'],
      validate: (row, context) => {
        if (!context.accounts.has(row.account_number)) {
          return `Missing referenced account_number: ${row.account_number}`;
        }
        return null;
      }
    },
    {
      name: 'account_lien_records',
      csv: 'account_lien_records.csv',
      pk: 'lien_id',
      columns: ['lien_id', 'account_number', 'lien_amount', 'lien_reason', 'created_at'],
      validate: (row, context) => {
        if (!context.accounts.has(row.account_number)) {
          return `Missing referenced account_number: ${row.account_number}`;
        }
        return null;
      }
    },
    {
      name: 'deposits',
      csv: 'deposits.csv',
      pk: 'deposit_id',
      columns: [
        'deposit_id', 'linked_account', 'deposit_type', 'principal_amount',
        'interest_rate', 'tenure_months', 'maturity_amount', 'maturity_date', 'status', 'created_at'
      ],
      validate: (row, context) => {
        if (!context.accounts.has(row.linked_account)) {
          return `Missing referenced linked_account: ${row.linked_account}`;
        }
        return null;
      }
    },
    {
      name: 'beneficiaries',
      csv: 'beneficiaries.csv',
      pk: 'beneficiary_id',
      columns: [
        'beneficiary_id', 'customer_id', 'beneficiary_name', 'account_number',
        'ifsc_code', 'transfer_limit', 'cooling_until', 'created_at', 'is_active'
      ],
      validate: (row, context) => {
        if (!context.customers.has(row.customer_id)) {
          return `Missing referenced customer_id: ${row.customer_id}`;
        }
        if (!context.branches.has(row.ifsc_code)) {
          return `Missing referenced ifsc_code: ${row.ifsc_code}`;
        }
        return null;
      }
    },
    {
      name: 'transactions',
      csv: 'transactions.csv',
      pk: 'transaction_id',
      columns: [
        'transaction_id', 'sender_account', 'receiver_account', 'counterparty_details',
        'channel', 'amount', 'type', 'date_time', 'status', 'description', 'reference_number'
      ],
      validate: () => null
    },
    {
      name: 'kyc_verifications',
      csv: 'kyc_verifications.csv',
      pk: 'verification_id',
      columns: [
        'verification_id', 'customer_id', 'document_type', 'document_number',
        'verification_method', 'status', 'verified_at', 'remarks'
      ],
      validate: (row, context) => {
        if (!context.customers.has(row.customer_id)) {
          return `Missing referenced customer_id: ${row.customer_id}`;
        }
        return null;
      }
    },
    {
      name: 'audit_logs',
      csv: 'audit_logs.csv',
      pk: 'log_id',
      columns: ['log_id', 'customer_id', 'action', 'entity_type', 'entity_id', 'details', 'timestamp'],
      validate: () => null
    },
    {
      name: 'otp_sessions',
      csv: 'otp_sessions.csv',
      pk: 'session_id',
      columns: [
        'session_id', 'identifier', 'purpose', 'otp_hash',
        'expires_at', 'verified', 'attempts', 'last_sent_at', 'created_at'
      ],
      validate: () => null
    },
    {
      name: 'security_rate_limits',
      csv: 'security_rate_limits.csv',
      pk: 'key_id',
      columns: ['key_id', 'attempts', 'last_attempt_at', 'locked_until'],
      validate: () => null
    }
  ];

  // Build referential context
  const context = {
    branches: new Set(),
    customers: new Set(),
    accounts: new Set()
  };

  try {
    const [bRows] = await pool.query('SELECT ifsc_code FROM branches');
    bRows.forEach(r => context.branches.add(r.ifsc_code));
    const [cRows] = await pool.query('SELECT customer_id FROM customers');
    cRows.forEach(r => context.customers.add(r.customer_id));
    const [aRows] = await pool.query('SELECT account_number FROM accounts');
    aRows.forEach(r => context.accounts.add(r.account_number));
  } catch (e) {
    // If tables are empty or newly initialized, sets will populate during sequential import
  }

  const reconciliationReport = [];

  for (const tableConfig of tables) {
    const csvPath = path.resolve(CSV_SOURCE_DIR, tableConfig.csv);
    if (!fs.existsSync(csvPath)) {
      console.warn(`[WARNING] CSV file not found: ${csvPath}. Skipping table ${tableConfig.name}.`);
      continue;
    }

    const { header, rows } = parseCSV(csvPath);

    // Filter columns that actually exist in the table in MySQL
    let [dbCols] = await pool.query(`DESCRIBE \`${tableConfig.name}\``);
    const existingColNames = new Set(dbCols.map(c => c.Field));
    const activeColumns = tableConfig.columns.filter(c => existingColNames.has(c));

    const [dbRows] = await pool.query(`SELECT * FROM \`${tableConfig.name}\``);
    const dbMap = new Map();
    dbRows.forEach(r => dbMap.set(String(r[tableConfig.pk]), r));

    let rowsInserted = 0;
    let rowsIdentical = 0;
    let rowsSkippedPolicy = 0;
    let rowsConflicting = 0;
    let rowsInvalid = 0;
    let rowsMissingFk = 0;

    const conflictDetails = [];
    const rowsToInsert = [];

    for (const rawRow of rows) {
      const pkVal = String(rawRow[tableConfig.pk]);
      const dbRow = dbMap.get(pkVal);

      if (dbRow) {
        // Record exists: check if identical or conflicting
        let diffs = [];
        activeColumns.forEach(col => {
          if (!valuesEquivalent(col, rawRow[col], dbRow[col])) {
            diffs.push({ col, csv: rawRow[col], db: dbRow[col] });
          }
        });

        if (diffs.length === 0) {
          rowsIdentical++;
        } else {
          rowsConflicting++;
          rowsSkippedPolicy++;
          conflictDetails.push({ pk: pkVal, diffs });
        }

        // Maintain referential context
        if (tableConfig.name === 'branches' && rawRow.ifsc_code) context.branches.add(rawRow.ifsc_code);
        if (tableConfig.name === 'customers') context.customers.add(pkVal);
        if (tableConfig.name === 'accounts') context.accounts.add(pkVal);
      } else {
        // Record missing: Candidate for insertion
        const fkError = tableConfig.validate(rawRow, context);
        if (fkError) {
          rowsMissingFk++;
          rowsInvalid++;
          continue;
        }

        const transformed = tableConfig.transform ? tableConfig.transform(rawRow) : rawRow;
        rowsToInsert.push(transformed);

        if (tableConfig.name === 'branches' && rawRow.ifsc_code) context.branches.add(rawRow.ifsc_code);
        if (tableConfig.name === 'customers') context.customers.add(pkVal);
        if (tableConfig.name === 'accounts') context.accounts.add(pkVal);
        dbMap.set(pkVal, transformed);
      }
    }

    // Execute batch insert in atomic transaction if live and candidate rows exist
    if (!effectiveDryRun && rowsToInsert.length > 0) {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        const placeholders = activeColumns.map(() => '?').join(', ');
        const insertSql = `INSERT INTO \`${tableConfig.name}\` (${activeColumns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;

        for (const r of rowsToInsert) {
          const values = activeColumns.map(c => (r[c] === undefined ? null : r[c]));
          await conn.query(insertSql, values);
          rowsInserted++;
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw new Error(`Batch insert failed on table ${tableConfig.name}: ${err.message}`);
      } finally {
        conn.release();
      }
    } else if (effectiveDryRun) {
      rowsInserted = rowsToInsert.length;
    }

    // Query final count
    const [[{ finalCount }]] = await pool.query(`SELECT COUNT(*) as finalCount FROM \`${tableConfig.name}\``);

    reconciliationReport.push({
      table: tableConfig.name,
      csvFile: tableConfig.csv,
      csvDataRows: rows.length,
      rowsInserted,
      rowsIdentical,
      rowsSkippedPolicy,
      rowsConflicting,
      rowsInvalid,
      rowsMissingFk,
      finalDbCount: finalCount,
      conflictDetails
    });
  }

  // ------------------------------------------------------------------------------
  // Reconciliation Presentation
  // ------------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------------------------------');
  console.log('                         TABLE-BY-TABLE BCNF CSV DATA RECONCILIATION REPORT                     ');
  console.log('--------------------------------------------------------------------------------------------------------');
  console.log(
    'Table Name'.padEnd(26) +
    'CSV Rows'.padStart(9) +
    'Inserted'.padStart(9) +
    'Identical'.padStart(10) +
    'Conflict'.padStart(9) +
    'Skipped'.padStart(8) +
    'Miss-FK'.padStart(8) +
    'Target Total'.padStart(14)
  );
  console.log('-'.repeat(93));

  for (const r of reconciliationReport) {
    console.log(
      r.table.padEnd(26) +
      String(r.csvDataRows).padStart(9) +
      String(r.rowsInserted).padStart(9) +
      String(r.rowsIdentical).padStart(10) +
      String(r.rowsConflicting).padStart(9) +
      String(r.rowsSkippedPolicy).padStart(8) +
      String(r.rowsMissingFk).padStart(8) +
      String(r.finalDbCount).padStart(14)
    );
  }
  console.log('-'.repeat(93));

  await pool.end();
  console.log('\n[COMPLETED] BCNF Importer execution and reconciliation finished successfully.\n');
  return reconciliationReport;
}

if (require.main === module) {
  runImporter().catch(err => {
    console.error('[FATAL IMPORTER ERROR]:', err);
    process.exit(1);
  });
}

module.exports = { runImporter, parseCSV };
