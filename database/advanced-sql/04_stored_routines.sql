-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 04: STORED PROCEDURES & STORED FUNCTIONS (MySQL 8.0+)
-- ============================================================================

-- Note: Database context must be explicitly selected by the caller (e.g. USE <database>; or via connection pool/CLI).
-- Do NOT hardcode 'USE bankist;' here to prevent accidental mutation of live environments during test/disposable setups.

-- ----------------------------------------------------------------------------
-- 1. Deterministic Stored Functions
-- ----------------------------------------------------------------------------

-- Function 1: Financial Compound Interest Calculation (Quarterly Compounding)
DROP FUNCTION IF EXISTS `fn_calculate_compound_yield`;
DELIMITER //
CREATE FUNCTION `fn_calculate_compound_yield`(
    p_principal DECIMAL(15,2),
    p_annual_rate DECIMAL(5,2),
    p_months INT
) 
RETURNS DECIMAL(15,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_years DECIMAL(10,4);
    DECLARE v_yield DECIMAL(15,2);

    IF p_principal <= 0 OR p_annual_rate <= 0 OR p_months <= 0 THEN
        RETURN 0.00;
    END IF;

    SET v_years = p_months / 12.0;
    -- Formula: A = P * (1 + r/400)^(4 * t)
    SET v_yield = p_principal * POW(1 + (p_annual_rate / 400.0), 4.0 * v_years);
    RETURN ROUND(v_yield, 2);
END //
DELIMITER ;

-- Function 2: Data Protection & Masking for Customer Accounts
DROP FUNCTION IF EXISTS `fn_mask_account_number`;
DELIMITER //
CREATE FUNCTION `fn_mask_account_number`(p_account VARCHAR(50))
RETURNS VARCHAR(50)
DETERMINISTIC
NO SQL
BEGIN
    IF p_account IS NULL OR LENGTH(p_account) < 6 THEN
        RETURN p_account;
    END IF;
    -- Returns ACC-****10 style token
    RETURN CONCAT(LEFT(p_account, 4), '****', RIGHT(p_account, 2));
END //
DELIMITER ;

-- Function 3: AML Daily Transfer Velocity Checker
DROP FUNCTION IF EXISTS `fn_check_daily_limit_exceeded`;
DELIMITER //
CREATE FUNCTION `fn_check_daily_limit_exceeded`(
    p_account VARCHAR(50),
    p_new_amount DECIMAL(15,2),
    p_daily_limit DECIMAL(15,2)
)
RETURNS TINYINT
READS SQL DATA
BEGIN
    DECLARE v_daily_sum DECIMAL(15,2);

    SELECT COALESCE(SUM(amount), 0.00) INTO v_daily_sum
    FROM transactions
    WHERE sender_account = p_account
      AND DATE(date_time) = CURDATE()
      AND status = 'Success';

    IF (v_daily_sum + p_new_amount) > p_daily_limit THEN
        RETURN 1; -- Exceeded
    ELSE
        RETURN 0; -- Safe
    END IF;
END //
DELIMITER ;

-- ----------------------------------------------------------------------------
-- 2. Stored Procedures: Core Banking Operations
-- ----------------------------------------------------------------------------

-- Procedure 1: Atomic Fund Transfer with Row-Level Locking (SELECT ... FOR UPDATE)
DROP PROCEDURE IF EXISTS `sp_atomic_fund_transfer`;
DELIMITER //
CREATE PROCEDURE `sp_atomic_fund_transfer`(
    IN p_sender_acc VARCHAR(50),
    IN p_receiver_acc VARCHAR(50),
    IN p_amount DECIMAL(15,2),
    IN p_description VARCHAR(255),
    OUT p_status VARCHAR(50),
    OUT p_txn_id VARCHAR(50)
)
proc_body: BEGIN
    DECLARE v_sender_bal DECIMAL(15,2);
    DECLARE v_sender_status VARCHAR(20);
    DECLARE v_receiver_status VARCHAR(20);
    DECLARE v_ref_num VARCHAR(100);

    -- Standard SQL Exception Handler
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'ERROR_SQL_EXCEPTION_ROLLED_BACK';
        SET p_txn_id = NULL;
    END;

    -- Basic Validation
    IF p_amount <= 0 THEN
        SET p_status = 'INVALID_TRANSFER_AMOUNT';
        SET p_txn_id = NULL;
        LEAVE proc_body;
    END IF;

    IF p_sender_acc = p_receiver_acc THEN
        SET p_status = 'IDENTICAL_SENDER_AND_RECEIVER';
        SET p_txn_id = NULL;
        LEAVE proc_body;
    END IF;

    -- Begin Explicit ACID Transaction
    START TRANSACTION;

        -- 1. Lock Sender Account Row (FOR UPDATE)
        SELECT balance, status INTO v_sender_bal, v_sender_status
        FROM accounts
        WHERE account_number = p_sender_acc
        FOR UPDATE;

        IF v_sender_status IS NULL THEN
            ROLLBACK;
            SET p_status = 'SENDER_ACCOUNT_NOT_FOUND';
            SET p_txn_id = NULL;
            LEAVE proc_body;
        END IF;

        IF v_sender_status <> 'Active' THEN
            ROLLBACK;
            SET p_status = 'SENDER_ACCOUNT_INACTIVE';
            SET p_txn_id = NULL;
            LEAVE proc_body;
        END IF;

        IF v_sender_bal < p_amount THEN
            ROLLBACK;
            SET p_status = 'INSUFFICIENT_FUNDS';
            SET p_txn_id = NULL;
            LEAVE proc_body;
        END IF;

        -- 2. Lock Receiver Account Row (FOR UPDATE)
        SELECT status INTO v_receiver_status
        FROM accounts
        WHERE account_number = p_receiver_acc
        FOR UPDATE;

        IF v_receiver_status IS NULL THEN
            ROLLBACK;
            SET p_status = 'RECEIVER_ACCOUNT_NOT_FOUND';
            SET p_txn_id = NULL;
            LEAVE proc_body;
        END IF;

        IF v_receiver_status <> 'Active' THEN
            ROLLBACK;
            SET p_status = 'RECEIVER_ACCOUNT_INACTIVE';
            SET p_txn_id = NULL;
            LEAVE proc_body;
        END IF;

        -- 3. Execute Atomic Balances Update
        UPDATE accounts SET balance = balance - p_amount WHERE account_number = p_sender_acc;
        UPDATE accounts SET balance = balance + p_amount WHERE account_number = p_receiver_acc;

        -- 4. Record Double-Entry Ledger Transaction
        SET p_txn_id = CONCAT('TXN-', UNIX_TIMESTAMP(), '-', FLOOR(RAND() * 1000));
        SET v_ref_num = CONCAT('BTB', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), FLOOR(RAND() * 1000));

        INSERT INTO transactions (
            transaction_id, 
            sender_account, 
            receiver_account, 
            amount, 
            type, 
            date_time, 
            status, 
            description, 
            reference_number
        ) VALUES (
            p_txn_id, 
            p_sender_acc, 
            p_receiver_acc, 
            p_amount, 
            'Transfer', 
            NOW(), 
            'Success', 
            p_description, 
            v_ref_num
        );

        -- 5. Record Compliance Audit Log Entry
        INSERT INTO audit_logs (
            log_id, 
            customer_id, 
            action, 
            entity_type, 
            entity_id, 
            details, 
            timestamp
        ) VALUES (
            CONCAT('AUDIT-', UUID()), 
            (SELECT customer_id FROM accounts WHERE account_number = p_sender_acc), 
            'SP_FUND_TRANSFER_SUCCESS', 
            'ACCOUNT', 
            p_sender_acc, 
            CONCAT('Transferred INR ', p_amount, ' to ', p_receiver_acc, ' [Txn: ', p_txn_id, ']'), 
            NOW()
        );

    COMMIT;
    SET p_status = 'SUCCESS';

END proc_body //
DELIMITER ;

-- Procedure 2: Customer Portfolio Inspection (Multi-Result Set)
DROP PROCEDURE IF EXISTS `sp_get_customer_full_portfolio`;
DELIMITER //
CREATE PROCEDURE `sp_get_customer_full_portfolio`(IN p_cust_id VARCHAR(50))
BEGIN
    -- Result 1: Customer Profile
    SELECT customer_id, full_name, email, phone, tier, credit_score, status 
    FROM customers 
    WHERE customer_id = p_cust_id;

    -- Result 2: Accounts & Balances with Masking
    SELECT 
        account_number, 
        fn_mask_account_number(account_number) AS masked_account, 
        account_type, 
        balance, 
        branch_name, 
        status 
    FROM accounts 
    WHERE customer_id = p_cust_id;

    -- Result 3: Active Term Deposits
    SELECT 
        deposit_id, 
        linked_account, 
        deposit_type, 
        principal_amount, 
        interest_rate, 
        maturity_amount, 
        maturity_date 
    FROM deposits 
    WHERE customer_id = p_cust_id;
END //
DELIMITER ;

-- ----------------------------------------------------------------------------
-- 3. Stored Routine Verification & Execution Demonstration
-- ----------------------------------------------------------------------------

-- Test Function Execution
SELECT 
    fn_calculate_compound_yield(100000.00, 7.50, 12) AS expected_1yr_yield,
    fn_mask_account_number('ACC-772910') AS masked_test,
    fn_check_daily_limit_exceeded('ACC-772910', 1000.00, 500000.00) AS limit_exceeded_flag;

-- Test Transfer Procedure Execution
SET @status = '';
SET @txnid = '';
CALL sp_atomic_fund_transfer('ACC-772910', 'ACC-553102', 250.00, 'Demonstration Transfer via Stored Procedure', @status, @txnid);
SELECT @status AS transfer_result_status, @txnid AS generated_transaction_id;

-- Test Multi-Result Portfolio Procedure
CALL sp_get_customer_full_portfolio('CUST-101');
