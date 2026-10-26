-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 07: INDEXING STRATEGY & QUERY OPTIMIZATION (MySQL 8.0+)
-- Features: Composite Indexes, Leftmost Prefix Rule, EXPLAIN & EXPLAIN ANALYZE
-- ============================================================================

USE `bankist`;

-- ----------------------------------------------------------------------------
-- 1. Index Audit: Inspect Current Secondary & Primary Indexes
-- ----------------------------------------------------------------------------
SELECT 
    TABLE_NAME, 
    INDEX_NAME, 
    SEQ_IN_INDEX, 
    COLUMN_NAME, 
    CARDINALITY, 
    INDEX_TYPE 
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = 'bankist'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ----------------------------------------------------------------------------
-- 2. Performance-Driven Index Engineering
-- Adding composite indexes targeting frequent range scans and sort operations
-- ----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_create_index_if_missing;
DELIMITER //
CREATE PROCEDURE sp_create_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = p_table 
      AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '`(', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- Index 1: Composite Index on Account Transactions (Statement Generation)
-- Equality filter (`sender_account`) + Range/Sort (`date_time`)
CALL sp_create_index_if_missing('transactions', 'idx_tx_sender_datetime', 'sender_account, date_time');

-- Index 2: Composite Index on Account Customer & Status (Active Account Fetch)
CALL sp_create_index_if_missing('accounts', 'idx_acc_cust_status', 'customer_id, status');

-- Index 3: Composite Index on Deposits Maturity & Status (Batch Job Optimization)
CALL sp_create_index_if_missing('deposits', 'idx_dep_maturity_status', 'status, maturity_date');

DROP PROCEDURE IF EXISTS sp_create_index_if_missing;

-- ----------------------------------------------------------------------------
-- 3. Execution Plan Analysis: Traditional EXPLAIN
-- ----------------------------------------------------------------------------

-- Test Query: Customer Statement Generation
EXPLAIN 
SELECT transaction_id, date_time, amount, type, status, description
FROM transactions
WHERE sender_account = 'ACC-772910' 
  AND date_time >= '2024-01-01'
ORDER BY date_time DESC;

-- ----------------------------------------------------------------------------
-- 4. Deep Query Profiling: EXPLAIN ANALYZE (MySQL 8.0 Tree Execution Format)
-- Shows: Actual Engine Time, Number of Loops, Number of Rows, Filter Percentage
-- ----------------------------------------------------------------------------
EXPLAIN ANALYZE 
SELECT transaction_id, date_time, amount, type, status, description
FROM transactions
WHERE sender_account = 'ACC-772910' 
  AND date_time >= '2024-01-01'
ORDER BY date_time DESC;

-- ----------------------------------------------------------------------------
-- 5. Leftmost Prefix Demonstration
-- Index: (sender_account, date_time)
-- ----------------------------------------------------------------------------

-- Case A: Uses BOTH columns of composite index (Full Index Seek & Range Scan)
EXPLAIN 
SELECT * FROM transactions 
WHERE sender_account = 'ACC-772910' AND date_time > '2024-06-01';

-- Case B: Uses LEFTMOST prefix column only (Index Seek on sender_account)
EXPLAIN 
SELECT * FROM transactions 
WHERE sender_account = 'ACC-772910';

-- Case C: Skips LEFTMOST prefix column (Cannot perform index range seek)
EXPLAIN 
SELECT * FROM transactions 
WHERE date_time > '2024-06-01';
