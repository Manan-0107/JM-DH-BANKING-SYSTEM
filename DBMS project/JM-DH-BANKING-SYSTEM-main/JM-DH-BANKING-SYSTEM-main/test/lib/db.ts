import path from 'path';
import bcrypt from 'bcryptjs';

// Load environment variables if not already loaded
if (typeof process !== 'undefined' && process.env) {
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  } catch (e) {
    // dotenv is optional in Next.js since Next automatically loads .env
  }
}

export interface DbAdapter {
  query: (sql: string, params?: any[]) => Promise<[any[], any[]]>;
  transaction: <T>(callback: (conn: { query: (sql: string, params?: any[]) => Promise<[any[], any[]]> }) => Promise<T>) => Promise<T>;
  isSqlite?: boolean;
}

let dbInstance: DbAdapter | null = null;
let sqliteTxMutex: Promise<any> = Promise.resolve();

function createSqliteAdapter(sqliteDb: any): DbAdapter {
  const runAsync = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (this: any, err: Error | null) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  const allAsync = (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  };

  const query = async (sql: string, params: any[] = []): Promise<[any[], any[]]> => {
    const trimmed = sql.trim();
    const isSelect = /^SELECT/i.test(trimmed) || /^PRAGMA/i.test(trimmed) || /^EXPLAIN/i.test(trimmed);

    // Adapt common MySQL dialect expressions for SQLite
    const adaptedSql = sql
      .replace(/NOW\(\)/gi, "datetime('now', 'localtime')")
      .replace(/CURDATE\(\)/gi, "date('now', 'localtime')")
      .replace(/DATE\(date_time\)\s*>=\s*CURDATE\(\)/gi, "date(date_time) >= date('now', 'localtime')")
      .replace(/CREATE OR REPLACE VIEW/gi, "CREATE VIEW IF NOT EXISTS");

    if (isSelect) {
      const rows = await allAsync(adaptedSql, params);
      return [rows, []];
    } else {
      const result = await runAsync(adaptedSql, params);
      return [{ insertId: result.lastID, affectedRows: result.changes, changes: result.changes } as any, []];
    }
  };

  // Mutex-protected atomic transaction queue for SQLite to prevent nested transaction errors
  const transaction = async <T>(
    callback: (conn: { query: (sql: string, params?: any[]) => Promise<[any[], any[]]> }) => Promise<T>
  ): Promise<T> => {
    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const previousMutex = sqliteTxMutex;
    sqliteTxMutex = (async () => {
      await previousMutex;
      await lockPromise;
    })();

    await previousMutex;
    try {
      await runAsync('BEGIN IMMEDIATE TRANSACTION');
      try {
        const conn = { query };
        const result = await callback(conn);
        await runAsync('COMMIT');
        return result;
      } catch (err) {
        try {
          await runAsync('ROLLBACK');
        } catch (rbErr) {
          // ignore rollback error if already rolled back
        }
        throw err;
      }
    } finally {
      releaseLock();
    }
  };

  return { query, transaction, isSqlite: true };
}

async function runCommonMigrationsAndSeeds(adapter: DbAdapter) {
  // 1. Customers Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      dob TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Active',
      kyc_status TEXT DEFAULT 'Pending',
      password_hash TEXT NOT NULL,
      credit_score INTEGER DEFAULT 700,
      tier TEXT DEFAULT 'Silver',
      pan_number TEXT,
      aadhaar_number TEXT,
      gender TEXT,
      father_name TEXT,
      marital_status TEXT,
      occupation TEXT,
      annual_income TEXT,
      nominee_name TEXT,
      nominee_relation TEXT,
      nominee_dob TEXT,
      vkyc_status TEXT DEFAULT 'Completed',
      signature_data TEXT,
      avatar_data TEXT,
      card_pin TEXT DEFAULT NULL,
      card_pin_hash TEXT
    );
  `);

  const customerColumns = [
    'pan_number TEXT',
    'aadhaar_number TEXT',
    'gender TEXT',
    'father_name TEXT',
    'marital_status TEXT',
    'occupation TEXT',
    'annual_income TEXT',
    'nominee_name TEXT',
    'nominee_relation TEXT',
    'nominee_dob TEXT',
    "vkyc_status TEXT DEFAULT 'Completed'",
    'signature_data TEXT',
    'avatar_data TEXT',
    "card_pin TEXT DEFAULT NULL",
    'card_pin_hash TEXT'
  ];
  for (const col of customerColumns) {
    try {
      await adapter.query(`ALTER TABLE customers ADD COLUMN ${col}`);
    } catch (e) {
      // Column already exists
    }
  }

  // 2. Accounts Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      account_number TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      account_type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0.00,
      ifsc_code TEXT NOT NULL DEFAULT 'BTBI0001024',
      branch_name TEXT NOT NULL DEFAULT 'Downtown Central',
      opening_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Active',
      card_pin TEXT DEFAULT NULL,
      card_pin_hash TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  try {
    await adapter.query("ALTER TABLE accounts ADD COLUMN card_pin TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    await adapter.query("ALTER TABLE accounts ADD COLUMN card_pin_hash TEXT");
  } catch (e) {}

  // 3. Transactions Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      transaction_id TEXT PRIMARY KEY,
      sender_account TEXT,
      receiver_account TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Success',
      description TEXT,
      reference_number TEXT
    );
  `);

  try {
    await adapter.query("ALTER TABLE transactions ADD COLUMN reference_number TEXT");
  } catch (e) {}
  try {
    await adapter.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_number)");
  } catch (e) {}

  // 4. KYC Verifications Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS kyc_verifications (
      verification_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_number TEXT,
      verification_method TEXT NOT NULL,
      status TEXT DEFAULT 'Verified',
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  // 5. Beneficiaries Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS beneficiaries (
      beneficiary_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      beneficiary_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      transfer_limit REAL DEFAULT 100000.00,
      cooling_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  // 6. Deposits Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS deposits (
      deposit_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      linked_account TEXT NOT NULL,
      deposit_type TEXT NOT NULL,
      principal_amount REAL NOT NULL,
      interest_rate REAL NOT NULL,
      tenure_months INTEGER NOT NULL,
      maturity_amount REAL NOT NULL,
      maturity_date DATETIME NOT NULL,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  // 7. National Branches Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS branches (
      branch_id TEXT PRIMARY KEY,
      branch_name TEXT NOT NULL,
      ifsc_code TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      timing TEXT DEFAULT '09:30 AM - 04:30 PM',
      phone TEXT,
      status TEXT DEFAULT 'Active'
    );
  `);

  // 8. Security & Admin Audit Log Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id TEXT PRIMARY KEY,
      customer_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 9. OTP Sessions Table
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS otp_sessions (
      session_id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      purpose TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. Individual PIN Migration for legacy records
  // Migrates each customer's individual plaintext PIN, hashes that specific credential,
  // and scrubs the plaintext column. Never resets existing users to a shared default PIN.
  try {
    // 10a. Migrate individual customer plaintext PINs
    const [unhashedCustomers] = await adapter.query(
      `SELECT customer_id, card_pin FROM customers WHERE (card_pin_hash IS NULL OR card_pin_hash = '') AND card_pin IS NOT NULL AND card_pin != ''`
    );
    for (const cust of unhashedCustomers || []) {
      const rawPin = cust.card_pin ? cust.card_pin.toString().trim() : '';
      if (rawPin.length >= 4) {
        const hashed = bcrypt.hashSync(rawPin, 10);
        await adapter.query(
          `UPDATE customers SET card_pin_hash = ? WHERE customer_id = ?`,
          [hashed, cust.customer_id]
        );
      }
    }

    // 10b. Migrate individual account plaintext PINs
    const [unhashedAccounts] = await adapter.query(
      `SELECT account_number, card_pin FROM accounts WHERE (card_pin_hash IS NULL OR card_pin_hash = '') AND card_pin IS NOT NULL AND card_pin != ''`
    );
    for (const acc of unhashedAccounts || []) {
      const rawPin = acc.card_pin ? acc.card_pin.toString().trim() : '';
      if (rawPin.length >= 4) {
        const hashed = bcrypt.hashSync(rawPin, 10);
        await adapter.query(
          `UPDATE accounts SET card_pin_hash = ? WHERE account_number = ?`,
          [hashed, acc.account_number]
        );
      }
    }

    // 10c. Scrub plaintext PIN columns to prevent credential leakage
    await adapter.query(`UPDATE customers SET card_pin = NULL WHERE card_pin_hash IS NOT NULL AND card_pin_hash != ''`);
    await adapter.query(`UPDATE accounts SET card_pin = NULL WHERE card_pin_hash IS NOT NULL AND card_pin_hash != ''`);

    // 10d. Verification: Fail safely if any unmigrated plaintext PINs remain
    const [remainingCustomers] = await adapter.query(
      `SELECT COUNT(*) as count FROM customers WHERE (card_pin_hash IS NULL OR card_pin_hash = '') AND card_pin IS NOT NULL AND card_pin != ''`
    );
    const [remainingAccounts] = await adapter.query(
      `SELECT COUNT(*) as count FROM accounts WHERE (card_pin_hash IS NULL OR card_pin_hash = '') AND card_pin IS NOT NULL AND card_pin != ''`
    );

    const custPending = remainingCustomers[0]?.count || 0;
    const accPending = remainingAccounts[0]?.count || 0;

    if (custPending > 0 || accPending > 0) {
      throw new Error(
        `[PIN Migration Incomplete] Critical integrity check failed: ${custPending} customer(s) and ${accPending} account(s) retain unmigrated plaintext PINs.`
      );
    }
  } catch (e: any) {
    const msg = String(e?.message || e);
    // Safe to ignore only if the legacy column does not exist in the database engine
    if (msg.includes('no such column') || msg.includes("Unknown column 'card_pin'")) {
      // Benign: schema dialect already has no legacy plaintext card_pin column
    } else {
      console.error('[DB PIN Migration] Critical failure during PIN migration:', e?.message || e);
      throw e;
    }
  }

  // Seed baseline Customers if empty
  const [existing] = await adapter.query("SELECT COUNT(*) as count FROM customers");
  if (!existing[0] || existing[0].count === 0) {
    const defaultPinHash = bcrypt.hashSync('1234', 10);
    await adapter.query(`
      INSERT INTO customers (customer_id, full_name, email, phone, dob, address, created_at, status, kyc_status, password_hash, card_pin_hash, credit_score, tier) VALUES
      ('CUST-101', 'Aarav Lynn', 'aarav@example.com', '+91 98200 12345', '1990-03-15', 'Flat 402, Nariman Point, Mumbai', '2024-01-10 09:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', '${defaultPinHash}', 810, 'Platinum'),
      ('CUST-102', 'Priya Nair', 'priya@example.com', '+91 98200 54321', '1995-07-22', 'Block B, Indiranagar, Bengaluru', '2024-02-14 10:30:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', '${defaultPinHash}', 760, 'Gold'),
      ('CUST-103', 'Rohan Gupta', 'rohan@example.com', '+91 98111 67890', '1988-11-05', 'Connaught Place, New Delhi', '2024-03-01 14:15:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', '${defaultPinHash}', 790, 'Platinum'),
      ('CUST-104', 'Ananya Sen', 'ananya@example.com', '+91 98450 11223', '1992-09-18', 'Koregaon Park, Pune', '2024-04-20 11:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', '${defaultPinHash}', 745, 'Silver'),
      ('CUST-105', 'Het Nasit', 'het@example.com', '+91 99099 88776', '1998-05-10', 'SG Highway, Ahmedabad', '2024-05-05 08:45:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', '${defaultPinHash}', 830, 'VIP');
    `);

    await adapter.query(`
      INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status, card_pin_hash) VALUES
      ('ACC-772910', 'CUST-101', 'Savings Account', 142500.00, 'BTBI0001024', 'Mumbai Nariman Point Hub', '2024-01-15 09:00:00', 'Active', '${defaultPinHash}'),
      ('ACC-553102', 'CUST-102', 'Savings Account', 48920.50, 'BTBI0002018', 'Bengaluru MG Road Branch', '2024-02-20 10:30:00', 'Active', '${defaultPinHash}'),
      ('ACC-664019', 'CUST-103', 'Current Account', 95120.00, 'BTBI0003055', 'Delhi Connaught Place Branch', '2024-03-10 14:15:00', 'Active', '${defaultPinHash}'),
      ('ACC-883921', 'CUST-104', 'Savings Account', 68450.00, 'BTBI0004011', 'Pune Camp Central Branch', '2024-04-25 11:00:00', 'Active', '${defaultPinHash}'),
      ('ACC-442991', 'CUST-105', 'Savings Account', 250000.00, 'BTBI0005089', 'Ahmedabad Ashram Road Hub', '2024-05-10 08:45:00', 'Active', '${defaultPinHash}');
    `);

    await adapter.query(`
      INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number) VALUES
      ('TXN-00000001', NULL, 'ACC-772910', 50000.00, 'Deposit', '2024-06-01 09:00:00', 'Success', 'Salary Credit - Tech Innovations Pvt Ltd', 'BTB20240601001'),
      ('TXN-00000002', 'ACC-772910', 'ACC-553102', 15000.00, 'Transfer', '2024-06-05 14:00:00', 'Success', 'IMPS Fund Transfer to Miyah', 'BTB20240605002'),
      ('TXN-00000003', NULL, 'ACC-772910', 100000.00, 'Deposit', '2024-06-15 11:30:00', 'Success', 'Fixed Deposit Interest Credit', 'BTB20240615003'),
      ('TXN-00000004', 'ACC-772910', NULL, 2500.00, 'Withdrawal', '2024-06-20 18:45:00', 'Success', 'ATM Cash Withdrawal - Nariman Point', 'BTB20240620004'),
      ('TXN-00000005', 'ACC-772910', 'ACC-664019', 10000.00, 'Transfer', '2024-07-01 10:15:00', 'Success', 'NEFT Business Rent Payment', 'BTB20240701005'),
      ('TXN-00000006', NULL, 'ACC-772910', 20000.00, 'Deposit', '2024-08-01 12:00:00', 'Success', 'UPI Inward Payment - Consulting Fee', 'BTB20240801006');
    `);
  }

  // Seed default branches if empty
  try {
    const [bRows] = await adapter.query("SELECT COUNT(*) as count FROM branches");
    if (!bRows[0] || bRows[0].count === 0) {
      await adapter.query(`
        INSERT INTO branches (branch_id, branch_name, ifsc_code, city, address, timing, phone) VALUES
        ('BR-101', 'Mumbai Nariman Point Hub', 'BTBI0001024', 'Mumbai', 'Ground Floor, Express Towers, Nariman Point, Mumbai 400021', '09:30 AM - 04:30 PM', '022-22881024'),
        ('BR-102', 'Bengaluru MG Road Branch', 'BTBI0002018', 'Bengaluru', 'Prestige Meridian, 29 MG Road, Bengaluru 560001', '09:30 AM - 04:30 PM', '080-25582018'),
        ('BR-103', 'Delhi Connaught Place Branch', 'BTBI0003055', 'New Delhi', 'Inner Circle, Blocks A-C, Connaught Place, New Delhi 110001', '09:30 AM - 04:30 PM', '011-23343055'),
        ('BR-104', 'Pune Camp Central Branch', 'BTBI0004011', 'Pune', 'Moledina Road, Camp, Pune 411001', '09:30 AM - 04:30 PM', '020-26124011'),
        ('BR-105', 'Ahmedabad Ashram Road Hub', 'BTBI0005089', 'Ahmedabad', 'Near Sakar III, Ashram Road, Ahmedabad 380009', '09:30 AM - 04:30 PM', '079-26585089'),
        ('BR-106', 'Hyderabad Banjara Hills Branch', 'BTBI0006033', 'Hyderabad', 'Road No. 12, Banjara Hills, Hyderabad 500034', '09:30 AM - 04:30 PM', '040-23396033'),
        ('BR-107', 'Chennai Anna Salai Branch', 'BTBI0007019', 'Chennai', 'Mount Road, Anna Salai, Chennai 600002', '09:30 AM - 04:30 PM', '044-28527019'),
        ('BR-108', 'Kolkata Park Street Branch', 'BTBI0008044', 'Kolkata', 'Park Street Crossing, Kolkata 700016', '09:30 AM - 04:30 PM', '033-22298044');
      `);
    }
  } catch (e) {
    console.warn('Branches seed check:', e);
  }

  // Seed default beneficiaries if empty
  try {
    const [benRows] = await adapter.query("SELECT COUNT(*) as count FROM beneficiaries");
    if (!benRows[0] || benRows[0].count === 0) {
      await adapter.query(`
        INSERT INTO beneficiaries (beneficiary_id, customer_id, beneficiary_name, account_number, ifsc_code, bank_name, transfer_limit, cooling_until) VALUES
        ('BEN-1001', 'CUST-101', 'Priya Nair', 'ACC-553102', 'BTBI0002018', 'Bharat Trust Bank (MG Road)', 100000.00, NULL),
        ('BEN-1002', 'CUST-101', 'Rohan Gupta', 'ACC-664019', 'BTBI0003055', 'Bharat Trust Bank (Connaught Place)', 200000.00, NULL),
        ('BEN-1003', 'CUST-101', 'Ananya Sen', 'ACC-883921', 'BTBI0004011', 'Bharat Trust Bank (Pune Camp)', 75000.00, NULL);
      `);
    }
  } catch (e) {
    console.warn('Beneficiaries seed check:', e);
  }

  // Seed default deposits if empty
  try {
    const [depRows] = await adapter.query("SELECT COUNT(*) as count FROM deposits");
    if (!depRows[0] || depRows[0].count === 0) {
      await adapter.query(`
        INSERT INTO deposits (deposit_id, customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status) VALUES
        ('FD-2024-8841', 'CUST-101', 'ACC-772910', 'Fixed Deposit', 50000.00, 7.50, 12, 53890.00, date('now', '+1 year'), 'Active'),
        ('RD-2024-9122', 'CUST-101', 'ACC-772910', 'Recurring Deposit', 5000.00, 7.20, 6, 30650.00, date('now', '+6 months'), 'Active');
      `);
    }
  } catch (e) {
    console.warn('Deposits seed check:', e);
  }

  // Setup Relational Database Views
  try {
    await adapter.query(`
      CREATE VIEW IF NOT EXISTS v_customer_portfolio AS
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
  } catch (e) {}
}

async function initSqliteDb(): Promise<DbAdapter> {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(process.cwd(), 'bankist.sqlite');

  return new Promise((resolve, reject) => {
    const rawDb = new sqlite3.Database(dbPath, async (err: Error | null) => {
      if (err) return reject(err);

      const adapter = createSqliteAdapter(rawDb);
      try {
        await runCommonMigrationsAndSeeds(adapter);
        resolve(adapter);
      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function getDb(): Promise<DbAdapter> {
  if (dbInstance) return dbInstance;

  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const dbName = process.env.DB_NAME || 'bankist';

  if (process.env.USE_MYSQL === 'true') {
    try {
      const mysql = require('mysql2/promise');
      
      // Check database existence / create if absent
      const initConnection = await mysql.createConnection({ host, user, password, port });
      await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await initConnection.end();

      const pool = mysql.createPool({
        host,
        user,
        password,
        database: dbName,
        port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      pool.transaction = async function (callback: any) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
          const result = await callback(connection);
          await connection.commit();
          return result;
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }
      };

      await pool.query('SELECT 1');
      await runCommonMigrationsAndSeeds(pool);
      (pool as any).isSqlite = false;
      dbInstance = pool;
      console.log(`[DB Engine] Connected successfully to MySQL 8.0+ (${host}:${port}/${dbName})`);
      return dbInstance;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        console.error(`[DB ERROR] Fatal MySQL connection failure in production: ${err.message}`);
        throw new Error(
          `[Database Engine Error] USE_MYSQL=true is configured, but failed to connect to MySQL database at ${host}:${port}/${dbName}: ${err.message}. ` +
          `Automatic SQLite fallback is strictly prohibited in production to prevent silent data divergence.`
        );
      }

      if (process.env.ALLOW_SQLITE_FALLBACK === 'true') {
        console.warn(
          `[DB WARNING] USE_MYSQL=true is configured, but MySQL connection failed: ${err.message}. ` +
          `ALLOW_SQLITE_FALLBACK=true is enabled in development, falling back to embedded SQLite.`
        );
      } else {
        console.error(`[DB ERROR] Fatal MySQL connection failure: ${err.message}`);
        throw new Error(
          `[Database Engine Error] USE_MYSQL=true is configured, but failed to connect to MySQL database at ${host}:${port}/${dbName}: ${err.message}. ` +
          `To prevent silent data divergence between MySQL and SQLite, startup is aborted. ` +
          `Please ensure MySQL is running with valid credentials in .env, or set USE_MYSQL=false to explicitly use the SQLite engine.`
        );
      }
    }
  }

  // Explicit SQLite Engine
  dbInstance = await initSqliteDb();
  console.log('[DB Engine] Active database engine: SQLite (embedded)');
  return dbInstance;
}
