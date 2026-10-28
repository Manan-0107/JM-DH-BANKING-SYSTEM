import path from 'path';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

const customRequire = typeof require !== 'undefined' ? require : createRequire(import.meta.url);

// Load environment variables if not already loaded
if (typeof process !== 'undefined' && process.env) {
  try {
    const dotenv = customRequire('dotenv');
    const fs = customRequire('fs');
    const envCandidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '..', '.env'),
      path.resolve(__dirname, '.env'),
      path.resolve(process.cwd(), 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/.env')
    ];
    for (const envPath of envCandidates) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        break;
      }
    }
  } catch (e) {
    // dotenv is optional in Next.js since Next automatically loads .env
  }
}

export interface DbAdapter {
  query: (sql: string, params?: any[]) => Promise<[any[], any[]]>;
  transaction: <T>(callback: (conn: { query: (sql: string, params?: any[]) => Promise<[any[], any[]]> }) => Promise<T>) => Promise<T>;
  isSqlite?: false;
}

let dbInstance: DbAdapter | null = null;

async function runCommonMigrationsAndSeeds(adapter: DbAdapter) {
  // MySQL 8.0 DDL & Migration - Normalized BCNF Tables & Compatibility Views

  // 1. Branches Directory (BCNF Determinant: ifsc_code -> bank_name, branch_name, city, address)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`branches\` (
      \`branch_id\` VARCHAR(50) PRIMARY KEY,
      \`ifsc_code\` VARCHAR(20) NOT NULL UNIQUE,
      \`bank_name\` VARCHAR(100) NOT NULL DEFAULT 'Bharat Trust Bank',
      \`branch_name\` VARCHAR(100) NOT NULL,
      \`city\` VARCHAR(100) NOT NULL,
      \`address\` TEXT NOT NULL,
      \`timing\` VARCHAR(50) DEFAULT '09:30 AM - 04:30 PM',
      \`phone\` VARCHAR(30) DEFAULT NULL,
      \`status\` VARCHAR(20) DEFAULT 'Active'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try {
    await adapter.query("ALTER TABLE branches ADD COLUMN bank_name VARCHAR(100) NOT NULL DEFAULT 'Bharat Trust Bank'");
  } catch (e) {}

  // 2. Customers Entity (BCNF: Nominees and Card Credentials decomposed into separate relations)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`customers\` (
      \`customer_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`full_name\` VARCHAR(100) NOT NULL,
      \`email\` VARCHAR(100) NOT NULL UNIQUE,
      \`phone\` VARCHAR(30) DEFAULT NULL,
      \`dob\` DATE DEFAULT NULL,
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
      \`father_name\` VARCHAR(100) DEFAULT NULL,
      \`marital_status\` VARCHAR(30) DEFAULT NULL,
      \`occupation\` VARCHAR(100) DEFAULT NULL,
      \`annual_income\` VARCHAR(50) DEFAULT NULL,
      \`vkyc_status\` VARCHAR(30) DEFAULT 'Completed',
      \`signature_data\` LONGTEXT DEFAULT NULL,
      \`avatar_data\` LONGTEXT DEFAULT NULL,
      INDEX \`idx_cust_email\` (\`email\`),
      INDEX \`idx_cust_phone\` (\`phone\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Customer Nominees (BCNF: 1:N relationship, eliminates 1NF repeating group flaw)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`customer_nominees\` (
      \`nominee_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`customer_id\` VARCHAR(50) NOT NULL,
      \`nominee_name\` VARCHAR(100) NOT NULL,
      \`relationship\` VARCHAR(50) NOT NULL,
      \`dob\` DATE DEFAULT NULL,
      \`allocation_percentage\` DECIMAL(5,2) DEFAULT 100.00,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_nominee_customer\` (\`customer_id\`),
      CONSTRAINT \`fk_nominee_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`customer_id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. Accounts Entity (BCNF: Transitive branch_name removed; resolved via ifsc_code -> branches)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`accounts\` (
      \`account_number\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`customer_id\` VARCHAR(50) NOT NULL,
      \`account_type\` VARCHAR(50) NOT NULL,
      \`balance\` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      \`ifsc_code\` VARCHAR(20) NOT NULL DEFAULT 'BTBI0001024',
      \`opening_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`status\` VARCHAR(30) DEFAULT 'Active',
      INDEX \`idx_acc_customer\` (\`customer_id\`),
      INDEX \`idx_acc_ifsc\` (\`ifsc_code\`),
      CONSTRAINT \`fk_acc_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`customer_id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`fk_acc_branch\` FOREIGN KEY (\`ifsc_code\`) REFERENCES \`branches\` (\`ifsc_code\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. Account Card Credentials (BCNF: Secure card authentication credentials decoupled from accounts and customers)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`account_card_credentials\` (
      \`credential_id\` VARCHAR(64) NOT NULL PRIMARY KEY,
      \`account_number\` VARCHAR(50) NOT NULL UNIQUE,
      \`card_pin_hash\` VARCHAR(255) DEFAULT NULL,
      \`status\` VARCHAR(30) DEFAULT 'Active',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`fk_card_account\` FOREIGN KEY (\`account_number\`) REFERENCES \`accounts\` (\`account_number\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. Account Lien Records
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`account_lien_records\` (
      \`lien_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`account_number\` VARCHAR(50) NOT NULL,
      \`lien_amount\` DECIMAL(15,2) NOT NULL,
      \`lien_reason\` VARCHAR(255) NOT NULL,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_lien_account\` (\`account_number\`),
      CONSTRAINT \`fk_lien_account\` FOREIGN KEY (\`account_number\`) REFERENCES \`accounts\` (\`account_number\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 7. Transactions Immutable Ledger
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`transactions\` (
      \`transaction_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`sender_account\` VARCHAR(100) DEFAULT NULL,
      \`receiver_account\` VARCHAR(100) DEFAULT NULL,
      \`counterparty_details\` VARCHAR(150) DEFAULT NULL,
      \`channel\` VARCHAR(30) DEFAULT 'TRANSFER',
      \`amount\` DECIMAL(15,2) NOT NULL,
      \`type\` VARCHAR(30) NOT NULL,
      \`date_time\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`status\` VARCHAR(30) DEFAULT 'Success',
      \`description\` TEXT DEFAULT NULL,
      \`reference_number\` VARCHAR(100) DEFAULT NULL,
      INDEX \`idx_txn_sender\` (\`sender_account\`),
      INDEX \`idx_txn_receiver\` (\`receiver_account\`),
      INDEX \`idx_txn_date\` (\`date_time\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. KYC Verifications
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`kyc_verifications\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 9. Beneficiaries (BCNF: Transitive bank_name removed; resolved via ifsc_code -> branches)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`beneficiaries\` (
      \`beneficiary_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`customer_id\` VARCHAR(50) NOT NULL,
      \`beneficiary_name\` VARCHAR(150) NOT NULL,
      \`account_number\` VARCHAR(50) NOT NULL,
      \`ifsc_code\` VARCHAR(20) NOT NULL,
      \`transfer_limit\` DECIMAL(15,2) DEFAULT 100000.00,
      \`cooling_until\` DATETIME DEFAULT NULL,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`is_active\` INT DEFAULT 1,
      INDEX \`idx_ben_customer\` (\`customer_id\`),
      INDEX \`idx_ben_ifsc\` (\`ifsc_code\`),
      CONSTRAINT \`fk_ben_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`customer_id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_ben_branch\` FOREIGN KEY (\`ifsc_code\`) REFERENCES \`branches\` (\`ifsc_code\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 10. Deposits (BCNF: Transitive customer_id removed; derived via linked_account -> accounts)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`deposits\` (
      \`deposit_id\` VARCHAR(50) NOT NULL PRIMARY KEY,
      \`linked_account\` VARCHAR(50) NOT NULL,
      \`deposit_type\` VARCHAR(50) NOT NULL,
      \`principal_amount\` DECIMAL(15,2) NOT NULL,
      \`interest_rate\` DECIMAL(5,2) NOT NULL,
      \`tenure_months\` INT NOT NULL,
      \`maturity_amount\` DECIMAL(15,2) NOT NULL,
      \`maturity_date\` DATE NOT NULL,
      \`status\` VARCHAR(30) DEFAULT 'Active',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_dep_account\` (\`linked_account\`),
      CONSTRAINT \`fk_dep_account\` FOREIGN KEY (\`linked_account\`) REFERENCES \`accounts\` (\`account_number\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 11. Audit Logs
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`audit_logs\` (
      \`log_id\` VARCHAR(50) PRIMARY KEY,
      \`customer_id\` VARCHAR(50) DEFAULT NULL,
      \`action\` VARCHAR(100) NOT NULL,
      \`entity_type\` VARCHAR(50) NOT NULL,
      \`entity_id\` VARCHAR(50) DEFAULT NULL,
      \`details\` TEXT DEFAULT NULL,
      \`timestamp\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX \`idx_audit_customer\` (\`customer_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 12. OTP Sessions (BCNF & Security: Plaintext otp_code eliminated; uses salted HMAC-SHA256 otp_hash)
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`otp_sessions\` (
      \`session_id\` VARCHAR(50) PRIMARY KEY,
      \`identifier\` VARCHAR(150) NOT NULL,
      \`purpose\` VARCHAR(50) NOT NULL,
      \`otp_hash\` VARCHAR(255) DEFAULT NULL,
      \`expires_at\` BIGINT NOT NULL,
      \`verified\` INT DEFAULT 0,
      \`attempts\` INT DEFAULT 0,
      \`last_sent_at\` BIGINT DEFAULT 0,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 13. Security Rate Limits
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS \`security_rate_limits\` (
      \`key_id\` VARCHAR(191) NOT NULL PRIMARY KEY,
      \`attempts\` INT DEFAULT 1,
      \`last_attempt_at\` BIGINT NOT NULL,
      \`locked_until\` BIGINT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Defensive index & column additions for seamless migration of existing databases
  try {
    await adapter.query("ALTER TABLE transactions ADD COLUMN reference_number VARCHAR(100) DEFAULT NULL");
  } catch (e) {}
  try {
    await adapter.query("CREATE UNIQUE INDEX idx_transactions_reference ON transactions(reference_number)");
  } catch (e) {}
  try {
    await adapter.query("ALTER TABLE otp_sessions ADD COLUMN otp_hash VARCHAR(255) DEFAULT NULL");
  } catch (e) {}
  try {
    await adapter.query("ALTER TABLE otp_sessions ADD COLUMN attempts INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    await adapter.query("ALTER TABLE otp_sessions ADD COLUMN last_sent_at BIGINT DEFAULT 0");
  } catch (e) {}

  // Populate BCNF customer_nominees from legacy customer nominee fields if present
  try {
    await adapter.query(`
      INSERT IGNORE INTO customer_nominees (nominee_id, customer_id, nominee_name, relationship, dob, allocation_percentage)
      SELECT CONCAT('NOM-', customer_id), customer_id, nominee_name, COALESCE(nominee_relation, 'Nominee'), nominee_dob, 100.00
      FROM customers
      WHERE nominee_name IS NOT NULL AND nominee_name != '';
    `);
  } catch (e) {}

  // Populate BCNF account_card_credentials from accounts / customers if present
  try {
    await adapter.query(`
      INSERT IGNORE INTO account_card_credentials (credential_id, account_number, card_pin_hash, status)
      SELECT CONCAT('CARD-', account_number), account_number, card_pin_hash, 'Active'
      FROM accounts
      WHERE card_pin_hash IS NOT NULL AND card_pin_hash != '';
    `);
  } catch (e) {}

  // Individual PIN Migration for legacy records
  try {
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
        await adapter.query(
          `INSERT INTO account_card_credentials (credential_id, account_number, card_pin_hash, status)
           VALUES (?, ?, ?, 'Active')
           ON DUPLICATE KEY UPDATE card_pin_hash = VALUES(card_pin_hash)`,
          [`CARD-${acc.account_number}`, acc.account_number, hashed]
        );
      }
    }

    await adapter.query(`UPDATE customers SET card_pin = NULL WHERE card_pin_hash IS NOT NULL AND card_pin_hash != ''`);
    await adapter.query(`UPDATE accounts SET card_pin = NULL WHERE card_pin_hash IS NOT NULL AND card_pin_hash != ''`);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (!msg.includes('no such column') && !msg.includes("Unknown column 'card_pin'")) {
      console.error('[DB PIN Migration] Critical failure during PIN migration:', e?.message || e);
      throw e;
    }
  }

  // Setup Relational Compatibility & Analytical Views
  try {
    // View 1: v_accounts_legacy
    await adapter.query(`
      CREATE OR REPLACE VIEW v_accounts_legacy AS
      SELECT 
          a.account_number,
          a.customer_id,
          a.account_type,
          a.balance,
          a.ifsc_code,
          b.branch_name,
          a.opening_date,
          a.status,
          c.card_pin_hash
      FROM accounts a
      JOIN branches b ON a.ifsc_code = b.ifsc_code
      LEFT JOIN account_card_credentials c ON a.account_number = c.account_number;
    `);

    // View 2: v_customers_legacy (MySQL Error 1055 resolved via ROW_NUMBER())
    await adapter.query(`
      CREATE OR REPLACE VIEW v_customers_legacy AS
      SELECT 
          c.customer_id,
          c.full_name,
          c.email,
          c.phone,
          c.dob,
          c.address,
          c.created_at,
          c.status,
          c.kyc_status,
          c.credit_score,
          c.tier,
          c.pan_number,
          c.aadhaar_number,
          n.nominee_name,
          n.relationship AS nominee_relation,
          n.dob AS nominee_dob
      FROM customers c
      LEFT JOIN (
          SELECT 
              customer_id,
              nominee_name,
              relationship,
              dob,
              ROW_NUMBER() OVER (
                  PARTITION BY customer_id 
                  ORDER BY CASE WHEN allocation_percentage IS NOT NULL THEN allocation_percentage ELSE 0 END DESC, nominee_id ASC
              ) AS rn
          FROM customer_nominees
      ) n ON c.customer_id = n.customer_id AND n.rn = 1;
    `);

    // View 3: v_customer_portfolio (Canonical wealth summary, zero Cartesian multiplication)
    await adapter.query(`
      CREATE OR REPLACE VIEW v_customer_portfolio AS
      SELECT 
          c.customer_id,
          c.full_name,
          c.email,
          c.phone,
          c.tier,
          c.credit_score,
          COALESCE(acc.total_accounts, 0) AS total_accounts,
          COALESCE(acc.total_liquid_balance, 0.00) AS total_liquid_balance,
          COALESCE(dep.total_deposits_principal, 0.00) AS total_deposits_principal,
          (COALESCE(acc.total_liquid_balance, 0.00) + COALESCE(dep.total_deposits_principal, 0.00)) AS total_net_worth
      FROM customers c
      LEFT JOIN (
          SELECT customer_id, COUNT(*) AS total_accounts, SUM(balance) AS total_liquid_balance
          FROM accounts
          WHERE status = 'Active'
          GROUP BY customer_id
      ) acc ON c.customer_id = acc.customer_id
      LEFT JOIN (
          SELECT a.customer_id, SUM(d.principal_amount) AS total_deposits_principal
          FROM deposits d
          JOIN accounts a ON d.linked_account = a.account_number
          WHERE d.status = 'Active'
          GROUP BY a.customer_id
      ) dep ON c.customer_id = dep.customer_id;
    `);

    // View 4: v_deposits (Customer ownership derived via linked_account -> accounts)
    await adapter.query(`
      CREATE OR REPLACE VIEW v_deposits AS
      SELECT 
          d.deposit_id,
          a.customer_id,
          c.full_name,
          d.linked_account,
          a.account_type,
          d.deposit_type,
          d.principal_amount,
          d.interest_rate,
          d.tenure_months,
          d.maturity_amount,
          d.maturity_date,
          d.status,
          d.created_at
      FROM deposits d
      JOIN accounts a ON d.linked_account = a.account_number
      JOIN customers c ON a.customer_id = c.customer_id;
    `);

    // View 5: v_beneficiaries (Bank details resolved dynamically via ifsc_code -> branches)
    await adapter.query(`
      CREATE OR REPLACE VIEW v_beneficiaries AS
      SELECT 
          b.beneficiary_id,
          b.customer_id,
          b.beneficiary_name,
          b.account_number,
          b.ifsc_code,
          br.bank_name,
          br.branch_name,
          br.city AS branch_city,
          b.transfer_limit,
          b.cooling_until,
          b.is_active,
          b.created_at
      FROM beneficiaries b
      LEFT JOIN branches br ON b.ifsc_code = br.ifsc_code;
    `);
  } catch (e) {
    // Under least-privilege service accounts (no DDL privilege), ignore if view already exists
  }

  // Seed default branches if empty
  try {
    const [bRows] = await adapter.query("SELECT COUNT(*) as count FROM branches");
    if (!bRows[0] || bRows[0].count === 0) {
      await adapter.query(`
        INSERT INTO branches (branch_id, ifsc_code, bank_name, branch_name, city, address, timing, phone) VALUES
        ('BR-101', 'BTBI0001024', 'Bharat Trust Bank', 'Mumbai Nariman Point Hub', 'Mumbai', 'Ground Floor, Express Towers, Nariman Point, Mumbai 400021', '09:30 AM - 04:30 PM', '022-22881024'),
        ('BR-102', 'BTBI0002018', 'Bharat Trust Bank', 'Bengaluru MG Road Branch', 'Bengaluru', 'Prestige Meridian, 29 MG Road, Bengaluru 560001', '09:30 AM - 04:30 PM', '080-25582018'),
        ('BR-103', 'BTBI0003055', 'Bharat Trust Bank', 'Delhi Connaught Place Branch', 'New Delhi', 'Inner Circle, Blocks A-C, Connaught Place, New Delhi 110001', '09:30 AM - 04:30 PM', '011-23343055'),
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

  // Seed baseline Customers if empty
  const [existing] = await adapter.query("SELECT COUNT(*) as count FROM customers");
  if (!existing[0] || existing[0].count === 0) {
    const defaultPinHash = bcrypt.hashSync('1234', 10);
    await adapter.query(`
      INSERT INTO customers (customer_id, full_name, email, phone, dob, address, created_at, status, kyc_status, password_hash, credit_score, tier) VALUES
      ('CUST-101', 'Aarav Lynn', 'aarav@example.com', '+91 98200 12345', '1990-03-15', 'Flat 402, Nariman Point, Mumbai', '2024-01-10 09:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 810, 'Platinum'),
      ('CUST-102', 'Priya Nair', 'priya@example.com', '+91 98200 54321', '1995-07-22', 'Block B, Indiranagar, Bengaluru', '2024-02-14 10:30:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 760, 'Gold'),
      ('CUST-103', 'Rohan Gupta', 'rohan@example.com', '+91 98111 67890', '1988-11-05', 'Connaught Place, New Delhi', '2024-03-01 14:15:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 790, 'Platinum'),
      ('CUST-104', 'Ananya Sen', 'ananya@example.com', '+91 98450 11223', '1992-09-18', 'Koregaon Park, Pune', '2024-04-20 11:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 745, 'Silver'),
      ('CUST-105', 'Het Nasit', 'het@example.com', '+91 99099 88776', '1998-05-10', 'SG Highway, Ahmedabad', '2024-05-05 08:45:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 830, 'VIP');
    `);

    await adapter.query(`
      INSERT INTO customer_nominees (nominee_id, customer_id, nominee_name, relationship, dob, allocation_percentage) VALUES
      ('NOM-101', 'CUST-101', 'Kavita Lynn', 'Spouse', '1992-08-14', 100.00),
      ('NOM-102', 'CUST-102', 'Sunil Nair', 'Father', '1965-03-22', 100.00),
      ('NOM-103', 'CUST-103', 'Meera Gupta', 'Mother', '1968-06-11', 100.00),
      ('NOM-104', 'CUST-104', 'Debashish Sen', 'Brother', '1996-12-05', 100.00),
      ('NOM-105', 'CUST-105', 'Bhavna Nasit', 'Mother', '1975-01-20', 100.00);
    `);

    await adapter.query(`
      INSERT INTO accounts (account_number, customer_id, account_type, balance, ifsc_code, opening_date, status) VALUES
      ('ACC-772910', 'CUST-101', 'Savings Account', 142500.00, 'BTBI0001024', '2024-01-15 09:00:00', 'Active'),
      ('ACC-553102', 'CUST-102', 'Savings Account', 48920.50, 'BTBI0002018', '2024-02-20 10:30:00', 'Active'),
      ('ACC-664019', 'CUST-103', 'Current Account', 95120.00, 'BTBI0003055', '2024-03-10 14:15:00', 'Active'),
      ('ACC-883921', 'CUST-104', 'Savings Account', 68450.00, 'BTBI0004011', '2024-04-25 11:00:00', 'Active'),
      ('ACC-442991', 'CUST-105', 'Savings Account', 250000.00, 'BTBI0005089', '2024-05-10 08:45:00', 'Active');
    `);

    await adapter.query(`
      INSERT INTO account_card_credentials (credential_id, account_number, card_pin_hash, status) VALUES
      ('CARD-ACC-772910', 'ACC-772910', '${defaultPinHash}', 'Active'),
      ('CARD-ACC-553102', 'ACC-553102', '${defaultPinHash}', 'Active'),
      ('CARD-ACC-664019', 'ACC-664019', '${defaultPinHash}', 'Active'),
      ('CARD-ACC-883921', 'ACC-883921', '${defaultPinHash}', 'Active'),
      ('CARD-ACC-442991', 'ACC-442991', '${defaultPinHash}', 'Active');
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

  // Seed default beneficiaries if empty
  try {
    const [benRows] = await adapter.query("SELECT COUNT(*) as count FROM beneficiaries");
    if (!benRows[0] || benRows[0].count === 0) {
      await adapter.query(`
        INSERT INTO beneficiaries (beneficiary_id, customer_id, beneficiary_name, account_number, ifsc_code, transfer_limit, cooling_until) VALUES
        ('BEN-1001', 'CUST-101', 'Priya Nair', 'ACC-553102', 'BTBI0002018', 100000.00, NULL),
        ('BEN-1002', 'CUST-101', 'Rohan Gupta', 'ACC-664019', 'BTBI0003055', 200000.00, NULL),
        ('BEN-1003', 'CUST-101', 'Ananya Sen', 'ACC-883921', 'BTBI0004011', 75000.00, NULL);
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
        INSERT INTO deposits (deposit_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status) VALUES
        ('FD-2024-8841', 'ACC-772910', 'Fixed Deposit', 50000.00, 7.50, 12, 53890.00, DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'Active'),
        ('RD-2024-9122', 'ACC-772910', 'Recurring Deposit', 5000.00, 7.20, 6, 30650.00, DATE_ADD(CURDATE(), INTERVAL 6 MONTH), 'Active');
      `);
    }
  } catch (e) {
    console.warn('Deposits seed check:', e);
  }
}

export async function getDb(): Promise<DbAdapter> {
  if (dbInstance) return dbInstance;

  const host = process.env.DB_HOST || '127.0.0.1';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const dbName = process.env.DB_NAME || 'bankist';

  try {
    const mysql = customRequire('mysql2/promise');
    
    // Least-Privilege Support: Check database existence or create if privileged
    try {
      const initConnection = await mysql.createConnection({ host, user, password, port });
      await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await initConnection.end();
    } catch (privErr: any) {
      console.warn(`[DB Engine] Note: Proceeding without CREATE DATABASE privilege: ${privErr.message}`);
    }

    const pool = mysql.createPool({
      host,
      user,
      password,
      database: dbName,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
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

    (pool as any).isSqlite = false;
    await pool.query('SELECT 1');
    await runCommonMigrationsAndSeeds(pool);
    dbInstance = pool;
    console.log(`[DB Engine] Connected successfully to MySQL 8.0+ (${host}:${port}/${dbName})`);
    return dbInstance;
  } catch (err: any) {
    console.error(`[DB ERROR] Fatal MySQL connection failure: ${err.message}`);
    throw new Error(
      `[Database Engine Error] Failed to connect to MySQL database at ${host}:${port}/${dbName}: ${err.message}. ` +
      `MySQL 8.0+ is the sole runtime database engine. Please ensure MySQL is running with valid credentials in .env.`
    );
  }
}

export function resetDbInstanceForTesting(): void {
  dbInstance = null;
}
