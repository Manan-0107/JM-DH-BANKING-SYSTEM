# Bharat Tech Bank (BTB) — Comprehensive DBMS Viva Preparation Guide
**System Name:** JM-DH Banking System (Bharat Tech Bank — BTB)  
**Academic Context:** Advanced Relational Database Management Systems (DBMS) Laboratory & Coursework Evaluation  
**Authoritative Schema:** MySQL 8.0.42+ (InnoDB Engine) with Dual SQLite Compatibility Layer  
**Target Repository:** `Manan-0107/JM-DH-BANKING-SYSTEM` (`final-submission-stage` @ `ee166022b9e4021dcddbbd07eb4c9082413fc9ff`)

---

## 1. Project Overview & Objectives

The **JM-DH Banking System** (branded as **Bharat Tech Bank — BTB**) is an enterprise-grade full-stack banking prototype built to model the transactional, regulatory, and architectural rigors of Indian commercial retail banking.

### Core Objectives:
1. **Relational Data Integrity:** Enforce strict financial invariants declaratively in the schema rather than relying solely on application middleware.
2. **ACID Transaction Guarantees:** Ensure zero balance divergence, eliminate dirty/phantom reads via `REPEATABLE-READ` isolation, and demonstrate fail-closed automatic rollback under simulated network/process aborts.
3. **Pessimistic Concurrency Control:** Prevent double-spend and overdraft anomalies through row-level locking (`SELECT ... FOR UPDATE`).
4. **Defense-in-Depth Credential Security:** Strict separation of NetBanking authentication (bcrypt password) from debit card authorization (bcrypt PIN), zero plaintext OTP storage (HMAC-SHA256), and persistent database-backed rate limiting.

---

## 2. Technology Stack & Architecture

- **Database Engine (Primary):** MySQL 8.0.42 Community Server (`InnoDB` Storage Engine, `utf8mb4_unicode_ci` collation, default transaction isolation `REPEATABLE-READ`).
- **Database Engine (Portability Fallback):** SQLite 3 (in-memory or file-backed via custom `DbAdapter` with serialize-locking mutex).
- **Backend Runtime:** Node.js v24.x / Next.js 15.5.28 (App Router Server Route Handlers).
- **Frontend Architecture:** React 18.3.1, Tailwind CSS 3.4.14, Vanilla CSS Design System with Outfit / JetBrains Mono typography.
- **Security & Cryptography:** `bcryptjs` (salt rounds = 10) for passwords and card PINs; native Node.js `crypto` (HMAC-SHA256) for OTP digests; JSON Web Tokens (`jsonwebtoken`) with 2-hour TTL.
- **Connection Architecture:** Connection pooling via `mysql2/promise` (`connectionLimit: 10`, `waitForConnections: true`).

```
+-------------------------------------------------------------------------+
|                  Client Web Application (React 18 / Next.js 15)         |
+-------------------------------------------------------------------------+
                                    | (HTTPS / REST API)
+-------------------------------------------------------------------------+
|             Next.js 15 Server Route Handlers (app/api/*)               |
|      - Token Authentication & Bearer Header Verification                 |
|      - Atomic Database-Backed Rate Limiting (security_rate_limits)       |
|      - Strict Monetary Input Sanitization (2-decimal precision regex)   |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
|               Data Access Layer (lib/db.ts: DbAdapter)                  |
|      - MySQL 2 Connection Pool (connectionLimit: 10)                    |
|      - Programmatic Transaction Boundary (BEGIN ... COMMIT/ROLLBACK)   |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
|             MySQL 8.0.42 InnoDB Enterprise Database Engine              |
|   - 9 Relational Tables + 4 Views + 1 Materialized Summary Table        |
|   - Declarative CHECK Constraints & Foreign Keys (RESTRICT / CASCADE)   |
|   - Pessimistic Row Locking (SELECT ... FOR UPDATE)                     |
|   - Triggers: trg_prevent_negative_balance, trg_audit_status_change    |
|   - Stored Procedures: sp_atomic_fund_transfer, sp_refresh_summary      |
|   - Stored Functions: fn_calculate_compound_yield, fn_mask_account_no   |
+-------------------------------------------------------------------------+
```

---

## 3. ER Model & Relational Schema

The core relational model consists of 9 core tables:

1. **`branches`**: Physical and operational branch infrastructure.
   - `branch_id` (PK), `branch_name`, `ifsc_code` (UQ), `city`, `address`, `timing`, `phone`, `status`.
2. **`customers`**: Retail banking users and KYC identification.
   - `customer_id` (PK), `full_name`, `email` (UQ), `phone`, `dob`, `address`, `created_at`, `status`, `kyc_status`, `password_hash`, `card_pin_hash`, `credit_score`, `tier`, `pan_number`, `aadhaar_number`, `avatar_data`.
3. **`accounts`**: Deposit accounts mapped to customers.
   - `account_number` (PK), `customer_id` (FK), `account_type`, `balance`, `ifsc_code`, `branch_name`, `opening_date`, `status`, `card_pin_hash`.
4. **`transactions`**: Double-entry financial audit journal.
   - `transaction_id` (PK), `sender_account` (FK-nullable), `receiver_account` (FK-nullable), `amount`, `type`, `date_time`, `status`, `description`, `reference_number` (UQ).
5. **`beneficiaries`**: Whitelisted intra-bank and inter-bank payees.
   - `beneficiary_id` (PK), `customer_id` (FK), `beneficiary_name`, `account_number`, `ifsc_code`, `bank_name`, `transfer_limit`, `cooling_until`.
6. **`deposits`**: Term investment contracts (Fixed & Recurring Deposits).
   - `deposit_id` (PK), `customer_id` (FK), `linked_account` (FK), `deposit_type`, `principal_amount`, `interest_rate`, `tenure_months`, `maturity_amount`, `maturity_date`, `status`, `created_at`.
7. **`kyc_verifications`**: Formal identity verification workflow logs.
   - `verification_id` (PK), `customer_id` (FK), `document_type`, `document_number`, `document_url`, `status`, `submitted_at`, `verified_at`, `rejection_reason`.
8. **`audit_logs`**: Immutable security and regulatory audit events.
   - `log_id` (PK), `customer_id`, `action`, `entity_type`, `entity_id`, `details`, `timestamp`.
9. **`otp_sessions`**: Cryptographic two-factor authentication tokens.
   - `session_id` (PK), `identifier`, `purpose`, `otp_code` (NULL), `otp_hash`, `expires_at`, `verified`, `attempts`, `last_sent_at`, `created_at`.
10. **`security_rate_limits`**: Atomic brute-force attempt counters.
    - `key_id` (PK), `attempts`, `last_attempt_at`, `locked_until`.
11. **`account_lien_records`**: Legal and regulatory encumbrance holds.
    - `lien_id` (PK), `account_number` (FK), `lien_amount`, `lien_reason`, `created_at`.

---

## 4. Functional Dependencies & Normalization Analysis

### Relation 1: `customers`
- **Candidate Keys:** `{customer_id}`, `{email}`, `{pan_number}`
- **Functional Dependencies (FDs):**
  - `customer_id -> full_name, email, phone, dob, address, status, kyc_status, password_hash, card_pin_hash, credit_score, tier, pan_number, aadhaar_number`
  - `email -> customer_id`
  - `pan_number -> customer_id`
- **Normal Form Claim:** **BCNF (Boyce-Codd Normal Form)**.  
  *Justification:* Every determinant (`customer_id`, `email`, `pan_number`) is a superkey. There are no partial dependencies (1NF/2NF satisfied) and no transitive dependencies (3NF satisfied).

### Relation 2: `branches`
- **Candidate Keys:** `{branch_id}`, `{ifsc_code}`
- **FDs:**
  - `branch_id -> branch_name, ifsc_code, city, address, timing, phone, status`
  - `ifsc_code -> branch_id, branch_name, city, address`
- **Normal Form Claim:** **BCNF**.  
  *Justification:* All determinants are superkeys.

### Relation 3: `accounts`
- **Candidate Keys:** `{account_number}`
- **FDs:**
  - `account_number -> customer_id, account_type, balance, ifsc_code, opening_date, status, card_pin_hash`
  - `ifsc_code -> branch_name` (Transitive via foreign key to `branches`)
- **Normal Form Claim:** **2NF (Controlled Denormalization from 3NF)**.  
  *Rigorous DBMS Justification:* In pure relational theory, `ifsc_code -> branch_name` represents a transitive dependency ($X \to Y \to Z$). Because `ifsc_code` is not a superkey of `accounts` and `branch_name` is not a prime attribute, the table strictly violates 3NF and resides in **Second Normal Form (2NF)**. Retaining `branch_name` is an intentional OLTP optimization to eliminate joining `branches` during frequent account balance queries, with foreign key constraints preserving referential consistency.

### Relation 4: `transactions`
- **Candidate Keys:** `{transaction_id}`, `{reference_number}`
- **FDs:**
  - `transaction_id -> sender_account, receiver_account, amount, type, date_time, status, description, reference_number`
  - `reference_number -> transaction_id`
- **Normal Form Claim:** **BCNF**.  
  *Justification:* Financial audit entries are append-only; each non-prime attribute is fully functionally dependent on candidate keys.

### 4.5 Lossless Join Decomposition & Dependency Preservation
In relational database theory, decomposing a universal schema $R$ into sub-schemas $(R_1, R_2)$ is **lossless** if and only if the common attributes functionally determine at least one of the decomposed relations:
$$R_1 \cap R_2 \to R_1 \quad \text{or} \quad R_1 \cap R_2 \to R_2$$

In the JM-DH Banking System schema:
1. **Decomposition of `(Customers, Accounts)`:**
   - Common attribute: `customer_id`
   - In `customers`, `customer_id` is the Primary Key: `customer_id -> customers`
   - Therefore, `Customers \cap Accounts = {customer_id} -> Customers`.
   - **Conclusion:** The decomposition is strictly **lossless**; natural join `customers NATURAL JOIN accounts` guarantees zero spurious tuples.
2. **Decomposition of `(Accounts, Transactions)`:**
   - Common attribute: `account_number`
   - In `accounts`, `account_number` is the Primary Key: `account_number -> accounts`
   - Therefore, `Accounts \cap Transactions = {account_number} -> Accounts`.
   - **Conclusion:** Guaranteed **lossless**.
3. **Dependency Preservation:**
   - All functional dependencies ($X \to Y$) are enforced within their respective base relations without requiring cross-table relational joins to validate candidate key uniqueness or functional constraints.

### 4.6 Entity-Relationship (ER) Cardinalities
- **Customer to Account:** `1 : N` (One customer can hold multiple savings/current accounts; every account must belong to exactly one customer via mandatory foreign key).
- **Customer to Deposit:** `1 : N` (One customer can open multiple fixed/recurring term deposits).
- **Account to Transaction:** `1 : N` (One account acts as sender or receiver across many historical transaction records).
- **Branch to Account:** `1 : N` (One bank branch manages many customer deposit accounts linked via IFSC code).
- **Customer to Beneficiary:** `1 : N` (One customer can whitelist multiple payees for rapid fund transfer).

---

## 5. Constraints, Keys & Indexing Strategy

### 5.1 Primary, Foreign & Unique Keys
- **Primary Keys:** Clustered B-tree indexes automatically maintained by InnoDB on every table's surrogate identifier (`customer_id`, `account_number`, `transaction_id`, etc.).
- **Foreign Keys:**
  - `accounts.customer_id` -> `customers.customer_id` (`ON DELETE RESTRICT`)
  - `deposits.customer_id` -> `customers.customer_id` (`ON DELETE RESTRICT`)
  - `deposits.linked_account` -> `accounts.account_number` (`ON DELETE RESTRICT`)
  - `beneficiaries.customer_id` -> `customers.customer_id` (`ON DELETE CASCADE`)
  - `account_lien_records.account_number` -> `accounts.account_number` (`ON DELETE RESTRICT ON UPDATE CASCADE`)
- **Unique Constraints:**
  - `customers.email`
  - `branches.ifsc_code`
  - `transactions.reference_number`

### 5.2 Declarative CHECK Constraints (MySQL 8.0+)
- `accounts.chk_account_positive_balance`: `CHECK (balance >= 0.00)`
- `transactions.chk_transaction_positive_amount`: `CHECK (amount > 0.00)`
- `deposits.chk_deposit_min_principal`: `CHECK (principal_amount >= 1000.00)`
- `deposits.chk_deposit_valid_tenure`: `CHECK (tenure_months >= 1 AND tenure_months <= 120)`
- `customers.chk_customer_cibil_range`: `CHECK (credit_score >= 300 AND credit_score <= 900)`
- `branches.chk_branch_ifsc_format`: `CHECK (LENGTH(ifsc_code) = 11)`

### 5.3 Composite Indexes & The Leftmost Prefix Rule
1. **`idx_tx_sender_datetime` on `transactions(sender_account, date_time)`:**
   - Optimizes statement queries: `WHERE sender_account = ? ORDER BY date_time DESC`.
   - *Leftmost Prefix Rule:* A query filtering on `sender_account` utilizes an index seek. A query filtering only on `date_time` bypasses this index and performs a table scan.
2. **`idx_acc_cust_status` on `accounts(customer_id, status)`:**
   - Speeds up active account portfolio resolution for authenticated customers.
3. **`idx_dep_maturity_status` on `deposits(status, maturity_date)`:**
   - Enables batch job seeks for mature deposits: `WHERE status = 'Active' AND maturity_date <= CURDATE()`.

---

## 6. SQL Joins, Views, Triggers, Routines & Functions

### 6.1 Relational Views
1. **`v_customer_portfolio`**: Aggregates customer total liquid balance across multiple accounts and total term principal in active deposits (`LEFT JOIN` between `customers`, `accounts`, and `deposits`).
2. **`v_high_value_transactions`**: AML compliance view filtering transactions where `amount >= 25000.00`.
3. **`v_active_deposits_summary`**: Displays active deposits joined with customer names, calculating expected interest yields and countdown `days_to_maturity`.
4. **`v_live_branch_summary`**: Real-time branch liquidity aggregation summing liquid assets across all associated active accounts.

### 6.2 Materialized View Pattern in MySQL
*Technical Note:* Unlike Oracle or PostgreSQL, MySQL 8.0 does not offer a native `CREATE MATERIALIZED VIEW` statement. The enterprise design pattern implemented in BTB uses:
- A physical table: `mv_branch_financial_summary`.
- A transaction-safe refresh stored procedure: `sp_refresh_branch_summary()` executing an atomic `DELETE` + `INSERT INTO ... SELECT` within an explicit transaction.

### 6.3 Database Triggers
1. **`trg_prevent_negative_balance` (BEFORE UPDATE on `accounts`):**
   - Fail-closed guard: Throws `SIGNAL SQLSTATE '45000'` if `NEW.balance < 0.00`, providing a second defensive layer behind application checks and CHECK constraints.
2. **`trg_audit_account_status_change` (AFTER UPDATE on `accounts`):**
   - Automatically writes an immutable record to `audit_logs` whenever `OLD.status <> NEW.status` (e.g., active -> frozen).
3. **`trg_audit_high_value_transaction` (AFTER INSERT on `transactions`):**
   - Automatically logs an AML alert to `audit_logs` for any transaction where `amount >= 100000.00`.

### 6.4 Stored Procedures & Functions
1. **`sp_atomic_fund_transfer`:**
   - Stored procedure taking sender account, receiver account, and amount.
   - Acquires row-level exclusive locks (`FOR UPDATE`), checks active status and balance sufficiency, updates balances, and inserts double-entry transaction journal records atomically.
2. **`fn_calculate_compound_yield`:**
   - Deterministic mathematical function computing quarterly compound interest:
     $$\text{Yield} = P \times \left(1 + \frac{r}{400}\right)^{4 \times t}$$
3. **`fn_mask_account_number`:**
   - Data protection function returning `ACC-****10` to satisfy RBI privacy masking mandates.
4. **`fn_check_daily_limit_exceeded`:**
   - Computes daily velocity sums to enforce velocity caps on debit accounts.

---

## 7. ACID Properties & Concurrency Implementation

| ACID Property | Implementation Mechanism in BTB |
| :--- | :--- |
| **Atomicity** | Wrapped in explicit `db.transaction()` / `START TRANSACTION`. If any statement (debit, credit, or ledger insert) fails, an explicit `ROLLBACK` undoes all prior mutations. Verified via `test_failure_driven_rollback`. |
| **Consistency** | Invariants enforced by database engine: `CHECK (balance >= 0.00)`, foreign keys (`ON DELETE RESTRICT`), and triggers (`trg_prevent_negative_balance`). |
| **Isolation** | MySQL default `REPEATABLE-READ` isolation level with InnoDB multi-version concurrency control (MVCC) and gap locking, preventing dirty reads and non-repeatable reads. |
| **Durability** | InnoDB doublewrite buffer (`dblwr`), redo logs (`#ib_redo*`), and write-ahead logging (WAL) ensure committed transactions survive process or power failures. |

---

## 8. Transaction Rollback & Concurrency Protection

### Failure-Driven Mid-Transaction Rollback
In `app/api/system/test-rollback/route.ts` and `08_transactions_and_concurrency.sql`:
1. Sender balance is decremented: `UPDATE accounts SET balance = balance - 1000 WHERE account_number = ?`.
2. A deliberate runtime exception is thrown before ledger insertion.
3. The catch block executes `ROLLBACK`.
4. Automated tests query the database directly and verify:
   - Initial balance is 100% restored (zero partial debit).
   - Uncommitted transaction journal records are completely purged.

### Race Condition & Overdraft Prevention
- **Mechanism:** In `app/api/accounts/transfer/route.ts`:
  ```sql
  SELECT balance, status FROM accounts WHERE account_number = ? FOR UPDATE;
  ```
- **Concurrency Test:** `test_backend_suite.js` (Section 17) executes 3 parallel asynchronous transfers of ₹10,000 from an account holding exactly ₹10,000.
- **Result:** InnoDB row-level locking forces threads to serialize. Exactly 1 transfer commits (HTTP 200), and the remaining 2 are blocked with HTTP 400 (`Insufficient balance`). The resulting balance is exactly ₹0.00, demonstrating zero race condition leakage.

---

## 9. Security, Authentication & Credential Lifecycle

### 9.1 Credential Separation
- **Login Password:** Hashed using `bcrypt` (10 rounds). Authenticates NetBanking sessions and issues a signed JWT. Cannot be used to execute financial transfers.
- **Card PIN:** 4-digit numeric code hashed using a distinct `bcrypt` salt (`card_pin_hash`). Required for fund transfers, withdrawals, and term deposit breaking. The login password is strictly rejected if submitted as a transaction PIN.

### 9.2 Rate Limiting & Lockout
- **Database Table:** `security_rate_limits(key_id, attempts, last_attempt_at, locked_until)`.
- **Login Defense:** 5 consecutive incorrect passwords locks the account for 15 minutes (HTTP 429).
- **Transaction PIN Defense:** 5 consecutive incorrect PIN attempts locks card authorization for 15 minutes (HTTP 429).
- **Persistent:** Stored in MySQL rather than memory, surviving server restarts.

### 9.3 OTP Verification Lifecycle
- **Zero Plaintext Storage:** `otp_code` column is strictly `NULL`.
- **HMAC-SHA256 Hashing:** Codes are digested as `crypto.createHmac('sha256', SECRET).update(otp).digest('hex')`.
- **TTL Enforcement:** 300-second expiration. Expired codes are rejected with HTTP 400.
- **Replay Protection:** Verified sessions are flagged `verified = 1`. Subsequent reuse attempts fail immediately.
- **Concurrency Protection:** Single-use verification race tests verify that simultaneous submissions permit exactly 1 verification.

---

## 10. Database Configuration & Demonstrating MySQL Persistence

### 10.1 Configuration (.env)
```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=bankist
USE_MYSQL=true
DISABLE_SQLITE_FALLBACK=true
```

### 10.2 How to Demonstrate Persistence to the Examiner
1. **Initial Account Query:**
   ```sql
   SELECT account_number, balance FROM accounts WHERE account_number = 'ACC-772910';
   ```
2. **Execute Transaction:** Perform a transfer of ₹5,000 via the web portal or test script.
3. **Inspect Active Ledger:**
   ```sql
   SELECT reference_number, sender_account, receiver_account, amount, status FROM transactions ORDER BY date_time DESC LIMIT 1;
   ```
4. **Restart Application & Query MySQL:** Terminate the Next.js process (`Ctrl+C`), reopen MySQL shell, and demonstrate that the balance reflects the deduction and the transaction record persists durably on disk.

---

## 11. Test Suites & Verification Evidence

All 233 automated test checks (36 Security + 161 Backend + 5 Persistence + 31 DBMS), along with both TypeScript compilation and production build checks, pass 100% against the active MySQL 8.0.42 instance:

1. **TypeScript Type Check (`npx tsc --noEmit`):** Exit code 0 (0 compilation errors).
2. **Production Build (`npm run build`):** Exit code 0 (16 static and dynamic routes compiled in 3.0s).
3. **Security Remediation Suite (`node test_security_remediation.js`):** Exit code 0 (36/36 tests PASS).
   - Validates brute-force lockouts, PIN vs. password separation, OTP HMAC security, replay denial, and sensitive field response stripping.
4. **Authoritative Backend Suite (`node test_backend_suite.js`):** Exit code 0 (161/161 tests PASS).
   - Validates all REST endpoints, onboarding concurrency, decimal input precision, token tampering, and multi-threaded overdraft protection.
5. **End-to-End Persistence Suite (`node test_persistence.js`):** Exit code 0 (5/5 phases PASS).
   - Verifies customer creation, transfer execution, session re-authentication, and durable ledger record persistence.
6. **Advanced DBMS Master Suite (`node scripts/run_all_dbms_tests.js`):** Exit code 0 (31/31 tests PASS).
   - Verifies MySQL 8.0.42 connectivity, DDL structures, CHECK constraints, foreign keys, views, stored routines, triggers, ACID rollback, row locking, and composite index usage.
7. **Security Dependency Audit (`npm audit`):**
   - **Critical Vulnerabilities:** 0
   - **High Vulnerabilities:** 0
   - **Moderate Vulnerabilities:** 1 (`uuid < 11.1.1` in buffer boundary checks).

---

## 12. Known Limitations & Academic Project Disclaimers

1. **Simulated OTP & SMS Delivery:** In this academic demo environment, OTP generation prints to server console logs or returns a `test_otp` property in development mode. A commercial production deployment requires a telecom SMS gateway integration (e.g., Twilio, AWS SNS).
2. **Mock KYC Processing:** Aadhaar and PAN documents are verified via simulated logic. Commercial banking mandates integration with UIDAI and NSDL verification APIs.
3. **Residual Upstream Dependency Advisory:** `uuid@10.0.0` reports a moderate advisory ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)) relating to buffer bounds checks in `uuid.v3/v5/v6`. BTB exclusively calls `uuid.v4()` returning strings, making this advisory non-exploitable in the system. Upgrading to `uuid@11+` would break CommonJS test harness compatibility.
4. **Single-Node Deployment:** The prototype runs against a single MySQL instance. Production banking systems employ active-active replication, distributed consensus (e.g., MySQL InnoDB Cluster), and HSMs (Hardware Security Modules) for PIN translation.

---

## 13. Top 25 Likely Viva Questions & Answers

### Q1: What database engine does the system use, and what is its default isolation level?
**Answer:** The primary database is MySQL 8.0.42 using the InnoDB storage engine. InnoDB’s default transaction isolation level is `REPEATABLE-READ`, which uses Multi-Version Concurrency Control (MVCC) and gap locking to prevent dirty reads, non-repeatable reads, and phantom reads.

### Q2: How does the system prevent negative account balances?
**Answer:** Through defense-in-depth at three layers:
1. Application layer validation before initiating transactions.
2. Declarative MySQL 8.0 CHECK constraint: `CHECK (balance >= 0.00)`.
3. Database trigger `trg_prevent_negative_balance` which executes `BEFORE UPDATE` and signals SQLSTATE `45000` if `NEW.balance < 0.00`.

### Q3: How do you prevent race conditions when two users withdraw from the same account simultaneously?
**Answer:** We employ pessimistic row-level locking using `SELECT ... FOR UPDATE` inside an explicit ACID transaction. When thread A executes `SELECT ... FOR UPDATE` on an account row, InnoDB acquires an exclusive lock. Thread B is forced to wait until thread A commits or rolls back, guaranteeing serialized execution.

### Q4: Explain the difference between `DELETE RESTRICT` and `DELETE CASCADE` in your schema.
**Answer:** We enforce `ON DELETE RESTRICT` on core financial entities (e.g., deleting a customer with active accounts or deleting an account with legal liens is rejected by the database to prevent orphaned records). We use `ON DELETE CASCADE` on auxiliary entities such as `beneficiaries` so that removing a customer automatically removes their whitelisted payee list.

### Q5: What normal form does the `customers` relation satisfy, and why?
**Answer:** It satisfies Boyce-Codd Normal Form (BCNF). All non-trivial functional dependencies have determinants (`customer_id`, `email`, `pan_number`) that are superkeys. There are no partial or transitive dependencies.

### Q6: Why does `accounts` store `branch_name` when `ifsc_code` is already a foreign key to `branches`?
**Answer:** In pure relational theory, storing `branch_name` creates a transitive dependency (`account_number -> ifsc_code -> branch_name` where `branch_name` is non-prime and `ifsc_code` is not a superkey), placing `accounts` in **Second Normal Form (2NF)**. We intentionally denormalize from 3NF down to 2NF as an OLTP optimization to eliminate joining `branches` during frequent account balance queries, while foreign key integrity guarantees consistency.

### Q7: How does the system implement Materialized Views in MySQL 8.0?
**Answer:** Because MySQL does not support native materialized views, we created a physical snapshot summary table (`mv_branch_financial_summary`) and an atomic stored procedure (`sp_refresh_branch_summary`) that executes a transactional `DELETE` and `INSERT INTO ... SELECT` query from base tables.

### Q8: What does the Leftmost Prefix Rule mean for your composite index `idx_tx_sender_datetime`?
**Answer:** The composite index is defined on `(sender_account, date_time)`. Under the leftmost prefix rule, the query optimizer can use the index for queries filtering on `sender_account` or `(sender_account AND date_time)`. A query filtering only on `date_time` cannot use this index and triggers a full table scan.

### Q9: What happens if a server crashes mid-transfer after debiting the sender but before crediting the receiver?
**Answer:** The transaction has not reached `COMMIT`. Upon restart, InnoDB’s crash recovery protocol inspects the write-ahead redo logs and undo logs. Uncommitted transactions are automatically rolled back, restoring the sender's balance and leaving zero partial debits.

### Q10: How are passwords and transaction PINs secured in the database?
**Answer:** Neither is ever stored in plaintext. Both are hashed using `bcryptjs` with 10 salt rounds (`password_hash` and `card_pin_hash`). They are salted independently so identical values yield completely different cryptographic hashes. Plaintext columns are strictly `NULL`.

### Q11: Can a user authenticate a fund transfer using their NetBanking login password?
**Answer:** No. We enforce strict credential separation. The login password only grants a JWT session. Financial endpoints strictly require the 4-digit Debit Card PIN, verified against `card_pin_hash`. Submitting the login password as the PIN returns HTTP 401 Unauthorized.

### Q12: How are OTPs stored, and how is OTP replay prevented?
**Answer:** OTPs are never stored in plaintext (`otp_code` is NULL). The database stores an HMAC-SHA256 digest (`otp_hash`). When verified, the record is flagged `verified = 1`. Any subsequent verification attempt checks `verified === 0` and rejects replayed submissions with HTTP 400.

### Q13: How does the system defend against brute-force login attacks?
**Answer:** Using persistent rate limiting backed by the `security_rate_limits` MySQL table. Each failed attempt increments an atomic counter. Upon the 5th consecutive failure, the record enters a lockout state (`locked_until = NOW + 15 minutes`), returning HTTP 429 Too Many Requests even if valid credentials are subsequently provided.

### Q14: What is the purpose of the stored function `fn_calculate_compound_yield`?
**Answer:** It is a deterministic mathematical function executed inside MySQL that computes quarterly compound interest for Fixed Deposits using the standard formula $A = P \times (1 + r/400)^{4t}$, avoiding client-side rounding discrepancies.

### Q15: Why is `fn_mask_account_number` marked as `DETERMINISTIC NO SQL`?
**Answer:** It is marked `DETERMINISTIC` because given the same input string, it always returns the exact same masked output (`ACC-****10`). It is marked `NO SQL` because it performs string manipulation (`CONCAT`, `LEFT`, `RIGHT`) without executing any SQL read or write queries.

### Q16: What does the `trg_audit_high_value_transaction` trigger do?
**Answer:** It is an `AFTER INSERT` trigger on `transactions`. Whenever a transaction is inserted with `amount >= 100000.00`, it automatically inserts an AML compliance alert into `audit_logs` containing the customer ID, amount, and timestamp.

### Q17: What is the difference between a Clustered Index and a Secondary Index in InnoDB?
**Answer:** The clustered index is the primary key; the actual table row data is physically stored in the leaf pages of the B-tree. A secondary index contains the indexed columns and the primary key value as a pointer; querying via a secondary index requires an index seek followed by a clustered index lookup (bookmark lookup) unless it is a covering index.

### Q18: How does the system ensure double-entry accounting integrity?
**Answer:** Every fund transfer executes two balance mutations (sender debit, receiver credit) and records a single transaction journal entry with `sender_account`, `receiver_account`, and `reference_number` inside a single atomic transaction.

### Q19: Why does the system support both MySQL and SQLite?
**Answer:** MySQL 8.0 is the authoritative enterprise engine for advanced DBMS evaluation (triggers, stored routines, row-level locking, views). SQLite is maintained as a portability fallback via our custom `DbAdapter` abstraction to allow smoke testing on machines without a configured MySQL instance.

### Q20: What is the significance of the `SAVEPOINT` demonstration in Module 08?
**Answer:** Savepoints allow partial transaction rollback. In `sp_demo_savepoint_rollback`, a fee is debited, a savepoint is established, a speculative penalty is applied, and then rolled back to the savepoint before committing, demonstrating that only the fee persists.

### Q21: What is EXPLAIN ANALYZE in MySQL 8.0, and how did you use it?
**Answer:** `EXPLAIN ANALYZE` executes the query and generates an execution tree detailing actual execution time, startup cost, rows scanned, and loop counts. We used it to verify that our composite indexes reduced full table scans to index seeks.

### Q22: How does the system handle high-concurrency digital onboarding?
**Answer:** Digital signup generates unique customer IDs (`CUST-xxx`) and account numbers (`ACC-xxx`) backed by unique constraints. In concurrent onboarding tests with 3 parallel signups, all completed with unique primary keys and zero duplicate email conflicts (HTTP 409).

### Q23: What security headers and credential stripping are performed across financial API responses?
**Answer:** All API responses pass through sanitization logic that strips `password_hash`, `card_pin`, and `card_pin_hash` before serializing JSON payloads to prevent credential leaks to the client browser.

### Q24: What is the purpose of the `account_lien_records` table?
**Answer:** It models regulatory freezes or collateral liens placed on bank accounts. It enforces `ON DELETE RESTRICT`, preventing bank staff from closing or deleting any account currently subject to an active legal lien.

### Q25: Why is this project classified as an academic prototype rather than commercial banking software?
**Answer:** While it implements genuine enterprise relational database design and defensive security, it uses simulated SMS/OTP delivery, mock KYC workflows, a single-node database architecture without Hardware Security Modules (HSMs), and retains a non-exploitable moderate upstream `uuid` advisory.
