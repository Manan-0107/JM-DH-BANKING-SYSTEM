-- ============================================================================
-- BHARAT TRUST BANK (BTB) - NORMALIZATION VALIDATION & INTEGRITY TEST SUITE
-- Target RDBMS: MySQL 8.0+
-- File: bankist_normalization_tests.sql
-- ============================================================================
--
-- Instructions:
-- Run this test script in the target database containing the normalized schema
-- and migrated data (e.g. `bankist_norm_test`).
--
-- Example execution:
--   mysql -u root -p <database_name> < bankist_normalization_tests.sql
-- ============================================================================

-- Set execution environment
SET @test_count = 0;
SET @pass_count = 0;
SET @fail_count = 0;

-- ----------------------------------------------------------------------------
-- TEST GROUP 1: Core Relational Tables Existence (13 Base Tables)
-- ----------------------------------------------------------------------------
SELECT 
    'T01_BASE_TABLES_COUNT' AS test_name,
    13 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 13 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_TYPE = 'BASE TABLE'
  AND TABLE_NAME IN (
    'branches', 'customers', 'customer_nominees', 'accounts', 'cards',
    'transactions', 'deposits', 'beneficiaries', 'kyc_verifications',
    'otp_sessions', 'security_rate_limits', 'account_lien_records', 'audit_logs'
  );

-- ----------------------------------------------------------------------------
-- TEST GROUP 2: Compatibility & Analytical Views Existence (6 Views)
-- ----------------------------------------------------------------------------
SELECT 
    'T02_VIEWS_COUNT' AS test_name,
    6 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 6 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'v_accounts_legacy', 'v_customers_legacy', 'v_customer_portfolio',
    'v_high_value_transactions', 'v_active_deposits_summary', 'v_branch_performance'
  );

-- ----------------------------------------------------------------------------
-- TEST GROUP 3: Foreign Key Constraints Count
-- ----------------------------------------------------------------------------
SELECT 
    'T03_FOREIGN_KEYS_ENFORCED' AS test_name,
    '>= 10' AS expected,
    COUNT(*) AS actual_foreign_keys,
    CASE WHEN COUNT(*) >= 10 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';

-- ----------------------------------------------------------------------------
-- TEST GROUP 4: Referential Integrity & Orphan Records Check (Must be 0)
-- ----------------------------------------------------------------------------
SELECT 
    'T04A_ORPHAN_ACCOUNTS_CUSTOMER' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts` a
LEFT JOIN `customers` c ON a.customer_id = c.customer_id
WHERE c.customer_id IS NULL;

SELECT 
    'T04B_ORPHAN_ACCOUNTS_BRANCH' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts` a
LEFT JOIN `branches` b ON a.ifsc_code = b.ifsc_code
WHERE b.ifsc_code IS NULL;

SELECT 
    'T04C_ORPHAN_CARDS_ACCOUNT' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `cards` c
LEFT JOIN `accounts` a ON c.account_number = a.account_number
WHERE a.account_number IS NULL;

SELECT 
    'T04D_ORPHAN_NOMINEES_CUSTOMER' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `customer_nominees` n
LEFT JOIN `customers` c ON n.customer_id = c.customer_id
WHERE c.customer_id IS NULL;

SELECT 
    'T04E_ORPHAN_DEPOSITS_ACCOUNT' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `deposits` d
LEFT JOIN `accounts` a ON d.linked_account = a.account_number
WHERE a.account_number IS NULL;

SELECT 
    'T04F_ORPHAN_BENEFICIARIES_CUSTOMER' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `beneficiaries` b
LEFT JOIN `customers` c ON b.customer_id = c.customer_id
WHERE c.customer_id IS NULL;

SELECT 
    'T04G_ORPHAN_KYC_CUSTOMER' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `kyc_verifications` k
LEFT JOIN `customers` c ON k.customer_id = c.customer_id
WHERE c.customer_id IS NULL;

SELECT 
    'T04H_ORPHAN_LIENS_ACCOUNT' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `account_lien_records` l
LEFT JOIN `accounts` a ON l.account_number = a.account_number
WHERE a.account_number IS NULL;

-- ----------------------------------------------------------------------------
-- TEST GROUP 5: Security Credential Hardening (Zero Plaintext PINs / OTPs)
-- ----------------------------------------------------------------------------
SELECT 
    'T05A_SECURITY_NO_PLAINTEXT_CARD_PINS' AS test_name,
    0 AS expected_plaintext_columns,
    COUNT(*) AS actual_plaintext_columns,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'customers' AND COLUMN_NAME = 'card_pin') OR
    (TABLE_NAME = 'accounts' AND COLUMN_NAME = 'card_pin') OR
    (TABLE_NAME = 'cards' AND COLUMN_NAME = 'card_pin')
  );

SELECT 
    'T05B_SECURITY_NO_PLAINTEXT_OTP' AS test_name,
    0 AS expected_plaintext_columns,
    COUNT(*) AS actual_plaintext_columns,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'otp_sessions' AND COLUMN_NAME = 'otp_code';

SELECT 
    'T05C_SECURITY_BCRYPT_PIN_HASH_INTEGRITY' AS test_name,
    0 AS invalid_pin_hashes,
    COUNT(*) AS actual_invalid,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `cards`
WHERE `card_pin_hash` NOT LIKE '$2a$%' AND `card_pin_hash` NOT LIKE '$2b$%';

-- ----------------------------------------------------------------------------
-- TEST GROUP 6: Domain & CHECK Constraint Invariants
-- ----------------------------------------------------------------------------
SELECT 
    'T06A_CHECK_NON_NEGATIVE_BALANCES' AS test_name,
    0 AS invalid_balances,
    COUNT(*) AS actual_invalid,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts`
WHERE balance < 0.00;

SELECT 
    'T06B_CHECK_CREDIT_SCORE_RANGE' AS test_name,
    0 AS invalid_scores,
    COUNT(*) AS actual_invalid,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `customers`
WHERE credit_score < 300 OR credit_score > 900;

SELECT 
    'T06C_CHECK_DEPOSIT_PRINCIPAL_MIN' AS test_name,
    0 AS invalid_deposits,
    COUNT(*) AS actual_invalid,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `deposits`
WHERE principal_amount < 1000.00;

SELECT 
    'T06D_CHECK_DEPOSIT_MATURITY_GTE_PRINCIPAL' AS test_name,
    0 AS invalid_maturity,
    COUNT(*) AS actual_invalid,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `deposits`
WHERE maturity_amount < principal_amount;

SELECT 
    'T06E_CHECK_TXN_AMOUNT_POSITIVE' AS test_name,
    0 AS non_positive_txns,
    COUNT(*) AS actual_non_positive,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `transactions`
WHERE amount <= 0.00;

-- ----------------------------------------------------------------------------
-- TEST GROUP 7: Data Preservation & Balance Sum Conservation
-- ----------------------------------------------------------------------------
SELECT 
    'T07A_BALANCE_SUM_CONSERVATION' AS test_name,
    19155216.07 AS expected_sum,
    ROUND(SUM(balance), 2) AS actual_sum,
    CASE WHEN ABS(ROUND(SUM(balance), 2) - 19155216.07) < 0.01 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts`;

SELECT 
    'T07B_CUSTOMERS_COUNT' AS test_name,
    124 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 124 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `customers`;

SELECT 
    'T07C_ACCOUNTS_COUNT' AS test_name,
    208 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 208 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts`;

SELECT 
    'T07D_TRANSACTIONS_COUNT' AS test_name,
    782 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 782 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `transactions`;

SELECT 
    'T07E_DEPOSITS_COUNT' AS test_name,
    74 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 74 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `deposits`;

SELECT 
    'T07F_KYC_VERIFICATIONS_COUNT' AS test_name,
    815 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 815 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `kyc_verifications`;

SELECT 
    'T07G_BENEFICIARIES_COUNT' AS test_name,
    99 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 99 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `beneficiaries`;

SELECT 
    'T07H_CARDS_PARITY_COUNT' AS test_name,
    208 AS expected_cards,
    COUNT(*) AS actual_cards,
    CASE WHEN COUNT(*) = 208 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `cards`;

-- ----------------------------------------------------------------------------
-- TEST GROUP 8: Backward-Compatibility Views Functionality
-- ----------------------------------------------------------------------------
SELECT 
    'T08A_VIEW_ACCOUNTS_LEGACY_PARITY' AS test_name,
    208 AS expected_rows,
    COUNT(*) AS actual_rows,
    SUM(CASE WHEN branch_name IS NULL OR branch_name = '' THEN 1 ELSE 0 END) AS null_branch_names,
    CASE WHEN COUNT(*) = 208 AND SUM(CASE WHEN branch_name IS NULL OR branch_name = '' THEN 1 ELSE 0 END) = 0 
         THEN 'PASS' ELSE 'FAIL' END AS status
FROM `v_accounts_legacy`;

SELECT 
    'T08B_VIEW_PORTFOLIO_LIQUID_BALANCE' AS test_name,
    19155216.07 AS expected_sum,
    ROUND(SUM(total_liquid_balance), 2) AS actual_sum,
    CASE WHEN ABS(ROUND(SUM(total_liquid_balance), 2) - 19155216.07) < 0.01 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `v_customer_portfolio`;

-- ============================================================================
-- END OF VALIDATION TESTS
-- ============================================================================
