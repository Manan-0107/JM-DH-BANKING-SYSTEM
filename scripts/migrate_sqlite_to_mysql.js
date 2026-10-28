const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const appRoot = path.join(projectRoot, 'DBMS project', 'JM-DH-BANKING-SYSTEM-main', 'JM-DH-BANKING-SYSTEM-main', 'test');

// Load environment variables locally
const dotenv = require(path.join(appRoot, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(appRoot, '.env') });

const sqlite3 = require(path.join(appRoot, 'node_modules', 'sqlite3')).verbose();
const mysql = require(path.join(appRoot, 'node_modules', 'mysql2', 'promise'));

function openSqlite(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function allSqlite(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getSqlite(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// 11 Core Base Tables in strict topological foreign-key order
const BASE_TABLES = [
  { name: 'branches', pk: 'branch_id' },
  { name: 'customers', pk: 'customer_id' },
  { name: 'accounts', pk: 'account_number' },
  { name: 'account_lien_records', pk: 'lien_id' },
  { name: 'beneficiaries', pk: 'beneficiary_id' },
  { name: 'deposits', pk: 'deposit_id' },
  { name: 'transactions', pk: 'transaction_id' },
  { name: 'kyc_verifications', pk: 'verification_id' },
  { name: 'audit_logs', pk: 'log_id' },
  { name: 'otp_sessions', pk: 'session_id' },
  { name: 'security_rate_limits', pk: 'key_id' }
];

// All Declared Foreign-Key Relationships from Schema DDL
const DECLARED_FOREIGN_KEYS = [
  {
    name: 'fk_accounts_customer',
    childTable: 'accounts',
    parentTable: 'customers',
    pairs: [{ childCol: 'customer_id', parentCol: 'customer_id' }]
  },
  {
    name: 'fk_lien_account',
    childTable: 'account_lien_records',
    parentTable: 'accounts',
    pairs: [{ childCol: 'account_number', parentCol: 'account_number' }]
  },
  {
    name: 'fk_ben_customer',
    childTable: 'beneficiaries',
    parentTable: 'customers',
    pairs: [{ childCol: 'customer_id', parentCol: 'customer_id' }]
  },
  {
    name: 'fk_dep_customer',
    childTable: 'deposits',
    parentTable: 'customers',
    pairs: [{ childCol: 'customer_id', parentCol: 'customer_id' }]
  },
  {
    name: 'fk_kyc_customer',
    childTable: 'kyc_verifications',
    parentTable: 'customers',
    pairs: [{ childCol: 'customer_id', parentCol: 'customer_id' }]
  }
];

// Error codes representing data integrity violations, truncation, or coercion:
// 1048 (Cannot be null), 1261 (Row doesn't contain all cols), 1262 (Row truncated),
// 1263 (Set to default value), 1264 (Out of range), 1265 (Data truncated),
// 1292 (Truncated wrong value), 1364 (No default), 1366 (Incorrect string/num value),
// 1406 (Data too long), 1411 (Incorrect datetime)
const CRITICAL_WARNING_CODES = new Set([
  1048, 1261, 1262, 1263, 1264, 1265, 1292, 1364, 1366, 1406, 1411
]);

// Exact Decimal Handling using BigInt integer cents (Zero floating-point rounding)
function parseDecimalToCents(val, label = 'amount') {
  if (val === null || val === undefined) {
    return 0n;
  }
  const str = String(val).trim();
  if (str === '' || str === '0') {
    return 0n;
  }

  // Strictly validate standard decimal format: optional negative sign, integer digits, optional decimal fraction
  const match = str.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error(`[INVALID DECIMAL FORMAT] Value for '${label}' is not a valid numeric string: "${str}"`);
  }

  const isNegative = Boolean(match[1]);
  const wholePart = match[2];
  const fracPart = match[3] || '';

  // Reject unexpected fractional precision (> 2 decimal places) rather than silently truncating
  if (fracPart.length > 2) {
    throw new Error(`[EXCESSIVE DECIMAL PRECISION] Value for '${label}' has ${fracPart.length} decimal places (max 2 expected): "${str}"`);
  }

  // Normalize fractional component to exactly 2 digits: '' -> '00', '5' -> '50', '50' -> '50'
  const normalizedFrac = (fracPart + '00').slice(0, 2);
  const totalCents = BigInt(wholePart) * 100n + BigInt(normalizedFrac);

  return isNegative ? -totalCents : totalCents;
}

// Format BigInt cents directly to string without converting to floating-point Number
function formatBigIntCents(cents) {
  const isNegative = cents < 0n;
  const absCents = isNegative ? -cents : cents;
  const whole = absCents / 100n;
  const frac = absCents % 100n;
  const fracStr = frac < 10n ? '0' + frac.toString() : frac.toString();
  return (isNegative ? '-' : '') + whole.toString() + '.' + fracStr;
}

function compareMonetary(val1, val2, label) {
  try {
    const c1 = parseDecimalToCents(val1, `${label} (SQLite)`);
    const c2 = parseDecimalToCents(val2, `${label} (MySQL)`);
    const match = c1 === c2;
    const diff = c1 - c2;
    return {
      label,
      match,
      formatted1: formatBigIntCents(c1),
      formatted2: formatBigIntCents(c2),
      difference: formatBigIntCents(diff),
      error: null
    };
  } catch (err) {
    return {
      label,
      match: false,
      formatted1: String(val1),
      formatted2: String(val2),
      difference: 'ERROR',
      error: err.message
    };
  }
}

// Robust, timezone-neutral value comparison
function valuesMatch(v1, v2) {
  if (v1 === v2) return true;

  // Strict NULL handling: only null/undefined match null/undefined. Never match empty string to null.
  if ((v1 === null || v1 === undefined) && (v2 === null || v2 === undefined)) return true;
  if ((v1 === null || v1 === undefined) || (v2 === null || v2 === undefined)) return false;

  // Exact type equality check
  if (typeof v1 === 'number' && typeof v2 === 'number') {
    return Math.abs(v1 - v2) < 0.000001;
  }

  // Cross-type numeric comparison (e.g. SQLite integer/real 0 vs MySQL string '0.00')
  if (typeof v1 === 'number' || typeof v2 === 'number') {
    const n1 = Number(v1);
    const n2 = Number(v2);
    if (!isNaN(n1) && !isNaN(n2)) {
      return Math.abs(n1 - n2) < 0.000001;
    }
  }

  const s1 = String(v1).trim();
  const s2 = String(v2).trim();
  if (s1 === s2) return true;

  // Timezone-neutral Date & Datetime normalization: compare 'YYYY-MM-DD HH:MM:SS' across ISO and SQL formats
  // e.g. '2024-01-15T09:00:00' or '2024-01-15T09:00:00.000Z' vs '2024-01-15 09:00:00'
  const d1 = s1.replace('T', ' ').replace(/\.000Z$/, '').slice(0, 19);
  const d2 = s2.replace('T', ' ').replace(/\.000Z$/, '').slice(0, 19);
  if (d1 === d2 && d1.length >= 10) return true;

  // Decimal string normalization if both represent standard numeric decimals (e.g. '0.0' vs '0.00')
  const decRegex = /^-?\d+\.\d+$/;
  if (decRegex.test(s1) && decRegex.test(s2)) {
    try {
      return parseDecimalToCents(s1) === parseDecimalToCents(s2);
    } catch {
      // Fall through if not standard 2-decimal money
    }
  }

  return false;
}

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
  const database = process.env.DB_NAME || 'bankist';

  console.log('================================================================');
  console.log('   JM-DH BANKING SYSTEM — HARDENED SQLITE TO MYSQL 8.0 MIGRATION ');
  console.log('================================================================');
  console.log(`Target MySQL Endpoint: ${user}@${host}:${port}/${database} (Password Redacted)`);

  const sqlitePath = path.join(appRoot, 'bankist.sqlite');
  if (!fs.existsSync(sqlitePath)) {
    console.error(`[FATAL] SQLite database file not found at: ${sqlitePath}`);
    process.exit(1);
  }

  let pool = null;
  let dedicatedConn = null;
  let sqliteDb = null;
  let primaryError = null;
  let cleanupError = null;
  const verificationFailures = [];

  try {
    // 1. Establish MySQL Connection Pool with dateStrings: true for exact date comparison
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      waitForConnections: true,
      connectionLimit: 5,
      dateStrings: true // Return MySQL DATE and DATETIME columns as raw strings ('YYYY-MM-DD HH:MM:SS')
    });

    // Test connectivity
    await pool.query('SELECT 1 as connected');
    console.log(`[CONNECTED] Established connection to MySQL 8.0 at ${host}:${port}`);

    // Ensure destination database exists
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await pool.query(`USE \`${database}\`;`);
    console.log(`[SCHEMA] Target database \`${database}\` confirmed active.`);

    // 2. Acquire a Dedicated Connection for session-level variables, DDL, and transactional loads
    dedicatedConn = await pool.getConnection();
    await dedicatedConn.query(`USE \`${database}\`;`);
    await dedicatedConn.query('SET SESSION sql_mode = "STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION";');

    // Disable foreign key checks strictly on this dedicated session during schema creation and loading
    await dedicatedConn.query('SET FOREIGN_KEY_CHECKS = 0;');
    console.log('[SESSION] Disabled FOREIGN_KEY_CHECKS on dedicated migration connection.');

    // 3. Open SQLite source in READ-ONLY mode
    sqliteDb = await openSqlite(sqlitePath);
    console.log(`[SOURCE] Opened SQLite source in READONLY mode: ${sqlitePath}`);

    // 4. Create Tables with exact InnoDB Schema (Phase 3)
    // NOTE: MySQL DDL statements execute an implicit commit; they cannot be rolled back by an active transaction.
    console.log('\n--- Phase 3: Preparing MySQL InnoDB Schemas & Constraints ---');

    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS \`branches\` (
        \`branch_id\` VARCHAR(50) PRIMARY KEY,
        \`branch_name\` VARCHAR(100) NOT NULL,
        \`ifsc_code\` VARCHAR(20) NOT NULL UNIQUE,
        \`city\` VARCHAR(100) NOT NULL,
        \`address\` TEXT NOT NULL,
        \`timing\` VARCHAR(50) DEFAULT '09:30 AM - 04:30 PM',
        \`phone\` VARCHAR(30) DEFAULT NULL,
        \`status\` VARCHAR(20) DEFAULT 'Active'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`customers\` (
        \`customer_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`full_name\` VARCHAR(150) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL UNIQUE,
        \`phone\` VARCHAR(30) DEFAULT NULL,
        \`dob\` VARCHAR(50) DEFAULT NULL,
        \`address\` TEXT DEFAULT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`status\` VARCHAR(30) DEFAULT 'Active',
        \`kyc_status\` VARCHAR(30) DEFAULT 'Pending',
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`credit_score\` INT DEFAULT 700,
        \`tier\` VARCHAR(30) DEFAULT 'Silver',
        \`pan_number\` VARCHAR(20) DEFAULT NULL,
        \`aadhaar_number\` VARCHAR(20) DEFAULT NULL,
        \`gender\` VARCHAR(20) DEFAULT NULL,
        \`father_name\` VARCHAR(150) DEFAULT NULL,
        \`marital_status\` VARCHAR(30) DEFAULT NULL,
        \`occupation\` VARCHAR(100) DEFAULT NULL,
        \`annual_income\` VARCHAR(100) DEFAULT NULL,
        \`nominee_name\` VARCHAR(150) DEFAULT NULL,
        \`nominee_relation\` VARCHAR(50) DEFAULT NULL,
        \`nominee_dob\` VARCHAR(50) DEFAULT NULL,
        \`vkyc_status\` VARCHAR(50) DEFAULT 'Completed',
        \`signature_data\` LONGTEXT DEFAULT NULL,
        \`avatar_data\` LONGTEXT DEFAULT NULL,
        \`card_pin\` VARCHAR(10) DEFAULT NULL,
        \`card_pin_hash\` VARCHAR(255) DEFAULT NULL,
        INDEX \`idx_cust_email\` (\`email\`),
        INDEX \`idx_cust_phone\` (\`phone\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`accounts\` (
        \`account_number\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`customer_id\` VARCHAR(50) NOT NULL,
        \`account_type\` VARCHAR(50) NOT NULL,
        \`balance\` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        \`ifsc_code\` VARCHAR(20) NOT NULL DEFAULT 'BTBI0001024',
        \`branch_name\` VARCHAR(100) NOT NULL DEFAULT 'Downtown Central',
        \`opening_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`status\` VARCHAR(30) DEFAULT 'Active',
        \`card_pin\` VARCHAR(10) DEFAULT NULL,
        \`card_pin_hash\` VARCHAR(255) DEFAULT NULL,
        INDEX \`idx_acc_customer\` (\`customer_id\`),
        CONSTRAINT \`fk_accounts_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`customer_id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`account_lien_records\` (
        \`lien_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`account_number\` VARCHAR(50) NOT NULL,
        \`lien_amount\` DECIMAL(15,2) NOT NULL,
        \`lien_reason\` TEXT NOT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_lien_acc\` (\`account_number\`),
        CONSTRAINT \`fk_lien_account\` FOREIGN KEY (\`account_number\`) REFERENCES \`accounts\` (\`account_number\`) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`beneficiaries\` (
        \`beneficiary_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`customer_id\` VARCHAR(50) NOT NULL,
        \`beneficiary_name\` VARCHAR(100) NOT NULL,
        \`account_number\` VARCHAR(50) NOT NULL,
        \`ifsc_code\` VARCHAR(20) NOT NULL,
        \`bank_name\` VARCHAR(100) NOT NULL,
        \`transfer_limit\` DECIMAL(15,2) DEFAULT 100000.00,
        \`cooling_until\` DATETIME DEFAULT NULL,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`is_active\` INT DEFAULT 1,
        INDEX \`idx_ben_customer\` (\`customer_id\`),
        CONSTRAINT \`fk_ben_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`customer_id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`deposits\` (
        \`deposit_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`customer_id\` VARCHAR(50) NOT NULL,
        \`linked_account\` VARCHAR(50) NOT NULL,
        \`deposit_type\` VARCHAR(50) NOT NULL,
        \`principal_amount\` DECIMAL(15,2) NOT NULL,
        \`interest_rate\` DECIMAL(5,2) NOT NULL,
        \`tenure_months\` INT NOT NULL,
        \`maturity_amount\` DECIMAL(15,2) NOT NULL,
        \`maturity_date\` DATE NOT NULL,
        \`status\` VARCHAR(30) DEFAULT 'Active',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_dep_customer\` (\`customer_id\`),
        CONSTRAINT \`fk_dep_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`customer_id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`transactions\` (
        \`transaction_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`sender_account\` VARCHAR(50) DEFAULT NULL,
        \`receiver_account\` VARCHAR(50) DEFAULT NULL,
        \`amount\` DECIMAL(15,2) NOT NULL,
        \`type\` VARCHAR(30) NOT NULL,
        \`date_time\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`status\` VARCHAR(30) DEFAULT 'Success',
        \`description\` TEXT DEFAULT NULL,
        \`reference_number\` VARCHAR(100) DEFAULT NULL,
        INDEX \`idx_txn_sender\` (\`sender_account\`),
        INDEX \`idx_txn_receiver\` (\`receiver_account\`),
        INDEX \`idx_txn_date\` (\`date_time\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`kyc_verifications\` (
        \`verification_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`customer_id\` VARCHAR(50) NOT NULL,
        \`document_type\` VARCHAR(50) NOT NULL,
        \`document_number\` VARCHAR(50) DEFAULT NULL,
        \`verification_method\` VARCHAR(50) NOT NULL,
        \`status\` VARCHAR(30) DEFAULT 'Verified',
        \`verified_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`remarks\` TEXT DEFAULT NULL,
        INDEX \`idx_kyc_customer\` (\`customer_id\`),
        CONSTRAINT \`fk_kyc_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`customer_id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`log_id\` VARCHAR(50) PRIMARY KEY,
        \`customer_id\` VARCHAR(50) DEFAULT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`entity_type\` VARCHAR(50) NOT NULL,
        \`entity_id\` VARCHAR(50) DEFAULT NULL,
        \`details\` TEXT DEFAULT NULL,
        \`timestamp\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`otp_sessions\` (
        \`session_id\` VARCHAR(50) PRIMARY KEY,
        \`identifier\` VARCHAR(150) NOT NULL,
        \`purpose\` VARCHAR(50) NOT NULL,
        \`otp_code\` VARCHAR(10) DEFAULT NULL,
        \`otp_hash\` VARCHAR(255) DEFAULT NULL,
        \`expires_at\` BIGINT NOT NULL,
        \`verified\` INT DEFAULT 0,
        \`attempts\` INT DEFAULT 0,
        \`last_sent_at\` BIGINT DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS \`security_rate_limits\` (
        \`key_id\` VARCHAR(191) NOT NULL PRIMARY KEY,
        \`attempts\` INT DEFAULT 1,
        \`last_attempt_at\` BIGINT NOT NULL,
        \`locked_until\` BIGINT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    ];

    for (const stmt of schemaStatements) {
      await dedicatedConn.query(stmt);
    }

    // Recreate the Portfolio view separately
    await dedicatedConn.query(`
      CREATE OR REPLACE VIEW \`v_customer_portfolio\` AS
      SELECT 
          c.customer_id,
          c.full_name,
          c.email,
          c.phone,
          c.tier,
          c.credit_score,
          COUNT(DISTINCT a.account_number) AS total_accounts,
          COALESCE(SUM(a.balance), 0.00) AS total_liquid_balance
      FROM customers c
      LEFT JOIN accounts a ON c.customer_id = a.customer_id AND a.status = 'Active'
      GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.tier, c.credit_score;
    `);

    console.log('[SUCCESS] All 11 base tables and `v_customer_portfolio` view created or confirmed in MySQL.');

    // 5. Data Migration with Per-Table Transactions & Conflict Detection (Phase 4)
    console.log('\n--- Phase 4: Data Migration with Conflict Detection & Transactions ---');

    for (const tableInfo of BASE_TABLES) {
      const tableName = tableInfo.name;
      const pkCol = tableInfo.pk;

      const sqliteRows = await allSqlite(sqliteDb, `SELECT * FROM "${tableName}"`);
      const sourceCount = sqliteRows.length;

      // Query existing rows in destination MySQL to avoid blind overwrite or false count reporting
      const [existingRows] = await dedicatedConn.query(`SELECT * FROM \`${tableName}\``);
      const existingMap = new Map();
      for (const r of existingRows) {
        existingMap.set(String(r[pkCol]), r);
      }

      const rowsToInsert = [];
      let identicalMatches = 0;
      const conflicts = [];

      for (const sRow of sqliteRows) {
        const pkVal = String(sRow[pkCol]);
        if (existingMap.has(pkVal)) {
          const destRow = existingMap.get(pkVal);
          // Compare fields between source and destination
          let hasDiff = false;
          for (const key of Object.keys(sRow)) {
            if (!valuesMatch(sRow[key], destRow[key])) {
              hasDiff = true;
              conflicts.push({
                pk: pkVal,
                column: key,
                sourceValue: sRow[key],
                destValue: destRow[key]
              });
              break;
            }
          }
          if (!hasDiff) {
            identicalMatches++;
          }
        } else {
          rowsToInsert.push(sRow);
        }
      }

      if (conflicts.length > 0) {
        const msg = `Table \`${tableName}\` has ${conflicts.length} conflicting records already in MySQL with divergent values!`;
        console.error(`[CONFLICT ERROR] ${msg}`);
        for (const c of conflicts.slice(0, 3)) {
          console.error(`  - PK ${c.pk}: Column '${c.column}' source='${c.sourceValue}' vs dest='${c.destValue}'`);
        }
        verificationFailures.push(msg);
      }

      let insertedCount = 0;
      if (rowsToInsert.length > 0) {
        const cols = Object.keys(rowsToInsert[0]);
        const colList = cols.map(c => `\`${c}\``).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const insertSql = `INSERT INTO \`${tableName}\` (${colList}) VALUES (${placeholders})`;

        // Transaction per table data load
        await dedicatedConn.beginTransaction();
        try {
          for (const row of rowsToInsert) {
            const values = cols.map(c => row[c] !== undefined ? row[c] : null);
            const [res] = await dedicatedConn.query(insertSql, values);
            if (res.affectedRows > 0) {
              insertedCount++;
            }

            // Inspect warning status immediately after each individual insert before the next query clears it
            const warningCount = (res && (res.warningStatus || res.warningCount)) || 0;
            if (warningCount > 0) {
              const [rowWarnings] = await dedicatedConn.query('SHOW WARNINGS;');
              if (rowWarnings && rowWarnings.length > 0) {
                for (const w of rowWarnings) {
                  const code = Number(w.Code);
                  const msgText = String(w.Message || '');
                  const isIntegrityWarning = w.Level === 'Error' || 
                    w.Level === 'Warning' ||
                    CRITICAL_WARNING_CODES.has(code) ||
                    /truncated|out of range|incorrect|cannot be null|too long|default value/i.test(msgText);

                  const logLine = `Table \`${tableName}\` insert warning [${code}] (${w.Level}): ${msgText}`;
                  if (isIntegrityWarning) {
                    console.error(`[CRITICAL WARNING] ${logLine}`);
                    verificationFailures.push(`Data-integrity warning during insert into \`${tableName}\`: [${code}] ${msgText}`);
                  } else {
                    console.warn(`[INFORMATIONAL NOTE] ${logLine}`);
                  }
                }
              } else {
                const emptyWarnMsg = `Table \`${tableName}\` reported warningCount=${warningCount} on insert, but SHOW WARNINGS returned 0 diagnostic records.`;
                console.error(`[UNRESOLVED WARNING ERROR] ${emptyWarnMsg}`);
                verificationFailures.push(emptyWarnMsg);
              }
            }
          }

          await dedicatedConn.commit();
        } catch (tErr) {
          await dedicatedConn.rollback();
          console.error(`[ROLLBACK] Transaction rolled back for table \`${tableName}\`: ${tErr.message}`);
          throw tErr;
        }
      }

      // Verify row counts for this table
      const [finalCountRows] = await dedicatedConn.query(`SELECT COUNT(*) as c FROM \`${tableName}\``);
      const destCount = finalCountRows[0].c;

      const isCountMatched = sourceCount === destCount;
      if (!isCountMatched) {
        const msg = `Row count mismatch on table \`${tableName}\`: SQLite has ${sourceCount}, MySQL has ${destCount}`;
        verificationFailures.push(msg);
      }

      // Explicitly assert that every source row is accounted for
      if (insertedCount + identicalMatches !== sourceCount) {
        const msg = `Accounting mismatch on table \`${tableName}\`: inserted (${insertedCount}) + existing (${identicalMatches}) !== source (${sourceCount})`;
        verificationFailures.push(msg);
      }

      console.log(
        `[TABLE: ${tableName.padEnd(22)}] ` +
        `Source: ${String(sourceCount).padStart(4)} | ` +
        `Inserted: ${String(insertedCount).padStart(4)} | ` +
        `Identical Existing: ${String(identicalMatches).padStart(4)} | ` +
        `Conflicts: ${String(conflicts.length).padStart(2)} | ` +
        `MySQL Total: ${String(destCount).padStart(4)} | ` +
        `Match: ${isCountMatched ? 'PASS' : 'FAIL'}`
      );
    }

    // 6. View & Foreign-Key Integrity Verification (Phase 5)
    console.log('\n--- Phase 5: Database Object & Foreign-Key Verification ---');

    // 6a. View Verification
    try {
      const [viewRows] = await dedicatedConn.query('SELECT COUNT(*) as c FROM `v_customer_portfolio`;');
      console.log(`[VIEW: v_customer_portfolio  ] Queryable: PASS | Active Customers Evaluated: ${viewRows[0].c}`);
    } catch (vErr) {
      const msg = `View \`v_customer_portfolio\` verification failed: ${vErr.message}`;
      console.error(`[FAIL] ${msg}`);
      verificationFailures.push(msg);
    }

    // 6b. Explicit Post-Load Foreign-Key Orphan Verification across all declared relationships
    console.log('\n--- Verifying Declared Foreign-Key Relationships (Orphan Checks) ---');
    for (const fk of DECLARED_FOREIGN_KEYS) {
      const nonNullConditions = fk.pairs.map(p => `c.\`${p.childCol}\` IS NOT NULL`).join(' AND ');
      const joinConditions = fk.pairs.map(p => `p.\`${p.parentCol}\` = c.\`${p.childCol}\``).join(' AND ');

      const orphanSql = `
        SELECT COUNT(*) as orphan_count 
        FROM \`${fk.childTable}\` c 
        WHERE ${nonNullConditions}
          AND NOT EXISTS (
            SELECT 1 FROM \`${fk.parentTable}\` p 
            WHERE ${joinConditions}
          );
      `;

      const [res] = await dedicatedConn.query(orphanSql);
      const orphanCount = res[0].orphan_count;

      if (orphanCount > 0) {
        const msg = `[FK ORPHAN VIOLATION] Constraint '${fk.name}': Found ${orphanCount} orphaned record(s) in \`${fk.childTable}\` referencing \`${fk.parentTable}\`!`;
        console.error(msg);
        verificationFailures.push(msg);
      } else {
        console.log(`[FK VERIFIED: ${fk.name.padEnd(22)}] Child: \`${fk.childTable}\` -> Parent: \`${fk.parentTable}\` | Orphans: 0 (PASS)`);
      }
    }

    // 7. Financial Integrity Baseline Verification (Phase 6 - Exact BigInt Cents)
    console.log('\n--- Phase 6: Financial Integrity Verification (Exact BigInt Cents Precision) ---');

    // Checksum 1: Account Balances
    const sqliteBal = await getSqlite(sqliteDb, 'SELECT COALESCE(SUM(balance), 0) as total FROM accounts');
    const [mysqlBal] = await dedicatedConn.query('SELECT COALESCE(SUM(balance), 0) as total FROM accounts');
    const balCheck = compareMonetary(sqliteBal.total, mysqlBal[0].total, 'Account Balances');
    console.log(`[FINANCIAL] ${balCheck.label.padEnd(20)}: SQLite=₹${balCheck.formatted1} | MySQL=₹${balCheck.formatted2} | Match: ${balCheck.match ? 'PASS' : 'FAIL'}`);
    if (!balCheck.match) verificationFailures.push(`Account balance checksum mismatch: diff=₹${balCheck.difference}`);

    // Checksum 2: Transaction Volumes
    const sqliteTxn = await getSqlite(sqliteDb, 'SELECT COALESCE(SUM(amount), 0) as total FROM transactions');
    const [mysqlTxn] = await dedicatedConn.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions');
    const txnCheck = compareMonetary(sqliteTxn.total, mysqlTxn[0].total, 'Transaction Volumes');
    console.log(`[FINANCIAL] ${txnCheck.label.padEnd(20)}: SQLite=₹${txnCheck.formatted1} | MySQL=₹${txnCheck.formatted2} | Match: ${txnCheck.match ? 'PASS' : 'FAIL'}`);
    if (!txnCheck.match) verificationFailures.push(`Transaction volume checksum mismatch: diff=₹${txnCheck.difference}`);

    // Checksum 3: Deposit Principals
    const sqliteDep = await getSqlite(sqliteDb, 'SELECT COALESCE(SUM(principal_amount), 0) as total FROM deposits');
    const [mysqlDep] = await dedicatedConn.query('SELECT COALESCE(SUM(principal_amount), 0) as total FROM deposits');
    const depCheck = compareMonetary(sqliteDep.total, mysqlDep[0].total, 'Deposit Principals');
    console.log(`[FINANCIAL] ${depCheck.label.padEnd(20)}: SQLite=₹${depCheck.formatted1} | MySQL=₹${depCheck.formatted2} | Match: ${depCheck.match ? 'PASS' : 'FAIL'}`);
    if (!depCheck.match) verificationFailures.push(`Deposit principal checksum mismatch: diff=₹${depCheck.difference}`);

    // Checksum 4: Legal Liens Encumbered
    const sqliteLien = await getSqlite(sqliteDb, 'SELECT COALESCE(SUM(lien_amount), 0) as total FROM account_lien_records');
    const [mysqlLien] = await dedicatedConn.query('SELECT COALESCE(SUM(lien_amount), 0) as total FROM account_lien_records');
    const lienCheck = compareMonetary(sqliteLien.total, mysqlLien[0].total, 'Legal Liens');
    console.log(`[FINANCIAL] ${lienCheck.label.padEnd(20)}: SQLite=₹${lienCheck.formatted1} | MySQL=₹${lienCheck.formatted2} | Match: ${lienCheck.match ? 'PASS' : 'FAIL'}`);
    if (!lienCheck.match) verificationFailures.push(`Legal lien checksum mismatch: diff=₹${lienCheck.difference}`);

  } catch (err) {
    primaryError = err;
    console.error('\n[FATAL ERROR DURING MIGRATION]:', err.message);
  } finally {
    // 8. Robust Connection Cleanup in finally Block
    console.log('\n--- Resource Cleanup ---');

    if (dedicatedConn) {
      try {
        // Restore foreign key checks strictly on the dedicated connection
        await dedicatedConn.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('[CLEANUP] Restored FOREIGN_KEY_CHECKS = 1 on dedicated connection.');
      } catch (fkErr) {
        cleanupError = fkErr;
        console.error('[CLEANUP ERROR] Failed to restore FOREIGN_KEY_CHECKS = 1:', fkErr.message);
      } finally {
        try {
          dedicatedConn.release();
          console.log('[CLEANUP] Released dedicated MySQL connection.');
        } catch (rErr) {
          console.error('[CLEANUP ERROR] Failed to release dedicated connection:', rErr.message);
        }
      }
    }

    if (sqliteDb) {
      try {
        sqliteDb.close();
        console.log('[CLEANUP] Closed SQLite read-only database handle.');
      } catch (sqErr) {
        console.error('[CLEANUP ERROR] Failed to close SQLite database:', sqErr.message);
      }
    }

    if (pool) {
      try {
        await pool.end();
        console.log('[CLEANUP] Closed MySQL connection pool.');
      } catch (pErr) {
        console.error('[CLEANUP ERROR] Failed to end MySQL pool:', pErr.message);
      }
    }
  }

  // 9. Fail-Closed Post-Verification Exit Decision
  console.log('\n================================================================');
  if (primaryError) {
    console.error('   MIGRATION TERMINATED WITH UNHANDLED ERROR                     ');
    console.error('================================================================');
    console.error(`Error: ${primaryError.message}`);
    if (cleanupError) {
      console.error(`Cleanup Error: ${cleanupError.message}`);
    }
    process.exit(1);
  }

  if (verificationFailures.length > 0) {
    console.error('   MIGRATION FAILED VERIFICATION (FAIL-CLOSED)                   ');
    console.error('================================================================');
    console.error(`Discrepancies encountered (${verificationFailures.length}):`);
    for (const f of verificationFailures) {
      console.error(`  - ${f}`);
    }
    console.error('\nResult: Destination MySQL database does NOT match SQLite ground truth.');
    process.exit(1);
  }

  console.log('   MIGRATION & VERIFICATION COMPLETED SUCCESSFULLY              ');
  console.log('================================================================');
  console.log('All 11 base tables, 1 view, 5 foreign-key constraints, and all 4 financial totals matched 100%.');
}

main().catch(err => {
  console.error('[FATAL PROCESS CRASH]:', err);
  process.exit(1);
});
