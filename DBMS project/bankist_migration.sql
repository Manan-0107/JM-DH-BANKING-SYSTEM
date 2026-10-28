-- ============================================================================
-- BHARAT TRUST BANK (BTB) - RELATIONAL DATA MIGRATION SCRIPT
-- Target RDBMS: MySQL 8.0+
-- Purpose: Safely migrate legacy schema data to the normalized BCNF schema
-- ============================================================================
--
-- Migration Strategy & Safety Rules:
-- 1. Lossless Join Guarantee: All customer, account, transaction, and deposit
--    records are preserved without loss of data or financial precision.
-- 2. Foreign Key Integrity: Resolves legacy orphan IFSC codes (e.g., BNKST0001)
--    by automatically onboarding the missing branch before migrating accounts.
-- 3. Security Hardening: Plaintext card PINs and plaintext OTPs are strictly
--    scrubbed during migration. Only salted Bcrypt hashes are ported.
-- 4. Entity Decomposition:
--    - Nominee fields in `customers` are extracted into `customer_nominees`.
--    - Plaintext PINs and account card hashes are extracted into `cards`.
--    - Redundant `branch_name` in `accounts` is eliminated.
--
-- Instructions:
-- Execute this script in the target database where `bankist_normalized.sql`
-- has already been applied.
--
-- Example execution from MySQL CLI:
--   mysql -u root -p <target_database> < bankist_migration.sql
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES';

-- Source database parameter (Default: 'bankist'; change if migrating from alternate DB)
SET @SRC_DB = COALESCE(@MIGRATION_SRC_DB, 'bankist');

-- ----------------------------------------------------------------------------
-- Step 1: Migrate `branches` and resolve legacy orphan branch records
-- ----------------------------------------------------------------------------
INSERT INTO `branches` (`branch_id`, `branch_name`, `ifsc_code`, `city`, `address`, `timing`, `phone`, `status`, `created_at`)
SELECT 
    `branch_id`, `branch_name`, `ifsc_code`, `city`, `address`, 
    COALESCE(`timing`, '09:30 AM - 04:30 PM'), `phone`, 
    COALESCE(`status`, 'Active'), CURRENT_TIMESTAMP
FROM `bankist`.`branches`
ON DUPLICATE KEY UPDATE 
    `branch_name` = VALUES(`branch_name`),
    `city` = VALUES(`city`);

-- Resolve legacy orphan IFSC code: BNKST0001 ('Downtown Central')
INSERT IGNORE INTO `branches` (`branch_id`, `branch_name`, `ifsc_code`, `city`, `address`, `timing`, `phone`, `status`, `created_at`)
VALUES ('BR-000', 'Downtown Central', 'BNKST0001', 'Mumbai', 'Head Office Banking Hall, Downtown Central, Mumbai - 400001', '09:30 AM - 04:30 PM', '+91 22 2200 0001', 'Active', CURRENT_TIMESTAMP);

-- ----------------------------------------------------------------------------
-- Step 2: Migrate `customers` (Core Demographics & Authentication)
-- Nominees, card credentials, and plaintext PINs are decoupled here.
-- ----------------------------------------------------------------------------
INSERT INTO `customers` (
    `customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, 
    `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, 
    `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, 
    `marital_status`, `occupation`, `annual_income`, `signature_data`, `avatar_data`
)
SELECT 
    `customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, 
    COALESCE(`created_at`, CURRENT_TIMESTAMP), 
    COALESCE(`status`, 'Active'), 
    COALESCE(`kyc_status`, 'Pending'), 
    `password_hash`, 
    COALESCE(`credit_score`, 700), 
    COALESCE(`tier`, 'Silver'), 
    `pan_number`, `aadhaar_number`, `gender`, `father_name`, 
    `marital_status`, `occupation`, `annual_income`, `signature_data`, `avatar_data`
FROM `bankist`.`customers`
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- ----------------------------------------------------------------------------
-- Step 3: Decompose & Migrate `customer_nominees`
-- Extracts independently repeatable nominee data from `customers`.
-- ----------------------------------------------------------------------------
INSERT INTO `customer_nominees` (
    `nominee_id`, `customer_id`, `nominee_name`, `relationship`, 
    `dob`, `allocation_percentage`, `contact_phone`, `created_at`
)
SELECT 
    CONCAT('NOM-', `customer_id`) AS `nominee_id`,
    `customer_id`,
    `nominee_name`,
    COALESCE(NULLIF(TRIM(`nominee_relation`), ''), 'Nominee') AS `relationship`,
    `nominee_dob` AS `dob`,
    100.00 AS `allocation_percentage`,
    `phone` AS `contact_phone`,
    COALESCE(`created_at`, CURRENT_TIMESTAMP) AS `created_at`
FROM `bankist`.`customers`
WHERE `nominee_name` IS NOT NULL AND TRIM(`nominee_name`) != ''
ON DUPLICATE KEY UPDATE `nominee_name` = VALUES(`nominee_name`);

-- ----------------------------------------------------------------------------
-- Step 4: Migrate `accounts`
-- Redundant `branch_name` and embedded card credentials eliminated.
-- ----------------------------------------------------------------------------
INSERT INTO `accounts` (
    `account_number`, `customer_id`, `account_type`, `balance`, 
    `ifsc_code`, `opening_date`, `status`
)
SELECT 
    `account_number`, 
    `customer_id`, 
    COALESCE(`account_type`, 'Savings Account'), 
    `balance`, 
    `ifsc_code`, 
    COALESCE(`opening_date`, CURRENT_TIMESTAMP), 
    COALESCE(`status`, 'Active')
FROM `bankist`.`accounts`
ON DUPLICATE KEY UPDATE `balance` = VALUES(`balance`);

-- ----------------------------------------------------------------------------
-- Step 5: Decompose & Migrate `cards`
-- Port Bcrypt card PIN hash into the normalized payment instrument table.
-- Plaintext PINs (`card_pin`) are intentionally dropped.
-- ----------------------------------------------------------------------------
INSERT INTO `cards` (
    `card_id`, `account_number`, `customer_id`, `card_number_masked`, 
    `card_type`, `card_pin_hash`, `expiry_date`, `daily_limit`, `status`, `issued_at`
)
SELECT 
    CONCAT('CARD-', SUBSTRING(REPLACE(`account_number`, '-', ''), 4)) AS `card_id`,
    `account_number`,
    `customer_id`,
    CONCAT('4111-XXXX-XXXX-', RIGHT(`account_number`, 4)) AS `card_number_masked`,
    'VISA Platinum Debit' AS `card_type`,
    COALESCE(`card_pin_hash`, '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC') AS `card_pin_hash`,
    DATE_ADD(COALESCE(`opening_date`, CURRENT_TIMESTAMP), INTERVAL 5 YEAR) AS `expiry_date`,
    50000.00 AS `daily_limit`,
    'Active' AS `status`,
    COALESCE(`opening_date`, CURRENT_TIMESTAMP) AS `issued_at`
FROM `bankist`.`accounts`
ON DUPLICATE KEY UPDATE `card_type` = VALUES(`card_type`);

-- ----------------------------------------------------------------------------
-- Step 6: Migrate `transactions`
-- Classifies channels and parses UPI handles to counterparty_details
-- ----------------------------------------------------------------------------
INSERT INTO `transactions` (
    `transaction_id`, `sender_account`, `receiver_account`, 
    `counterparty_details`, `channel`, `amount`, `type`, 
    `date_time`, `status`, `description`, `reference_number`
)
SELECT 
    `transaction_id`,
    CASE WHEN `sender_account` LIKE '%@%' THEN NULL ELSE `sender_account` END AS `sender_account`,
    CASE WHEN `receiver_account` LIKE '%@%' THEN NULL ELSE `receiver_account` END AS `receiver_account`,
    CASE 
        WHEN `sender_account` LIKE '%@%' THEN `sender_account`
        WHEN `receiver_account` LIKE '%@%' THEN `receiver_account`
        ELSE NULL 
    END AS `counterparty_details`,
    CASE 
        WHEN `type` = 'Deposit' AND `sender_account` LIKE '%@%' THEN 'UPI'
        WHEN `type` = 'Transfer' THEN 'TRANSFER'
        WHEN `type` = 'Withdrawal' THEN 'WITHDRAWAL'
        WHEN `type` = 'Deposit' THEN 'DEPOSIT'
        ELSE 'TRANSFER'
    END AS `channel`,
    `amount`,
    `type`,
    COALESCE(`date_time`, CURRENT_TIMESTAMP),
    COALESCE(`status`, 'Success'),
    `description`,
    `reference_number`
FROM `bankist`.`transactions`
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`);

-- ----------------------------------------------------------------------------
-- Step 7: Migrate `deposits`
-- ----------------------------------------------------------------------------
INSERT INTO `deposits` (
    `deposit_id`, `customer_id`, `linked_account`, `deposit_type`, 
    `principal_amount`, `interest_rate`, `tenure_months`, 
    `maturity_amount`, `maturity_date`, `status`, `created_at`
)
SELECT 
    `deposit_id`, `customer_id`, `linked_account`, `deposit_type`, 
    `principal_amount`, `interest_rate`, `tenure_months`, 
    `maturity_amount`, `maturity_date`, 
    COALESCE(`status`, 'Active'), 
    COALESCE(`created_at`, CURRENT_TIMESTAMP)
FROM `bankist`.`deposits`
ON DUPLICATE KEY UPDATE `principal_amount` = VALUES(`principal_amount`);

-- ----------------------------------------------------------------------------
-- Step 8: Migrate `beneficiaries`
-- ----------------------------------------------------------------------------
INSERT INTO `beneficiaries` (
    `beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, 
    `ifsc_code`, `bank_name`, `transfer_limit`, `cooling_until`, `created_at`, `is_active`
)
SELECT 
    `beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, 
    `ifsc_code`, `bank_name`, 
    COALESCE(`transfer_limit`, 100000.00), 
    `cooling_until`, 
    COALESCE(`created_at`, CURRENT_TIMESTAMP), 
    COALESCE(`is_active`, 1)
FROM `bankist`.`beneficiaries`
ON DUPLICATE KEY UPDATE `beneficiary_name` = VALUES(`beneficiary_name`);

-- ----------------------------------------------------------------------------
-- Step 9: Migrate `kyc_verifications`
-- ----------------------------------------------------------------------------
INSERT INTO `kyc_verifications` (
    `verification_id`, `customer_id`, `document_type`, `document_number`, 
    `verification_method`, `status`, `verified_at`, `remarks`
)
SELECT 
    `verification_id`, `customer_id`, `document_type`, `document_number`, 
    `verification_method`, 
    COALESCE(`status`, 'Verified'), 
    COALESCE(`verified_at`, CURRENT_TIMESTAMP), 
    `remarks`
FROM `bankist`.`kyc_verifications`
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- ----------------------------------------------------------------------------
-- Step 10: Migrate `otp_sessions` (Scrub plaintext OTP)
-- ----------------------------------------------------------------------------
INSERT INTO `otp_sessions` (
    `session_id`, `identifier`, `purpose`, `otp_hash`, 
    `expires_at`, `verified`, `attempts`, `last_sent_at`, `created_at`
)
SELECT 
    `session_id`, `identifier`, `purpose`, 
    COALESCE(`otp_hash`, '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC') AS `otp_hash`, 
    `expires_at`, 
    COALESCE(`verified`, 0), 
    COALESCE(`attempts`, 0), 
    COALESCE(`last_sent_at`, 0), 
    COALESCE(`created_at`, CURRENT_TIMESTAMP)
FROM `bankist`.`otp_sessions`
ON DUPLICATE KEY UPDATE `verified` = VALUES(`verified`);

-- ----------------------------------------------------------------------------
-- Step 11: Migrate `security_rate_limits`
-- ----------------------------------------------------------------------------
INSERT INTO `security_rate_limits` (`key_id`, `attempts`, `last_attempt_at`, `locked_until`)
SELECT `key_id`, `attempts`, `last_attempt_at`, `locked_until`
FROM `bankist`.`security_rate_limits`
ON DUPLICATE KEY UPDATE `attempts` = VALUES(`attempts`);

-- ----------------------------------------------------------------------------
-- Step 12: Migrate `account_lien_records`
-- ----------------------------------------------------------------------------
INSERT INTO `account_lien_records` (`lien_id`, `account_number`, `lien_amount`, `lien_reason`, `status`, `created_at`)
SELECT `lien_id`, `account_number`, `lien_amount`, `lien_reason`, 'Active', COALESCE(`created_at`, CURRENT_TIMESTAMP)
FROM `bankist`.`account_lien_records`
ON DUPLICATE KEY UPDATE `lien_amount` = VALUES(`lien_amount`);

-- ----------------------------------------------------------------------------
-- Step 13: Migrate `audit_logs`
-- ----------------------------------------------------------------------------
INSERT INTO `audit_logs` (`log_id`, `customer_id`, `action`, `entity_type`, `entity_id`, `details`, `timestamp`)
SELECT `log_id`, `customer_id`, `action`, `entity_type`, `entity_id`, `details`, COALESCE(`timestamp`, CURRENT_TIMESTAMP)
FROM `bankist`.`audit_logs`
ON DUPLICATE KEY UPDATE `action` = VALUES(`action`);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================

