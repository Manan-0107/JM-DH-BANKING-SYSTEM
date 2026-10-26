# JM-DH Banking System — Database Schema & Data Dictionary

**RDBMS**: MySQL 8.0+ (Enterprise) & SQLite 3 (Embedded Fallback)  
**Character Set**: `utf8mb4`  
**Collation**: `utf8mb4_unicode_ci`  
**Storage Engine**: `InnoDB` (ACID Compliant)  
**Author**: Senior Database Architect  

---

## 1. Relational Entities Summary

| Table Name | Primary Key | Description & Domain Role | Expected Scale |
| :--- | :--- | :--- | :--- |
| **`customers`** | `customer_id` | Master customer profile, identity credentials, CIBIL credit rating, and tier. | $10^2$ to $10^5$ |
| **`accounts`** | `account_number` | Deposit and liquidity ledger accounts owned by customers. | $10^2$ to $10^5$ |
| **`transactions`** | `transaction_id` | Immutable double-entry financial ledger recording debits, credits, and UTRs. | $10^3$ to $10^6$ |
| **`kyc_verifications`**| `verification_id` | Regulatory identity verification audit trail (PAN, Aadhaar, Video KYC). | $10^2$ to $10^5$ |
| **`beneficiaries`** | `beneficiary_id` | Registered payee records for NEFT/RTGS/IMPS fund transfers. | $10^2$ to $10^5$ |
| **`deposits`** | `deposit_id` | Term deposit contracts (Fixed Deposits & Recurring Deposits) with maturity schedules. | $10^2$ to $10^4$ |
| **`branches`** | `branch_id` | Physical bank branch network and RBI IFSC routing directory. | $10^1$ to $10^2$ |
| **`audit_logs`** | `log_id` | Immutable security and regulatory compliance audit trail. | $10^3$ to $10^6$ |
| **`otp_sessions`** | `session_id` | Two-factor authentication challenge sessions (Bcrypt OTP hash). | Ephemeral |
| **`account_lien_records`**| `lien_id` | Legal liens and funds holds (Demonstrates `ON DELETE RESTRICT`). | $10^1$ to $10^3$ |
| **`mv_branch_financial_summary`**| `ifsc_code`| Physically materialized branch summary snapshot table. | Aggregated |

---

## 2. Detailed Data Dictionary Tables

### 2.1 Table: `customers`
Stores primary customer identity records.

| Column Name | Data Type | Nullable | Key / Default | Constraints & Domain Invariants | Business Purpose |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `customer_id` | `VARCHAR(50)` | NO | PRIMARY KEY | Format: `CUST-XXXX` | Unique customer entity identifier. |
| `full_name` | `VARCHAR(150)`| NO | None | `NOT NULL` | Legal customer name as verified against PAN. |
| `email` | `VARCHAR(150)`| NO | UNIQUE | Valid email format | Primary net banking login identifier. |
| `phone` | `VARCHAR(30)` | YES | None | Optional mobile contact | Mobile number for 2FA OTP challenges. |
| `dob` | `DATE` | YES | None | Historical date | Customer birthdate for KYC validation. |
| `address` | `TEXT` | YES | None | Physical residence | Physical address for correspondence. |
| `created_at` | `DATETIME` | YES | `CURRENT_TIMESTAMP` | Ingestion timestamp | Account registration timestamp. |
| `status` | `ENUM` | YES | `'Active'` | `'Active', 'Suspended', 'Pending'` | Account operational lifecycle status. |
| `kyc_status` | `ENUM` | YES | `'Pending'` | `'Pending', 'Verified', 'Rejected'` | Regulatory KYC compliance status. |
| `password_hash`| `VARCHAR(255)`| NO | None | Bcrypt hash (Cost 10) | Encrypted password credential. Plaintext never stored. |
| `card_pin_hash`| `VARCHAR(255)`| YES | None | Bcrypt hash (Cost 10) | Encrypted 4-digit debit PIN. Plaintext never stored. |
| `credit_score` | `INT` | YES | `700` | `CHECK (300 <= credit_score <= 900)` | CIBIL credit rating score. |
| `tier` | `ENUM` | YES | `'Silver'` | `'Silver', 'Gold', 'Platinum', 'VIP'` | Relationship banking tier. |
| `pan_number` | `VARCHAR(20)` | YES | None | Masked/verified PAN | Indian Permanent Account Number. |
| `aadhaar_number`| `VARCHAR(20)` | YES | None | Masked (XXXXXXXX1234) | Masked Aadhaar identifier. |

---

### 2.2 Table: `accounts`
Stores liquid financial accounts (Savings & Current).

| Column Name | Data Type | Nullable | Key / Default | Constraints & Domain Invariants | Business Purpose |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `account_number` | `VARCHAR(50)` | NO | PRIMARY KEY | Format: `ACC-XXXXXX` | Core banking account number. |
| `customer_id` | `VARCHAR(50)` | NO | FOREIGN KEY | References `customers(customer_id)` `ON DELETE CASCADE` | Legal account holder. |
| `account_type` | `VARCHAR(50)` | NO | None | `'Savings Account', 'Current Account'` | Banking product subtype. |
| `balance` | `DECIMAL(15,2)`| NO | `0.00` | `CHECK (balance >= 0.00)` | Liquid balance. Negative balances strictly prohibited. |
| `ifsc_code` | `VARCHAR(20)` | NO | FOREIGN KEY | References `branches(ifsc_code)` | Domicile branch IFSC routing code. |
| `branch_name` | `VARCHAR(100)`| NO | `'Downtown Central'` | Descriptive branch | Name of domicile branch. |
| `opening_date` | `DATETIME` | YES | `CURRENT_TIMESTAMP` | Timestamp | Date account was opened. |
| `status` | `ENUM` | YES | `'Active'` | `'Active', 'Frozen', 'Closed'` | Operational state. Transfers blocked if Frozen. |
| `card_pin_hash` | `VARCHAR(255)`| YES | None | Bcrypt hash | Account-specific card PIN hash. |

---

### 2.3 Table: `transactions`
Double-entry financial ledger recording all debit and credit movements.

| Column Name | Data Type | Nullable | Key / Default | Constraints & Domain Invariants | Business Purpose |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `transaction_id` | `VARCHAR(50)` | NO | PRIMARY KEY | Format: `TXN-XXXXXXXX` | Immutable transaction record key. |
| `sender_account` | `VARCHAR(50)` | YES | INDEX | `NULL` for inward deposits | Debited source account. |
| `receiver_account`| `VARCHAR(50)` | YES | INDEX | `NULL` for outward withdrawals | Credited destination account. |
| `amount` | `DECIMAL(15,2)`| NO | None | `CHECK (amount > 0.00)` | Monetary transfer value in INR. Strictly positive. |
| `type` | `VARCHAR(30)` | NO | None | `'Transfer', 'Deposit', 'Withdrawal', 'UPI'` | Financial rail/transaction category. |
| `date_time` | `DATETIME` | YES | `CURRENT_TIMESTAMP` | Chronological index | Exact execution timestamp. |
| `status` | `VARCHAR(30)` | YES | `'Success'` | `'Success', 'Failed', 'Pending'` | Settlement status. |
| `description` | `TEXT` | YES | None | Free text | Narrative / remarks / counterparty details. |
| `reference_number`| `VARCHAR(100)`| YES | UNIQUE | RBI UTR format | Unique payment settlement identifier. |

---

### 2.4 Table: `deposits`
Fixed and recurring term deposit contracts.

| Column Name | Data Type | Nullable | Key / Default | Constraints & Domain Invariants | Business Purpose |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `deposit_id` | `VARCHAR(50)` | NO | PRIMARY KEY | Format: `FD-XXXX` / `RD-XXXX` | Term deposit contract reference. |
| `customer_id` | `VARCHAR(50)` | NO | FOREIGN KEY | References `customers(customer_id)` `ON DELETE CASCADE` | Depositor customer ID. |
| `linked_account`| `VARCHAR(50)` | NO | None | References `accounts(account_number)` | Operative account used for debits and maturity credits. |
| `deposit_type` | `VARCHAR(50)` | NO | None | `'Fixed Deposit', 'Recurring Deposit'` | Term product category. |
| `principal_amount`| `DECIMAL(15,2)`| NO | None | `CHECK (principal_amount >= 1000.00)` | Initial principal sum invested. |
| `interest_rate` | `DECIMAL(5,2)` | NO | None | Annual APR (e.g., 7.50) | Contractual interest rate percentage. |
| `tenure_months` | `INT` | NO | None | `CHECK (1 <= tenure_months <= 120)` | Lock-in duration in months. |
| `maturity_amount`| `DECIMAL(15,2)`| NO | None | Calculated compound yield | Total payout upon maturity horizon. |
| `maturity_date` | `DATE` | NO | None | Future date | Scheduled contract completion date. |
| `status` | `ENUM` | YES | `'Active'` | `'Active', 'Matured', 'Liquidated'` | Deposit operational status. |
| `created_at` | `DATETIME` | YES | `CURRENT_TIMESTAMP` | Timestamp | Booking timestamp. |

---

### 2.5 Table: `beneficiaries`
External and intra-bank transfer recipients registered by customers.

| Column Name | Data Type | Nullable | Key / Default | Constraints & Domain Invariants | Business Purpose |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `beneficiary_id` | `VARCHAR(50)` | NO | PRIMARY KEY | Format: `BEN-XXXX` | Beneficiary mapping identifier. |
| `customer_id` | `VARCHAR(50)` | NO | FOREIGN KEY | References `customers(customer_id)` `ON DELETE CASCADE` | Owning customer. |
| `beneficiary_name`| `VARCHAR(150)`| NO | None | Legal payee name | Recipient legal entity name. |
| `account_number` | `VARCHAR(50)` | NO | None | Destination account string | Destination bank account number (Can be external). |
| `ifsc_code` | `VARCHAR(20)` | NO | None | Valid 11-char IFSC | Payee branch IFSC code. |
| `bank_name` | `VARCHAR(150)`| NO | None | Bank title | Recipient institution name. |
| `transfer_limit` | `DECIMAL(15,2)`| YES | `100000.00` | Max single transfer limit | Risk mitigation transfer limit. |
| `cooling_until` | `DATETIME` | YES | `NULL` | Anti-fraud threshold | Cooling period timestamp during which transfers are restricted. |
| `created_at` | `DATETIME` | YES | `CURRENT_TIMESTAMP` | Timestamp | Beneficiary registration timestamp. |
| `is_active` | `TINYINT(1)` | YES | `1` | `1 = Active, 0 = Inactive` | Beneficiary whitelist status. |

---

### 2.6 Table: `branches`
Bank branch office reference directory.

| Column Name | Data Type | Nullable | Key / Default | Constraints & Domain Invariants | Business Purpose |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `branch_id` | `VARCHAR(50)` | NO | PRIMARY KEY | Format: `BR-XXX` | Internal branch identifier. |
| `branch_name` | `VARCHAR(100)`| NO | None | Official branch title | Descriptive name of banking hub. |
| `ifsc_code` | `VARCHAR(20)` | NO | UNIQUE | `CHECK (LENGTH(ifsc_code) = 11)` | Unique RBI IFSC clearing code. |
| `city` | `VARCHAR(100)`| NO | None | Geographic city | Municipality/city of operation. |
| `address` | `TEXT` | NO | None | Physical location | Street address and postal PIN. |
| `timing` | `VARCHAR(50)` | YES | `'09:30 AM - 04:30 PM'`| Operating hours | Banking hours for public operations. |
| `phone` | `VARCHAR(30)` | YES | None | Landline contact | Customer support telephone. |
| `status` | `VARCHAR(20)` | YES | `'Active'` | `'Active', 'Closed'` | Operational state of branch. |

---

### 2.7 Table: `audit_logs`
Security and regulatory audit logging.

| Column Name | Data Type | Nullable | Key / Default | Constraints & Domain Invariants | Business Purpose |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `log_id` | `VARCHAR(50)` | NO | PRIMARY KEY | UUID or `AUDIT-UUID` | Immutable event identifier. |
| `customer_id` | `VARCHAR(50)` | YES | None | Optional customer token | Actor or subject customer entity. |
| `action` | `VARCHAR(100)`| NO | None | Event classification | Action code (e.g., `ACCOUNT_STATUS_TRANSITION`). |
| `entity_type` | `VARCHAR(50)` | NO | None | Target domain entity | `ACCOUNT`, `CUSTOMER`, `TRANSACTION`. |
| `entity_id` | `VARCHAR(50)` | YES | None | Entity primary key | Identifier of modified record. |
| `details` | `TEXT` | YES | None | Redacted JSON payload | Structured narrative of mutation. |
| `timestamp` | `DATETIME` | YES | `CURRENT_TIMESTAMP` | Ingestion timestamp | Non-repudiable event timestamp. |
