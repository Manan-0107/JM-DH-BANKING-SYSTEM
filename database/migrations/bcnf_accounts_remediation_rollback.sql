-- ============================================================================
-- BHARAT TRUST BANK (BTB) - BCNF ACCOUNTS REMEDIATION ROLLBACK PLAN
-- Target RDBMS: MySQL 8.0+ Enterprise / InnoDB / STRICT_TRANS_TABLES
-- Purpose: Restore denormalized `branch_name` column to `accounts` if rollback is required
-- Status: PREPARED & REVIEWED
-- ============================================================================

SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY';
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- STEP 1: RE-ADD branch_name COLUMN TO accounts IF MISSING
-- ----------------------------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
      AND table_name = 'accounts' 
      AND column_name = 'branch_name'
);

SET @sql_add_col = IF(@col_exists = 0,
    'ALTER TABLE `accounts` ADD COLUMN `branch_name` VARCHAR(100) NOT NULL DEFAULT "Downtown Central" AFTER `ifsc_code`;',
    'SELECT "Column accounts.branch_name already exists."'
);
PREPARE stmt_add FROM @sql_add_col;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

-- ----------------------------------------------------------------------------
-- STEP 2: RE-POPULATE branch_name FROM branches VIA ifsc_code
-- ----------------------------------------------------------------------------
UPDATE `accounts` a
JOIN `branches` b ON a.ifsc_code = b.ifsc_code
SET a.branch_name = b.branch_name;

-- ----------------------------------------------------------------------------
-- STEP 3: VERIFY COMPLETE RESTORATION
-- ----------------------------------------------------------------------------
SELECT 
    COUNT(*) AS total_accounts,
    SUM(CASE WHEN branch_name IS NULL OR branch_name = '' THEN 1 ELSE 0 END) AS unpopulated_branches,
    'SUCCESS: accounts.branch_name rolled back and fully repopulated' AS rollback_status
FROM `accounts`;
