-- ============================================================================
-- BHARAT TRUST BANK (BTB) - NORMALIZATION VALIDATION & INTEGRITY TEST SUITE
-- Target RDBMS: MySQL 8.0+ Enterprise
-- File: bankist_normalization_tests.sql
-- Version: 2.1 (Full Integrity, Zero Fabrication, Financial Parity)
-- ============================================================================
--
-- Instructions:
-- Execute this test script inside the target disposable database containing
-- the normalized schema and migrated data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TEST GROUP 1: Core Relational Base Tables Existence (13 Base Tables)
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
    'branches', 'customers', 'customer_nominees', 'accounts', 'account_card_credentials',
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
    10 AS expected,
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
    'T04C_ORPHAN_CARD_CREDENTIALS_ACCOUNT' AS test_name,
    0 AS expected_orphans,
    COUNT(*) AS actual_orphans,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `account_card_credentials` c
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
    0 AS expected_plaintext_count,
    COUNT(*) AS actual_plaintext_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts`
WHERE `card_pin` IS NOT NULL AND `card_pin` != '';

SELECT 
    'T05B_SECURITY_NO_PLAINTEXT_OTP' AS test_name,
    0 AS expected_plaintext_count,
    COUNT(*) AS actual_plaintext_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `otp_sessions`
WHERE `otp_code` IS NOT NULL AND `otp_code` != '';

SELECT 
    'T05C_SECURITY_BCRYPT_PIN_HASH_INTEGRITY' AS test_name,
    0 AS invalid_pin_hashes,
    COUNT(*) AS actual_invalid,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `account_card_credentials`
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
-- TEST GROUP 7: Data Preservation & Financial Conservation
-- ----------------------------------------------------------------------------
SELECT 
    'T07A_BALANCE_SUM_CONSERVATION' AS test_name,
    19155216.07 AS expected_sum,
    ROUND(SUM(balance), 2) AS actual_sum,
    CASE WHEN ABS(ROUND(SUM(balance), 2) - 19155216.07) < 0.01 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts`;

SELECT 
    'T07B_TXN_AMOUNT_SUM_CONSERVATION' AS test_name,
    6891891.26 AS expected_sum,
    ROUND(SUM(amount), 2) AS actual_sum,
    CASE WHEN ABS(ROUND(SUM(amount), 2) - 6891891.26) < 0.01 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `transactions`;

SELECT 
    'T07C_DEP_PRINCIPAL_SUM_CONSERVATION' AS test_name,
    2505000.00 AS expected_sum,
    ROUND(SUM(principal_amount), 2) AS actual_sum,
    CASE WHEN ABS(ROUND(SUM(principal_amount), 2) - 2505000.00) < 0.01 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `deposits`;

SELECT 
    'T07D_CUSTOMERS_COUNT' AS test_name,
    124 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 124 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `customers`;

SELECT 
    'T07E_ACCOUNTS_COUNT' AS test_name,
    208 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 208 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `accounts`;

SELECT 
    'T07F_TRANSACTIONS_COUNT' AS test_name,
    782 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 782 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `transactions`;

SELECT 
    'T07G_DEPOSITS_COUNT' AS test_name,
    74 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 74 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `deposits`;

SELECT 
    'T07H_KYC_VERIFICATIONS_COUNT' AS test_name,
    815 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 815 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `kyc_verifications`;

SELECT 
    'T07I_BENEFICIARIES_COUNT' AS test_name,
    99 AS expected_count,
    COUNT(*) AS actual_count,
    CASE WHEN COUNT(*) = 99 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `beneficiaries`;

SELECT 
    'T07J_CARD_CREDENTIALS_COUNT' AS test_name,
    208 AS expected_credentials,
    COUNT(*) AS actual_credentials,
    CASE WHEN COUNT(*) = 208 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `account_card_credentials`;

SELECT 
    'T07K_CUSTOMER_NOMINEES_COUNT' AS test_name,
    8 AS expected_nominees,
    COUNT(*) AS actual_nominees,
    CASE WHEN COUNT(*) = 8 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `customer_nominees`;

SELECT 
    'T07L_LIENS_COUNT' AS test_name,
    15 AS expected_liens,
    COUNT(*) AS actual_liens,
    CASE WHEN COUNT(*) = 15 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `account_lien_records`;

-- ----------------------------------------------------------------------------
-- TEST GROUP 8: Transaction Counterparty Preservation
-- ----------------------------------------------------------------------------
SELECT 
    'T08A_PRESERVED_UPI_SENDERS' AS test_name,
    30 AS expected_upi_txns,
    COUNT(*) AS actual_upi_txns,
    CASE WHEN COUNT(*) = 30 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `transactions`
WHERE `sender_account` LIKE '%@%';

-- ----------------------------------------------------------------------------
-- TEST GROUP 9: Backward-Compatibility Views Functionality
-- ----------------------------------------------------------------------------
SELECT 
    'T09A_VIEW_ACCOUNTS_LEGACY_PARITY' AS test_name,
    208 AS expected_rows,
    COUNT(*) AS actual_rows,
    SUM(CASE WHEN branch_name IS NULL OR branch_name = '' THEN 1 ELSE 0 END) AS null_branch_names,
    CASE WHEN COUNT(*) = 208 AND SUM(CASE WHEN branch_name IS NULL OR branch_name = '' THEN 1 ELSE 0 END) = 0 
         THEN 'PASS' ELSE 'FAIL' END AS status
FROM `v_accounts_legacy`;

SELECT 
    'T09B_VIEW_CUSTOMERS_LEGACY_NOMINEE_COUNT' AS test_name,
    8 AS expected_nominees_joined,
    COUNT(nominee_name) AS actual_nominees_joined,
    CASE WHEN COUNT(nominee_name) = 8 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `v_customers_legacy`
WHERE nominee_name IS NOT NULL AND nominee_name != '';

SELECT 
    'T09C_VIEW_PORTFOLIO_LIQUID_BALANCE' AS test_name,
    19155216.07 AS expected_sum,
    ROUND(SUM(total_liquid_balance), 2) AS actual_sum,
    CASE WHEN ABS(ROUND(SUM(total_liquid_balance), 2) - 19155216.07) < 0.01 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `v_customer_portfolio`;

-- ============================================================================
SELECT 
    'T09D_VIEW_CUSTOMERS_ONLY_FULL_GROUP_BY_STRICT' AS test_name,
    124 AS expected_rows,
    COUNT(*) AS actual_rows,
    CASE WHEN COUNT(*) = 124 THEN 'PASS' ELSE 'FAIL' END AS status
FROM `v_customers_legacy`;

SELECT 
    'T09E_VIEW_CUSTOMERS_AT_MOST_ONE_ROW_PER_CUSTOMER' AS test_name,
    0 AS duplicate_customer_rows,
    COUNT(*) AS actual_duplicates,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
    SELECT customer_id, COUNT(*) as cnt 
    FROM `v_customers_legacy` 
    GROUP BY customer_id 
    HAVING COUNT(*) > 1
) dup;

-- END OF VALIDATION TESTS
-- ============================================================================
