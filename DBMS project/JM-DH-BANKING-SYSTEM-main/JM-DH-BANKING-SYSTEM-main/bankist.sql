-- ============================================================================
-- BHARAT TRUST BANK (BTB) - COMPLETE RELATIONAL DATABASE DUMP
-- Compatible with MySQL 8.0+ & MySQL Workbench
-- Generated: 2026-09-13T16:49:30.116Z
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `bankist` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `bankist`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Table structure for `customers`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `customer_id` VARCHAR(50) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
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
  `card_pin` VARCHAR(10) DEFAULT '1234',
  PRIMARY KEY (`customer_id`),
  INDEX `idx_cust_email` (`email`),
  INDEX `idx_cust_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `accounts`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `accounts`;
CREATE TABLE `accounts` (
  `account_number` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `account_type` VARCHAR(50) NOT NULL,
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `ifsc_code` VARCHAR(20) NOT NULL DEFAULT 'BTBI0001024',
  `branch_name` VARCHAR(100) NOT NULL DEFAULT 'Downtown Central',
  `opening_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Active', 'Frozen', 'Closed') DEFAULT 'Active',
  `card_pin` VARCHAR(10) DEFAULT '1234',
  PRIMARY KEY (`account_number`),
  INDEX `idx_acc_customer` (`customer_id`),
  CONSTRAINT `fk_accounts_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `transactions`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `transaction_id` VARCHAR(50) NOT NULL,
  `sender_account` VARCHAR(50) DEFAULT NULL,
  `receiver_account` VARCHAR(50) DEFAULT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `date_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(30) DEFAULT 'Success',
  `description` TEXT DEFAULT NULL,
  PRIMARY KEY (`transaction_id`),
  INDEX `idx_tx_sender` (`sender_account`),
  INDEX `idx_tx_receiver` (`receiver_account`),
  INDEX `idx_tx_datetime` (`date_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `kyc_verifications`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `kyc_verifications`;
CREATE TABLE `kyc_verifications` (
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
  CONSTRAINT `fk_kyc_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `beneficiaries`
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
  INDEX `idx_ben_customer` (`customer_id`),
  CONSTRAINT `fk_ben_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table structure for `deposits`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `deposits`;
CREATE TABLE `deposits` (
  `deposit_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) NOT NULL,
  `linked_account` VARCHAR(50) NOT NULL,
  `deposit_type` VARCHAR(50) NOT NULL,
  `principal_amount` DECIMAL(15,2) NOT NULL,
  `interest_rate` DECIMAL(5,2) NOT NULL,
  `tenure_months` INT NOT NULL,
  `maturity_amount` DECIMAL(15,2) NOT NULL,
  `maturity_date` DATE NOT NULL,
  `status` ENUM('Active', 'Matured', 'Liquidated') DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`deposit_id`),
  INDEX `idx_dep_customer` (`customer_id`),
  CONSTRAINT `fk_dep_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- Data for table `customers` (9 records)
-- ----------------------------------------------------------------------------
LOCK TABLES `customers` WRITE;
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-101', 'Aarav Lynn', 'aarav@example.com', '+91 98200 12345', '1990-03-15', 'Flat 402, Nariman Point, Mumbai', '2024-01-10 09:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 810, 'Platinum', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Completed', NULL, NULL, '1234');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-102', 'Priya Nair', 'priya@example.com', '+91 98200 54321', '1995-07-22', 'Block B, Indiranagar, Bengaluru', '2024-02-14 10:30:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 760, 'Gold', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Completed', NULL, NULL, '1234');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-103', 'Rohan Gupta', 'rohan@example.com', '+91 98111 67890', '1988-11-05', 'Connaught Place, New Delhi', '2024-03-01 14:15:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 790, 'Platinum', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Completed', NULL, NULL, '1234');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-104', 'Ananya Sen', 'ananya@example.com', '+91 98450 11223', '1992-09-18', 'Koregaon Park, Pune', '2024-04-20 11:00:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 745, 'Silver', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Completed', NULL, NULL, '1234');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-105', 'Het Nasit', 'het@example.com', '+91 99099 88776', '1998-05-10', 'SG Highway, Ahmedabad', '2024-05-05 08:45:00', 'Active', 'Verified', '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC', 830, 'VIP', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Completed', NULL, NULL, '1234');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-106', 'boom bam', 'hu@gmail.com', '1234567890', NULL, NULL, '2026-09-10 12:29:00', 'Active', 'Pending', '$2a$10$5VUsp6NQdA9XiMOi8EcHxuypt7FHn6E2ikbkBKfulDYivJPwa.HZi', 700, 'Silver', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Completed', NULL, NULL, '1234');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-107', 'Devraj Chauhan', 'devraj.test1789194641010@example.com', '9820098200', '1995-12-10', 'Plot 42, Civil Lines, Jaipur, Rajasthan - 302006', '2026-09-12 06:30:43', 'Active', 'Verified', '$2a$10$IVa/TiERID2ll7b1SaU1SepBiauhEqektcwWT1V/9s.xWKnHcERRy', 770, 'Silver', 'ABCDE9876Q', 'XXXXXXXX9012', 'Male', 'Mahendra Chauhan', 'Married', 'Self-Employed Professional', '₹10,00,000 - ₹25,00,000', 'Kavita Chauhan', 'Spouse', '1997-03-25', 'Completed', 'data:image/png;base64,sample', 'data:image/png;base64,sample', '1234');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-108', 'Tanvi Deshmukh', 'tanvi.1789195547760@example.com', '9892011223', '1998-02-14', 'Bandra West, Mumbai, Maharashtra - 400050', '2026-09-12 06:45:48', 'Active', 'Verified', '$2a$10$Jh1xQz9B4TBy.UvEzaDIZe8abxjfPuxHagXXtSRCr2AZRliIKMk5K', 770, 'Silver', 'ABCTD1234M', 'XXXXXXXX5566', 'Female', 'Sunil Deshmukh', 'Single', 'Salaried', '₹10,00,000 - ₹25,00,000', 'Sunil Deshmukh', 'Father', '1965-05-20', 'Completed', 'data:image/png;base64,sample', 'data:image/png;base64,sample', '8899');
INSERT INTO `customers` (`customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, `marital_status`, `occupation`, `annual_income`, `nominee_name`, `nominee_relation`, `nominee_dob`, `vkyc_status`, `signature_data`, `avatar_data`, `card_pin`) VALUES ('CUST-109', 'boom san', 'test@gmail.com', '9979261611', '1996-08-15', 'YFEIWH, IFIWHUGIK, Maharashtra - 400001', '2026-09-12 07:01:43', 'Active', 'Verified', '$2a$10$ZwnDQdsqDJSg9/l1Bw1qRuJfIf9Al.mCpdu2S8uHe9fyCbdGhSZYC', 770, 'Silver', 'ABCDE1234F', 'XXXXXXXX8224', 'Male', 'HH', 'Married', 'Salaried', '₹3,00,000 - ₹10,00,000', 'HH', 'Spouse', '1997-04-12', 'Completed', 'data:image/png;base64,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', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%230f172a"/><circle cx="100" cy="80" r="45" fill="%23cbd5e1"/><path d="M30 180 C30 130 170 130 170 180 Z" fill="%232563eb"/></svg>', '1234');
UNLOCK TABLES;

-- ----------------------------------------------------------------------------
-- Data for table `accounts` (9 records)
-- ----------------------------------------------------------------------------
LOCK TABLES `accounts` WRITE;
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-772910', 'CUST-101', 'Savings Account', 144499, 'BTBI0001024', 'Mumbai Nariman Point Hub', '2024-01-15 09:00:00', 'Active', '1234');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-553102', 'CUST-102', 'Savings Account', 62420.5, 'BTBI0002018', 'Bengaluru MG Road Branch', '2024-02-20 10:30:00', 'Active', '1234');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-664019', 'CUST-103', 'Current Account', 88120, 'BTBI0003055', 'Delhi Connaught Place Branch', '2024-03-10 14:15:00', 'Active', '1234');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-883921', 'CUST-104', 'Savings Account', 68450, 'BTBI0004011', 'Pune Camp Central Branch', '2024-04-25 11:00:00', 'Active', '1234');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-442991', 'CUST-105', 'Savings Account', 250000, 'BTBI0005089', 'Ahmedabad Ashram Road Hub', '2024-05-10 08:45:00', 'Active', '1234');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-261709', 'CUST-106', 'Savings Account', 10000, 'BNKST0001', 'Downtown Central', '2026-09-10 12:29:00', 'Active', '1234');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-775741', 'CUST-107', 'Savings Account', 10000, 'BTBI0001024', 'Mumbai Nariman Point Hub', '2026-09-12 06:30:43', 'Active', '1234');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-215853', 'CUST-108', 'Savings Account', 8500, 'BTBI0001024', 'Mumbai Nariman Point Hub', '2026-09-12 06:45:48', 'Active', '8899');
INSERT INTO `accounts` (`account_number`, `customer_id`, `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin`) VALUES ('ACC-350912', 'CUST-109', 'Savings Account', 10000, 'BTBI0001024', 'Mumbai Nariman Point Hub', '2026-09-12 07:01:43', 'Active', '1234');
UNLOCK TABLES;

-- ----------------------------------------------------------------------------
-- Data for table `transactions` (27 records)
-- ----------------------------------------------------------------------------
LOCK TABLES `transactions` WRITE;
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000001', NULL, 'ACC-772910', 50000, 'Deposit', '2024-06-01 09:00:00', 'Success', 'Salary Credit - Tech Innovations Pvt Ltd');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000002', 'ACC-772910', 'ACC-553102', 15000, 'Transfer', '2024-06-05 14:00:00', 'Success', 'IMPS Fund Transfer to Miyah');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000003', NULL, 'ACC-772910', 100000, 'Deposit', '2024-06-15 11:30:00', 'Success', 'Fixed Deposit Interest Credit');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000004', 'ACC-772910', NULL, 2500, 'Withdrawal', '2024-06-20 18:45:00', 'Success', 'ATM Cash Withdrawal - Nariman Point');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000005', 'ACC-772910', 'ACC-664019', 10000, 'Transfer', '2024-07-01 10:15:00', 'Success', 'NEFT Business Rent Payment');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000006', NULL, 'ACC-772910', 20000, 'Deposit', '2024-08-01 12:00:00', 'Success', 'UPI Inward Payment - Consulting Fee');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000007', 'ACC-772910', 'ACC-553102', 500, 'Transfer', '2026-09-10 11:36:46', 'Success', 'Dinner Bill Split');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000008', NULL, 'ACC-772910', 1000, 'Deposit', '2026-09-10 11:36:46', 'Success', 'Salary Bonus Deposit');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-00000009', NULL, 'ACC-261709', 10000, 'Deposit', '2026-09-10 12:30:50', 'Success', 'chori');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-45124234', 'ACC-772910', 'ACC-553102', 500, 'Transfer', '2026-09-10 12:58:44', 'Success', 'Next.js IMPS Test Transfer');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-45124369', NULL, 'ACC-772910', 1000, 'Deposit', '2026-09-10 12:58:44', 'Success', 'Test Deposit');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-45124496', 'ACC-772910', NULL, 500, 'Withdrawal', '2026-09-10 12:58:44', 'Success', 'Test Cashout');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-46308456', 'ACC-664019', 'ACC-553102', 2000, 'Transfer', '2026-09-10 13:18:28', 'Success', 'drug money');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-47035796', 'ACC-772910', 'ACC-553102', 500, 'Transfer', '2026-09-10 13:30:35', 'Success', 'Test verified transfer');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-47041991', NULL, 'ACC-772910', 1000, 'Deposit', '2026-09-10 13:30:41', 'Success', 'Cash deposit test');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-47048865', 'ACC-772910', NULL, 500, 'Withdrawal', '2026-09-10 13:30:48', 'Success', 'ATM Cashout test');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-49040109', 'ACC-664019', 'ACC-553102', 5000, 'Transfer', '2026-09-10 14:04:00', 'Success', 'chori');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-94643176', NULL, 'ACC-775741', 10000, 'Deposit', '2026-09-12 06:30:43', 'Success', 'Welcome Opening Balance Grant - BTB DigiSave');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-95548812', NULL, 'ACC-215853', 10000, 'Deposit', '2026-09-12 06:45:48', 'Success', 'Welcome Opening Balance Grant - BTB DigiSave');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-95549209', 'ACC-215853', 'ACC-772910', 1500, 'Transfer', '2026-09-12 06:45:49', 'Success', 'Test IMPS Transfer with 4-Digit Debit Card PIN');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-96503259', NULL, 'ACC-350912', 10000, 'Deposit', '2026-09-12 07:01:43', 'Success', 'Welcome Opening Balance Grant - BTB DigiSave');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-UPI16605982', 'test.payer@okaxis', 'ACC-772910', 2500, 'Deposit', '2026-09-13 16:23:25', 'Success', 'UPI Credit: Dinner split (from Test Payer [test.payer@okaxis] | UTR: 425667308893)');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-17404794', 'ACC-772910', 'ACC-553102', 5000, 'Transfer', '2026-09-13 16:36:44', 'Success', 'test');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-UPI17684348', 'priya.nair@okhdfcbank', 'ACC-772910', 1500, 'Deposit', '2026-09-13 16:41:24', 'Success', 'UPI Credit: Personal payment (from Priya Nair [priya.nair@okhdfcbank] | UTR: 425659909383)');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-UPI17724793', 'priya.nair@okhdfcbank', 'ACC-772910', 1500, 'Deposit', '2026-09-13 16:42:04', 'Success', 'UPI Credit: Personal payment (from Priya Nair [priya.nair@okhdfcbank] | UTR: 425610933996)');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-UPI17747446', 'priya.nair@okhdfcbank', 'ACC-772910', 1500, 'Deposit', '2026-09-13 16:42:27', 'Success', 'UPI Credit: Personal payment (from Priya Nair [priya.nair@okhdfcbank] | UTR: 425657965828)');
INSERT INTO `transactions` (`transaction_id`, `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `description`) VALUES ('TXN-17788278', 'ACC-772910', NULL, 2001, 'Withdrawal', '2026-09-13 16:43:08', 'Success', 'h');
UNLOCK TABLES;

-- ----------------------------------------------------------------------------
-- Data for table `kyc_verifications` (15 records)
-- ----------------------------------------------------------------------------
LOCK TABLES `kyc_verifications` WRITE;
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-6431231', 'CUST-107', 'MOBILE_OTP', '9820098200', 'SMS_OTP_AUTHENTICATION', 'Verified', '2026-09-12 06:30:43', 'Mobile number authenticated with 2-factor OTP verification');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-6431312', 'CUST-107', 'PAN_CARD', 'ABCDE9876Q', 'NSDL_TIN_API_SIMULATED', 'Verified', '2026-09-12 06:30:43', 'PAN format validated and legal name verified against Income Tax Database');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-6431413', 'CUST-107', 'AADHAAR_UIDAI', 'XXXXXXXX9012', 'UIDAI_DEMOGRAPHIC_EKYC', 'Verified', '2026-09-12 06:30:43', 'Aadhaar demographic details verified via biometric/OTP e-KYC');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-6431484', 'CUST-107', 'VIDEO_KYC', 'LIVE_FACIAL_CAPTURE', 'AI_FACIAL_LIVENESS_GEO_TAG', 'Verified', '2026-09-12 06:30:43', 'Liveness confirmed and geo-coordinates stamped in compliance with RBI norms');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-6431575', 'CUST-107', 'DIGITAL_SIGNATURE', 'CANVAS_SIGNATURE', 'TOUCH_CANVAS_DIGITAL_RECORD', 'Verified', '2026-09-12 06:30:43', 'Digital signature specimen captured and recorded for mandate');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5487871', 'CUST-108', 'MOBILE_OTP', '9892011223', 'SMS_OTP_AUTHENTICATION', 'Verified', '2026-09-12 06:45:48', 'Mobile number authenticated with 2-factor OTP verification');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5487902', 'CUST-108', 'PAN_CARD', 'ABCTD1234M', 'NSDL_TIN_API_SIMULATED', 'Verified', '2026-09-12 06:45:48', 'PAN format validated and legal name verified against Income Tax Database');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5487953', 'CUST-108', 'AADHAAR_UIDAI', 'XXXXXXXX5566', 'UIDAI_DEMOGRAPHIC_EKYC', 'Verified', '2026-09-12 06:45:48', 'Aadhaar demographic details verified via biometric/OTP e-KYC');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5487994', 'CUST-108', 'VIDEO_KYC', 'LIVE_FACIAL_CAPTURE', 'AI_FACIAL_LIVENESS_GEO_TAG', 'Verified', '2026-09-12 06:45:48', 'Liveness confirmed and geo-coordinates stamped in compliance with RBI norms');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5488035', 'CUST-108', 'DIGITAL_SIGNATURE', 'CANVAS_SIGNATURE', 'TOUCH_CANVAS_DIGITAL_RECORD', 'Verified', '2026-09-12 06:45:48', 'Digital signature specimen captured and recorded for mandate');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5032181', 'CUST-109', 'MOBILE_OTP', '9979261611', 'SMS_OTP_AUTHENTICATION', 'Verified', '2026-09-12 07:01:43', 'Mobile number authenticated with 2-factor OTP verification');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5032252', 'CUST-109', 'PAN_CARD', 'ABCDE1234F', 'NSDL_TIN_API_SIMULATED', 'Verified', '2026-09-12 07:01:43', 'PAN format validated and legal name verified against Income Tax Database');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5032333', 'CUST-109', 'AADHAAR_UIDAI', 'XXXXXXXX8224', 'UIDAI_DEMOGRAPHIC_EKYC', 'Verified', '2026-09-12 07:01:43', 'Aadhaar demographic details verified via biometric/OTP e-KYC');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5032404', 'CUST-109', 'VIDEO_KYC', 'LIVE_FACIAL_CAPTURE', 'AI_FACIAL_LIVENESS_GEO_TAG', 'Verified', '2026-09-12 07:01:43', 'Liveness confirmed and geo-coordinates stamped in compliance with RBI norms');
INSERT INTO `kyc_verifications` (`verification_id`, `customer_id`, `document_type`, `document_number`, `verification_method`, `status`, `verified_at`, `remarks`) VALUES ('KYC-5032475', 'CUST-109', 'DIGITAL_SIGNATURE', 'CANVAS_SIGNATURE', 'TOUCH_CANVAS_DIGITAL_RECORD', 'Verified', '2026-09-12 07:01:43', 'Digital signature specimen captured and recorded for mandate');
UNLOCK TABLES;

-- ----------------------------------------------------------------------------
-- Data for table `beneficiaries` (3 records)
-- ----------------------------------------------------------------------------
LOCK TABLES `beneficiaries` WRITE;
INSERT INTO `beneficiaries` (`beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, `ifsc_code`, `bank_name`, `transfer_limit`, `cooling_until`, `created_at`, `is_active`) VALUES ('BEN-1001', 'CUST-101', 'Priya Nair', 'ACC-553102', 'BTBI0002018', 'Bharat Trust Bank (MG Road)', 100000, NULL, '2026-09-13 16:23:25', 1);
INSERT INTO `beneficiaries` (`beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, `ifsc_code`, `bank_name`, `transfer_limit`, `cooling_until`, `created_at`, `is_active`) VALUES ('BEN-1002', 'CUST-101', 'Rohan Gupta', 'ACC-664019', 'BTBI0003055', 'Bharat Trust Bank (Connaught Place)', 200000, NULL, '2026-09-13 16:23:25', 1);
INSERT INTO `beneficiaries` (`beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, `ifsc_code`, `bank_name`, `transfer_limit`, `cooling_until`, `created_at`, `is_active`) VALUES ('BEN-1003', 'CUST-101', 'Ananya Sen', 'ACC-883921', 'BTBI0004011', 'Bharat Trust Bank (Pune Camp)', 75000, NULL, '2026-09-13 16:23:25', 1);
UNLOCK TABLES;

-- ----------------------------------------------------------------------------
-- Data for table `deposits` (2 records)
-- ----------------------------------------------------------------------------
LOCK TABLES `deposits` WRITE;
INSERT INTO `deposits` (`deposit_id`, `customer_id`, `linked_account`, `deposit_type`, `principal_amount`, `interest_rate`, `tenure_months`, `maturity_amount`, `maturity_date`, `status`, `created_at`) VALUES ('FD-2024-8841', 'CUST-101', 'ACC-772910', 'Fixed Deposit', 50000, 7.5, 12, 53890, '2027-09-13', 'Active', '2026-09-13 16:23:25');
INSERT INTO `deposits` (`deposit_id`, `customer_id`, `linked_account`, `deposit_type`, `principal_amount`, `interest_rate`, `tenure_months`, `maturity_amount`, `maturity_date`, `status`, `created_at`) VALUES ('RD-2024-9122', 'CUST-101', 'ACC-772910', 'Recurring Deposit', 5000, 7.2, 6, 30650, '2027-03-13', 'Active', '2026-09-13 16:23:25');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- USEFUL DATABASE VIEWS (DBMS PROJECT SHOWCASE)
-- ============================================================================

-- View: Customer Financial Portfolio Overview
CREATE OR REPLACE VIEW `v_customer_portfolio` AS
SELECT 
    c.customer_id,
    c.full_name,
    c.email,
    c.phone,
    c.tier,
    c.credit_score,
    COUNT(DISTINCT a.account_number) AS total_accounts,
    COALESCE(SUM(a.balance), 0.00) AS total_liquid_balance,
    COALESCE(SUM(d.principal_amount), 0.00) AS total_deposits_principal,
    (COALESCE(SUM(a.balance), 0.00) + COALESCE(SUM(d.principal_amount), 0.00)) AS total_net_worth
FROM customers c
LEFT JOIN accounts a ON c.customer_id = a.customer_id AND a.status = 'Active'
LEFT JOIN deposits d ON c.customer_id = d.customer_id AND d.status = 'Active'
GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.tier, c.credit_score;

-- View: High Value Transactions (> ₹25,000)
CREATE OR REPLACE VIEW `v_high_value_transactions` AS
SELECT 
    transaction_id,
    sender_account,
    receiver_account,
    amount,
    type,
    date_time,
    status,
    description
FROM transactions
WHERE amount >= 25000.00
ORDER BY date_time DESC;

-- View: Active Term Deposits Summary
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
FROM deposits d
JOIN customers c ON d.customer_id = c.customer_id
WHERE d.status = 'Active';

-- ============================================================================
-- END OF DATABASE SCRIPT
-- ============================================================================
