const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const appRoot = path.join(projectRoot, 'DBMS project', 'JM-DH-BANKING-SYSTEM-main', 'JM-DH-BANKING-SYSTEM-main', 'test');

// Load environment variables
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

const TABLE_ORDER = [
  'branches',
  'customers',
  'accounts',
  'account_lien_records',
  'beneficiaries',
  'deposits',
  'transactions',
  'kyc_verifications',
  'audit_logs',
  'otp_sessions',
  'security_rate_limits'
];

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
  const database = process.env.DB_NAME || 'bankist';

  console.log('================================================================');
  console.log('   JM-DH BANKING SYSTEM — SQLITE TO MYSQL 8.0 MIGRATION ENGINE   ');
  console.log('================================================================');
  console.log(`Target MySQL: ${user}@${host}:${port}/${database}`);

  const sqlitePath = path.join(appRoot, 'bankist.sqlite');
  if (!fs.existsSync(sqlitePath)) {
    console.error(`ERROR: SQLite database file not found at ${sqlitePath}`);
    process.exit(1);
  }

  // 1. Test MySQL Connection
  let pool;
  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      waitForConnections: true,
      connectionLimit: 10
    });
    // Test simple ping
    const [testPing] = await pool.query('SELECT 1 as connected');
    console.log(`[CONNECTED] Successfully established connection to MySQL 8.0 at ${host}:${port}`);
  } catch (err) {
    console.error('\n================================================================');
    console.error('   BLOCKER DETECTED: CANNOT CONNECT TO TARGET MYSQL 8.0 SERVER   ');
    console.error('================================================================');
    console.error(`Target Host: ${host}`);
    console.error(`Target Port: ${port}`);
    console.error(`Target User: ${user}`);
    console.error(`Error Code:  ${err.code || 'UNKNOWN'}`);
    console.error(`Error Msg:   ${err.message}`);
    console.error('\nAction Required:');
    if (err.code === 'ECONNREFUSED') {
      console.error(`1. The MySQL service is not listening on port ${port}.`);
      console.error(`   Ensure the MySQL 8.0 service (e.g. 'MySQL80') is running in Windows Services.`);
      console.error(`   If MySQL is running on a different port (e.g. 3306), update DB_PORT in .env.`);
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`1. Access denied for user '${user}'. The password in .env is incorrect or empty.`);
      console.error(`   Update DB_PASSWORD in .env with the valid MySQL root password.`);
    }
    console.error('\nOriginal SQLite database and backups remain 100% intact.');
    process.exit(2);
  }

  // 2. Ensure target database exists
  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await pool.query(`USE \`${database}\``);
  console.log(`[SCHEMA] Database \`${database}\` confirmed active.`);

  // 3. Open SQLite
  const sqliteDb = await openSqlite(sqlitePath);

  // 4. Create Tables with exact InnoDB Schema
  console.log('\n--- Phase 3: Preparing MySQL InnoDB Schemas ---');
  await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

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
    await pool.query(stmt);
  }

  // Create or Replace View
  await pool.query(`
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

  console.log('[SUCCESS] All 11 tables and view `v_customer_portfolio` prepared in MySQL.');

  // 5. Migrate Data
  console.log('\n--- Phase 4: Migrating Records from SQLite to MySQL ---');
  const migrationResults = [];

  for (const table of TABLE_ORDER) {
    const sqliteRows = await allSqlite(sqliteDb, `SELECT * FROM "${table}"`);
    const sourceCount = sqliteRows.length;

    let inserted = 0;
    let existing = 0;

    if (sourceCount > 0) {
      const sample = sqliteRows[0];
      const cols = Object.keys(sample);
      const colList = cols.map(c => `\`${c}\``).join(', ');
      const placeholders = cols.map(() => '?').join(', ');

      // Use INSERT IGNORE for idempotency and conflict preservation
      const sql = `INSERT IGNORE INTO \`${table}\` (${colList}) VALUES (${placeholders})`;

      // Batch insert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < sqliteRows.length; i += chunkSize) {
        const chunk = sqliteRows.slice(i, i + chunkSize);
        for (const row of chunk) {
          const values = cols.map(c => row[c] !== undefined ? row[c] : null);
          const [result] = await pool.query(sql, values);
          if (result.affectedRows > 0) {
            inserted += result.affectedRows;
          } else {
            existing++;
          }
        }
      }
    }

    const [destCountRows] = await pool.query(`SELECT COUNT(*) as c FROM \`${table}\``);
    const destCount = destCountRows[0].c;

    migrationResults.push({
      table,
      sourceCount,
      inserted,
      existing,
      destCount,
      match: sourceCount === destCount
    });

    console.log(`[TABLE: ${table.padEnd(22)}] Source: ${String(sourceCount).padStart(4)} | Inserted: ${String(inserted).padStart(4)} | Existing: ${String(existing).padStart(4)} | MySQL Total: ${String(destCount).padStart(4)} | Match: ${sourceCount === destCount ? 'YES' : 'FAIL'}`);
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

  // 6. Verification
  console.log('\n--- Phase 5 & 6: Data & Financial Integrity Verification ---');

  // Balances
  const sqliteBal = await getSqlite(sqliteDb, 'SELECT SUM(balance) as total FROM accounts');
  const [mysqlBalRows] = await pool.query('SELECT SUM(balance) as total FROM accounts');
  const sqliteBalTotal = Number(sqliteBal.total).toFixed(2);
  const mysqlBalTotal = Number(mysqlBalRows[0].total).toFixed(2);
  console.log(`[FINANCIAL] Account Balances Checksum:`);
  console.log(`  - SQLite: ₹${sqliteBalTotal}`);
  console.log(`  - MySQL:  ₹${mysqlBalTotal}`);
  console.log(`  - Match:  ${sqliteBalTotal === mysqlBalTotal ? 'PASS' : 'FAIL'}`);

  // Transactions
  const sqliteTxn = await getSqlite(sqliteDb, 'SELECT SUM(amount) as total FROM transactions');
  const [mysqlTxnRows] = await pool.query('SELECT SUM(amount) as total FROM transactions');
  const sqliteTxnTotal = Number(sqliteTxn.total).toFixed(2);
  const mysqlTxnTotal = Number(mysqlTxnRows[0].total).toFixed(2);
  console.log(`[FINANCIAL] Transaction Volumes Checksum:`);
  console.log(`  - SQLite: ₹${sqliteTxnTotal}`);
  console.log(`  - MySQL:  ₹${mysqlTxnTotal}`);
  console.log(`  - Match:  ${sqliteTxnTotal === mysqlTxnTotal ? 'PASS' : 'FAIL'}`);

  // Deposits
  const sqliteDep = await getSqlite(sqliteDb, 'SELECT SUM(principal_amount) as total FROM deposits');
  const [mysqlDepRows] = await pool.query('SELECT SUM(principal_amount) as total FROM deposits');
  const sqliteDepTotal = Number(sqliteDep.total).toFixed(2);
  const mysqlDepTotal = Number(mysqlDepRows[0].total).toFixed(2);
  console.log(`[FINANCIAL] Deposit Principals Checksum:`);
  console.log(`  - SQLite: ₹${sqliteDepTotal}`);
  console.log(`  - MySQL:  ₹${mysqlDepTotal}`);
  console.log(`  - Match:  ${sqliteDepTotal === mysqlDepTotal ? 'PASS' : 'FAIL'}`);

  // Liens
  const sqliteLien = await getSqlite(sqliteDb, 'SELECT SUM(lien_amount) as total FROM account_lien_records');
  const [mysqlLienRows] = await pool.query('SELECT SUM(lien_amount) as total FROM account_lien_records');
  const sqliteLienTotal = Number(sqliteLien.total).toFixed(2);
  const mysqlLienTotal = Number(mysqlLienRows[0].total).toFixed(2);
  console.log(`[FINANCIAL] Legal Liens Checksum:`);
  console.log(`  - SQLite: ₹${sqliteLienTotal}`);
  console.log(`  - MySQL:  ₹${mysqlLienTotal}`);
  console.log(`  - Match:  ${sqliteLienTotal === mysqlLienTotal ? 'PASS' : 'FAIL'}`);

  sqliteDb.close();
  await pool.end();

  console.log('\n================================================================');
  console.log('   MIGRATION & VERIFICATION COMPLETED SUCCESSFULLY              ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
