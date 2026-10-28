-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 08: ACID TRANSACTIONS, CONCURRENCY & LOCKING (MySQL 8.0+)
-- ============================================================================

-- Note: Database context must be explicitly selected by the caller (e.g. USE <database>; or via connection pool/CLI).
-- Do NOT hardcode 'USE bankist;' here to prevent accidental mutation of live environments during test/disposable setups.

-- ----------------------------------------------------------------------------
-- 1. Atomicity & Savepoints: Multi-Step Transfer with Partial Rollback
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_demo_savepoint_rollback`;
DELIMITER //
CREATE PROCEDURE `sp_demo_savepoint_rollback`()
BEGIN
    DECLARE v_initial_sender_bal DECIMAL(15,2);
    DECLARE v_final_sender_bal DECIMAL(15,2);

    START TRANSACTION;
        -- Step 1: Query initial state
        SELECT balance INTO v_initial_sender_bal FROM accounts WHERE account_number = 'ACC-772910' FOR UPDATE;

        -- Step 2: Debit fee of 50.00
        UPDATE accounts SET balance = balance - 50.00 WHERE account_number = 'ACC-772910';
        SAVEPOINT fee_debited;

        -- Step 3: Attempt speculative secondary processing (e.g., penalty charge of 1000)
        UPDATE accounts SET balance = balance - 1000.00 WHERE account_number = 'ACC-772910';

        -- Step 4: Business logic decides penalty was erroneous; Rollback to Savepoint!
        ROLLBACK TO SAVEPOINT fee_debited;

        -- Step 5: Commit the transaction (only the 50.00 fee persists)
    COMMIT;

    SELECT balance INTO v_final_sender_bal FROM accounts WHERE account_number = 'ACC-772910';

    SELECT 
        v_initial_sender_bal AS initial_balance,
        v_final_sender_bal AS final_balance,
        (v_initial_sender_bal - v_final_sender_bal) AS net_deducted_should_be_50;
END //
DELIMITER ;

CALL sp_demo_savepoint_rollback();
DROP PROCEDURE IF EXISTS `sp_demo_savepoint_rollback`;

-- ----------------------------------------------------------------------------
-- 2. Atomicity Test: Deliberate Mid-Transaction Failure Driven Rollback
-- (Proves zero partial debit or orphaned ledger entries on failure)
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_test_failure_driven_rollback`;
DELIMITER //
CREATE PROCEDURE `sp_test_failure_driven_rollback`()
BEGIN
    DECLARE v_bal_before DECIMAL(15,2);
    DECLARE v_bal_after DECIMAL(15,2);
    DECLARE v_txns_before INT;
    DECLARE v_txns_after INT;

    SELECT balance INTO v_bal_before FROM accounts WHERE account_number = 'ACC-772910';
    SELECT COUNT(*) INTO v_txns_before FROM transactions;

    -- Intentionally execute block that fails halfway
    BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
        END;

        START TRANSACTION;
            -- Step 1: Debit sender
            UPDATE accounts SET balance = balance - 500.00 WHERE account_number = 'ACC-772910';

            -- Step 2: Deliberately induce failure (Division by zero / syntax error / non-existent table)
            INSERT INTO non_existent_audit_table VALUES (1, 2, 3);

            -- Step 3: Credit receiver (Unreachable)
            UPDATE accounts SET balance = balance + 500.00 WHERE account_number = 'ACC-553102';
        COMMIT;
    END;

    SELECT balance INTO v_bal_after FROM accounts WHERE account_number = 'ACC-772910';
    SELECT COUNT(*) INTO v_txns_after FROM transactions;

    IF (v_bal_before = v_bal_after) AND (v_txns_before = v_txns_after) THEN
        SELECT 'SUCCESS: Transaction completely rolled back; Zero partial debit occurred!' AS test_atomicity_result;
    ELSE
        SELECT 'FAIL: Inconsistent partial state detected!' AS test_atomicity_result;
    END IF;
END //
DELIMITER ;

CALL sp_test_failure_driven_rollback();
DROP PROCEDURE IF EXISTS `sp_test_failure_driven_rollback`;

-- ----------------------------------------------------------------------------
-- 3. Consistency Invariant: Bank Net Worth Preservation (Conservation of Money)
-- ----------------------------------------------------------------------------
SELECT 
    'TOTAL_SYSTEM_LIQUID_ASSETS' AS metric,
    SUM(balance) AS total_vault_rupees,
    COUNT(*) AS total_accounts
FROM accounts;

-- ----------------------------------------------------------------------------
-- 4. Isolation Levels & MVCC (Multi-Version Concurrency Control)
-- ----------------------------------------------------------------------------
-- Display active global and session transaction isolation level
SELECT 
    @@GLOBAL.transaction_isolation AS global_isolation_level,
    @@SESSION.transaction_isolation AS session_isolation_level;

-- ----------------------------------------------------------------------------
-- 5. Canonical Locking Rule: Deadlock Prevention via Sorted Account Locking
-- When transferring between Account A and Account B, lock the account with the 
-- lexicographically smaller account number first, regardless of transfer direction.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_transfer_deadlock_free`;
DELIMITER //
CREATE PROCEDURE `sp_transfer_deadlock_free`(
    IN p_acc_from VARCHAR(50),
    IN p_acc_to VARCHAR(50),
    IN p_amount DECIMAL(15,2)
)
BEGIN
    DECLARE v_first_acc VARCHAR(50);
    DECLARE v_second_acc VARCHAR(50);

    -- Sort account identifiers canonically
    IF p_acc_from < p_acc_to THEN
        SET v_first_acc = p_acc_from;
        SET v_second_acc = p_acc_to;
    ELSE
        SET v_first_acc = p_acc_to;
        SET v_second_acc = p_acc_from;
    END IF;

    START TRANSACTION;
        -- Lock row 1
        SELECT balance FROM accounts WHERE account_number = v_first_acc FOR UPDATE;
        -- Lock row 2
        SELECT balance FROM accounts WHERE account_number = v_second_acc FOR UPDATE;

        -- Perform actual transfer safely
        UPDATE accounts SET balance = balance - p_amount WHERE account_number = p_acc_from;
        UPDATE accounts SET balance = balance + p_amount WHERE account_number = p_acc_to;
    COMMIT;

    SELECT 'SUCCESS: Deadlock-free transfer completed' AS result;
END //
DELIMITER ;

CALL sp_transfer_deadlock_free('ACC-772910', 'ACC-553102', 10.00);
DROP PROCEDURE IF EXISTS `sp_transfer_deadlock_free`;
