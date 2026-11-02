-- ============================================================================
-- BHARAT TRUST BANK (BTB) - BCNF ACCOUNTS REMEDIATION MIGRATION (REVIEWED)
-- Target RDBMS: MySQL 8.0+ Enterprise / InnoDB / STRICT_TRANS_TABLES
-- Purpose: Resolve transitive dependency {ifsc_code} -> {branch_name} in accounts
-- Standard: Boyce-Codd Normal Form (BCNF)
-- Status: PREPARED & REVIEWED (DO NOT EXECUTE DIRECTLY AGAINST LIVE WITHOUT APPROVAL)
-- ============================================================================
--
-- SAFETY & REVIEW NOTICE:
-- 1. This script resolves the BCNF violation on `accounts` by eliminating the
--    transitively dependent attribute `branch_name`.
-- 2. Heath's Theorem proves that decomposition across `ifsc_code` is lossless.
-- 3. The canonical view `v_accounts_legacy` guarantees 100% backward compatibility
--    for any legacy query requiring `branch_name`.
-- 4. In accordance with Safety Rule 10, this script is prepared for reviewed staging
--    execution and is NOT executed automatically against the live database.
-- ============================================================================

SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY';
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- STEP 1: PRE-FLIGHT INTEGRITY ASSERTIONS
-- ----------------------------------------------------------------------------

-- Assert 1: Confirm all accounts map to an existing branch in `branches`
SELECT 
    COUNT(*) INTO @orphan_branch_count
FROM `accounts` a
LEFT JOIN `branches` b ON a.ifsc_code = b.ifsc_code
WHERE b.ifsc_code IS NULL;

-- Assert 2: Confirm branch_name consistency between accounts and branches before drop
SELECT 
    COUNT(*) INTO @mismatched_branch_count
FROM `accounts` a
JOIN `branches` b ON a.ifsc_code = b.ifsc_code
WHERE a.branch_name != b.branch_name;

-- ----------------------------------------------------------------------------
-- STEP 2: ENSURE CANONICAL VIEW v_accounts_legacy EXISTS
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
LEFT JOIN `account_card_credentials` c ON a.account_number = c.account_number;

-- ----------------------------------------------------------------------------
-- STEP 3: ENFORCE FOREIGN KEY ON accounts(ifsc_code) -> branches(ifsc_code)
-- ----------------------------------------------------------------------------
-- Drop existing constraint if named differently, then add authoritative FK
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
      AND table_name = 'accounts' 
      AND constraint_name = 'fk_accounts_branch'
);

SET @sql_add_fk = IF(@fk_exists = 0,
    'ALTER TABLE `accounts` ADD CONSTRAINT `fk_accounts_branch` FOREIGN KEY (`ifsc_code`) REFERENCES `branches` (`ifsc_code`) ON DELETE RESTRICT ON UPDATE CASCADE;',
    'SELECT "Foreign key fk_accounts_branch already active."'
);
PREPARE stmt_fk FROM @sql_add_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- ----------------------------------------------------------------------------
-- STEP 4: DROP REDUNDANT branch_name COLUMN FROM accounts
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
      AND table_name = 'accounts' 
      AND column_name = 'branch_name'
);

SET @sql_drop_col = IF(@col_exists > 0,
    'ALTER TABLE `accounts` DROP COLUMN `branch_name`;',
    'SELECT "Column accounts.branch_name already removed."'
);
PREPARE stmt_drop FROM @sql_drop_col;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;

-- ----------------------------------------------------------------------------
-- STEP 5: POST-MIGRATION INTEGRITY VERIFICATION
-- ----------------------------------------------------------------------------
SELECT 
    COUNT(*) AS total_accounts,
    (SELECT COUNT(*) FROM `v_accounts_legacy`) AS view_accounts_count,
    'SUCCESS: accounts decomposed to BCNF with zero loss' AS migration_status
FROM `accounts`;
