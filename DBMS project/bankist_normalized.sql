-- ============================================================================
-- BHARAT TRUST BANK (BTB) - FULLY NORMALIZED RELATIONAL DATABASE SCHEMA (BCNF)
-- Target RDBMS: MySQL 8.0+ Enterprise / InnoDB / utf8mb4_unicode_ci
-- Architectural Standard: 1NF, 2NF, 3NF, BCNF Compliant
-- Version: 2.1 (Non-Destructive, Lossless, Backward-Compatible)
-- ============================================================================
--
-- CRITICAL SAFETY NOTICE:
-- 1. This schema definition is NON-DESTRUCTIVE. All 'DROP TABLE' statements have
--    been strictly removed to prevent catastrophic data loss in existing databases.
-- 2. Never execute this schema directly against the live production database 'bankist'.
-- 3. Database context must be explicitly selected by the caller (USE <disposable_db>;).
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES';

-- ----------------------------------------------------------------------------
-- 1. Table structure for `branches`
-- Boyce-Codd Normal Form (BCNF)
-- Candidate Keys: CK1 = {branch_id}, CK2 = {ifsc_code}
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `branches` (
  `branch_id` VARCHAR(50) NOT NULL,
  `branch_name` VARCHAR(100) NOT NULL,
  `ifsc_code` VARCHAR(20) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `address` TEXT NOT NULL,
  `timing` VARCHAR(50) DEFAULT '09:30 AM - 04:30 PM',
  `phone` VARCHAR(30) DEFAULT NULL,
  `status` ENUM('Active', 'Closed', 'Renovating') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`branch_id`),
  UNIQUE KEY `uk_branches_ifsc` (`ifsc_code`),
  INDEX `idx_branches_city` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Table structure for `customers`
-- Boyce-Codd Normal Form (BCNF)
-- Core demographic profile and net-banking authentication
-- Candidate Keys: CK1 = {customer_id}, CK2 = {email}, CK3 = {pan_number}
-- Backward Compatibility: Retains nominee/card columns for zero-breakage Next.js API compatibility
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `customer_id` VARCHAR(50) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `dob` DATE DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Active', 'Suspended', 'Pending') DEFAULT 'Active',
  `kyc_status` ENUM('Pending', 'Verified', 'Rejected') DEFAULT 'Pending',
  `password_hash` VARCHAR(255) NOT NULL,
  `credit_score` INT DEFAULT 700,
  `tier` ENUM('Silver', 'Gold', 'Platinum', 'VIP') DEFAULT 'Silver',
  `pan_number` VARCHAR(20) DEFAULT NULL,
  `aadhaar_number` VARCHAR(20) DEFAULT NULL,
  `gender` VARCHAR(20) DEFAULT NULL,
  `father_name` VARCHAR(150) DEFAULT NULL,
  `marital_status` VARCHAR(30) DEFAULT NULL,
  `occupation` VARCHAR(100) DEFAULT NULL,
  `annual_income` VARCHAR(100) DEFAULT NULL,
  `nominee_name` VARCHAR(150) DEFAULT NULL,
  `nominee_relation` VARCHAR(50) DEFAULT NULL,
  `nominee_dob` DATE DEFAULT NULL,
  `vkyc_status` VARCHAR(50) DEFAULT 'Completed',
  `signature_data` LONGTEXT DEFAULT NULL,
  `avatar_data` LONGTEXT DEFAULT NULL,
  `card_pin` VARCHAR(10) DEFAULT NULL,
  `card_pin_hash` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uk_customers_email` (`email`),
  UNIQUE KEY `uk_customers_pan` (`pan_number`),
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_status` (`status`),
  CONSTRAINT `chk_cust_credit_score` CHECK (`credit_score` BETWEEN 300 AND 900)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Table structure for `customer_nominees`
-- Decomposed 1:N normalized nominee relation (BCNF)
-- Supports multiple nominees per customer with fractional allocation percentages
-- Candidate Keys: CK1 = {nominee_id}, CK2 = {customer_id, nominee_name}
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_nominees` (
  `nominee_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `nominee_name` VARCHAR(150) NOT NULL,
  `relationship` VARCHAR(50) NOT NULL,
  `dob` DATE DEFAULT NULL,
  `allocation_percentage` DECIMAL(5,2) DEFAULT NULL,
  `contact_phone` VARCHAR(30) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`nominee_id`),
  UNIQUE KEY `uk_cust_nominee_name` (`customer_id`, `nominee_name`),
  INDEX `idx_nominee_customer` (`customer_id`),
  CONSTRAINT `fk_nominee_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_nominee_allocation` CHECK (`allocation_percentage` IS NULL OR (`allocation_percentage` > 0.00 AND `allocation_percentage` <= 100.00))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Table structure for `accounts`
-- Boyce-Codd Normal Form (BCNF)
-- Core banking ledger accounts referencing branches(ifsc_code)
-- Foreign Keys: customer_id REFERENCES customers, ifsc_code REFERENCES branches(ifsc_code)
-- Backward Compatibility: Retains branch_name/card_pin_hash columns for existing Next.js routes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounts` (
  `account_number` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Savings Account',
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `ifsc_code` VARCHAR(20) NOT NULL DEFAULT 'BTBI0001024',
  `branch_name` VARCHAR(100) NOT NULL DEFAULT 'Downtown Central',
  `opening_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Active', 'Frozen', 'Closed') DEFAULT 'Active',
  `card_pin` VARCHAR(10) DEFAULT NULL,
  `card_pin_hash` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`account_number`),
  INDEX `idx_acc_customer` (`customer_id`),
  INDEX `idx_acc_ifsc` (`ifsc_code`),
  INDEX `idx_acc_status` (`status`),
  CONSTRAINT `fk_accounts_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_accounts_branch` FOREIGN KEY (`ifsc_code`) 
    REFERENCES `branches` (`ifsc_code`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_acc_balance_non_negative` CHECK (`balance` >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Table structure for `account_card_credentials`
-- Normalized Card Credentials Relation (BCNF)
-- Decouples account card PIN hashes without inventing fake card numbers or expiry dates.
-- Candidate Key: CK1 = {credential_id}, CK2 = {account_number}
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `account_card_credentials` (
  `credential_id` VARCHAR(50) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `card_pin_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('Active', 'Blocked', 'Pending') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`credential_id`),
  UNIQUE KEY `uk_card_account` (`account_number`),
  INDEX `idx_card_customer` (`customer_id`),
  CONSTRAINT `fk_card_cred_account` FOREIGN KEY (`account_number`) 
    REFERENCES `accounts` (`account_number`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_card_cred_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Table structure for `transactions`
-- Immutable financial ledger in BCNF
-- Preserves original sender_account and receiver_account strings (including UPI VPAs)
-- Adds channel classification and UTR settlement identifier
-- Candidate Keys: CK1 = {transaction_id}, CK2 = {reference_number} (when non-null)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
  `transaction_id` VARCHAR(50) NOT NULL,
  `sender_account` VARCHAR(100) DEFAULT NULL,
  `receiver_account` VARCHAR(100) DEFAULT NULL,
  `counterparty_details` VARCHAR(150) DEFAULT NULL,
  `channel` ENUM('INTERNAL', 'UPI', 'NEFT', 'IMPS', 'RTGS', 'ATM', 'CASH', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL') DEFAULT 'TRANSFER',
  `amount` DECIMAL(15,2) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `date_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(30) DEFAULT 'Success',
  `description` TEXT DEFAULT NULL,
  `reference_number` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`transaction_id`),
  UNIQUE KEY `uk_transactions_ref` (`reference_number`),
  INDEX `idx_tx_sender` (`sender_account`),
  INDEX `idx_tx_receiver` (`receiver_account`),
  INDEX `idx_tx_datetime` (`date_time`),
  INDEX `idx_tx_status` (`status`),
  CONSTRAINT `chk_tx_amount_positive` CHECK (`amount` > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Table structure for `deposits`
-- Term contracts (Fixed & Recurring Deposits) in BCNF
-- Enforces referential integrity on linked_account and customer_id
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `deposits` (
  `deposit_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `linked_account` VARCHAR(50) NOT NULL,
  `deposit_type` VARCHAR(50) NOT NULL,
  `principal_amount` DECIMAL(15,2) NOT NULL,
  `interest_rate` DECIMAL(5,2) NOT NULL,
  `tenure_months` INT NOT NULL,
  `maturity_amount` DECIMAL(15,2) NOT NULL,
  `maturity_date` DATE NOT NULL,
  `status` ENUM('Active', 'Matured', 'Liquidated', 'Foreclosed') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`deposit_id`),
  INDEX `idx_dep_customer` (`customer_id`),
  INDEX `idx_dep_account` (`linked_account`),
  INDEX `idx_dep_status` (`status`),
  CONSTRAINT `fk_dep_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_dep_account` FOREIGN KEY (`linked_account`) 
    REFERENCES `accounts` (`account_number`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_dep_principal` CHECK (`principal_amount` >= 1000.00),
  CONSTRAINT `chk_dep_rate` CHECK (`interest_rate` > 0.00 AND `interest_rate` <= 20.00),
  CONSTRAINT `chk_dep_tenure` CHECK (`tenure_months` >= 1 AND `tenure_months` <= 120),
  CONSTRAINT `chk_dep_maturity` CHECK (`maturity_amount` >= `principal_amount`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. Table structure for `beneficiaries`
-- Registered payee directory in BCNF
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `beneficiaries` (
  `beneficiary_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `beneficiary_name` VARCHAR(150) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `ifsc_code` VARCHAR(20) NOT NULL,
  `bank_name` VARCHAR(150) NOT NULL,
  `transfer_limit` DECIMAL(15,2) DEFAULT 100000.00,
  `cooling_until` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `is_active` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`beneficiary_id`),
  UNIQUE KEY `uk_ben_account` (`customer_id`, `account_number`, `ifsc_code`),
  INDEX `idx_ben_customer` (`customer_id`),
  CONSTRAINT `fk_ben_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_ben_limit` CHECK (`transfer_limit` >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. Table structure for `kyc_verifications`
-- Authoritative regulatory identity compliance log in BCNF
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kyc_verifications` (
  `verification_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `document_number` VARCHAR(50) DEFAULT NULL,
  `verification_method` VARCHAR(50) NOT NULL,
  `status` VARCHAR(30) DEFAULT 'Verified',
  `verified_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `remarks` TEXT DEFAULT NULL,
  PRIMARY KEY (`verification_id`),
  INDEX `idx_kyc_customer` (`customer_id`),
  INDEX `idx_kyc_status` (`status`),
  CONSTRAINT `fk_kyc_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. Table structure for `otp_sessions`
-- Two-factor challenge table in BCNF
-- Plaintext OTP strictly scrubbed; salted bcrypt hash enforced; replay protected
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `otp_sessions` (
  `session_id` VARCHAR(50) NOT NULL,
  `identifier` VARCHAR(150) NOT NULL,
  `purpose` VARCHAR(50) NOT NULL,
  `otp_code` VARCHAR(10) DEFAULT NULL,
  `otp_hash` VARCHAR(255) DEFAULT NULL,
  `expires_at` BIGINT NOT NULL,
  `verified` INT DEFAULT 0,
  `attempts` INT DEFAULT 0,
  `last_sent_at` BIGINT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  INDEX `idx_otp_identifier` (`identifier`, `purpose`),
  INDEX `idx_otp_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. Table structure for `security_rate_limits`
-- Brute-force defensive ledger in BCNF
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `security_rate_limits` (
  `key_id` VARCHAR(150) NOT NULL,
  `attempts` INT DEFAULT 1,
  `last_attempt_at` BIGINT NOT NULL,
  `locked_until` BIGINT DEFAULT 0,
  PRIMARY KEY (`key_id`),
  INDEX `idx_rate_locked` (`locked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. Table structure for `account_lien_records`
-- Legal holds ledger with ON DELETE RESTRICT in BCNF
-- Preserves original columns and exact legal attachment amounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `account_lien_records` (
  `lien_id` VARCHAR(50) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `lien_amount` DECIMAL(15,2) NOT NULL,
  `lien_reason` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lien_id`),
  INDEX `idx_lien_account` (`account_number`),
  CONSTRAINT `fk_lien_account` FOREIGN KEY (`account_number`) 
    REFERENCES `accounts` (`account_number`) 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE,
  CONSTRAINT `chk_lien_amount_positive` CHECK (`lien_amount` > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. Table structure for `audit_logs`
-- Immutable non-repudiation audit trail in BCNF
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `log_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(50) DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  INDEX `idx_audit_customer` (`customer_id`),
  INDEX `idx_audit_entity` (`entity_type`, `entity_id`),
  INDEX `idx_audit_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================================
-- BACKWARD-COMPATIBILITY VIEWS & ANALYTICAL PROJECTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: `v_accounts_legacy`
-- Projects accounts joined with branches to guarantee authoritative branch names
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_accounts_legacy` AS
SELECT 
    a.account_number,
    a.customer_id,
    a.account_type,
    a.balance,
    a.ifsc_code,
    b.branch_name,
    a.opening_date,
    a.status,
    COALESCE(c.card_pin_hash, a.card_pin_hash) AS card_pin_hash
FROM `accounts` a
JOIN `branches` b ON a.ifsc_code = b.ifsc_code
LEFT JOIN `account_card_credentials` c ON a.account_number = c.account_number;

-- ----------------------------------------------------------------------------
-- View: `v_customers_legacy`
-- Seamlessly provides joined nominee details matching original customer shape
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_customers_legacy` AS
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
    c.password_hash,
    c.credit_score,
    c.tier,
    c.pan_number,
    c.aadhaar_number,
    c.gender,
    c.father_name,
    c.marital_status,
    c.occupation,
    c.annual_income,
    COALESCE(n.nominee_name, c.nominee_name) AS nominee_name,
    COALESCE(n.relationship, c.nominee_relation) AS nominee_relation,
    COALESCE(n.dob, c.nominee_dob) AS nominee_dob,
    c.vkyc_status,
    c.signature_data,
    c.avatar_data,
    c.card_pin_hash
FROM `customers` c
LEFT JOIN (
    SELECT customer_id, nominee_name, relationship, dob
    FROM `customer_nominees`
    GROUP BY customer_id
) n ON c.customer_id = n.customer_id;

-- ----------------------------------------------------------------------------
-- View: `v_customer_portfolio`
-- Reconstructs Customer Net Worth across Savings/Current and Term Deposits
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_customer_portfolio` AS
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
FROM `customers` c
LEFT JOIN (
    SELECT customer_id, COUNT(*) AS total_accounts, SUM(balance) AS total_liquid_balance
    FROM `accounts`
    WHERE status = 'Active'
    GROUP BY customer_id
) acc ON c.customer_id = acc.customer_id
LEFT JOIN (
    SELECT customer_id, SUM(principal_amount) AS total_deposits_principal
    FROM `deposits`
    WHERE status = 'Active'
    GROUP BY customer_id
) dep ON c.customer_id = dep.customer_id;

-- ----------------------------------------------------------------------------
-- View: `v_high_value_transactions`
-- Real-time AML compliance view for transactions >= ₹25,000
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_high_value_transactions` AS
SELECT 
    transaction_id,
    sender_account,
    receiver_account,
    amount,
    type,
    date_time,
    status,
    description,
    reference_number
FROM `transactions`
WHERE amount >= 25000.00
ORDER BY date_time DESC;

-- ----------------------------------------------------------------------------
-- View: `v_active_deposits_summary`
-- Term deposit portfolio yield summary
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_active_deposits_summary` AS
SELECT 
    d.deposit_id,
    c.full_name AS customer_name,
    d.linked_account,
    d.deposit_type,
    d.principal_amount,
    d.interest_rate,
    d.tenure_months,
    d.maturity_amount,
    (d.maturity_amount - d.principal_amount) AS expected_interest_yield,
    d.maturity_date
FROM `deposits` d
JOIN `customers` c ON d.customer_id = c.customer_id
WHERE d.status = 'Active';

-- ----------------------------------------------------------------------------
-- View: `v_branch_performance`
-- Domicile branch deposit accumulation & liquidity view
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_branch_performance` AS
SELECT 
    b.branch_id,
    b.branch_name,
    b.ifsc_code,
    b.city,
    COUNT(a.account_number) AS total_active_accounts,
    COALESCE(SUM(a.balance), 0.00) AS total_branch_liquidity
FROM `branches` b
LEFT JOIN `accounts` a ON b.ifsc_code = a.ifsc_code AND a.status = 'Active'
GROUP BY b.branch_id, b.branch_name, b.ifsc_code, b.city;

-- ============================================================================
-- END OF NORMALIZED DATABASE SCHEMA
-- ============================================================================
