import path from 'path';

export interface DbAdapter {
  query: (sql: string, params?: any[]) => Promise<[any[], any[]]>;
  transaction: <T>(callback: (conn: { query: (sql: string, params?: any[]) => Promise<[any[], any[]]> }) => Promise<T>) => Promise<T>;
  isSqlite?: boolean;
}

let dbInstance: DbAdapter | null = null;

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
    const isSelect = /^SELECT/i.test(trimmed) || /^PRAGMA/i.test(trimmed);

    const adaptedSql = sql
      .replace(/NOW\(\)/gi, "datetime('now', 'localtime')")
      .replace(/CURDATE\(\)/gi, "date('now', 'localtime')")
      .replace(/DATE\(date_time\)\s*>=\s*CURDATE\(\)/gi, "date(date_time) >= date('now', 'localtime')");

    if (isSelect) {
      const rows = await allAsync(adaptedSql, params);
      return [rows, []];
    } else {
      const result = await runAsync(adaptedSql, params);
      return [{ insertId: result.lastID, affectedRows: result.changes } as any, []];
    }
  };

  const transaction = async <T>(callback: (conn: { query: (sql: string, params?: any[]) => Promise<[any[], any[]]> }) => Promise<T>): Promise<T> => {
    await runAsync('BEGIN TRANSACTION');
    try {
      const conn = { query };
      const result = await callback(conn);
      await runAsync('COMMIT');
      return result;
    } catch (err) {
      await runAsync('ROLLBACK');
      throw err;
    }
  };

  return { query, transaction, isSqlite: true };
}

async function initSqliteDb(): Promise<DbAdapter> {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(process.cwd(), 'bankist.sqlite');

  return new Promise((resolve, reject) => {
    const rawDb = new sqlite3.Database(dbPath, async (err: Error | null) => {
      if (err) return reject(err);

      const adapter = createSqliteAdapter(rawDb);

      try {
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
            card_pin TEXT DEFAULT '1234'
          );
        `);

        // Migration safety: Ensure new columns exist in existing SQLite databases
        const newCols = [
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
          "card_pin TEXT DEFAULT '1234'"
        ];
        for (const col of newCols) {
          try {
            await adapter.query(`ALTER TABLE customers ADD COLUMN ${col}`);
          } catch (e) {
            // Ignore if column already exists
          }
        }

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
            card_pin TEXT DEFAULT '1234',
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
          );
        `);

        try {
          await adapter.query("ALTER TABLE accounts ADD COLUMN card_pin TEXT DEFAULT '1234'");
        } catch (e) {}

        await adapter.query(`
          CREATE TABLE IF NOT EXISTS transactions (
            transaction_id TEXT PRIMARY KEY,
            sender_account TEXT,
            receiver_account TEXT,
            amount REAL NOT NULL,
            type TEXT NOT NULL,
            date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'Success',
            description TEXT
          );
        `);

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

        const [existing] = await adapter.query("SELECT COUNT(*) as count FROM customers");
        if (!existing[0] || existing[0].count === 0) {
          await adapter.query(`
            INSERT INTO customers (customer_id, full_name, email, phone, dob, address, created_at, status, kyc_status, password_hash, credit_score, tier) VALUES
            ('CUST-101', 'Aarav Lynn', 'aarav@example.com', '+91 98200 12345', '1990-03-15', 'Flat 402, Nariman Point, Mumbai', '2024-01-10 09:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 810, 'Platinum'),
            ('CUST-102', 'Priya Nair', 'priya@example.com', '+91 98200 54321', '1995-07-22', 'Block B, Indiranagar, Bengaluru', '2024-02-14 10:30:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 760, 'Gold'),
            ('CUST-103', 'Rohan Gupta', 'rohan@example.com', '+91 98111 67890', '1988-11-05', 'Connaught Place, New Delhi', '2024-03-01 14:15:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 790, 'Platinum'),
            ('CUST-104', 'Ananya Sen', 'ananya@example.com', '+91 98450 11223', '1992-09-18', 'Koregaon Park, Pune', '2024-04-20 11:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 745, 'Silver'),
            ('CUST-105', 'Het Nasit', 'het@example.com', '+91 99099 88776', '1998-05-10', 'SG Highway, Ahmedabad', '2024-05-05 08:45:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 830, 'VIP');
          `);

          await adapter.query(`
            INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, branch_name, opening_date, status) VALUES
            ('ACC-772910', 'CUST-101', 'Savings Account', 142500.00, 'BTBI0001024', 'Mumbai Nariman Point Hub', '2024-01-15 09:00:00', 'Active'),
            ('ACC-553102', 'CUST-102', 'Savings Account', 48920.50, 'BTBI0002018', 'Bengaluru MG Road Branch', '2024-02-20 10:30:00', 'Active'),
            ('ACC-664019', 'CUST-103', 'Current Account', 95120.00, 'BTBI0003055', 'Delhi Connaught Place Branch', '2024-03-10 14:15:00', 'Active'),
            ('ACC-883921', 'CUST-104', 'Savings Account', 68450.00, 'BTBI0004011', 'Pune Camp Central Branch', '2024-04-25 11:00:00', 'Active'),
            ('ACC-442991', 'CUST-105', 'Savings Account', 250000.00, 'BTBI0005089', 'Ahmedabad Ashram Road Hub', '2024-05-10 08:45:00', 'Active');
          `);

          await adapter.query(`
            INSERT INTO transactions (transaction_id, sender_account, receiver_account, amount, type, date_time, status, description) VALUES
            ('TXN-00000001', NULL, 'ACC-772910', 50000.00, 'Deposit', '2024-06-01 09:00:00', 'Success', 'Salary Credit - Tech Innovations Pvt Ltd'),
            ('TXN-00000002', 'ACC-772910', 'ACC-553102', 15000.00, 'Transfer', '2024-06-05 14:00:00', 'Success', 'IMPS Fund Transfer to Miyah'),
            ('TXN-00000003', NULL, 'ACC-772910', 100000.00, 'Deposit', '2024-06-15 11:30:00', 'Success', 'Fixed Deposit Interest Credit'),
            ('TXN-00000004', 'ACC-772910', NULL, 2500.00, 'Withdrawal', '2024-06-20 18:45:00', 'Success', 'ATM Cash Withdrawal - Nariman Point'),
            ('TXN-00000005', 'ACC-772910', 'ACC-664019', 10000.00, 'Transfer', '2024-07-01 10:15:00', 'Success', 'NEFT Business Rent Payment'),
            ('TXN-00000006', NULL, 'ACC-772910', 20000.00, 'Deposit', '2024-08-01 12:00:00', 'Success', 'UPI Inward Payment - Consulting Fee');
          `);
        }

        // Independent check & seed for beneficiaries
        try {
          const [bRows] = await adapter.query("SELECT COUNT(*) as count FROM beneficiaries");
          if (!bRows[0] || bRows[0].count === 0) {
            await adapter.query(`
              INSERT INTO beneficiaries (beneficiary_id, customer_id, beneficiary_name, account_number, ifsc_code, bank_name, transfer_limit, cooling_until) VALUES
              ('BEN-1001', 'CUST-101', 'Priya Nair', 'ACC-553102', 'BTBI0002018', 'Bharat Trust Bank (MG Road)', 100000.00, NULL),
              ('BEN-1002', 'CUST-101', 'Rohan Gupta', 'ACC-664019', 'BTBI0003055', 'Bharat Trust Bank (Connaught Place)', 200000.00, NULL),
              ('BEN-1003', 'CUST-101', 'Ananya Sen', 'ACC-883921', 'BTBI0004011', 'Bharat Trust Bank (Pune Camp)', 75000.00, NULL);
            `);
          }
        } catch (e) {
          console.warn('Beneficiaries seed skipped:', e);
        }

        // Independent check & seed for deposits
        try {
          const [dRows] = await adapter.query("SELECT COUNT(*) as count FROM deposits");
          if (!dRows[0] || dRows[0].count === 0) {
            await adapter.query(`
              INSERT INTO deposits (deposit_id, customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status) VALUES
              ('FD-2024-8841', 'CUST-101', 'ACC-772910', 'Fixed Deposit', 50000.00, 7.50, 12, 53890.00, date('now', '+1 year'), 'Active'),
              ('RD-2024-9122', 'CUST-101', 'ACC-772910', 'Recurring Deposit', 5000.00, 7.20, 6, 30650.00, date('now', '+6 months'), 'Active');
            `);
          }
        } catch (e) {
          console.warn('Deposits seed skipped:', e);
        }

        resolve(adapter);

      } catch (e) {
        reject(e);
      }
    });
  });
}

export async function getDb(): Promise<DbAdapter> {
  if (dbInstance) return dbInstance;

  try {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const port = parseInt(process.env.DB_PORT || '3306');
    const dbName = process.env.DB_NAME || 'bankist';

    if (process.env.USE_MYSQL === 'true') {
      const mysql = require('mysql2/promise');
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
      dbInstance = pool;
      return dbInstance;
    }
  } catch (err: any) {
    // Fall back silently to SQLite
  }

  dbInstance = await initSqliteDb();
  return dbInstance;
}
