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
- Builds 8 non-blocking SQL views (including Error 1055-free window aggregate nominee view).
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

## 4. Comprehensive College DBMS Viva Defense Q&A

### Q1: What is database normalization?
> **Answer:** Normalization is the formal process of structuring a relational database schema to eliminate data redundancy, prevent relational update anomalies (insertion, deletion, and modification anomalies), and ensure that data dependencies are logically enforced by keys.

### Q2: What are 1NF, 2NF, 3NF, and BCNF?
> **Answer:**
> - **1NF (First Normal Form):** Every table cell contains an atomic (indivisible) scalar value; there are no repeating groups or arrays.
> - **2NF (Second Normal Form):** Satisfies 1NF and contains no **partial functional dependencies**—no non-prime attribute depends on a proper subset of any composite candidate key.
> - **3NF (Third Normal Form):** Satisfies 2NF and contains no **transitive dependencies**—for every non-trivial functional dependency $X \to Y$, either $X$ is a superkey or $Y$ is a prime attribute.
> - **BCNF (Boyce-Codd Normal Form):** A strictly stronger form of 3NF where for *every* non-trivial functional dependency $X \to Y$, the determinant $X$ must be a **superkey**.

### Q3: What is a functional dependency?
> **Answer:** A functional dependency $X \to Y$ between two sets of attributes $X$ and $Y$ in relation $R$ is a constraint stating that if two tuples agree on all values in $X$, they must also agree on all values in $Y$. For example, in our `branches` table, $ifsc\_code \to \{bank\_name, branch\_name, city\}$ because every unique IFSC code deterministically identifies one branch.

### Q4: What is a candidate key?
> **Answer:** A candidate key is a minimal superkey—a set of attributes that uniquely identifies every tuple in a relation such that no proper subset can uniquely identify the tuple. For example, in `branches`, both $\{branch\_id\}$ and $\{ifsc\_code\}$ are candidate keys.

### Q5: What is a partial dependency?
> **Answer:** A partial dependency occurs when a non-prime attribute depends on only a proper subset of a composite candidate key. For example, if relation $R(A, B, C)$ has composite candidate key $\{A, B\}$, and $A \to C$, then $C$ is partially dependent on $\{A, B\}$, violating 2NF. Relations with single-attribute candidate keys cannot violate 2NF.

### Q6: What is a transitive dependency?
> **Answer:** A transitive dependency occurs when $X \to Y$ and $Y \to Z$, where $Y$ is not a candidate key and $Z$ is a non-prime attribute, causing $X \to Z$ indirectly. In our banking system, `deposits` previously stored $deposit\_id \to linked\_account \to customer\_id$. Because $linked\_account$ was not a superkey in `deposits`, storing `customer_id` created a transitive dependency violating 3NF and BCNF.

### Q7: Why were particular tables decomposed in this project?
> **Answer:**
> 1. **`deposits`:** Removed redundant `customer_id` because `linked_account -> accounts(account_number) -> customer_id`. Customer ownership is derived through `accounts`, eliminating 3NF/BCNF transitive dependency and update anomalies.
> 2. **`beneficiaries`:** Removed `bank_name` because `ifsc_code -> bank_name` is an attribute of the bank branch. Moved bank details to `branches(ifsc_code)`, resolving the transitive dependency.
> 3. **`account_card_credentials`:** Decoupled card PIN hashes from `accounts` and removed redundant `customer_id`, preventing multi-attribute denormalization.
> 4. **`customer_nominees`:** Decomposed 1:N nominee facts from `customers`, removing 1NF repeating group limits while supporting multiple beneficiaries per customer.

### Q8: What is a lossless-join decomposition?
> **Answer:** A decomposition of relation $R$ into $R_1$ and $R_2$ is lossless if taking the natural join of the projections produces the exact original relation without creating spurious (false) tuples: $\Pi_{R_1}(r) \bowtie \Pi_{R_2}(r) = r$. Mathematically, this holds if $(R_1 \cap R_2) \to R_1$ or $(R_1 \cap R_2) \to R_2$. In our schema, decomposing `deposits` across common attribute `linked_account` is lossless because `linked_account` is a primary key of `accounts`.

### Q9: What are primary and foreign keys?
> **Answer:**
> - **Primary Key:** The candidate key chosen by the database architect to uniquely identify tuples in a table. It cannot contain NULL values.
> - **Foreign Key:** An attribute or set of attributes in a referencing table whose values must match a candidate/primary key in a referenced table, enforcing referential integrity. In our system, `deposits.linked_account` references `accounts.account_number` with `ON DELETE RESTRICT`.

### Q10: What are ACID properties?
> **Answer:**
> - **Atomicity:** All operations within a transaction succeed together or fail together (All-or-Nothing via `START TRANSACTION` / `COMMIT` / `ROLLBACK`).
> - **Consistency:** The transaction moves the database from one valid state to another, satisfying all constraints (`CHECK (balance >= 0)`).
> - **Isolation:** Concurrent transactions execute without interfering with one another, implemented via InnoDB row-level `SELECT ... FOR UPDATE` locks.
> - **Durability:** Committed data is written to InnoDB write-ahead redo logs and persists across server crashes.

### Q11: Why do deposit and transfer operations require transactions?
> **Answer:** A fund transfer requires at least three distinct database mutations: debiting the sender, crediting the receiver, and inserting an immutable transaction record. Without a transaction, a crash between debit and credit would cause money to disappear from the sender's account without reaching the receiver, corrupting the institutional balance. Wrapping the steps in an atomic transaction guarantees that either all mutations commit, or everything rolls back.

### Q12: How does rollback protect the database?
> **Answer:** When an unexpected exception, insufficient funds condition, or constraint violation occurs mid-operation, the `ROLLBACK` command reverts all uncommitted modifications back to the state recorded at `START TRANSACTION` using InnoDB undo logs. This ensures zero orphaned records, zero balance corruption, and 100% preservation of financial parity.

