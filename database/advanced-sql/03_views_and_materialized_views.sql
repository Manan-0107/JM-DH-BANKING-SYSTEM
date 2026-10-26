-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 03: RELATIONAL VIEWS & MATERIALIZED VIEW ALTERNATIVES (MySQL 8.0+)
-- ============================================================================

USE `bankist`;

-- ----------------------------------------------------------------------------
-- 1. Standard Relational Views (Virtual Tables with Query Rewriting)
-- ----------------------------------------------------------------------------

-- View 1: Customer Portfolio & Total Liquid/Term Net Worth
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

-- View 2: High Value Transaction Monitor (Transactions >= ₹25,000 for AML Compliance)
CREATE OR REPLACE VIEW `v_high_value_transactions` AS
SELECT 
    t.transaction_id,
    t.reference_number,
    t.date_time,
    t.sender_account,
    t.receiver_account,
    t.amount,
    t.type,
    t.status,
    t.description
FROM transactions t
WHERE t.amount >= 25000.00;

-- View 3: Active Term Deposits Summary with Yield Analysis
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
    d.maturity_date,
    DATEDIFF(d.maturity_date, CURDATE()) AS days_to_maturity
FROM deposits d
JOIN customers c ON d.customer_id = c.customer_id
WHERE d.status = 'Active';

-- View 4: Live Branch Liquidity Summary (Real-Time Aggregation View)
CREATE OR REPLACE VIEW `v_live_branch_summary` AS
SELECT 
    b.ifsc_code,
    b.branch_name,
    b.city,
    COUNT(DISTINCT a.account_number) AS active_accounts,
    COALESCE(SUM(a.balance), 0.00) AS total_liquid_assets
FROM branches b
LEFT JOIN accounts a ON b.ifsc_code = a.ifsc_code AND a.status = 'Active'
GROUP BY b.ifsc_code, b.branch_name, b.city;

-- ----------------------------------------------------------------------------
-- 2. Materialized View Alternative in MySQL 8.0: Summary Table + Refresh Pattern
-- Technical Context: Unlike PostgreSQL or Oracle, MySQL does not provide native 
-- MATERIALIZED VIEW syntax. The enterprise pattern in MySQL 8.0 is a physically 
-- indexed snapshot summary table refreshed transactionally via a stored procedure.
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS `mv_branch_financial_summary`;
CREATE TABLE `mv_branch_financial_summary` (
    `ifsc_code` VARCHAR(20) NOT NULL,
    `branch_name` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `active_accounts` INT NOT NULL,
    `total_liquid_assets` DECIMAL(15,2) NOT NULL,
    `last_refreshed_at` DATETIME NOT NULL,
    PRIMARY KEY (`ifsc_code`),
    INDEX `idx_mv_assets` (`total_liquid_assets`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Atomic Refresh Procedure for the Materialized Snapshot Table
DROP PROCEDURE IF EXISTS `sp_refresh_branch_summary`;
DELIMITER //
CREATE PROCEDURE `sp_refresh_branch_summary`()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        -- Staging / Upsert Refresh Strategy
        DELETE FROM `mv_branch_financial_summary`;

        INSERT INTO `mv_branch_financial_summary` (
            `ifsc_code`,
            `branch_name`,
            `city`,
            `active_accounts`,
            `total_liquid_assets`,
            `last_refreshed_at`
        )
        SELECT 
            b.ifsc_code,
            b.branch_name,
            b.city,
            COUNT(DISTINCT a.account_number) AS active_accounts,
            COALESCE(SUM(a.balance), 0.00) AS total_liquid_assets,
            NOW() AS last_refreshed_at
        FROM branches b
        LEFT JOIN accounts a ON b.ifsc_code = a.ifsc_code AND a.status = 'Active'
        GROUP BY b.ifsc_code, b.branch_name, b.city;

    COMMIT;
END //
DELIMITER ;

-- Execute Initial Refresh
CALL `sp_refresh_branch_summary`();

-- ----------------------------------------------------------------------------
-- 3. Consistency Test: Comparing Real-Time Virtual View vs Materialized Snapshot
-- ----------------------------------------------------------------------------
SELECT 
    v.ifsc_code,
    v.branch_name,
    v.total_liquid_assets AS live_view_assets,
    mv.total_liquid_assets AS materialized_assets,
    (v.total_liquid_assets - mv.total_liquid_assets) AS variance_delta,
    mv.last_refreshed_at
FROM v_live_branch_summary v
JOIN mv_branch_financial_summary mv ON v.ifsc_code = mv.ifsc_code;
