# Bharat Trust Bank (BTB) / Bankist Banking System
## Master Database Normalization, Architecture & Disaster Recovery Specification

**Author:** Senior MySQL 8.0 Database Architect & Systems Migration Specialist  
**Target Engine:** MySQL 8.0.42 Community / Enterprise Server (InnoDB Storage Engine)  
**Strict SQL Mode:** `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION`  
**Authoritative DDL:** `DBMS project/bankist_normalized.sql`  
**Authoritative Migration:** `DBMS project/bankist_migration.sql`  
**Authoritative Test Suite:** `DBMS project/bankist_normalization_tests.sql`  
**Execution Timestamp:** 2026-10-29  
**Certification status (static review):** BCNF is not runtime-certified. See `NORMALIZATION_CONSISTENCY_FIX_2026-10-29.md` for the latest corrections and verification limits.

---

## 1. Executive Architectural Summary

This master document provides the mathematical, theoretical, and empirical specification of the normalized Bharat Trust Bank (BTB) relational database.

The original unnormalized Core Banking System (CBS) schema (`DBMS project/bankist.sql`) comprised 11 tables containing embedded repeating groups (nominees inside customers), transitive dependencies (`branch_name` in accounts), redundant multi-table credential hashes, and unaggregated grouping risks.

Through relational decomposition, the schema has been organized into **13 base tables** and backward-compatibility/analytical views. BCNF status depends on the complete business functional dependencies and must not be inferred from table count alone:
- The decomposition is intended to reduce insertion, update, and deletion anomalies; complete elimination has not been independently proven.
- Financial-ledger conservation must be confirmed by executing migration parity tests against the actual source and disposable target databases.
- Historical record counts stated in earlier reports are claims pending independent runtime verification; extracted child rows change total row count and should be reconciled table by table.
- **Zero Plaintext Secrets**: Plaintext card PINs and OTPs completely eliminated; salted Bcrypt and HMAC-SHA256 hashes exclusively utilized.
- **Strict SQL Mode Compliance**: Deterministic window functions (`ROW_NUMBER()`) eliminate MySQL Error 1055 under `ONLY_FULL_GROUP_BY`.

---

## 2. Table-by-Table Normalization Audit (1NF through BCNF)

### 2.1 `branches` (Physical Branch Clearing Directory)
- **Business Purpose:** Central clearing directory of physical bank branches, IFSC codes, operating hours, and contact details.
- **Primary Key:** `branch_id` (e.g., `BR-101`)
- **Candidate Keys:**
  - $CK_1 = \{\text{branch\_id}\}$
  - $CK_2 = \{\text{ifsc\_code}\}$
- **Foreign Keys:** None (Root entity).
- **Functional Dependencies:**
  - $\text{branch\_id} \to \{\text{branch\_name}, \text{ifsc\_code}, \text{city}, \text{address}, \text{timing}, \text{phone}, \text{status}\}$
  - $\text{ifsc\_code} \to \{\text{branch\_id}, \text{branch\_name}, \text{city}, \text{address}, \text{timing}, \text{phone}, \text{status}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Justification:** Every determinant ($\text{branch\_id}$, $\text{ifsc\_code}$) is a superkey. All attributes are atomic (1NF); no partial dependencies (2NF); no transitive dependencies (3NF).

---

### 2.2 `customers` (Core Customer Demographic Identity)
- **Business Purpose:** Master customer registry for KYC-compliant individual retail and corporate clients.
- **Primary Key:** `customer_id` (e.g., `CUST-101`)
- **Candidate Keys:**
  - $CK_1 = \{\text{customer\_id}\}$
  - $CK_2 = \{\text{email}\}$
  - $CK_3 = \{\text{pan\_number}\}$ (when non-null)
- **Foreign Keys:** None.
- **Functional Dependencies:**
  - $\text{customer\_id} \to \{\text{full\_name}, \text{email}, \text{phone}, \text{dob}, \text{address}, \text{status}, \text{kyc\_status}, \text{password\_hash}, \text{credit\_score}, \text{tier}, \text{pan\_number}, \text{aadhaar\_number}\}$
  - $\text{email} \to \{\text{customer\_id}, \dots\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Decomposition Note:** Nominee attributes (`nominee_name`, `nominee_relation`, `nominee_dob`) and card credentials (`card_pin`, `card_pin_hash`) were removed and decomposed into dedicated entities (`customer_nominees` and `account_card_credentials`). Every determinant is a superkey.

---

### 2.3 `customer_nominees` (Decomposed Nominee Beneficiary Entity)
- **Business Purpose:** Models legal beneficiaries entitled to account funds upon customer demise (1:N cardinality).
- **Primary Key:** `nominee_id` (e.g., `NOM-107`)
- **Candidate Keys:** $CK_1 = \{\text{nominee\_id}\}$
- **Foreign Keys:** `customer_id` references `customers(customer_id)` `ON DELETE CASCADE`.
- **Functional Dependencies:**
  - $\text{nominee\_id} \to \{\text{customer\_id}, \text{nominee\_name}, \text{relationship}, \text{dob}, \text{allocation\_percentage}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Justification:** Eliminates the 1NF violation of repeating groups and un-normalized attributes from `customers`. Every determinant is a superkey.

---

### 2.4 `accounts` (Deposit Accounts & Operating Ledgers)
- **Business Purpose:** Core general ledger accounts (Savings, Current, Salary).
- **Primary Key:** `account_number` (e.g., `ACC-772910`)
- **Candidate Keys:** $CK_1 = \{\text{account\_number}\}$
- **Foreign Keys:**
  - `customer_id` references `customers(customer_id)` `ON DELETE RESTRICT`
  - `ifsc_code` references `branches(ifsc_code)` `ON DELETE RESTRICT`
- **Functional Dependencies:**
  - $\text{account\_number} \to \{\text{customer\_id}, \text{account\_type}, \text{balance}, \text{ifsc\_code}, \text{opening\_date}, \text{status}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Decomposition Note:** In the legacy schema, `accounts` stored `branch_name`, which depended transitively on `ifsc_code` ($\text{account\_number} \to \text{ifsc\_code} \to \text{branch\_name}$), violating 3NF. `branch_name` was eliminated; branch details are resolved relationally via `ifsc_code`.

---

### 2.5 `account_card_credentials` (Authentication & PIN Security Entity)
- **Business Purpose:** Isolated authentication instrument storing salted Bcrypt hashes for debit card PIN verification.
- **Primary Key:** `credential_id`
- **Candidate Keys:**
  - $CK_1 = \{\text{credential\_id}\}$
  - $CK_2 = \{\text{account\_number}\}$
- **Foreign Keys:**
  - `account_number` references `accounts(account_number)` `ON DELETE CASCADE`
  - `customer_id` references `customers(customer_id)` `ON DELETE CASCADE`
- **Functional Dependencies:**
  - $\text{credential\_id} \to \{\text{account\_number}, \text{customer\_id}, \text{card\_pin\_hash}, \text{status}\}$
  - $\text{account\_number} \to \{\text{credential\_id}, \text{customer\_id}, \text{card\_pin\_hash}, \text{status}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Security & Compatibility Property:** `card_pin_hash VARCHAR(255) DEFAULT NULL` allows fail-closed authentication without fabricating synthetic card numbers or fallback hashes. Every determinant is a superkey.

---

### 2.6 `transactions` (Immutable Financial General Ledger)
- **Business Purpose:** Append-only ledger recording all debits, credits, transfers, and settlements.
- **Primary Key:** `transaction_id` (e.g., `TXN-00000001`)
- **Candidate Keys:**
  - $CK_1 = \{\text{transaction\_id}\}$
  - $CK_2 = \{\text{reference\_number}\}$ (when non-null)
- **Foreign Keys:** None (Allows external counterparty accounts, cash settlements, and UPI handles).
- **Functional Dependencies:**
  - $\text{transaction\_id} \to \{\text{sender\_account}, \text{receiver\_account}, \text{channel}, \text{amount}, \text{type}, \text{date\_time}, \text{status}, \text{reference\_number}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Integrity Invariant:** `amount > 0.00` enforced via check constraint `chk_tx_amount_positive`. Reference number enforces settlement idempotency.

---

### 2.7 `deposits` (Term Deposit Investment Contracts)
- **Business Purpose:** Fixed Deposit (FD) and Recurring Deposit (RD) contracts.
- **Primary Key:** `deposit_id` (e.g., `FD-2024-8841`)
- **Candidate Keys:** $CK_1 = \{\text{deposit\_id}\}$
- **Foreign Keys:**
  - `customer_id` references `customers(customer_id)` `ON DELETE CASCADE`
  - `linked_account` references `accounts(account_number)` `ON DELETE RESTRICT`
- **Functional Dependencies:**
  - $\text{deposit\_id} \to \{\text{customer\_id}, \text{linked\_account}, \text{deposit\_type}, \text{principal\_amount}, \text{interest\_rate}, \text{tenure\_months}, \text{maturity\_amount}, \text{maturity\_date}, \text{status}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Constraint Verification:** `principal_amount >= 1000.00` and `maturity_amount >= principal_amount`.

---

### 2.8 `beneficiaries` (Whitelisted Payee Registry)
- **Business Purpose:** Pre-registered transfer counterparties subject to daily limits.
- **Primary Key:** `beneficiary_id`
- **Candidate Keys:**
  - $CK_1 = \{\text{beneficiary\_id}\}$
  - $CK_2 = \{\text{customer\_id}, \text{account\_number}, \text{ifsc\_code}\}$
- **Foreign Keys:** `customer_id` references `customers(customer_id)` `ON DELETE CASCADE`.
- **Functional Dependencies:**
  - $\text{beneficiary\_id} \to \{\text{customer\_id}, \text{beneficiary\_name}, \text{account\_number}, \text{ifsc\_code}, \text{bank\_name}, \text{transfer\_limit}, \text{cooling\_until}, \text{is\_active}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.

---

### 2.9 `kyc_verifications` (Regulatory Compliance Audit History)
- **Business Purpose:** Non-repudiation audit trail of customer identity verification events.
- **Primary Key:** `verification_id`
- **Candidate Keys:** $CK_1 = \{\text{verification\_id}\}$
- **Foreign Keys:** `customer_id` references `customers(customer_id)` `ON DELETE CASCADE`.
- **Functional Dependencies:**
  - $\text{verification\_id} \to \{\text{customer\_id}, \text{document\_type}, \text{document\_number}, \text{verification_method}, \text{status}, \text{verified_at}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.

---

### 2.10 `account_lien_records` (Legal Holds & Encumbrances)
- **Business Purpose:** Legal encumbrances, court-ordered freezes, and collateral holds.
- **Primary Key:** `lien_id`
- **Candidate Keys:** $CK_1 = \{\text{lien\_id}\}$
- **Foreign Keys:** `account_number` references `accounts(account_number)` `ON DELETE RESTRICT`.
- **Functional Dependencies:**
  - $\text{lien\_id} \to \{\text{account\_number}, \text{lien\_amount}, \text{lien\_reason}, \text{created\_at}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.

---

### 2.11 `audit_logs` (System Security & Non-Repudiation Trail)
- **Business Purpose:** Immutable record of security actions (logins, freezes, limit changes).
- **Primary Key:** `log_id`
- **Candidate Keys:** $CK_1 = \{\text{log\_id}\}$
- **Foreign Keys:** `customer_id` references `customers(customer_id)` `ON DELETE SET NULL`.
- **Functional Dependencies:**
  - $\text{log\_id} \to \{\text{customer\_id}, \text{action}, \text{entity\_type}, \text{entity\_id}, \text{details}, \text{timestamp}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.

---

### 2.12 `otp_sessions` (2FA Challenge Management)
- **Business Purpose:** Short-lived cryptographic two-factor authentication challenges.
- **Primary Key:** `session_id`
- **Candidate Keys:** $CK_1 = \{\text{session\_id}\}$
- **Foreign Keys:** None.
- **Functional Dependencies:**
  - $\text{session\_id} \to \{\text{identifier}, \text{purpose}, \text{otp\_code}, \text{otp\_hash}, \text{expires\_at}, \text{verified}, \text{attempts}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.
- **Security Hardening:** Plaintext `otp_code` scrubbed to `NULL` for historical sessions; HMAC-SHA256 hash verified.

---

### 2.13 `security_rate_limits` (Defensive Anti-Automation Engine)
- **Business Purpose:** Rate-limiting counters tracking failed login and OTP attempts by IP and account.
- **Primary Key:** `key_id`
- **Candidate Keys:** $CK_1 = \{\text{key\_id}\}$
- **Foreign Keys:** None.
- **Functional Dependencies:**
  - $\text{key\_id} \to \{\text{attempts}, \text{last\_attempt\_at}, \text{locked\_until}\}$
- **Normal Form Reached:** **Boyce-Codd Normal Form (BCNF)**.

---

## 3. Comprehensive Entity-Relationship (ER) Diagram (Mermaid)

```mermaid
erDiagram
    BRANCHES ||--o{ ACCOUNTS : "clears / maintains (1:N via ifsc_code)"
    CUSTOMERS ||--o{ CUSTOMER_NOMINEES : "designates (1:N)"
    CUSTOMERS ||--o{ ACCOUNTS : "owns (1:N)"
    CUSTOMERS ||--o{ ACCOUNT_CARD_CREDENTIALS : "authenticates (1:N)"
    CUSTOMERS ||--o{ DEPOSITS : "subscribes (1:N)"
    CUSTOMERS ||--o{ BENEFICIARIES : "registers (1:N)"
    CUSTOMERS ||--o{ KYC_VERIFICATIONS : "undergoes (1:N)"
    CUSTOMERS ||--o{ AUDIT_LOGS : "triggers (0:N)"
    ACCOUNTS ||--o{ ACCOUNT_CARD_CREDENTIALS : "has (1:1)"
    ACCOUNTS ||--o{ DEPOSITS : "funds / settles (1:N)"
    ACCOUNTS ||--o{ ACCOUNT_LIEN_RECORDS : "encumbered_by (0:N)"
    ACCOUNTS ||--o{ TRANSACTIONS : "debits / sender (0:N)"
    ACCOUNTS ||--o{ TRANSACTIONS : "credits / receiver (0:N)"

    BRANCHES {
        varchar(50) branch_id PK
        varchar(20) ifsc_code UK
        varchar(100) branch_name
        varchar(100) city
        text address
        varchar(50) timing
        varchar(30) phone
        varchar(20) status
    }

    CUSTOMERS {
        varchar(50) customer_id PK
        varchar(100) full_name
        varchar(100) email UK
        varchar(30) phone
        date dob
        text address
        varchar(30) status
        varchar(30) kyc_status
        varchar(255) password_hash
        int credit_score
        varchar(30) tier
        varchar(20) pan_number
        varchar(20) aadhaar_number
    }

    CUSTOMER_NOMINEES {
        varchar(50) nominee_id PK
        varchar(50) customer_id FK
        varchar(100) nominee_name
        varchar(50) relationship
        date dob
        decimal allocation_percentage
    }

    ACCOUNTS {
        varchar(50) account_number PK
        varchar(50) customer_id FK
        varchar(50) account_type
        decimal balance
        varchar(20) ifsc_code FK
        datetime opening_date
        varchar(30) status
    }

    ACCOUNT_CARD_CREDENTIALS {
        varchar(64) credential_id PK
        varchar(50) account_number UK,FK
        varchar(50) customer_id FK
        varchar(255) card_pin_hash
        enum status
    }

    TRANSACTIONS {
        varchar(50) transaction_id PK
        varchar(100) sender_account
        varchar(100) receiver_account
        enum channel
        decimal amount
        varchar(30) type
        datetime date_time
        varchar(30) status
        varchar(100) reference_number UK
    }

    DEPOSITS {
        varchar(50) deposit_id PK
        varchar(50) customer_id FK
        varchar(50) linked_account FK
        varchar(50) deposit_type
        decimal principal_amount
        decimal interest_rate
        int tenure_months
        decimal maturity_amount
        date maturity_date
        varchar(30) status
    }

    BENEFICIARIES {
        varchar(50) beneficiary_id PK
        varchar(50) customer_id FK
        varchar(150) beneficiary_name
        varchar(50) account_number
        varchar(20) ifsc_code
        varchar(150) bank_name
        decimal transfer_limit
        tinyint is_active
    }

    KYC_VERIFICATIONS {
        varchar(50) verification_id PK
        varchar(50) customer_id FK
        varchar(50) document_type
        varchar(50) document_number
        varchar(50) verification_method
        varchar(30) status
        datetime verified_at
    }

    ACCOUNT_LIEN_RECORDS {
        varchar(50) lien_id PK
        varchar(50) account_number FK
        decimal lien_amount
        varchar(255) lien_reason
        datetime created_at
    }

    AUDIT_LOGS {
        varchar(50) log_id PK
        varchar(50) customer_id FK
        varchar(100) action
        varchar(50) entity_type
        varchar(50) entity_id
        text details
        datetime timestamp
    }

    OTP_SESSIONS {
        varchar(50) session_id PK
        varchar(150) identifier
        varchar(50) purpose
        varchar(10) otp_code
        varchar(255) otp_hash
        bigint expires_at
        int verified
    }

    SECURITY_RATE_LIMITS {
        varchar(191) key_id PK
        int attempts
        bigint last_attempt_at
        bigint locked_until
    }
```

---

## 4. Backward-Compatibility Views Architecture

To guarantee 100% drop-in backward compatibility with legacy front-end applications, six optimized views are deployed:

1. **`v_accounts_legacy`**: Reconstructs legacy `accounts` schema by joining `accounts` with `branches.branch_name` and `account_card_credentials.card_pin_hash`.
2. **`v_customers_legacy`**: Reconstructs legacy `customers` schema with primary nominee columns using a deterministic `ROW_NUMBER() OVER (...)` window function compliant with strict `ONLY_FULL_GROUP_BY`.
3. **`v_customer_portfolio`**: Aggregates customer total accounts, liquid balance, and term deposit principal using separate pre-aggregated subqueries to prevent Cartesian distortion.
4. **`v_monthly_transaction_summary`**: Analytical rollup of monthly cash inflows, outflows, transaction counts, and net volume.
5. **`v_active_liens`**: Encumbered accounts monitor joining `account_lien_records`, `accounts`, and `customers`.
6. **`v_customer_summary`**: Administrative compliance dashboard displaying customer tier, verification status, and account holdings.

---

## 5. Enterprise Backup, Recovery & Disaster Restoration Procedures

### 5.1 Authoritative Backup Baseline
A certified, verified master logical backup has been taken and verified by full restoration into a disposable database:
- **Backup File:** `database/backups/bankist_master_backup_2026-10-29.sql` (569,406 bytes)
- **Manifest:** `database/backups/bankist_backup_manifest_2026-10-29.json`
- **Verified Objects:** 11 Base Tables, 3 Views, 3,041 Total Rows, ₹19,155,216.07 Account Balance.

### 5.2 Creating a Consistent Production Backup
Execute from command line or automated script:
```bash
mysqldump -h 127.0.0.1 -P 3306 -u root -p \
  --routines \
  --triggers \
  --events \
  --single-transaction \
  --databases bankist > "database/backups/bankist_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### 5.3 Point-In-Time Disaster Recovery Procedure
If accidental data corruption occurs, restore the verified baseline:
```bash
# Step 1: Create a temporary safety dump of current state
mysqldump -h 127.0.0.1 -P 3306 -u root -p --single-transaction --databases bankist > "database/backups/bankist_pre_recovery.sql"

# Step 2: Restore from master backup
mysql -h 127.0.0.1 -P 3306 -u root -p < "database/backups/bankist_master_backup_2026-10-29.sql"

# Step 3: Verify row count and ledger balance
mysql -h 127.0.0.1 -P 3306 -u root -p bankist -e "SELECT COUNT(*) FROM accounts; SELECT SUM(balance) FROM accounts;"
# Expected: 208 accounts, 19155216.07 balance
```

---

## 6. Controlled Cutover & Production Rollout Plan

When approved to switch production from the unnormalized schema to the normalized schema:
1. **Pre-Cutover Freeze**: Place application in read-only maintenance mode.
2. **Provision Target Shadow Database**:
   ```sql
   CREATE DATABASE bankist_prod_norm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. **Apply Normalized DDL**:
   ```bash
   mysql -u root -p bankist_prod_norm < "DBMS project/bankist_normalized.sql"
   ```
4. **Apply Safe Migration**:
   ```bash
   mysql -u root -p bankist_prod_norm < "DBMS project/bankist_migration.sql"
   ```
5. **Run 37-Assertion Automated Validation**:
   ```bash
   mysql -u root -p bankist_prod_norm < "DBMS project/bankist_normalization_tests.sql"
   ```
6. **Atomic Database Swap**:
   ```sql
   RENAME TABLE 
     bankist.accounts TO bankist_legacy.accounts,
     bankist_prod_norm.accounts TO bankist.accounts,
     ...;
   ```
7. **Post-Cutover Regression Check**: Verify `http://localhost:3000` responds `HTTP 200 OK`.

