-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 01: DDL, CONSTRAINTS & DATA INTEGRITY INVARIANTS (MySQL 8.0+)
-- ============================================================================

-- Note: Database context must be explicitly selected by the caller (e.g. USE <database>; or via connection pool/CLI).
-- Do NOT hardcode 'USE bankist;' here to prevent accidental mutation of live environments during test/disposable setups.

-- ----------------------------------------------------------------------------
-- 1. Dynamic Column & Table Evolution Helpers
-- ----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_add_column_if_missing;
DELIMITER //
CREATE PROCEDURE sp_add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = p_table 
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL sp_add_column_if_missing('transactions', 'reference_number', 'VARCHAR(100) DEFAULT NULL');
CALL sp_add_column_if_missing('customers', 'card_pin_hash', 'VARCHAR(255) DEFAULT NULL');
CALL sp_add_column_if_missing('accounts', 'card_pin_hash', 'VARCHAR(255) DEFAULT NULL');
DROP PROCEDURE IF EXISTS sp_add_column_if_missing;

-- ----------------------------------------------------------------------------
-- 2. Ensure Supporting Production Tables Exist
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `branches` (
  `branch_id` VARCHAR(50) NOT NULL,
  `branch_name` VARCHAR(100) NOT NULL,
  `ifsc_code` VARCHAR(20) NOT NULL UNIQUE,
  `city` VARCHAR(100) NOT NULL,
  `address` TEXT NOT NULL,
  `timing` VARCHAR(50) DEFAULT '09:30 AM - 04:30 PM',
  `phone` VARCHAR(30) DEFAULT NULL,
  `status` VARCHAR(20) DEFAULT 'Active',
  PRIMARY KEY (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `log_id` VARCHAR(50) NOT NULL,
  `customer_id` VARCHAR(50) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(50) DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed branches if empty
INSERT IGNORE INTO `branches` (`branch_id`, `branch_name`, `ifsc_code`, `city`, `address`, `timing`, `phone`) VALUES
('BR-101', 'Mumbai Nariman Point Hub', 'BTBI0001024', 'Mumbai', 'Ground Floor, Express Towers, Nariman Point, Mumbai 400021', '09:30 AM - 04:30 PM', '022-22881024'),
('BR-102', 'Bengaluru MG Road Branch', 'BTBI0002018', 'Bengaluru', 'Prestige Meridian, 29 MG Road, Bengaluru 560001', '09:30 AM - 04:30 PM', '080-25582018'),
('BR-103', 'Delhi Connaught Place Branch', 'BTBI0003055', 'New Delhi', 'Inner Circle, Blocks A-C, Connaught Place, New Delhi 110001', '09:30 AM - 04:30 PM', '011-23343055'),
('BR-104', 'Pune Camp Central Branch', 'BTBI0004011', 'Pune', 'Moledina Road, Camp, Pune 411001', '09:30 AM - 04:30 PM', '020-26124011'),
('BR-105', 'Ahmedabad Ashram Road Hub', 'BTBI0005089', 'Ahmedabad', 'Near Sakar III, Ashram Road, Ahmedabad 380009', '09:30 AM - 04:30 PM', '079-26585089');

-- ----------------------------------------------------------------------------
-- 3. Idempotent Dynamic Constraint Manager
-- ----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_add_constraint_if_missing;
DELIMITER //
CREATE PROCEDURE sp_add_constraint_if_missing(
  IN p_table VARCHAR(64),
  IN p_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = p_table 
      AND CONSTRAINT_NAME = p_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_name, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- Apply invariants safely
CALL sp_add_constraint_if_missing('accounts', 'chk_account_positive_balance', 'CHECK (balance >= 0.00)');
CALL sp_add_constraint_if_missing('transactions', 'chk_transaction_positive_amount', 'CHECK (amount > 0.00)');
CALL sp_add_constraint_if_missing('deposits', 'chk_deposit_min_principal', 'CHECK (principal_amount >= 1000.00)');
CALL sp_add_constraint_if_missing('deposits', 'chk_deposit_valid_tenure', 'CHECK (tenure_months >= 1 AND tenure_months <= 120)');
CALL sp_add_constraint_if_missing('customers', 'chk_customer_cibil_range', 'CHECK (credit_score >= 300 AND credit_score <= 900)');
CALL sp_add_constraint_if_missing('branches', 'chk_branch_ifsc_format', 'CHECK (LENGTH(ifsc_code) = 11)');

DROP PROCEDURE IF EXISTS sp_add_constraint_if_missing;

-- ----------------------------------------------------------------------------
-- 4. Demonstration of Referential Actions: RESTRICT vs CASCADE
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `account_lien_records`;
CREATE TABLE `account_lien_records` (
  `lien_id` VARCHAR(50) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `lien_amount` DECIMAL(15,2) NOT NULL,
  `lien_reason` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lien_id`),
  -- Enforces RESTRICT: An account under legal lien CANNOT be deleted
  CONSTRAINT `fk_lien_account` FOREIGN KEY (`account_number`) 
    REFERENCES `accounts` (`account_number`) 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Verification Queries for Table Constraints
-- ----------------------------------------------------------------------------
SELECT 
    CONSTRAINT_NAME, 
    TABLE_NAME, 
    CONSTRAINT_TYPE 
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = 'bankist' 
ORDER BY TABLE_NAME, CONSTRAINT_TYPE;
