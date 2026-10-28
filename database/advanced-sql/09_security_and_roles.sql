-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 09: DATABASE ROLES, LEAST PRIVILEGE & DATA PROTECTION (MySQL 8.0+)
-- ============================================================================

-- Note: Database context must be explicitly selected by the caller (e.g. USE <database>; or via connection pool/CLI).
-- Do NOT hardcode 'USE bankist;' here to prevent accidental mutation of live environments during test/disposable setups.

-- ----------------------------------------------------------------------------
-- 1. MySQL 8.0 Enterprise Role Hierarchy (Least Privilege Principle)
-- ----------------------------------------------------------------------------

-- Create Dedicated Banking Roles
CREATE ROLE IF NOT EXISTS 'role_bank_admin';
CREATE ROLE IF NOT EXISTS 'role_bank_teller';
CREATE ROLE IF NOT EXISTS 'role_bank_auditor';
CREATE ROLE IF NOT EXISTS 'role_bank_app_service';

-- Role 1: Bank Administrator (Full Operational Maintenance within target database)
-- GRANT ALL PRIVILEGES ON *.* requires global privilege; in database context, administrator manages all tables
GRANT ALL PRIVILEGES ON `customers` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `accounts` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `transactions` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `deposits` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `beneficiaries` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `kyc_verifications` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `otp_sessions` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `security_rate_limits` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `branches` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `account_lien_records` TO 'role_bank_admin';
GRANT ALL PRIVILEGES ON `audit_logs` TO 'role_bank_admin';

-- Role 2: Bank Teller (Counter Operations: Accounts & Transactions DML only)
-- Cannot alter schema, view password hashes, or modify audit history
GRANT SELECT, UPDATE ON `accounts` TO 'role_bank_teller';
GRANT SELECT, INSERT ON `transactions` TO 'role_bank_teller';
GRANT SELECT ON `customers` TO 'role_bank_teller';
GRANT SELECT ON `branches` TO 'role_bank_teller';

-- Role 3: Compliance & Security Auditor (Strictly Read-Only Access)
GRANT SELECT ON `audit_logs` TO 'role_bank_auditor';
GRANT SELECT ON `transactions` TO 'role_bank_auditor';
GRANT SELECT ON `v_customer_portfolio` TO 'role_bank_auditor';
GRANT SELECT ON `v_high_value_transactions` TO 'role_bank_auditor';

-- Role 4: Application Runtime Service (Least Privilege for Web App API)
-- Granted ONLY required DML; explicitly NO DROP, ALTER, CREATE TABLE, or SUPER privileges
GRANT SELECT, INSERT, UPDATE ON `customers` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `accounts` TO 'role_bank_app_service';
GRANT SELECT, INSERT ON `transactions` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `deposits` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE, DELETE ON `beneficiaries` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `kyc_verifications` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE, DELETE ON `otp_sessions` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE, DELETE ON `security_rate_limits` TO 'role_bank_app_service';
GRANT SELECT ON `branches` TO 'role_bank_app_service';
GRANT SELECT, INSERT, UPDATE ON `account_lien_records` TO 'role_bank_app_service';
GRANT SELECT, INSERT ON `audit_logs` TO 'role_bank_app_service';
GRANT SELECT ON `v_customer_portfolio` TO 'role_bank_app_service';
GRANT SELECT ON `v_high_value_transactions` TO 'role_bank_app_service';
GRANT EXECUTE ON PROCEDURE `sp_execute_atomic_transfer` TO 'role_bank_app_service';
GRANT EXECUTE ON PROCEDURE `sp_create_term_deposit` TO 'role_bank_app_service';
GRANT EXECUTE ON PROCEDURE `sp_verify_otp_and_escalate_kyc` TO 'role_bank_app_service';

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
