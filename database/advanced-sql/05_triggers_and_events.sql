-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 05: DATABASE TRIGGERS & SCHEDULED EVENTS (MySQL 8.0+)
-- ============================================================================

USE `bankist`;

-- ----------------------------------------------------------------------------
-- 1. BEFORE UPDATE Trigger: Database-Level Negative Balance Prevention
-- (Fail-closed defensive integrity guard against rogue DML updates)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_prevent_negative_balance`;
DELIMITER //
CREATE TRIGGER `trg_prevent_negative_balance`
BEFORE UPDATE ON `accounts`
FOR EACH ROW
BEGIN
    IF NEW.balance < 0.00 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '[BANK_INTEGRITY_VIOLATION] Account balance cannot be negative. Overdraft rejected by database trigger.';
    END IF;
END //
DELIMITER ;

-- ----------------------------------------------------------------------------
-- 2. AFTER UPDATE Trigger: Regulatory Account Status Audit Logging
-- (Captures freezes, closures, and reactivations without application overhead)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_account_status_change`;
DELIMITER //
CREATE TRIGGER `trg_audit_account_status_change`
AFTER UPDATE ON `accounts`
FOR EACH ROW
BEGIN
    -- Log only when the lifecycle status attribute genuinely mutates
    IF OLD.status <> NEW.status THEN
        INSERT INTO audit_logs (
            log_id,
            customer_id,
            action,
            entity_type,
            entity_id,
            details,
            timestamp
        ) VALUES (
            CONCAT('AUDIT-STATUS-', UUID()),
            NEW.customer_id,
            'ACCOUNT_STATUS_TRANSITION',
            'ACCOUNT',
            NEW.account_number,
            CONCAT('Status changed from [', OLD.status, '] to [', NEW.status, ']'),
            NOW()
        );
    END IF;
END //
DELIMITER ;

-- ----------------------------------------------------------------------------
-- 3. AFTER INSERT Trigger: High-Value AML Compliance Ingestion
-- (Automatically stamps compliance records for high-value fund movements >= 1,00,000)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_audit_high_value_transaction`;
DELIMITER //
CREATE TRIGGER `trg_audit_high_value_transaction`
AFTER INSERT ON `transactions`
FOR EACH ROW
BEGIN
    IF NEW.amount >= 100000.00 THEN
        INSERT INTO audit_logs (
            log_id,
            customer_id,
            action,
            entity_type,
            entity_id,
            details,
            timestamp
        ) VALUES (
            CONCAT('AUDIT-AML-', UUID()),
            (SELECT customer_id FROM accounts WHERE account_number = COALESCE(NEW.sender_account, NEW.receiver_account) LIMIT 1),
            'AML_HIGH_VALUE_THRESHOLD_ALERT',
            'TRANSACTION',
            NEW.transaction_id,
            CONCAT('High-value transaction of INR ', NEW.amount, ' recorded. Type: ', NEW.type),
            NOW()
        );
    END IF;
END //
DELIMITER ;

-- ----------------------------------------------------------------------------
-- 4. Scheduled Event & Manual Procedure Alternative: Deposit Maturity Processing
-- ----------------------------------------------------------------------------

-- Procedure Alternative for Manual Triggering / Controlled Testing
DROP PROCEDURE IF EXISTS `sp_process_matured_deposits`;
DELIMITER //
CREATE PROCEDURE `sp_process_matured_deposits`(OUT p_processed_count INT)
BEGIN
    DECLARE v_count INT DEFAULT 0;

    START TRANSACTION;
        -- Count deposits reaching maturity
        SELECT COUNT(*) INTO v_count
        FROM deposits
        WHERE status = 'Active' 
          AND maturity_date <= CURDATE();

        IF v_count > 0 THEN
            -- Update active deposits that have reached their maturity horizon
            UPDATE deposits
            SET status = 'Matured'
            WHERE status = 'Active' 
              AND maturity_date <= CURDATE();

            -- Log automated maturity event
            INSERT INTO audit_logs (log_id, action, entity_type, entity_id, details, timestamp)
            VALUES (CONCAT('AUDIT-MATURITY-', UUID()), 'BATCH_DEPOSIT_MATURITY_UPDATE', 'DEPOSITS', 'BATCH', CONCAT('Processed ', v_count, ' matured deposits'), NOW());
        END IF;
    COMMIT;

    SET p_processed_count = v_count;
END //
DELIMITER ;

-- Scheduled MySQL Event (Runs every 24 hours at 00:01 AM)
-- Note: Requires `SET GLOBAL event_scheduler = ON;` in production
DROP EVENT IF EXISTS `evt_daily_deposit_maturity_check`;
DELIMITER //
CREATE EVENT `evt_daily_deposit_maturity_check`
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 1 MINUTE)
COMMENT 'Automated overnight processing of matured fixed and recurring deposits'
DO
BEGIN
    DECLARE v_out INT;
    CALL sp_process_matured_deposits(v_out);
END //
DELIMITER ;

-- ----------------------------------------------------------------------------
-- 5. Trigger Testing & Verification
-- ----------------------------------------------------------------------------

-- Test 1: Verify Negative Balance Trigger Rejection
DROP PROCEDURE IF EXISTS `sp_test_trigger_overdraft_block`;
DELIMITER //
CREATE PROCEDURE `sp_test_trigger_overdraft_block`()
BEGIN
    DECLARE v_err_caught INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err_caught = 1;

    -- Intentionally attempt illegal negative balance
    UPDATE accounts SET balance = -500.00 WHERE account_number = 'ACC-772910';

    IF v_err_caught = 1 THEN
        SELECT 'SUCCESS: Negative balance was strictly rejected by trg_prevent_negative_balance' AS test_result;
    ELSE
        SELECT 'FAIL: Negative balance was permitted!' AS test_result;
    END IF;
END //
DELIMITER ;

CALL sp_test_trigger_overdraft_block();
DROP PROCEDURE IF EXISTS `sp_test_trigger_overdraft_block`;

-- Test 2: Verify Lifecycle Status Transition Trigger
UPDATE accounts SET status = 'Frozen' WHERE account_number = 'ACC-553102';
UPDATE accounts SET status = 'Active' WHERE account_number = 'ACC-553102';

-- Test 3: Verify Audit Log Output
SELECT log_id, action, entity_id, details, timestamp 
FROM audit_logs 
WHERE action = 'ACCOUNT_STATUS_TRANSITION' 
ORDER BY timestamp DESC 
LIMIT 2;
