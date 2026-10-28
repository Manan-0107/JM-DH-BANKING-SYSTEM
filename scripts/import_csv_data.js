#!/usr/bin/env node
/**
 * ==============================================================================
 * JM-DH BANKING SYSTEM — AUTHORITATIVE MYSQL 8.0+ CSV DATA IMPORTER & RECONCILIATION
 * ==============================================================================
 * 
 * Safely, idempotently integrates authoritative CSV datasets into MySQL 8.0+ (bankist):
 * 1.  branches.csv             -> branches
 * 2.  customers.csv            -> customers
 * 3.  accounts.csv             -> accounts
 * 4.  account_lien_records.csv -> account_lien_records
 * 5.  beneficiaries.csv        -> beneficiaries
 * 6.  deposits.csv             -> deposits
 * 7.  transactions.csv         -> transactions
 * 8.  kyc_verifications.csv    -> kyc_verifications
 * 9.  audit_logs.csv           -> audit_logs
 * 10. otp_sessions.csv        -> otp_sessions
 * 11. security_rate_limits.csv-> security_rate_limits
 * 
 * Strict Data Protection & Integrity Rules:
 * - MySQL 8.0+ is the exclusive runtime database.
 * - Topological foreign-key dependency order strictly enforced.
 * - Non-destructive conflict policy: Existing customer profiles, live balances,
 *   remediated bcrypt hashes, and audit histories are strictly preserved and NEVER overwritten.
 * - Zero Plaintext Storage: Plaintext card_pin and otp_code are strictly set to NULL in DB.
 * - Atomic transaction batches per table with full rollback on failure.
 * - Full audit reconciliation reporting per table.
 * 
 * Usage:
 *   node scripts/import_csv_data.js [--dry-run]
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
// Field Normalization for Deep Equivalence
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
  if (['balance', 'amount', 'lien_amount', 'transfer_limit', 'principal_amount', 'interest_rate', 'maturity_amount'].includes(col)) {
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
  if (['created_at', 'opening_date', 'date_time', 'verified_at', 'timestamp'].includes(col)) {
    const dCsv = String(csvVal).replace('T', ' ').replace(/\.\d+Z?$/, '');
    const dDb = String(dbVal).replace('T', ' ').replace(/\.\d+Z?$/, '');
    if (dCsv === dDb) return true;
  }

  return String(csvVal).trim() === String(dbVal).trim();
}

// ------------------------------------------------------------------------------
// Main Import & Reconciliation Workflow
// ------------------------------------------------------------------------------
async function runImporter() {
  console.log('================================================================');
  console.log('       BHARAT TRUST BANK — AUTHORITATIVE CSV DATA IMPORTER      ');
  console.log('================================================================');
  console.log(`Target Database Engine : MYSQL 8.0+ (Exclusive)`);
  console.log(`Execution Mode         : ${isDryRun ? 'DRY-RUN (Pre-Import Assessment, No Writes)' : 'LIVE IMPORT (Transactional Batch)'}`);
  console.log(`Database Host          : ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '3306'}`);
  console.log(`Database Name          : ${process.env.DB_NAME || 'bankist'}`);
  console.log(`CSV Source Directory   : ${WORKSPACE_ROOT}\n`);

  // Establish MySQL 2 Pool
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'bankist',
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
    console.error('[DATABASE ERROR] Failed to connect to MySQL 8.0:', err.message);
    process.exit(1);
  }

  // Table Configuration in Strict Dependency Order
  const tables = [
    {
      name: 'branches',
      csv: 'branches.csv',
      pk: 'branch_id',
      columns: ['branch_id', 'branch_name', 'ifsc_code', 'city', 'address', 'timing', 'phone', 'status'],
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
        'annual_income', 'nominee_name', 'nominee_relation', 'nominee_dob', 'vkyc_status',
        'signature_data', 'avatar_data', 'card_pin', 'card_pin_hash'
      ],
      transform: (row) => {
        const rawPin = row.card_pin ? row.card_pin.toString().trim() : '';
        let cardPinHash = row.card_pin_hash;
        if (rawPin && (!cardPinHash || cardPinHash.length === 64)) {
          cardPinHash = bcrypt.hashSync(rawPin, 10);
        }
        return {
          ...row,
          card_pin: null, // Strictly eliminate plaintext PIN
          card_pin_hash: cardPinHash
        };
      },
      validate: () => null
    },
    {
      name: 'accounts',
      csv: 'accounts.csv',
      pk: 'account_number',
      columns: [
        'account_number', 'customer_id', 'account_type', 'balance', 'ifsc_code',
        'branch_name', 'opening_date', 'status', 'card_pin', 'card_pin_hash'
      ],
      transform: (row) => {
        const rawPin = row.card_pin ? row.card_pin.toString().trim() : '';
        let cardPinHash = row.card_pin_hash;
        if (rawPin && (!cardPinHash || cardPinHash.length === 64)) {
          cardPinHash = bcrypt.hashSync(rawPin, 10);
        }
        return {
          ...row,
          card_pin: null, // Strictly eliminate plaintext PIN
          card_pin_hash: cardPinHash
        };
      },
      validate: (row, context) => {
        if (!context.customers.has(row.customer_id)) {
          return `Missing referenced customer_id: ${row.customer_id}`;
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
      name: 'beneficiaries',
      csv: 'beneficiaries.csv',
      pk: 'beneficiary_id',
      columns: [
        'beneficiary_id', 'customer_id', 'beneficiary_name', 'account_number',
        'ifsc_code', 'bank_name', 'transfer_limit', 'cooling_until', 'created_at', 'is_active'
      ],
      validate: (row, context) => {
        if (!context.customers.has(row.customer_id)) {
          return `Missing referenced customer_id: ${row.customer_id}`;
        }
        return null;
      }
    },
    {
      name: 'deposits',
      csv: 'deposits.csv',
      pk: 'deposit_id',
      columns: [
        'deposit_id', 'customer_id', 'linked_account', 'deposit_type', 'principal_amount',
        'interest_rate', 'tenure_months', 'maturity_amount', 'maturity_date', 'status', 'created_at'
      ],
      validate: (row, context) => {
        if (!context.customers.has(row.customer_id)) {
          return `Missing referenced customer_id: ${row.customer_id}`;
        }
        if (!context.accounts.has(row.linked_account)) {
          return `Missing referenced linked_account: ${row.linked_account}`;
        }
        return null;
      }
    },
    {
      name: 'transactions',
      csv: 'transactions.csv',
      pk: 'transaction_id',
      columns: [
        'transaction_id', 'sender_account', 'receiver_account', 'amount',
        'type', 'date_time', 'status', 'description', 'reference_number'
      ],
      validate: (row, context) => {
        if (row.sender_account && !context.accounts.has(row.sender_account)) {
          return `Missing sender account: ${row.sender_account}`;
        }
        if (row.receiver_account && !context.accounts.has(row.receiver_account)) {
          return `Missing receiver account: ${row.receiver_account}`;
        }
        return null;
      }
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
        'session_id', 'identifier', 'purpose', 'otp_code', 'otp_hash',
        'expires_at', 'verified', 'attempts', 'last_sent_at', 'created_at'
      ],
      transform: (row) => ({
        ...row,
        otp_code: null // Strictly eliminate plaintext OTP
      }),
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
    customers: new Set(),
    accounts: new Set()
  };

  const [cRows] = await pool.query('SELECT customer_id FROM customers');
  cRows.forEach(r => context.customers.add(r.customer_id));
  const [aRows] = await pool.query('SELECT account_number FROM accounts');
  aRows.forEach(r => context.accounts.add(r.account_number));

  const reconciliationReport = [];

  for (const tableConfig of tables) {
    const csvPath = path.resolve(WORKSPACE_ROOT, tableConfig.csv);
    const { header, rows } = parseCSV(csvPath);

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
        tableConfig.columns.forEach(col => {
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

        if (tableConfig.name === 'customers') context.customers.add(pkVal);
        if (tableConfig.name === 'accounts') context.accounts.add(pkVal);
        dbMap.set(pkVal, transformed);
      }
    }

    // Execute batch insert in atomic transaction if live and candidate rows exist
    if (!isDryRun && rowsToInsert.length > 0) {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        const placeholders = tableConfig.columns.map(() => '?').join(', ');
        const insertSql = `INSERT INTO \`${tableConfig.name}\` (${tableConfig.columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;

        for (const r of rowsToInsert) {
          const values = tableConfig.columns.map(c => (r[c] === undefined ? null : r[c]));
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
    } else if (isDryRun) {
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
  console.log('                         TABLE-BY-TABLE CSV DATA RECONCILIATION REPORT                         ');
  console.log('--------------------------------------------------------------------------------------------------------');
  console.log(
    'Table Name'.padEnd(23) +
    'CSV Rows'.padStart(9) +
    'Inserted'.padStart(9) +
    'Identical'.padStart(10) +
    'Conflict'.padStart(9) +
    'Skipped'.padStart(8) +
    'Miss-FK'.padStart(8) +
    'Live DB Total'.padStart(14)
  );
  console.log('-'.repeat(90));

  for (const r of reconciliationReport) {
    console.log(
      r.table.padEnd(23) +
      String(r.csvDataRows).padStart(9) +
      String(r.rowsInserted).padStart(9) +
      String(r.rowsIdentical).padStart(10) +
      String(r.rowsConflicting).padStart(9) +
      String(r.rowsSkippedPolicy).padStart(8) +
      String(r.rowsMissingFk).padStart(8) +
      String(r.finalDbCount).padStart(14)
    );
  }
  console.log('-'.repeat(90));

  // Display Conflict Policy Analysis
  const conflicted = reconciliationReport.filter(r => r.rowsConflicting > 0);
  if (conflicted.length > 0) {
    console.log('\n=== DOCUMENTED CONFLICT POLICY & SAFETY EXPLANATION ===');
    for (const c of conflicted) {
      console.log(`\nTable [${c.table}] — ${c.rowsConflicting} conflicting record(s) safely preserved:`);
      if (c.table === 'customers') {
        console.log('  * Policy: Existing live demo customer profiles (Aarav Lynn, Priya Nair, etc.) and remediated bcrypt');
        console.log('            hashes were strictly preserved. Overwriting with synthetic CSV names would break application logins.');
      } else if (c.table === 'accounts') {
        console.log('  * Policy: Existing live account balances and bcrypt card_pin_hashes were strictly preserved.');
        console.log('            Overwriting with stale CSV balances would destroy financial ledger reconciliation.');
      } else if (c.table === 'beneficiaries') {
        console.log('  * Policy: Seeded demo beneficiaries for CUST-101 (pointing to fellow demo users ACC-553102, etc.)');
        console.log('            were preserved to support frontend instant transfer workflows.');
      } else if (c.table === 'otp_sessions') {
        console.log('  * Policy: Plaintext otp_code values in CSV were rejected to comply with the cryptographic HMAC-SHA256');
        console.log('            security remediation. Existing hashed session records were preserved.');
      }
      console.log(`  * Sample Conflict: PK ${c.conflictDetails[0].pk}: ` +
        c.conflictDetails[0].diffs.slice(0, 3).map(d => `${d.col} (CSV='${d.csv}' vs DB='${d.db}')`).join(', '));
    }
  }

  // Relational Integrity & Monetary Reconciliation Invariant
  console.log('\n=== RELATIONAL INTEGRITY & FINANCIAL BALANCE RECONCILIATION ===');
  const [orphanAccounts] = await pool.query(`
    SELECT COUNT(*) as count FROM accounts a LEFT JOIN customers c ON a.customer_id = c.customer_id WHERE c.customer_id IS NULL
  `);
  const [orphanLiens] = await pool.query(`
    SELECT COUNT(*) as count FROM account_lien_records l LEFT JOIN accounts a ON l.account_number = a.account_number WHERE a.account_number IS NULL
  `);
  const [orphanBeneficiaries] = await pool.query(`
    SELECT COUNT(*) as count FROM beneficiaries b LEFT JOIN customers c ON b.customer_id = c.customer_id WHERE c.customer_id IS NULL
  `);
  const [orphanDeposits] = await pool.query(`
    SELECT COUNT(*) as count FROM deposits d LEFT JOIN customers c ON d.customer_id = c.customer_id WHERE c.customer_id IS NULL
  `);

  console.log(`  * Orphan Accounts          : ${orphanAccounts[0].count} (0 expected)`);
  console.log(`  * Orphan Lien Records      : ${orphanLiens[0].count} (0 expected)`);
  console.log(`  * Orphan Beneficiaries     : ${orphanBeneficiaries[0].count} (0 expected)`);
  console.log(`  * Orphan Deposit Records   : ${orphanDeposits[0].count} (0 expected)`);

  const [[{ accSum }]] = await pool.query('SELECT SUM(balance) as accSum FROM accounts');
  const [[{ portfolioSum }]] = await pool.query('SELECT SUM(total_liquid_balance) as portfolioSum FROM v_customer_portfolio');
  const variance = Math.abs(parseFloat(accSum) - parseFloat(portfolioSum));

  console.log(`  * Accounts Table Balance Sum   : ₹${parseFloat(accSum).toFixed(2)}`);
  console.log(`  * Portfolio View Balance Sum  : ₹${parseFloat(portfolioSum).toFixed(2)}`);
  console.log(`  * Financial Reconciliation Diff: ₹${variance.toFixed(2)} (${variance < 0.01 ? 'EXACT 100% RECONCILED' : 'DISCREPANCY'})`);

  await pool.end();
  console.log('\n[COMPLETED] Importer execution and reconciliation finished successfully.\n');
  return reconciliationReport;
}

if (require.main === module) {
  runImporter().catch(err => {
    console.error('[FATAL IMPORTER ERROR]:', err);
    process.exit(1);
  });
}

module.exports = { runImporter, parseCSV };
