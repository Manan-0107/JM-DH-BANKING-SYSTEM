# BHARAT TRUST BANK (BTB) — COLLEGE DEMO & VIVA SETUP GUIDE
## Step-by-Step Lab Demonstration, Test Execution & Viva Defense Reference

- **Project:** Bharat Trust Bank (BTB) / Bankist Banking Management System
- **Database Engine:** MySQL 8.0.42 Community Server
- **Full-Stack Framework:** Next.js 15.5.28 (React 19, TypeScript, Node.js)
- **Authoritative SQL Demo Script:** `DBMS_LAB_FINAL.sql`
- **Automated Verification Runner:** `scripts/test_college_demo.js`

---

## 1. System Prerequisites

Ensure the following environments are active before beginning the demonstration:
1. **Operating System:** Windows 10/11, Linux, or macOS.
2. **Database Engine:** MySQL 8.0+ running on `127.0.0.1:3306`.
3. **Runtime Engine:** Node.js v18.0+ / npm v9.0+.
4. **Target Demo Database:** `bankist_college_demo` (created automatically by `DBMS_LAB_FINAL.sql`).
5. **Live Database:** `bankist` (preserved and protected).

---

## 2. Fast Demonstration Execution (One-Click)

To run the complete end-to-end college demonstration (both SQL Lab file tests and full-stack API workflows), run:

```powershell
node scripts/test_college_demo.js
```

### Expected Output Summary:
```
======================================================
   PART 1: DIRECT EXECUTION OF DBMS_LAB_FINAL.sql     
======================================================
[PASS] Exactly 2 demo accounts verified
[PASS] ACC-1001 balance after test sequence: ₹5500.00 === ₹5,500.00
[PASS] ACC-1002 balance after test sequence: ₹2500.00 === ₹2,500.00
[PASS] Exactly 2 transactions (1 deposit, 1 transfer) recorded in ledger: 2
[SUCCESS] PART 1: DBMS_LAB_FINAL.sql executed and verified with 100% compliance!

======================================================
   PART 2: FULL-STACK APPLICATION DEMO VERIFICATION   
======================================================
--- DEMO TEST 1: Authentication & Authorization ---
[PASS] Valid credentials login returned HTTP 200 OK
[PASS] Session JWT token issued successfully
[PASS] Authenticated customer matches CUST-101 (Aarav Patel)
[PASS] Invalid credentials rejected with HTTP 401 Unauthorized

--- DEMO TEST 2: Valid Deposit (₹1,000.00) ---
[PASS] Deposit request returned HTTP 200 OK
[PASS] Balance updated correctly
[PASS] Deposit reference number issued

--- DEMO TEST 3: Valid Fund Transfer (₹500.00) ---
[PASS] Transfer request returned HTTP 200 OK
[PASS] Sender balance accurately debited by ₹500
[PASS] Transfer reference number issued

--- DEMO TEST 4: Rejecting Invalid Deposit (₹-500.00) ---
[PASS] Negative deposit strictly rejected with HTTP 400 Bad Request

--- DEMO TEST 5: Rejecting Insufficient Funds Transfer ---
[PASS] Overdraft transfer strictly rejected with HTTP 400 Bad Request

--- DEMO TEST 6: Atomic Transaction Rollback Invariant ---
[PASS] Transaction exception deliberately caught and triggered ROLLBACK
[PASS] Balance completely restored after rollback
======================================================
   ALL 7 COLLEGE DEMO REQUIREMENTS VERIFIED 100%      
======================================================
```

---

## 3. Manual Step-by-Step Viva Demonstration

If presenting the project live to professors or evaluators, follow these exact manual steps:

### Step 1: Demonstrate Pure Database Normalization & Lab SQL
Run `DBMS_LAB_FINAL.sql` directly into MySQL from the terminal:

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p < DBMS_LAB_FINAL.sql
```
*(When prompted, enter MySQL root password `Manan@011207`)*

**What this demonstrates to the professor:**
- Creates a clean BCNF database `bankist_college_demo`.
- Builds all 13 normalized tables with foreign keys and cascade constraints.
- Builds 5 non-blocking SQL views (including Error 1055-free window aggregate nominee view).
- Compiles 2 atomic stored procedures (`sp_deposit_funds` and `sp_transfer_funds`).
- Populates seed data for Aarav Patel (`ACC-1001`, initial ₹5,000) and Priya Nair (`ACC-1002`, initial ₹2,000).
- Runs 7 live SQL tests directly inside the console, displaying formatted tabular balance transformations.

---

### Step 2: Start the Next.js Production Banking Server
Open a dedicated terminal and run:

```powershell
cd "DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test"
npm run start
```

The portal starts on `http://localhost:3000`. Open your browser to `http://localhost:3000` to show the active Bharat Trust Bank (BTB) interface.

---

### Step 3: Interactive Demo Walkthrough & Test Credentials

Use the following pre-configured credentials in the web UI:

| User Role | Customer Name | Email / User ID | Password / PIN | Account Number | Initial Balance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Customer** | Aarav Patel | `aarav@example.com` | `1234` | Primary Account | ₹333,362.60 |
| **Beneficiary** | Priya Nair | `priya@example.com` | `1234` | Target Account | ₹305,328.79 |
| **Lab Demo Account 1** | Aarav Patel | `CUST-101` | `1234` | `ACC-1001` | ₹5,000.00 |
| **Lab Demo Account 2** | Priya Nair | `CUST-102` | `1234` | `ACC-1002` | ₹2,000.00 |

#### Demonstration Scenarios:
1. **Secure Customer Login:**
   - Go to `http://localhost:3000/personal` or login modal.
   - Enter `aarav@example.com` and password `1234`.
   - Show that JWT token and authenticated customer profile are loaded with active accounts.
   - Intentionally type `wrongpassword` to show instant `HTTP 401 Unauthorized` and lockout security logging.
2. **Execute Deposit Operation:**
   - In Aarav's dashboard, initiate a deposit of ₹1,000.
   - Show that the account balance increments by ₹1,000.
   - Show the newly generated transaction reference number in the transaction history.
3. **Execute Inter-Account Fund Transfer:**
   - Transfer ₹500 from Aarav's account to Priya's account (`ACC-1002` or `ACC-770358`).
   - Enter card PIN `1234`.
   - Show that Aarav's balance decrements by ₹500, Priya's balance increments by ₹500, and an immutable transaction ledger entry is created.
4. **Negative Input & Overdraft Rejection:**
   - Attempt a deposit with `-500`: System displays error `"Amount must be strictly greater than zero"`.
   - Attempt a transfer exceeding balance: System displays error `"Insufficient funds"`.
5. **ACID Transaction Rollback:**
   - Explain how `START TRANSACTION` ... `ROLLBACK` guarantees that any failure between debit and credit cancels both operations, leaving total bank liquidity unchanged.

---

## 4. Key Viva Questions & Model Answers

### Q1: Why did you normalize the database to BCNF instead of stopping at 3NF?
> **Answer:** "A table is in 3NF if for every functional dependency $X \to Y$, either $Y$ is a prime attribute or $X$ is a superkey. However, 3NF allows non-trivial dependencies where $X$ is not a superkey if $Y$ is prime. This permits redundancies and update anomalies when overlapping candidate keys exist. Boyce-Codd Normal Form (BCNF) enforces a strictly stronger condition: for every non-trivial functional dependency $X \to Y$, $X$ must be a superkey. In our banking system, card credentials, customer nominees, and account associations have been decomposed so that every determinant is a superkey, completely eliminating insertion, update, and deletion anomalies."

### Q2: How does the system handle concurrent fund transfers without causing deadlocks?
> **Answer:** "In stored procedure `sp_transfer_funds`, if User A transfers to User B while User B concurrently transfers to User A, an unordered `SELECT ... FOR UPDATE` could result in a cyclical lock wait (deadlock). To prevent this, we implemented **lexicographical lock ordering**:
> ```sql
> IF p_sender_acc < p_receiver_acc THEN
>     SELECT balance FROM accounts WHERE account_number = p_sender_acc FOR UPDATE;
>     SELECT balance FROM accounts WHERE account_number = p_receiver_acc FOR UPDATE;
> ELSE
>     SELECT balance FROM accounts WHERE account_number = p_receiver_acc FOR UPDATE;
>     SELECT balance FROM accounts WHERE account_number = p_sender_acc FOR UPDATE;
> END IF;
> ```
> Because every concurrent transaction acquires locks in the exact same alphanumeric order, circular wait graph cycles are mathematically impossible, guaranteeing deadlock-free execution."

### Q3: What caused MySQL Error 1055 (`ONLY_FULL_GROUP_BY`) and how did you resolve it?
> **Answer:** "MySQL 8.0 enables `ONLY_FULL_GROUP_BY` by default under SQL strict mode. In legacy queries, `customer_nominees` was queried using `SELECT customer_id, nominee_name ... GROUP BY customer_id`. Because `nominee_name` was neither in the `GROUP BY` clause nor wrapped in an aggregate function like `MAX()` or `ANY_VALUE()`, MySQL rejected it with Error 1055. We resolved this deterministically by using a Common Table Expression (CTE) with the `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY nominee_id)` window function to select exactly the primary nominee without nondeterminism or SQL syntax errors."

### Q4: How is ACID compliance maintained across financial transactions?
> **Answer:** 
> - **Atomicity:** All debits, credits, and ledger insertions are enclosed within `START TRANSACTION` and `COMMIT`. Any error triggers an `EXIT HANDLER FOR SQLEXCEPTION` executing `ROLLBACK`.
> - **Consistency:** Schema-level `CHECK (balance >= 0)` and foreign keys prevent invalid database states.
> - **Isolation:** `SELECT ... FOR UPDATE` row-level exclusive locks isolate concurrent updates.
> - **Durability:** The InnoDB ACID storage engine guarantees committed transactions persist via write-ahead logging (WAL) and redo logs.

