-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 06: RELATIONAL ALGEBRA & CALCULUS MAPPING (MySQL 8.0+)
-- Academic Query Theory: Mapping Formal Relational Operations to SQL
-- ============================================================================

USE `bankist`;

-- ----------------------------------------------------------------------------
-- Operation 1: Selection (σ)
-- Business Question: Find all customers in the 'Platinum' or 'VIP' tier with CIBIL score >= 780.
-- Relational Algebra: σ_{tier ∈ {'Platinum', 'VIP'} ∧ credit_score ≥ 780}(CUSTOMERS)
-- ----------------------------------------------------------------------------
SELECT customer_id, full_name, email, tier, credit_score
FROM customers
WHERE tier IN ('Platinum', 'VIP') AND credit_score >= 780;

-- ----------------------------------------------------------------------------
-- Operation 2: Projection (π)
-- Business Question: Retrieve all distinct branches and their operating cities.
-- Relational Algebra: π_{branch_name, city, ifsc_code}(BRANCHES)
-- ----------------------------------------------------------------------------
SELECT DISTINCT branch_name, city, ifsc_code
FROM branches;

-- ----------------------------------------------------------------------------
-- Operation 3: Natural / Equi-Join (⋈)
-- Business Question: Retrieve active accounts alongside their customer profile.
-- Relational Algebra: π_{customer_id, full_name, account_number, balance}(CUSTOMERS ⋈_{CUSTOMERS.customer_id = ACCOUNTS.customer_id} ACCOUNTS)
-- ----------------------------------------------------------------------------
SELECT 
    c.customer_id, 
    c.full_name, 
    a.account_number, 
    a.balance
FROM customers c
INNER JOIN accounts a ON c.customer_id = a.customer_id
WHERE a.status = 'Active';

-- ----------------------------------------------------------------------------
-- Operation 4: Theta-Join (⋈_θ)
-- Business Question: Match customers with loan offers where sanctioned amount <= 30% of liquid balance.
-- Relational Algebra: CUSTOMERS ⋈_{ACCOUNTS.balance > 100000 ∧ CUSTOMERS.credit_score ≥ 750} ACCOUNTS
-- ----------------------------------------------------------------------------
SELECT 
    c.customer_id,
    c.full_name,
    c.credit_score,
    a.account_number,
    a.balance,
    ROUND(a.balance * 0.30, 2) AS eligible_instant_credit_limit
FROM customers c
INNER JOIN accounts a ON c.customer_id = a.customer_id
WHERE a.balance > 100000.00 AND c.credit_score >= 750;

-- ----------------------------------------------------------------------------
-- Operation 5: Set Union (∪)
-- Business Question: Retrieve all unique account numbers that have participated in any transaction (either as sender or receiver).
-- Relational Algebra: π_{sender_account}(TRANSACTIONS) ∪ π_{receiver_account}(TRANSACTIONS)
-- ----------------------------------------------------------------------------
SELECT sender_account AS active_account FROM transactions WHERE sender_account IS NOT NULL
UNION
SELECT receiver_account AS active_account FROM transactions WHERE receiver_account IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Operation 6: Set Difference (−)
-- Business Question: Find all customers who have opened accounts but NEVER booked a term deposit.
-- Relational Algebra: π_{customer_id}(CUSTOMERS) − π_{customer_id}(DEPOSITS)
-- SQL Equivalents: EXCEPT (standard) / NOT IN / LEFT JOIN IS NULL
-- ----------------------------------------------------------------------------
SELECT customer_id, full_name, email
FROM customers
WHERE customer_id NOT IN (
    SELECT customer_id FROM deposits WHERE customer_id IS NOT NULL
);

-- Alternative using MySQL 8.0 EXCEPT syntax:
SELECT customer_id FROM customers
EXCEPT
SELECT customer_id FROM deposits;

-- ----------------------------------------------------------------------------
-- Operation 7: Set Intersection (∩)
-- Business Question: Find customers who have both an active Savings Account AND an active Current Account.
-- Relational Algebra: π_{customer_id}(σ_{account_type = 'Savings Account'}(ACCOUNTS)) ∩ π_{customer_id}(σ_{account_type = 'Current Account'}(ACCOUNTS))
-- ----------------------------------------------------------------------------
SELECT customer_id FROM accounts WHERE account_type = 'Savings Account'
INTERSECT
SELECT customer_id FROM accounts WHERE account_type = 'Current Account';

-- ----------------------------------------------------------------------------
-- Operation 8: Cartesian Product (×)
-- Business Question: Generate all theoretical combinations of customer tiers and deposit tenures for marketing tariff analysis.
-- Relational Algebra: π_{tier}(CUSTOMERS) × π_{tenure_months}(DEPOSITS)
-- ----------------------------------------------------------------------------
SELECT DISTINCT c.tier, d.tenure_months
FROM customers c
CROSS JOIN deposits d
ORDER BY c.tier, d.tenure_months;

-- ----------------------------------------------------------------------------
-- Operation 9: Relational Division (÷)
-- Business Question: Find customers who hold an account in ALL branches located in 'Mumbai'.
-- Relational Algebra:
-- Let R = π_{customer_id, ifsc_code}(ACCOUNTS)
-- Let S = π_{ifsc_code}(σ_{city = 'Mumbai'}(BRANCHES))
-- Query: R ÷ S
-- Meaning: Find customer_id such that for all ifsc_code in S, (customer_id, ifsc_code) ∈ R.
-- SQL Formulation using double NOT EXISTS:
-- ----------------------------------------------------------------------------
SELECT c.customer_id, c.full_name
FROM customers c
WHERE NOT EXISTS (
    -- Set S: All Mumbai branches
    SELECT b.ifsc_code 
    FROM branches b 
    WHERE b.city = 'Mumbai'
      AND NOT EXISTS (
          -- Pairs in R matching customer c
          SELECT 1 
          FROM accounts a 
          WHERE a.customer_id = c.customer_id 
            AND a.ifsc_code = b.ifsc_code
      )
);

-- Alternative SQL formulation using GROUP BY & HAVING COUNT:
SELECT a.customer_id, c.full_name
FROM accounts a
JOIN customers c ON a.customer_id = c.customer_id
JOIN branches b ON a.ifsc_code = b.ifsc_code
WHERE b.city = 'Mumbai'
GROUP BY a.customer_id, c.full_name
HAVING COUNT(DISTINCT b.ifsc_code) = (
    SELECT COUNT(*) FROM branches WHERE city = 'Mumbai'
);
