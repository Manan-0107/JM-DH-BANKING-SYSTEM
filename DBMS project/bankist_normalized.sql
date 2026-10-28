-- ============================================================================
-- BHARAT TRUST BANK (BTB) - FULLY NORMALIZED RELATIONAL DATABASE SCHEMA
-- Target RDBMS: MySQL 8.0+ / InnoDB / utf8mb4_unicode_ci
-- Architectural Standard: 1NF, 2NF, 3NF, BCNF Compliant
-- Generated: 2026-10-28
-- ============================================================================
--
-- Safety Notice:
-- Database context must be explicitly selected by the caller (e.g., USE <database>;).
-- Do NOT hardcode 'USE bankist;' here to prevent accidental mutation of live environments.
--

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Table structure for `branches`
-- Boyce-Codd Normal Form (BCNF)
-- Candidate Keys: CK1 = {branch_id}, CK2 = {ifsc_code}
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
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
-- Decomposed: Nominee details moved to `customer_nominees`
-- Decomposed: Card credentials moved to `cards`
-- Candidate Keys: CK1 = {customer_id}, CK2 = {email}, CK3 = {pan_number}
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
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
  `signature_data` LONGTEXT DEFAULT NULL,
  `avatar_data` LONGTEXT DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uk_customers_email` (`email`),
  UNIQUE KEY `uk_customers_pan` (`pan_number`),
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_status` (`status`),
  CONSTRAINT `chk_cust_credit_score` CHECK (`credit_score` BETWEEN 300 AND 900)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Table structure for `customer_nominees`
-- Decomposed from `customers` to eliminate repeating groups & transitive dependencies (1NF/3NF/BCNF)
-- Supports multiple nominees per customer with fractional allocation percentages
-- Candidate Key: CK1 = {nominee_id}, CK2 = {customer_id, nominee_name}
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `customer_nominees`;
CREATE TABLE `customer_nominees` (
  `nominee_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `nominee_name` VARCHAR(150) NOT NULL,
  `relationship` VARCHAR(50) NOT NULL,
  `dob` DATE DEFAULT NULL,
  `allocation_percentage` DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  `contact_phone` VARCHAR(30) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`nominee_id`),
  UNIQUE KEY `uk_cust_nominee_name` (`customer_id`, `nominee_name`),
  INDEX `idx_nominee_customer` (`customer_id`),
  CONSTRAINT `fk_nominee_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_nominee_allocation` CHECK (`allocation_percentage` > 0.00 AND `allocation_percentage` <= 100.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Table structure for `accounts`
-- Boyce-Codd Normal Form (BCNF)
-- Decomposed: Redundant `branch_name` removed (transitive dependency account_number -> ifsc_code -> branch_name eliminated)
-- Decomposed: Plaintext `card_pin` and card hashes moved to `cards`
-- Foreign Keys: customer_id REFERENCES customers, ifsc_code REFERENCES branches(ifsc_code)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `accounts`;
CREATE TABLE `accounts` (
  `account_number` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `account_type` ENUM('Savings Account', 'Current Account', 'Salary Account', 'NRI Account') NOT NULL DEFAULT 'Savings Account',
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `ifsc_code` VARCHAR(20) NOT NULL,
  `opening_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Active', 'Frozen', 'Closed') DEFAULT 'Active',
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
-- 5. Table structure for `cards`
-- Dedicated payment instrument relation (BCNF)
-- Eliminates plaintext PINs; stores Bcrypt card PIN hash; binds instrument to account
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `cards`;
CREATE TABLE `cards` (
  `card_id` VARCHAR(50) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `card_number_masked` VARCHAR(25) NOT NULL,
  `card_type` ENUM('VISA Platinum Debit', 'RuPay Classic', 'Mastercard World', 'Business Debit') DEFAULT 'VISA Platinum Debit',
  `card_pin_hash` VARCHAR(255) NOT NULL,
  `expiry_date` DATE NOT NULL,
  `daily_limit` DECIMAL(15,2) NOT NULL DEFAULT 50000.00,
  `status` ENUM('Active', 'Blocked', 'Expired', 'Hotlisted') DEFAULT 'Active',
  `issued_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`card_id`),
  INDEX `idx_card_account` (`account_number`),
  INDEX `idx_card_customer` (`customer_id`),
  CONSTRAINT `fk_cards_account` FOREIGN KEY (`account_number`) 
    REFERENCES `accounts` (`account_number`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cards_customer` FOREIGN KEY (`customer_id`) 
    REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_card_limit_positive` CHECK (`daily_limit` > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Table structure for `transactions`
-- Immutable financial ledger in BCNF
-- Clarifies channel, external counterparty handles, and maintains balance check
-- Candidate Key: CK1 = {transaction_id}, CK2 = {reference_number} (when non-null)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `transaction_id` VARCHAR(50) NOT NULL,
  `sender_account` VARCHAR(50) DEFAULT NULL,
  `receiver_account` VARCHAR(50) DEFAULT NULL,
  `counterparty_details` VARCHAR(150) DEFAULT NULL,
  `channel` ENUM('INTERNAL', 'UPI', 'NEFT', 'IMPS', 'RTGS', 'ATM', 'CASH', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL') DEFAULT 'TRANSFER',
  `amount` DECIMAL(15,2) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `date_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Success', 'Failed', 'Pending', 'Reversed') DEFAULT 'Success',
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
DROP TABLE IF EXISTS `deposits`;
CREATE TABLE `deposits` (
  `deposit_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `linked_account` VARCHAR(50) NOT NULL,
  `deposit_type` ENUM('Fixed Deposit', 'Recurring Deposit') NOT NULL,
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
DROP TABLE IF EXISTS `beneficiaries`;
CREATE TABLE `beneficiaries` (
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
DROP TABLE IF EXISTS `kyc_verifications`;
CREATE TABLE `kyc_verifications` (
  `verification_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `document_type` VARCHAR(50) NOT NULL,
  `document_number` VARCHAR(50) DEFAULT NULL,
  `verification_method` VARCHAR(50) NOT NULL,
  `status` ENUM('Verified', 'Pending', 'Rejected') DEFAULT 'Verified',
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
-- Plaintext OTP eliminated; bcrypt hash enforced
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `otp_sessions`;
CREATE TABLE `otp_sessions` (
  `session_id` VARCHAR(50) NOT NULL,
  `identifier` VARCHAR(150) NOT NULL,
  `purpose` VARCHAR(50) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `expires_at` BIGINT NOT NULL,
  `verified` TINYINT(1) DEFAULT 0,
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
DROP TABLE IF EXISTS `security_rate_limits`;
CREATE TABLE `security_rate_limits` (
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
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `account_lien_records`;
CREATE TABLE `account_lien_records` (
  `lien_id` VARCHAR(50) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `lien_amount` DECIMAL(15,2) NOT NULL,
  `lien_reason` VARCHAR(255) NOT NULL,
  `status` ENUM('Active', 'Released', 'Executed') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lien_id`),
  INDEX `idx_lien_account` (`account_number`),
  CONSTRAINT `fk_lien_account` FOREIGN KEY (`account_number`) 
    REFERENCES `accounts` (`account_number`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_lien_amount_positive` CHECK (`lien_amount` > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 13. Table structure for `audit_logs`
-- Immutable non-repudiation audit trail in BCNF
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
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
-- Seamlessly restores `branch_name` and `card_pin_hash` to match original
-- `accounts` table shape for existing application queries without schema violation.
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
    c.card_pin_hash
FROM `accounts` a
JOIN `branches` b ON a.ifsc_code = b.ifsc_code
LEFT JOIN `cards` c ON a.account_number = c.account_number;

-- ----------------------------------------------------------------------------
-- View: `v_customers_legacy`
-- Seamlessly provides joined nominee details matching original `customers` shape.
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
    n.nominee_name,
    n.relationship AS nominee_relation,
    n.dob AS nominee_dob,
    'Completed' AS vkyc_status,
    c.signature_data,
    c.avatar_data
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

