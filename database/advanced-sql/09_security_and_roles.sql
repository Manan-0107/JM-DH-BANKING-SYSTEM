-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 09: DATABASE ROLES, LEAST PRIVILEGE & DATA PROTECTION (MySQL 8.0+)
-- ============================================================================

USE `bankist`;

-- ----------------------------------------------------------------------------
-- 1. MySQL 8.0 Enterprise Role Hierarchy (Least Privilege Principle)
-- ----------------------------------------------------------------------------

-- Create Dedicated Banking Roles
CREATE ROLE IF NOT EXISTS 'role_bank_admin';
CREATE ROLE IF NOT EXISTS 'role_bank_teller';
CREATE ROLE IF NOT EXISTS 'role_bank_auditor';
CREATE ROLE IF NOT EXISTS 'role_bank_app_service';

-- Role 1: Bank Administrator (Full Operational Maintenance)
GRANT ALL PRIVILEGES ON `bankist`.* TO 'role_bank_admin';

-- Role 2: Bank Teller (Counter Operations: Accounts & Transactions DML only)
-- Cannot alter schema, view password hashes, or modify audit history
GRANT SELECT, UPDATE ON `bankist`.`accounts` TO 'role_bank_teller';
GRANT SELECT, INSERT ON `bankist`.`transactions` TO 'role_bank_teller';
GRANT SELECT ON `bankist`.`customers` TO 'role_bank_teller';
GRANT SELECT ON `bankist`.`branches` TO 'role_bank_teller';

-- Role 3: Compliance & Security Auditor (Strictly Read-Only Access)
GRANT SELECT ON `bankist`.`audit_logs` TO 'role_bank_auditor';
GRANT SELECT ON `bankist`.`transactions` TO 'role_bank_auditor';
GRANT SELECT ON `bankist`.`v_customer_portfolio` TO 'role_bank_auditor';
GRANT SELECT ON `bankist`.`v_high_value_transactions` TO 'role_bank_auditor';

-- Role 4: Application Runtime Service (Least Privilege for Web App API)
-- Granted ONLY required DML; explicitly NO DROP or ALTER privileges
GRANT SELECT, INSERT, UPDATE ON `bankist`.`customers` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `bankist`.`accounts` TO 'role_bank_app_service';
GRANT SELECT, INSERT ON `bankist`.`transactions` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `bankist`.`deposits` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `bankist`.`beneficiaries` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `bankist`.`kyc_verifications` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE, DELETE ON `bankist`.`otp_sessions` TO 'role_bank_app_service';
GRANT SELECT, INSERT ON `bankist`.`audit_logs` TO 'role_bank_app_service';
GRANT EXECUTE ON `bankist`.* TO 'role_bank_app_service';

-- ----------------------------------------------------------------------------
-- 2. Row-Level Security (RLS) Architecture in MySQL 8.0
-- Technical Fact: Unlike PostgreSQL, MySQL 8.0 does not feature native 
-- "CREATE POLICY ... FOR SELECT" statements. Furthermore, MySQL views forbid 
-- direct user session variables (@var). Enterprise row-level authorization 
-- is implemented using session-context accessor functions or secure stored routines.
-- ----------------------------------------------------------------------------

-- Context Accessor Function
DROP FUNCTION IF EXISTS `fn_get_current_session_customer`;
DELIMITER //
CREATE FUNCTION `fn_get_current_session_customer`()
RETURNS VARCHAR(50)
DETERMINISTIC
NO SQL
BEGIN
    RETURN @app_current_customer_id;
END //
DELIMITER ;

-- Secure Parameterized View utilizing the Session Context Function
CREATE OR REPLACE VIEW `v_secure_customer_accounts` AS
SELECT 
    a.account_number,
    a.customer_id,
    a.account_type,
    a.balance,
    a.branch_name,
    a.ifsc_code,
    a.status
FROM accounts a
WHERE a.customer_id = fn_get_current_session_customer();

-- Stored Procedure Alternative for Row-Level Authorization
DROP PROCEDURE IF EXISTS `sp_get_my_authorized_accounts`;
DELIMITER //
CREATE PROCEDURE `sp_get_my_authorized_accounts`(IN p_authenticated_customer_id VARCHAR(50))
BEGIN
    SELECT 
        account_number, 
        account_type, 
        balance, 
        branch_name, 
        status 
    FROM accounts 
    WHERE customer_id = p_authenticated_customer_id;
END //
DELIMITER ;

-- Demonstration of Row-Level Filtering via Session Context:
SET @app_current_customer_id = 'CUST-101';
SELECT * FROM v_secure_customer_accounts;

SET @app_current_customer_id = 'CUST-102';
SELECT * FROM v_secure_customer_accounts;

-- ----------------------------------------------------------------------------
-- 3. PII Redaction & Data Protection View
-- Exposes customer data to tellers while redacting PAN, Aadhaar, and password hash
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_teller_customer_view` AS
SELECT 
    c.customer_id,
    c.full_name,
    CONCAT(LEFT(c.email, 3), '***@', SUBSTRING_INDEX(c.email, '@', -1)) AS masked_email,
    CONCAT('+91 *****', RIGHT(c.phone, 4)) AS masked_phone,
    c.tier,
    c.status,
    c.kyc_status,
    'XXXXXXXX' AS masked_pan,
    c.aadhaar_number AS masked_aadhaar
FROM customers c;

SELECT * FROM v_teller_customer_view LIMIT 5;
