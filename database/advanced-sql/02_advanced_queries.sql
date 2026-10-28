-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 02: ADVANCED SQL QUERIES (MySQL 8.0+)
-- Features: Joins, Subqueries, CTEs, Recursive CTEs, Window Functions, Sets
-- ============================================================================

-- Note: Database context must be explicitly selected by the caller (e.g. USE <database>; or via connection pool/CLI).
-- Do NOT hardcode 'USE bankist;' here to prevent accidental mutation of live environments during test/disposable setups.

-- ----------------------------------------------------------------------------
-- 1. Multi-Table INNER & LEFT Joins: Comprehensive Customer Asset Profile
-- ----------------------------------------------------------------------------
SELECT 
    c.customer_id,
    c.full_name,
    c.tier,
    c.credit_score,
    a.account_number,
    a.account_type,
    a.balance AS liquid_balance,
    b.branch_name,
    b.city AS branch_city,
    COALESCE(d.total_deposit_principal, 0.00) AS total_deposits
FROM customers c
INNER JOIN accounts a ON c.customer_id = a.customer_id
LEFT JOIN branches b ON a.ifsc_code = b.ifsc_code
LEFT JOIN (
    SELECT customer_id, SUM(principal_amount) AS total_deposit_principal
    FROM deposits 
    WHERE status = 'Active'
    GROUP BY customer_id
) d ON c.customer_id = d.customer_id
WHERE a.status = 'Active'
ORDER BY c.customer_id, a.account_number;

-- ----------------------------------------------------------------------------
-- 2. Self-Join: Identifying Potential Fraudulent Internal Transactions
-- (Detecting transfers between accounts belonging to the same customer)
-- ----------------------------------------------------------------------------
SELECT 
    t.transaction_id,
    t.amount,
    t.date_time,
    a1.account_number AS source_acc,
    a2.account_number AS dest_acc,
    c.customer_id,
    c.full_name AS customer_name
FROM transactions t
INNER JOIN accounts a1 ON t.sender_account = a1.account_number
INNER JOIN accounts a2 ON t.receiver_account = a2.account_number
INNER JOIN customers c ON a1.customer_id = c.customer_id AND a2.customer_id = c.customer_id
WHERE a1.account_number <> a2.account_number;

-- ----------------------------------------------------------------------------
-- 3. Correlated Subquery: Accounts with Balances Exceeding Their Branch Average
-- ----------------------------------------------------------------------------
SELECT 
    a.account_number,
    a.customer_id,
    a.branch_name,
    a.balance,
    ROUND((
        SELECT AVG(sub.balance) 
        FROM accounts sub 
        WHERE sub.ifsc_code = a.ifsc_code AND sub.status = 'Active'
    ), 2) AS branch_average_balance,
    ROUND(a.balance - (
        SELECT AVG(sub.balance) 
        FROM accounts sub 
        WHERE sub.ifsc_code = a.ifsc_code AND sub.status = 'Active'
    ), 2) AS surplus_over_average
FROM accounts a
WHERE a.status = 'Active'
  AND a.balance > (
      SELECT AVG(sub.balance) 
      FROM accounts sub 
      WHERE sub.ifsc_code = a.ifsc_code AND sub.status = 'Active'
  )
ORDER BY surplus_over_average DESC;

-- ----------------------------------------------------------------------------
-- 4. EXISTS & NOT EXISTS: Active Customers Without Any Term Deposits
-- ----------------------------------------------------------------------------
SELECT 
    c.customer_id,
    c.full_name,
    c.email,
    c.phone,
    c.tier
FROM customers c
WHERE c.status = 'Active'
  AND NOT EXISTS (
      SELECT 1 
      FROM deposits d 
      WHERE d.customer_id = c.customer_id 
        AND d.status = 'Active'
  );

-- ----------------------------------------------------------------------------
-- 5. GROUP BY with HAVING & Aggregations: High-Exposure Branches
-- (Branches with total deposits exceeding 50,000 and at least 1 active account)
-- ----------------------------------------------------------------------------
SELECT 
    b.ifsc_code,
    b.branch_name,
    b.city,
    COUNT(a.account_number) AS active_account_count,
    ROUND(SUM(a.balance), 2) AS total_vault_holdings,
    ROUND(AVG(a.balance), 2) AS average_account_holding,
    ROUND(MAX(a.balance), 2) AS max_single_holding
FROM branches b
JOIN accounts a ON b.ifsc_code = a.ifsc_code
WHERE a.status = 'Active'
GROUP BY b.ifsc_code, b.branch_name, b.city
HAVING SUM(a.balance) >= 50000.00
ORDER BY total_vault_holdings DESC;

-- ----------------------------------------------------------------------------
-- 6. UNION ALL: Unified Financial Passbook (Debits & Credits in Single Ledger)
-- ----------------------------------------------------------------------------
(
    SELECT 
        transaction_id,
        date_time,
        sender_account AS account_involved,
        'DEBIT' AS entry_type,
        amount,
        description
    FROM transactions
    WHERE sender_account IS NOT NULL
)
UNION ALL
(
    SELECT 
        transaction_id,
        date_time,
        receiver_account AS account_involved,
        'CREDIT' AS entry_type,
        amount,
        description
    FROM transactions
    WHERE receiver_account IS NOT NULL
)
ORDER BY date_time DESC
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 7. Common Table Expressions (CTEs): High-Tier Customer Balance Contribution
-- ----------------------------------------------------------------------------
WITH CustomerTotals AS (
    SELECT 
        c.customer_id,
        c.full_name,
        c.tier,
        COALESCE(SUM(a.balance), 0.00) AS total_balance
    FROM customers c
    LEFT JOIN accounts a ON c.customer_id = a.customer_id AND a.status = 'Active'
    GROUP BY c.customer_id, c.full_name, c.tier
),
BankTotal AS (
    SELECT SUM(total_balance) AS grand_total_assets FROM CustomerTotals
)
SELECT 
    ct.customer_id,
    ct.full_name,
    ct.tier,
    ct.total_balance,
    ROUND((ct.total_balance / bt.grand_total_assets) * 100, 2) AS asset_percentage
FROM CustomerTotals ct
CROSS JOIN BankTotal bt
ORDER BY ct.total_balance DESC;

-- ----------------------------------------------------------------------------
-- 8. Recursive CTE: 12-Month Compound Interest Growth Projection Schedule
-- ----------------------------------------------------------------------------
WITH RECURSIVE MonthlyAccrual AS (
    -- Anchor Member: Month 1
    SELECT 
        1 AS month_number,
        CAST(100000.00 AS DECIMAL(15,2)) AS opening_principal,
        CAST(ROUND(100000.00 * (0.075 / 12), 2) AS DECIMAL(15,2)) AS interest_accrued,
        CAST(ROUND(100000.00 + (100000.00 * (0.075 / 12)), 2) AS DECIMAL(15,2)) AS closing_balance
    UNION ALL
    -- Recursive Member: Months 2 through 12
    SELECT 
        month_number + 1,
        closing_balance,
        CAST(ROUND(closing_balance * (0.075 / 12), 2) AS DECIMAL(15,2)),
        CAST(ROUND(closing_balance + (closing_balance * (0.075 / 12)), 2) AS DECIMAL(15,2))
    FROM MonthlyAccrual
    WHERE month_number < 12
)
SELECT 
    month_number AS `Month`,
    opening_principal AS `Opening Balance (INR)`,
    interest_accrued AS `Monthly Interest (7.5% p.a.)`,
    closing_balance AS `Projected End Balance (INR)`
FROM MonthlyAccrual;

-- ----------------------------------------------------------------------------
-- 9. Window Functions: ROW_NUMBER, DENSE_RANK, Running Balance, LAG & LEAD
-- ----------------------------------------------------------------------------
SELECT 
    t.transaction_id,
    t.date_time,
    t.sender_account,
    t.receiver_account,
    t.amount,
    -- 1. Partitioned sequential row numbering
    ROW_NUMBER() OVER (
        PARTITION BY COALESCE(t.sender_account, t.receiver_account) 
        ORDER BY t.date_time
    ) AS account_txn_sequence,
    -- 2. Dense rank of transaction value across entire bank
    DENSE_RANK() OVER (ORDER BY t.amount DESC) AS global_amount_rank,
    -- 3. Running cumulative transaction volume per account
    SUM(t.amount) OVER (
        PARTITION BY COALESCE(t.sender_account, t.receiver_account) 
        ORDER BY t.date_time 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_volume,
    -- 4. LAG: Previous transaction amount for velocity anomaly detection
    LAG(t.amount, 1, 0.00) OVER (
        PARTITION BY COALESCE(t.sender_account, t.receiver_account) 
        ORDER BY t.date_time
    ) AS prev_transaction_amount,
    -- 5. LEAD: Next transaction amount
    LEAD(t.amount, 1, 0.00) OVER (
        PARTITION BY COALESCE(t.sender_account, t.receiver_account) 
        ORDER BY t.date_time
    ) AS next_transaction_amount
FROM transactions t
ORDER BY date_time DESC
LIMIT 15;
