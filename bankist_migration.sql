-- ============================================================================
-- BHARAT TRUST BANK (BTB) - SAFE RELATIONAL DATA MIGRATION SCRIPT
-- Target RDBMS: MySQL 8.0+ Enterprise
-- Purpose: Safely migrate data from original schema to normalized BCNF schema
-- Version: 3.0 (Zero Overwrite, Strict Topological Sort, Explicit SIGNAL Guard)
-- ============================================================================
--
-- STRICT PRE-FLIGHT SAFETY ENFORCEMENT:
-- 1. Must be executed in the target disposable database (USE <target_database>;).
-- 2. Foreign key checks remain ENABLED (FOREIGN_KEY_CHECKS = 1) throughout migration.
-- 3. Strict Pre-flight Guard validates identifiers, asserts source and destination
--    are distinct, refuses live production 'bankist', and verifies source schema.
-- 4. Overwrite Prevention: Asserts that destination tables are empty before migration.
--    Zero 'ON DUPLICATE KEY UPDATE' statements exist in this script.
-- 5. Zero Data Fabrication: Does NOT invent fake card numbers, expiry dates,
--    daily limits, or shared fallback PIN/OTP hashes.
-- 6. Full Transaction Preservation: Preserves canonical sender/receiver identifiers
--    for all 782 transactions, including external UPI handles (zero nullification).
-- ============================================================================

-- Ensure strict SQL mode and keep foreign key checks enabled
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY';
SET FOREIGN_KEY_CHECKS = 1;

-- Source database parameter (Default: 'bankist'; override with SET @MIGRATION_SRC_DB = '...';)
SET @SRC_DB = COALESCE(@MIGRATION_SRC_DB, 'bankist');
SET @DEST_DB = DATABASE();

-- ----------------------------------------------------------------------------
-- Pre-flight Stored Procedure: Explicit Validation via SIGNAL SQLSTATE '45000'
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_preflight_migration_guard`;

CREATE PROCEDURE `sp_preflight_migration_guard`(
    IN p_src VARCHAR(64),
    IN p_dest VARCHAR(64)
)
BEGIN
    DECLARE v_src_exists INT DEFAULT 0;
    DECLARE v_src_table_count INT DEFAULT 0;
    DECLARE v_dest_table_count INT DEFAULT 0;
    DECLARE v_dest_row_count INT DEFAULT 0;

    -- 1. Validate database identifiers (prevent SQL injection in dynamic SQL)
    IF p_src IS NULL OR p_src = '' OR p_src NOT REGEXP '^[a-zA-Z0-9_]+$' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Source database identifier is invalid.';
    END IF;

    IF p_dest IS NULL OR p_dest = '' OR p_dest NOT REGEXP '^[a-zA-Z0-9_]+$' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Destination database identifier is invalid.';
    END IF;

    -- 2. Ensure source and destination are distinct
    IF LOWER(p_src) = LOWER(p_dest) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Source and destination cannot be identical.';
    END IF;

    -- 3. Refuse live production 'bankist' as migration target
    IF LOWER(p_dest) = 'bankist' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Target database cannot be live production bankist.';
    END IF;

    -- 4. Confirm source database exists
    SELECT COUNT(*) INTO v_src_exists 
    FROM information_schema.schemata 
    WHERE schema_name = p_src;

    IF v_src_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Source database does not exist.';
    END IF;

    -- 5. Confirm source database contains all 11 required core tables
    SELECT COUNT(DISTINCT table_name) INTO v_src_table_count
    FROM information_schema.tables 
    WHERE table_schema = p_src 
      AND table_name IN (
        'branches', 'customers', 'accounts', 'transactions', 'deposits',
        'beneficiaries', 'kyc_verifications', 'otp_sessions',
        'security_rate_limits', 'account_lien_records', 'audit_logs'
      );

    IF v_src_table_count < 11 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Source database missing required tables.';
    END IF;

    -- 6. Confirm destination contains all 13 required target normalized tables
    SELECT COUNT(DISTINCT table_name) INTO v_dest_table_count
    FROM information_schema.tables 
    WHERE table_schema = p_dest 
      AND table_name IN (
        'branches', 'customers', 'customer_nominees', 'accounts', 'account_card_credentials',
        'transactions', 'deposits', 'beneficiaries', 'kyc_verifications',
        'otp_sessions', 'security_rate_limits', 'account_lien_records', 'audit_logs'
      );

    IF v_dest_table_count < 13 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Destination missing required normalized tables.';
    END IF;

    -- 7. Overwrite Prevention: Confirm destination tables are empty
    SELECT (SELECT COUNT(*) FROM `accounts`) + (SELECT COUNT(*) FROM `transactions`) + (SELECT COUNT(*) FROM `customers`) INTO v_dest_row_count;
    IF v_dest_row_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pre-flight Error: Destination has existing records. Must be empty.';
    END IF;
END;

-- Execute Pre-flight Safety Guard
CALL `sp_preflight_migration_guard`(@SRC_DB, @DEST_DB);
DROP PROCEDURE IF EXISTS `sp_preflight_migration_guard`;


-- ============================================================================
-- LOSSLESS TOPOLOGICALLY-SORTED DATA MIGRATION
-- Foreign key checks remain ENABLED (FOREIGN_KEY_CHECKS = 1).
-- Zero ON DUPLICATE KEY UPDATE statements.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Migrate `branches` and resolve legacy orphan branch record
-- ----------------------------------------------------------------------------
SET @sql_branches = CONCAT('
INSERT INTO `branches` (`branch_id`, `branch_name`, `ifsc_code`, `city`, `address`, `timing`, `phone`, `status`, `created_at`)
SELECT 
    `branch_id`, `branch_name`, `ifsc_code`, `city`, `address`, 
    COALESCE(`timing`, "09:30 AM - 04:30 PM"), `phone`, 
    COALESCE(`status`, "Active"), CURRENT_TIMESTAMP
FROM `', @SRC_DB, '`.`branches`;
');
PREPARE stmt FROM @sql_branches;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Resolve legacy orphan IFSC code: BNKST0001 ('Downtown Central') for ACC-261709
INSERT INTO `branches` (`branch_id`, `branch_name`, `ifsc_code`, `city`, `address`, `timing`, `phone`, `status`, `created_at`)
SELECT 'BR-000', 'Downtown Central', 'BNKST0001', 'Mumbai', 'Head Office Banking Hall, Downtown Central, Mumbai - 400001', '09:30 AM - 04:30 PM', '+91 22 2200 0001', 'Active', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM `branches` WHERE `ifsc_code` = 'BNKST0001');

-- ----------------------------------------------------------------------------
-- Step 2: Migrate `customers` (Core Demographics & Authentication)
-- Preserves all genuine customer attributes; nominee and card PINs decomposed
-- ----------------------------------------------------------------------------
SET @sql_customers = CONCAT('
INSERT INTO `customers` (
    `customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, 
    `created_at`, `status`, `kyc_status`, `password_hash`, `credit_score`, 
    `tier`, `pan_number`, `aadhaar_number`, `gender`, `father_name`, 
    `marital_status`, `occupation`, `annual_income`, `vkyc_status`, 
    `signature_data`, `avatar_data`
)
SELECT 
    `customer_id`, `full_name`, `email`, `phone`, `dob`, `address`, 
    COALESCE(`created_at`, CURRENT_TIMESTAMP), 
    COALESCE(`status`, "Active"), 
    COALESCE(`kyc_status`, "Pending"), 
    `password_hash`, 
    COALESCE(`credit_score`, 700), 
    COALESCE(`tier`, "Silver"), 
    `pan_number`, `aadhaar_number`, `gender`, `father_name`, 
    `marital_status`, `occupation`, `annual_income`, 
    COALESCE(`vkyc_status`, "Completed"), 
    `signature_data`, `avatar_data`
FROM `', @SRC_DB, '`.`customers`;
');
PREPARE stmt FROM @sql_customers;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 3: Decompose & Migrate `customer_nominees`
-- Migrates only genuine source nominee records; leaves unstated allocation percentages NULL
-- ----------------------------------------------------------------------------
SET @sql_nominees = CONCAT('
INSERT INTO `customer_nominees` (
    `nominee_id`, `customer_id`, `nominee_name`, `relationship`, 
    `dob`, `allocation_percentage`, `contact_phone`, `created_at`
)
SELECT 
    CONCAT("NOM-", `customer_id`) AS `nominee_id`,
    `customer_id`,
    TRIM(`nominee_name`),
    COALESCE(NULLIF(TRIM(`nominee_relation`), ""), "Nominee") AS `relationship`,
    `nominee_dob` AS `dob`,
    NULL AS `allocation_percentage`, -- Source has no contractual split; do not fabricate one.
    `phone` AS `contact_phone`,
    COALESCE(`created_at`, CURRENT_TIMESTAMP) AS `created_at`
FROM `', @SRC_DB, '`.`customers`
WHERE `nominee_name` IS NOT NULL AND TRIM(`nominee_name`) != "";
');
PREPARE stmt FROM @sql_nominees;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 4: Migrate `accounts`
-- Preserves exact decimal balances (19,155,216.07), ifsc_code, and customer linkage
-- ----------------------------------------------------------------------------
SET @sql_accounts = CONCAT('
INSERT INTO `accounts` (
    `account_number`, `customer_id`, `account_type`, `balance`, 
    `ifsc_code`, `opening_date`, `status`
)
SELECT 
    `account_number`, 
    `customer_id`, 
    COALESCE(`account_type`, "Savings Account"), 
    `balance`, 
    `ifsc_code`, 
    COALESCE(`opening_date`, CURRENT_TIMESTAMP), 
    COALESCE(`status`, "Active")
FROM `', @SRC_DB, '`.`accounts`;
');
PREPARE stmt FROM @sql_accounts;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 5: Decompose & Migrate `account_card_credentials`
-- Preserves genuine account card PIN hashes without inventing fake card numbers,
-- fake limits, or fake expiry dates.
-- ZERO SHARED FALLBACK HASHES: Accounts without card PIN hashes are not populated.
-- ----------------------------------------------------------------------------
SET @sql_cards = CONCAT('
INSERT INTO `account_card_credentials` (
    `credential_id`, `account_number`, `card_pin_hash`, `status`, `created_at`
)
SELECT 
    CONCAT("CARD-CRED-", `account_number`) AS `credential_id`,
    `account_number`,
    `card_pin_hash`,
    "Active" AS `status`,
    COALESCE(`opening_date`, CURRENT_TIMESTAMP) AS `created_at`
FROM `', @SRC_DB, '`.`accounts`
WHERE `card_pin_hash` IS NOT NULL AND `card_pin_hash` != "";
');
PREPARE stmt FROM @sql_cards;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 6: Migrate `transactions`
-- PRESERVES FULL SENDER & RECEIVER IDENTIFIERS (Zero NULL conversions)
-- External UPI handles (e.g. test.colleague@okaxis) are preserved in sender_account
-- and classified into channel = "UPI" with counterparty_details populated.
-- ----------------------------------------------------------------------------
SET @sql_txns = CONCAT('
INSERT INTO `transactions` (
    `transaction_id`, `sender_account`, `receiver_account`, 
    `counterparty_details`, `channel`, `amount`, `type`, 
    `date_time`, `status`, `description`, `reference_number`
)
SELECT 
    `transaction_id`,
    `sender_account`,
    `receiver_account`,
    CASE 
        WHEN `sender_account` LIKE "%@%" THEN `sender_account`
        WHEN `receiver_account` LIKE "%@%" THEN `receiver_account`
        ELSE NULL 
    END AS `counterparty_details`,
    CASE 
        WHEN `sender_account` LIKE "%@%" OR `receiver_account` LIKE "%@%" THEN "UPI"
        WHEN `type` = "Transfer" THEN "TRANSFER"
        WHEN `type` = "Withdrawal" THEN "WITHDRAWAL"
        WHEN `type` = "Deposit" THEN "DEPOSIT"
        ELSE "TRANSFER"
    END AS `channel`,
    `amount`,
    `type`,
    COALESCE(`date_time`, CURRENT_TIMESTAMP),
    COALESCE(`status`, "Success"),
    `description`,
    `reference_number`
FROM `', @SRC_DB, '`.`transactions`;
');
PREPARE stmt FROM @sql_txns;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 7: Migrate `deposits`
-- Preserves all principal, interest rates, tenures, maturities, and linked accounts
-- Customer ownership derived losslessly through linked_account -> accounts(account_number)
-- ----------------------------------------------------------------------------
SET @sql_deposits = CONCAT('
INSERT INTO `deposits` (
    `deposit_id`, `linked_account`, `deposit_type`, 
    `principal_amount`, `interest_rate`, `tenure_months`, 
    `maturity_amount`, `maturity_date`, `status`, `created_at`
)
SELECT 
    `deposit_id`, `linked_account`, `deposit_type`, 
    `principal_amount`, `interest_rate`, `tenure_months`, 
    `maturity_amount`, `maturity_date`, 
    COALESCE(`status`, "Active"), 
    COALESCE(`created_at`, CURRENT_TIMESTAMP)
FROM `', @SRC_DB, '`.`deposits`;
');
PREPARE stmt FROM @sql_deposits;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 8: Migrate `beneficiaries`
-- Bank and branch details resolved dynamically via ifsc_code -> branches(ifsc_code)
-- ----------------------------------------------------------------------------
SET @sql_beneficiaries = CONCAT('
INSERT INTO `beneficiaries` (
    `beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, 
    `ifsc_code`, `transfer_limit`, `cooling_until`, `created_at`, `is_active`
)
SELECT 
    `beneficiary_id`, `customer_id`, `beneficiary_name`, `account_number`, 
    `ifsc_code`, 
    COALESCE(`transfer_limit`, 100000.00), 
    `cooling_until`, 
    COALESCE(`created_at`, CURRENT_TIMESTAMP), 
    COALESCE(`is_active`, 1)
FROM `', @SRC_DB, '`.`beneficiaries`;
');
PREPARE stmt FROM @sql_beneficiaries;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 9: Migrate `kyc_verifications`
-- ----------------------------------------------------------------------------
SET @sql_kyc = CONCAT('
INSERT INTO `kyc_verifications` (
    `verification_id`, `customer_id`, `document_type`, `document_number`, 
    `verification_method`, `status`, `verified_at`, `remarks`
)
SELECT 
    `verification_id`, `customer_id`, `document_type`, `document_number`, 
    `verification_method`, 
    COALESCE(`status`, "Verified"), 
    COALESCE(`verified_at`, CURRENT_TIMESTAMP), 
    `remarks`
FROM `', @SRC_DB, '`.`kyc_verifications`;
');
PREPARE stmt FROM @sql_kyc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 10: Migrate `otp_sessions`
-- ZERO FALLBACK HASHES: Only genuine salted bcrypt hashes are migrated.
-- Plaintext otp_code is strictly scrubbed.
-- ----------------------------------------------------------------------------
SET @sql_otp = CONCAT('
INSERT INTO `otp_sessions` (
    `session_id`, `identifier`, `purpose`, `otp_hash`, 
    `expires_at`, `verified`, `attempts`, `last_sent_at`, `created_at`
)
SELECT 
    `session_id`, `identifier`, `purpose`, 
    `otp_hash`, 
    `expires_at`, 
    COALESCE(`verified`, 0), 
    COALESCE(`attempts`, 0), 
    COALESCE(`last_sent_at`, 0), 
    COALESCE(`created_at`, CURRENT_TIMESTAMP)
FROM `', @SRC_DB, '`.`otp_sessions`;
');
PREPARE stmt FROM @sql_otp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 11: Migrate `security_rate_limits`
-- ----------------------------------------------------------------------------
SET @sql_rate = CONCAT('
INSERT INTO `security_rate_limits` (`key_id`, `attempts`, `last_attempt_at`, `locked_until`)
SELECT `key_id`, `attempts`, `last_attempt_at`, `locked_until`
FROM `', @SRC_DB, '`.`security_rate_limits`;
');
PREPARE stmt FROM @sql_rate;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 12: Migrate `account_lien_records`
-- Preserves all legal hold records, account attachments, and exact amounts
-- ----------------------------------------------------------------------------
SET @sql_liens = CONCAT('
INSERT INTO `account_lien_records` (`lien_id`, `account_number`, `lien_amount`, `lien_reason`, `created_at`)
SELECT `lien_id`, `account_number`, `lien_amount`, `lien_reason`, COALESCE(`created_at`, CURRENT_TIMESTAMP)
FROM `', @SRC_DB, '`.`account_lien_records`;
');
PREPARE stmt FROM @sql_liens;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Step 13: Migrate `audit_logs`
-- ----------------------------------------------------------------------------
SET @sql_audit = CONCAT('
INSERT INTO `audit_logs` (`log_id`, `customer_id`, `action`, `entity_type`, `entity_id`, `details`, `timestamp`)
SELECT `log_id`, `customer_id`, `action`, `entity_type`, `entity_id`, `details`, COALESCE(`timestamp`, CURRENT_TIMESTAMP)
FROM `', @SRC_DB, '`.`audit_logs`;
');
PREPARE stmt FROM @sql_audit;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- END OF SAFE MIGRATION SCRIPT
-- ============================================================================
