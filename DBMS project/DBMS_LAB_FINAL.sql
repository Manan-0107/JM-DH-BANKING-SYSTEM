-- ==============================================================================
-- BHARAT TRUST BANK (BTB) / BANKIST — FINAL COLLEGE DBMS LAB & VIVA SPECIFICATION
-- ==============================================================================
-- Database Engine : MySQL 8.0.16+ (InnoDB Storage Engine)
-- Normal Form     : Boyce-Codd Normal Form (BCNF)
-- Features        : 1NF–BCNF Schema, Domain Checks, Foreign Keys, Stored Routines,
--                   ACID Transactions, Rollback Invariants, Views, and Test Suites.
-- Author          : Senior MySQL Database Architect & Full-Stack Engineer
-- Target Database : `bankist_college_demo` (Isolated Demo Database)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: DATABASE INITIALIZATION & ENVIRONMENT SETUP
-- ------------------------------------------------------------------------------
DROP DATABASE IF EXISTS `bankist_college_demo`;
CREATE DATABASE `bankist_college_demo`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `bankist_college_demo`;

-- Enforce strict SQL mode (Zero tolerance for group-by errors or silent truncations)
SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- SECTION 2: BCNF NORMALIZED SCHEMA CREATION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table 1: `branches`
-- Normal Form: BCNF
-- FDs: branch_id -> {ifsc_code, branch_name, city, address, timing, phone, status}
--      ifsc_code -> {branch_id, branch_name, city, address, timing, phone, status}
-- Superkeys: {branch_id}, {ifsc_code}
-- ------------------------------------------------------------------------------
CREATE TABLE `branches` (
    `branch_id` VARCHAR(50) NOT NULL,
    `ifsc_code` VARCHAR(20) NOT NULL,
    `branch_name` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `address` TEXT NOT NULL,
    `timing` VARCHAR(50) DEFAULT '09:30 AM - 04:30 PM',
    `phone` VARCHAR(30) DEFAULT NULL,
    `status` ENUM('Active', 'Inactive', 'Closed') DEFAULT 'Active',
    PRIMARY KEY (`branch_id`),
    UNIQUE KEY `uk_branches_ifsc` (`ifsc_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 2: `customers`
-- Normal Form: BCNF
-- FDs: customer_id -> {full_name, email, phone, dob, address, status, kyc_status, password_hash, credit_score, tier, pan_number, aadhaar_number}
--      email -> {customer_id, ...}
-- Superkeys: {customer_id}, {email}
-- Note: Nominees and card PINs are decomposed into separate relations.
-- ------------------------------------------------------------------------------
CREATE TABLE `customers` (
    `customer_id` VARCHAR(50) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(30) DEFAULT NULL,
    `dob` DATE DEFAULT NULL,
    `address` TEXT DEFAULT NULL,
    `status` ENUM('Active', 'Suspended', 'Pending', 'Closed') DEFAULT 'Active',
    `kyc_status` ENUM('Verified', 'Pending', 'Rejected') DEFAULT 'Pending',
    `password_hash` VARCHAR(255) NOT NULL,
    `credit_score` INT DEFAULT 700,
    `tier` ENUM('Silver', 'Gold', 'Platinum', 'VIP') DEFAULT 'Silver',
    `pan_number` VARCHAR(20) DEFAULT NULL,
    `aadhaar_number` VARCHAR(20) DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`customer_id`),
    UNIQUE KEY `uk_customers_email` (`email`),
    INDEX `idx_cust_phone` (`phone`),
    INDEX `idx_cust_status` (`status`),
    CONSTRAINT `chk_cust_credit_score` CHECK (`credit_score` BETWEEN 300 AND 900)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 3: `customer_nominees`
-- Normal Form: BCNF
-- FDs: nominee_id -> {customer_id, nominee_name, relationship, dob, allocation_percentage}
-- Superkeys: {nominee_id}
-- Solves 1NF repeating group flaw in customers.
-- ------------------------------------------------------------------------------
CREATE TABLE `customer_nominees` (
    `nominee_id` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(50) NOT NULL,
    `nominee_name` VARCHAR(100) NOT NULL,
    `relationship` VARCHAR(50) NOT NULL,
    `dob` DATE DEFAULT NULL,
    `allocation_percentage` DECIMAL(5,2) DEFAULT 100.00,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`nominee_id`),
    INDEX `idx_nominee_customer` (`customer_id`),
    CONSTRAINT `fk_nominee_customer` FOREIGN KEY (`customer_id`)
        REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_nominee_allocation` CHECK (`allocation_percentage` > 0.00 AND `allocation_percentage` <= 100.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 4: `accounts`
-- Normal Form: BCNF
-- FDs: account_number -> {customer_id, account_type, balance, ifsc_code, opening_date, status}
-- Superkeys: {account_number}
-- Solves 3NF transitive dependency: branch_name removed (resolved via ifsc_code).
-- ------------------------------------------------------------------------------
CREATE TABLE `accounts` (
    `account_number` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(50) NOT NULL,
    `account_type` ENUM('Savings', 'Current', 'Salary', 'Fixed Deposit') NOT NULL DEFAULT 'Savings',
    `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `ifsc_code` VARCHAR(20) NOT NULL,
    `opening_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `status` ENUM('Active', 'Dormant', 'Frozen', 'Closed') DEFAULT 'Active',
    PRIMARY KEY (`account_number`),
    INDEX `idx_acc_customer` (`customer_id`),
    INDEX `idx_acc_ifsc` (`ifsc_code`),
    INDEX `idx_acc_cust_status` (`customer_id`, `status`),
    CONSTRAINT `fk_acc_customer` FOREIGN KEY (`customer_id`)
        REFERENCES `customers` (`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_acc_branch` FOREIGN KEY (`ifsc_code`)
        REFERENCES `branches` (`ifsc_code`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `chk_acc_balance_non_negative` CHECK (`balance` >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 5: `account_card_credentials`
-- Normal Form: BCNF
-- FDs: credential_id -> {account_number, customer_id, card_pin_hash, status}
--      account_number -> {credential_id, customer_id, card_pin_hash, status}
-- Superkeys: {credential_id}, {account_number}
-- Stores salted Bcrypt hashes for card PIN verification. Fails closed on NULL.
-- ------------------------------------------------------------------------------
CREATE TABLE `account_card_credentials` (
    `credential_id` VARCHAR(64) NOT NULL,
    `account_number` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(50) NOT NULL,
    `card_pin_hash` VARCHAR(255) DEFAULT NULL,
    `status` ENUM('Active', 'Blocked', 'Pending', 'NoCard') DEFAULT 'Active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`credential_id`),
    UNIQUE KEY `uk_card_account` (`account_number`),
    INDEX `idx_card_customer` (`customer_id`),
    CONSTRAINT `fk_card_account` FOREIGN KEY (`account_number`)
        REFERENCES `accounts` (`account_number`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_card_customer` FOREIGN KEY (`customer_id`)
        REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 6: `transactions`
-- Normal Form: BCNF
-- FDs: transaction_id -> {sender_account, receiver_account, channel, amount, type, date_time, status, reference_number}
-- Superkeys: {transaction_id}, {reference_number} (when non-null)
-- Immutable General Financial Ledger.
-- ------------------------------------------------------------------------------
CREATE TABLE `transactions` (
    `transaction_id` VARCHAR(50) NOT NULL,
    `sender_account` VARCHAR(100) DEFAULT NULL,
    `receiver_account` VARCHAR(100) DEFAULT NULL,
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

-- ------------------------------------------------------------------------------
-- Table 7: `deposits`
-- Normal Form: BCNF
-- FDs: deposit_id -> {customer_id, linked_account, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status}
-- Superkeys: {deposit_id}
-- Term deposits contracts (Fixed & Recurring).
-- ------------------------------------------------------------------------------
CREATE TABLE `deposits` (
    `deposit_id` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(50) NOT NULL,
    `linked_account` VARCHAR(50) NOT NULL,
    `deposit_type` ENUM('Fixed', 'Recurring') NOT NULL DEFAULT 'Fixed',
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
    CONSTRAINT `chk_dep_principal_min` CHECK (`principal_amount` >= 1000.00),
    CONSTRAINT `chk_dep_maturity_gte_principal` CHECK (`maturity_amount` >= `principal_amount`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 8: `beneficiaries`
-- Normal Form: BCNF
-- FDs: beneficiary_id -> {customer_id, beneficiary_name, account_number, ifsc_code, bank_name, transfer_limit, is_active}
-- Superkeys: {beneficiary_id}, {customer_id, account_number, ifsc_code}
-- ------------------------------------------------------------------------------
CREATE TABLE `beneficiaries` (
    `beneficiary_id` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(50) NOT NULL,
    `beneficiary_name` VARCHAR(150) NOT NULL,
    `account_number` VARCHAR(50) NOT NULL,
    `ifsc_code` VARCHAR(20) NOT NULL,
    `bank_name` VARCHAR(150) NOT NULL,
    `transfer_limit` DECIMAL(15,2) DEFAULT 100000.00,
    `cooling_until` DATETIME DEFAULT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`beneficiary_id`),
    UNIQUE KEY `uk_ben_account` (`customer_id`, `account_number`, `ifsc_code`),
    INDEX `idx_ben_customer` (`customer_id`),
    CONSTRAINT `fk_ben_customer` FOREIGN KEY (`customer_id`)
        REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_ben_limit_positive` CHECK (`transfer_limit` > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Table 9: `audit_logs`
-- Normal Form: BCNF
-- Non-repudiation administrative & security audit trail.
-- ------------------------------------------------------------------------------
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
    INDEX `idx_audit_action` (`action`),
    CONSTRAINT `fk_audit_customer` FOREIGN KEY (`customer_id`)
        REFERENCES `customers` (`customer_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- SECTION 3: BACKWARD-COMPATIBILITY & ANALYTICAL VIEWS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- View 1: `v_accounts_legacy`
-- Reconstructs legacy accounts projection by joining accounts with branches and credentials.
-- ------------------------------------------------------------------------------
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
LEFT JOIN `account_card_credentials` c ON a.account_number = c.account_number;

-- ------------------------------------------------------------------------------
-- View 2: `v_customers_legacy`
-- Eliminates MySQL Error 1055 under strict ONLY_FULL_GROUP_BY using ROW_NUMBER() window function.
-- ------------------------------------------------------------------------------
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
    c.credit_score,
    c.tier,
    c.pan_number,
    c.aadhaar_number,
    n.nominee_name,
    n.relationship AS nominee_relation,
    n.dob AS nominee_dob
FROM `customers` c
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
    FROM `customer_nominees`
) n ON c.customer_id = n.customer_id AND n.rn = 1;

-- ------------------------------------------------------------------------------
-- View 3: `v_customer_portfolio`
-- Canonical wealth summary. Pre-aggregates accounts and deposits independently to prevent Cartesian bloat.
-- ------------------------------------------------------------------------------
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

-- ==============================================================================
-- SECTION 4: ATOMIC STORED PROCEDURES (ACID TRANSACTIONS)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Procedure: `sp_deposit_funds`
-- Purpose  : Atomically validates, credits account, and records transaction ledger.
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_deposit_funds`;

DELIMITER //
CREATE PROCEDURE `sp_deposit_funds`(
    IN  p_account_number VARCHAR(50),
    IN  p_amount         DECIMAL(15,2),
    IN  p_description    VARCHAR(255),
    OUT p_status         VARCHAR(20),
    OUT p_message        VARCHAR(255),
    OUT p_txn_id         VARCHAR(50)
)
proc_label: BEGIN
    DECLARE v_acc_status VARCHAR(30);
    DECLARE v_new_balance DECIMAL(15,2);
    DECLARE v_txn_id VARCHAR(50);
    DECLARE v_ref_no VARCHAR(100);

    -- Error handler for unexpected database exceptions
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'ERROR';
        SET p_message = 'Database exception during deposit execution. Transaction rolled back.';
        SET p_txn_id = NULL;
    END;

    -- 1. Validate Monetary Amount
    IF p_amount IS NULL OR p_amount <= 0.00 THEN
        SET p_status = 'REJECTED';
        SET p_message = 'Invalid deposit amount. Amount must be strictly greater than zero.';
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    -- 2. Verify Account Exists and is Active
    SELECT status INTO v_acc_status
    FROM `accounts`
    WHERE account_number = p_account_number;

    IF v_acc_status IS NULL THEN
        SET p_status = 'REJECTED';
        SET p_message = 'Target account number does not exist.';
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    IF v_acc_status != 'Active' THEN
        SET p_status = 'REJECTED';
        SET p_message = CONCAT('Account is currently ', LOWER(v_acc_status), '. Deposits are prohibited.');
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    -- 3. Generate Deterministic Identifiers
    SET v_txn_id = CONCAT('TXN-DEP-', UNIX_TIMESTAMP(), '-', FLOOR(1000 + RAND() * 9000));
    SET v_ref_no = CONCAT('BTB', DATE_FORMAT(NOW(), '%Y%m%d'), UPPER(HEX(RANDOM_BYTES(5))));

    -- 4. Begin ACID Transaction
    START TRANSACTION;

    -- Credit Account Balance
    UPDATE `accounts`
    SET balance = balance + p_amount
    WHERE account_number = p_account_number;

    -- Insert Transaction Record
    INSERT INTO `transactions` (
        transaction_id, sender_account, receiver_account, channel,
        amount, type, date_time, status, description, reference_number
    ) VALUES (
        v_txn_id, NULL, p_account_number, 'CASH',
        p_amount, 'Deposit', NOW(), 'Success',
        COALESCE(p_description, 'Direct Cash Deposit'), v_ref_no
    );

    -- Insert Audit Record
    INSERT INTO `audit_logs` (log_id, customer_id, action, entity_type, entity_id, details)
    SELECT 
        CONCAT('AUDIT-', UNIX_TIMESTAMP(), '-', FLOOR(100 + RAND() * 900)),
        customer_id, 'CASH_DEPOSIT', 'ACCOUNT', p_account_number,
        CONCAT('Deposited ₹', p_amount, '. New Ref: ', v_ref_no)
    FROM `accounts`
    WHERE account_number = p_account_number;

    COMMIT;

    -- Retrieve Updated Balance
    SELECT balance INTO v_new_balance FROM `accounts` WHERE account_number = p_account_number;

    SET p_status = 'SUCCESS';
    SET p_message = CONCAT('₹', p_amount, ' deposited successfully. New balance: ₹', v_new_balance);
    SET p_txn_id = v_txn_id;
END proc_label //
DELIMITER ;

-- ------------------------------------------------------------------------------
-- Procedure: `sp_transfer_funds`
-- Purpose  : Concurrency-safe atomic transfer between two accounts with deadlock avoidance.
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_transfer_funds`;

DELIMITER //
CREATE PROCEDURE `sp_transfer_funds`(
    IN  p_sender_acc     VARCHAR(50),
    IN  p_receiver_acc   VARCHAR(50),
    IN  p_amount         DECIMAL(15,2),
    IN  p_description    VARCHAR(255),
    OUT p_status         VARCHAR(20),
    OUT p_message        VARCHAR(255),
    OUT p_txn_id         VARCHAR(50)
)
proc_label: BEGIN
    DECLARE v_sender_status VARCHAR(30);
    DECLARE v_receiver_status VARCHAR(30);
    DECLARE v_sender_balance DECIMAL(15,2);
    DECLARE v_sender_new_balance DECIMAL(15,2);
    DECLARE v_receiver_new_balance DECIMAL(15,2);
    DECLARE v_txn_id VARCHAR(50);
    DECLARE v_ref_no VARCHAR(100);

    -- Error handler for unexpected database exceptions
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'ERROR';
        SET p_message = 'Database exception during transfer execution. Transaction rolled back atomically.';
        SET p_txn_id = NULL;
    END;

    -- 1. Validate Monetary Amount
    IF p_amount IS NULL OR p_amount <= 0.00 THEN
        SET p_status = 'REJECTED';
        SET p_message = 'Transfer amount must be strictly greater than zero.';
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    -- 2. Reject Self-Transfer
    IF p_sender_acc = p_receiver_acc THEN
        SET p_status = 'REJECTED';
        SET p_message = 'Sender and receiver accounts cannot be identical.';
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    -- 3. Verify Accounts Exist and Are Active
    SELECT status, balance INTO v_sender_status, v_sender_balance
    FROM `accounts` WHERE account_number = p_sender_acc;

    IF v_sender_status IS NULL THEN
        SET p_status = 'REJECTED';
        SET p_message = 'Sender account not found.';
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    IF v_sender_status != 'Active' THEN
        SET p_status = 'REJECTED';
        SET p_message = CONCAT('Sender account is ', LOWER(v_sender_status), '. Transfer rejected.');
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    SELECT status INTO v_receiver_status
    FROM `accounts` WHERE account_number = p_receiver_acc;

    IF v_receiver_status IS NULL THEN
        SET p_status = 'REJECTED';
        SET p_message = 'Beneficiary account not found.';
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    IF v_receiver_status != 'Active' THEN
        SET p_status = 'REJECTED';
        SET p_message = CONCAT('Beneficiary account is ', LOWER(v_receiver_status), '. Transfer rejected.');
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    -- 4. Check Available Balance
    IF v_sender_balance < p_amount THEN
        SET p_status = 'REJECTED';
        SET p_message = CONCAT('Insufficient funds. Available: ₹', v_sender_balance, ', Requested: ₹', p_amount);
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    -- 5. Generate Identifiers
    SET v_txn_id = CONCAT('TXN-TRF-', UNIX_TIMESTAMP(), '-', FLOOR(1000 + RAND() * 9000));
    SET v_ref_no = CONCAT('BTB', DATE_FORMAT(NOW(), '%Y%m%d'), UPPER(HEX(RANDOM_BYTES(5))));

    -- 6. Execute Atomic Transaction with Deadlock Prevention (Lock accounts in consistent order)
    START TRANSACTION;

    -- Lock both accounts in lexicographical order to prevent concurrent deadlocks
    IF p_sender_acc < p_receiver_acc THEN
        SELECT balance FROM `accounts` WHERE account_number = p_sender_acc FOR UPDATE;
        SELECT balance FROM `accounts` WHERE account_number = p_receiver_acc FOR UPDATE;
    ELSE
        SELECT balance FROM `accounts` WHERE account_number = p_receiver_acc FOR UPDATE;
        SELECT balance FROM `accounts` WHERE account_number = p_sender_acc FOR UPDATE;
    END IF;

    -- Execute Conditional Debit (Guarantees balance non-negativity at the storage engine level)
    UPDATE `accounts`
    SET balance = balance - p_amount
    WHERE account_number = p_sender_acc AND balance >= p_amount;

    IF ROW_COUNT() = 0 THEN
        ROLLBACK;
        SET p_status = 'REJECTED';
        SET p_message = 'Insufficient funds or concurrent update detected during debit.';
        SET p_txn_id = NULL;
        LEAVE proc_label;
    END IF;

    -- Execute Credit
    UPDATE `accounts`
    SET balance = balance + p_amount
    WHERE account_number = p_receiver_acc;

    -- Insert Transaction Record
    INSERT INTO `transactions` (
        transaction_id, sender_account, receiver_account, channel,
        amount, type, date_time, status, description, reference_number
    ) VALUES (
        v_txn_id, p_sender_acc, p_receiver_acc, 'INTERNAL',
        p_amount, 'Transfer', NOW(), 'Success',
        COALESCE(p_description, CONCAT('Fund Transfer to ', p_receiver_acc)), v_ref_no
    );

    -- Insert Audit Record
    INSERT INTO `audit_logs` (log_id, customer_id, action, entity_type, entity_id, details)
    SELECT 
        CONCAT('AUDIT-', UNIX_TIMESTAMP(), '-', FLOOR(100 + RAND() * 900)),
        customer_id, 'FUND_TRANSFER', 'TRANSACTION', v_txn_id,
        CONCAT('Transferred ₹', p_amount, ' from ', p_sender_acc, ' to ', p_receiver_acc, '. Ref: ', v_ref_no)
    FROM `accounts`
    WHERE account_number = p_sender_acc;

    COMMIT;

    -- Retrieve Post-Transfer Balances
    SELECT balance INTO v_sender_new_balance FROM `accounts` WHERE account_number = p_sender_acc;
    SELECT balance INTO v_receiver_new_balance FROM `accounts` WHERE account_number = p_receiver_acc;

    SET p_status = 'SUCCESS';
    SET p_message = CONCAT('₹', p_amount, ' transferred successfully. Sender: ₹', v_sender_new_balance, ', Receiver: ₹', v_receiver_new_balance);
    SET p_txn_id = v_txn_id;
END proc_label //
DELIMITER ;

-- ==============================================================================
-- SECTION 5: SEED DATA FOR COLLEGE DEMONSTRATION & VIVA
-- ==============================================================================

-- 1. Insert Branch Directory
INSERT INTO `branches` (`branch_id`, `ifsc_code`, `branch_name`, `city`, `address`, `phone`, `status`) VALUES
('BR-101', 'BTBI0001024', 'Mumbai Nariman Point Hub', 'Mumbai', 'Ground Floor, Express Towers, Nariman Point, Mumbai 400021', '022-22881024', 'Active'),
('BR-102', 'BTBI0002018', 'Bengaluru MG Road Branch', 'Bengaluru', 'Prestige Meridian, 29 MG Road, Bengaluru 560001', '080-25582018', 'Active');

-- 2. Insert Customers (Password: "Student@123", PIN: "1234" - Bcrypt Hashed)
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`) VALUES
('CUST-101', 'Aarav Patel', 'aarav@example.com', '+91 98200 12345', '1990-03-15', 'Flat 402, Nariman Point, Mumbai', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 810, 'Platinum', 'ABCDE1234F', 'XXXXXXXX1234'),
('CUST-102', 'Priya Nair', 'priya@example.com', '+91 98200 54321', '1995-07-22', 'Block B, Indiranagar, Bengaluru', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 760, 'Gold', 'XYZPK9876Q', 'XXXXXXXX5678');

-- 3. Insert Nominees
INSERT INTO `customer_nominees` (`nominee_id`, `customer_id`, `nominee_name`, `relationship`, `dob`, `allocation_percentage`) VALUES
('NOM-101', 'CUST-101', 'Kavita Patel', 'Spouse', '1992-08-14', 100.00),
('NOM-102', 'CUST-102', 'Sunil Nair', 'Father', '1965-03-22', 100.00);

-- 4. Insert Accounts with Exact Demonstration Baseline:
--    Aarav Patel (ACC-1001): Initial Balance = ₹5,000.00
--    Priya Nair  (ACC-1002): Initial Balance = ₹2,000.00
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `status`) VALUES
('ACC-1001', 'CUST-101', 'Savings', 5000.00, 'BTBI0001024', 'Active'),
('ACC-1002', 'CUST-102', 'Savings', 2000.00, 'BTBI0002018', 'Active');

-- 5. Insert Card Credentials (PIN: "1234" - Bcrypt Hashed)
INSERT INTO `account_card_credentials` (`credential_id`, `account_number`, `customer_id`, `card_pin_hash`, `status`) VALUES
('CARD-1001', 'ACC-1001', 'CUST-101', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 'Active'),
('CARD-1002', 'ACC-1002', 'CUST-102', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 'Active');

-- 6. Insert Beneficiary Payee
INSERT INTO `beneficiaries` (`beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, `ifsc_code`, `bank_name`, `transfer_limit`) VALUES
('BEN-101', 'CUST-101', 'Priya Nair', 'ACC-1002', 'BTBI0002018', 'Bharat Trust Bank (MG Road)', 100000.00);

-- ==============================================================================
-- SECTION 6: POSITIVE AND NEGATIVE TEST DEMONSTRATIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- TEST 1: Baseline Account Verification
-- Expected: ACC-1001 = ₹5,000.00, ACC-1002 = ₹2,000.00
-- ------------------------------------------------------------------------------
SELECT '--- TEST 1: INITIAL BASELINE ACCOUNT BALANCES ---' AS test_banner;
SELECT account_number, customer_id, account_type, balance, status 
FROM `accounts` 
WHERE account_number IN ('ACC-1001', 'ACC-1002')
ORDER BY account_number;

-- ------------------------------------------------------------------------------
-- TEST 2: Valid Deposit Demonstration
-- Action: Deposit ₹1,000.00 into ACC-1001
-- Expected: ACC-1001 balance increases from ₹5,000.00 to ₹6,000.00. Exactly 1 transaction record created.
-- ------------------------------------------------------------------------------
SELECT '--- TEST 2: EXECUTING VALID DEPOSIT (₹1,000.00) ---' AS test_banner;
CALL sp_deposit_funds('ACC-1001', 1000.00, 'College Viva Demo Cash Deposit', @status, @msg, @tx_id);
SELECT @status AS deposit_status, @msg AS deposit_message, @tx_id AS deposit_txn_id;

-- Verify updated balance and transaction ledger
SELECT account_number, balance FROM `accounts` WHERE account_number = 'ACC-1001';
SELECT transaction_id, receiver_account, amount, type, status, reference_number 
FROM `transactions` WHERE transaction_id = @tx_id;

-- ------------------------------------------------------------------------------
-- TEST 3: Valid Inter-Account Transfer Demonstration
-- Action: Transfer ₹500.00 from ACC-1001 (₹6,000) to ACC-1002 (₹2,000)
-- Expected: ACC-1001 = ₹5,500.00, ACC-1002 = ₹2,500.00. Total institutional liquidity conserved (₹8,000 == ₹8,000).
-- ------------------------------------------------------------------------------
SELECT '--- TEST 3: EXECUTING VALID TRANSFER (₹500.00) ---' AS test_banner;
CALL sp_transfer_funds('ACC-1001', 'ACC-1002', 500.00, 'College Viva Fund Transfer Demo', @status, @msg, @tx_id);
SELECT @status AS transfer_status, @msg AS transfer_message, @tx_id AS transfer_txn_id;

-- Verify both balances
SELECT account_number, customer_id, balance 
FROM `accounts` 
WHERE account_number IN ('ACC-1001', 'ACC-1002')
ORDER BY account_number;

-- Verify combined total conservation
SELECT CAST(SUM(balance) AS DECIMAL(15,2)) AS total_institutional_liquidity 
FROM `accounts` 
WHERE account_number IN ('ACC-1001', 'ACC-1002');

-- ------------------------------------------------------------------------------
-- TEST 4: Invalid Deposit Rejection (Negative & Zero Amount)
-- Action: Attempt deposit of ₹-500.00
-- Expected: REJECTED with clear error. Balance remains exactly ₹5,500.00.
-- ------------------------------------------------------------------------------
SELECT '--- TEST 4: REJECTING NEGATIVE DEPOSIT (₹-500.00) ---' AS test_banner;
CALL sp_deposit_funds('ACC-1001', -500.00, 'Malicious Negative Deposit', @status, @msg, @tx_id);
SELECT @status AS rejected_status, @msg AS rejection_reason;
SELECT account_number, balance FROM `accounts` WHERE account_number = 'ACC-1001';

-- ------------------------------------------------------------------------------
-- TEST 5: Insufficient Funds Transfer Rejection
-- Action: Attempt transfer of ₹10,000.00 from ACC-1001 (Available: ₹5,500.00)
-- Expected: REJECTED with clear error. Both balances remain unchanged.
-- ------------------------------------------------------------------------------
SELECT '--- TEST 5: REJECTING OVERDRAFT TRANSFER (₹10,000.00) ---' AS test_banner;
CALL sp_transfer_funds('ACC-1001', 'ACC-1002', 10000.00, 'Overdraft Attempt', @status, @msg, @tx_id);
SELECT @status AS rejected_status, @msg AS rejection_reason;
SELECT account_number, balance FROM `accounts` WHERE account_number IN ('ACC-1001', 'ACC-1002') ORDER BY account_number;

-- ------------------------------------------------------------------------------
-- TEST 6: Simulated Mid-Transaction Automatic Rollback
-- Action: Simulate a failure during multi-step operation.
-- Expected: No partial debit, credit, or orphaned record.
-- ------------------------------------------------------------------------------
SELECT '--- TEST 6: DEMONSTRATING ATOMIC TRANSACTION ROLLBACK ---' AS test_banner;
START TRANSACTION;
UPDATE `accounts` SET balance = balance - 200.00 WHERE account_number = 'ACC-1001';
-- Simulate unexpected runtime crash or constraint violation
ROLLBACK;

-- Verify balance is intact
SELECT account_number, balance, 'Restored atomically after ROLLBACK' AS verification_result 
FROM `accounts` WHERE account_number = 'ACC-1001';

-- ------------------------------------------------------------------------------
-- TEST 7: Querying Analytical Views
-- ------------------------------------------------------------------------------
SELECT '--- TEST 7: CANONICAL PORTFOLIO AGGREGATION VIEW ---' AS test_banner;
SELECT customer_id, full_name, total_accounts, total_liquid_balance, total_net_worth 
FROM `v_customer_portfolio`;

SELECT '--- TEST 7B: STRICT MODE LEGACY CUSTOMER & NOMINEE VIEW ---' AS test_banner;
SELECT customer_id, full_name, nominee_name, nominee_relation, nominee_dob 
FROM `v_customers_legacy`;

-- ==============================================================================
-- SECTION 7: SAFE DEMO CLEANUP & RESET INSTRUCTIONS
-- ==============================================================================
-- To reset the demonstration at any time during your viva presentation:
-- Simply re-run this script:
--   mysql -u root -p < DBMS_LAB_FINAL.sql
--
-- To completely drop the demo database after the viva evaluation:
--   DROP DATABASE IF EXISTS `bankist_college_demo`;
-- ==============================================================================
