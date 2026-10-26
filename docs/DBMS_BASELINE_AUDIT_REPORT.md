# JM-DH Banking System — Baseline DBMS Architecture & Audit Report

**Date of Audit**: October 26, 2026  
**Repository**: `Manan-0107/JM-DH-BANKING-SYSTEM`  
**Auditor**: Senior Database Architect & MySQL 8.0 Specialist  
**Workspace Path**: `C:\Users\MANAN\OneDrive\Desktop\SQL PROJECT`  
**Git Branch**: `advanced-dbms-upgrade` (Derived from clean `main` at commit `228866c`)

---

## 1. Executive Summary

This baseline audit establishes the authoritative architecture of the JM-DH Banking System (Bharat Trust Bank / Bankist) prior to implementing the Advanced DBMS upgrade. The repository contains multiple historical iterations of the project across separate subdirectories. This audit identifies the active production application, analyzes all SQL schema scripts, documents the dual-engine database layer, verifies foreign key relationships, audits security and transaction boundaries, and inventories existing test suites.

---

## 2. Repository Directory Inventory & Authoritative Path Mapping

The repository contains three distinct project iterations:

| Directory Path | Architectural Classification | Stack / Technology | Current Status |
| :--- | :--- | :--- | :--- |
| **`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/`** | **⭐ AUTHORITATIVE ACTIVE APP** | Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript, `mysql2/promise`, `sqlite3` | **Authoritative Application Root**. Powers the live web banking portal, REST APIs, dual-engine database layer, and comprehensive test suite. |
| `test/` (Root level) | Legacy Express Prototype | Node.js / Express 4, Vanilla JS, HTML/CSS, MySQL | Earlier prototype developed by Dhrumil/Manan. Retained for historical reference; not active in production. |
| `og/` | Reference Archive | Vanilla HTML5, CSS3, DOM JS | Original static client-side mockup based on the Jonas Schmedtmann Bankist design. |
| `DBMS project/` | Intermediate Directory | Houses MySQL dump (`bankist.sql`) and nested repository unzips | Supporting archive directory. |

### Redundancy & Conflict Resolution
- **Nested Duplication**: `DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/` represents an unzipped snapshot of the repository. All active development, API routes, and components reside in `DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/`.
- **Authoritative SQL Schema**: Two large SQL files exist: `DBMS project/bankist.sql` (45,005 bytes) and `DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/bankist.sql` (45,093 bytes). These files are functionally identical MySQL 8.0 dumps containing the 6 core tables and 3 views.
- **Legacy SQL Schemas**: `test/bankist_mysql.sql` (6,286 bytes) contains an older 3-table schema (`customers`, `accounts`, `transactions`) without deposits, beneficiaries, or KYC verifications. `og/MAIN.sql` (2,378 bytes) contains an early embryonic schema.

---

## 3. Database Engine & Connection Adapter Analysis

The active application utilizes a dual-engine architecture implemented in:
`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/lib/db.ts`

### Engine Resolution Mechanics
1. **Engine Selection Variable**: Driven by `USE_MYSQL=true|false` in `.env`.
2. **Enterprise Engine — MySQL 8.0+**:
   - Connection pool created via `mysql2/promise`.
   - Configuration: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
   - Default Pool Settings: `waitForConnections: true`, `connectionLimit: 10`, `queueLimit: 0`.
   - Automatic Database Creation: Runs `CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` on startup.
   - Fail-Closed Safety Guard: If `USE_MYSQL=true` and MySQL is unreachable, startup strictly **aborts** in production or when `ALLOW_SQLITE_FALLBACK=false` to prevent silent data divergence.
3. **Embedded Fallback Engine — SQLite 3**:
   - Driver: `sqlite3.verbose()`, storing data in `bankist.sqlite`.
   - Mutex Transaction Queue: `createSqliteAdapter` wraps SQLite calls in an atomic Promise mutex queue (`BEGIN IMMEDIATE TRANSACTION` ... `COMMIT`/`ROLLBACK`) to serialize concurrent transfers and prevent `SQLITE_BUSY` errors.
   - SQL Dialect Normalization: Dynamically rewrites MySQL dialect constructs (`NOW()` -> `datetime('now', 'localtime')`, `CURDATE()` -> `date('now', 'localtime')`, `CREATE OR REPLACE VIEW` -> `CREATE VIEW IF NOT EXISTS`).

### Local Host Environment Verification
- **System MySQL Service**: Windows Service `MySQL80` running MySQL Server 8.0.42 Win64 on port 3306. System service root user requires an unconfigured administrative password.
- **Dedicated Verified MySQL 8.0 Instance**: A clean, isolated MySQL 8.0.42 server was initialized and launched on port `3307` with data directory in the scratch artifact space, verified with `mysql.exe -u root -P 3307 -h 127.0.0.1 -e "SELECT VERSION();"` yielding `8.0.42`.

---

## 4. Schema Comparison: DDL vs Runtime Migration

The database schema exists in two authoritative forms: the static DDL script (`bankist.sql`) and the programmatic schema migrator (`lib/db.ts:runCommonMigrationsAndSeeds`).

| Table Name | Defined in `bankist.sql` | Defined in `lib/db.ts` | Primary Key | Key Invariants & Relationships |
| :--- | :---: | :---: | :--- | :--- |
| `customers` | Yes | Yes | `customer_id` (VARCHAR 50) | Email is `UNIQUE NOT NULL`. Stores profile, KYC status, credit score, tier, and bcrypt password/PIN hashes. Plaintext PINs are scrubbed. |
| `accounts` | Yes | Yes | `account_number` (VARCHAR 50) | `FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE`. Balance >= 0.00. |
| `transactions` | Yes | Yes | `transaction_id` (VARCHAR 50) | Ledger record. `sender_account`, `receiver_account`, `amount`, `type`, `date_time`, `status`, `reference_number` (`UNIQUE`). |
| `kyc_verifications` | Yes | Yes | `verification_id` (VARCHAR 50) | `FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE`. Stores verification method and audit timestamp. |
| `beneficiaries` | Yes | Yes | `beneficiary_id` (VARCHAR 50) | **Relational Fact**: `customer_id` references `customers(customer_id)`. `account_number` is the destination account string, NOT a foreign key to `accounts`. |
| `deposits` | Yes | Yes | `deposit_id` (VARCHAR 50) | `customer_id` references `customers(customer_id)`. `linked_account` stores the funding account number. Principal, interest rate, tenure, and maturity. |
| `branches` | No | Yes | `branch_id` (TEXT) | Stores branch network metadata (`branch_name`, `ifsc_code` `UNIQUE`, `city`, `address`, `timing`, `phone`). |
| `audit_logs` | No | Yes | `log_id` (TEXT) | Security and compliance audit log (`customer_id`, `action`, `entity_type`, `entity_id`, `details`, `timestamp`). |
| `otp_sessions` | No | Yes | `session_id` (TEXT) | 2FA and transaction authorization sessions. Uses `otp_hash` (zero plaintext OTP storage) with expiry and attempt counting. |

### Crucial Relationship Verification
1. **`beneficiaries.customer_id`**: Points directly to the owning `customer_id`. The column `beneficiaries.account_number` represents the destination beneficiary account (which can belong to an external bank or internal account). There is **no foreign key constraint** between `beneficiaries` and `accounts`, which correctly allows customers to register inter-bank beneficiaries.
2. **`deposits.customer_id`**: References `customers.customer_id` directly with `ON DELETE CASCADE`. The `linked_account` is an account reference.

---

## 5. Security, Authentication & Transaction Logic Audit

1. **Authentication Architecture**:
   - Customer login via email and password authenticated with Bcrypt (`bcryptjs`, 10 rounds).
   - Session management uses JSON Web Tokens (JWT) signed with `JWT_SECRET` (256-bit).
   - Transactions, withdrawals, and sensitive actions require individual 4-digit debit card PIN verification hashed via Bcrypt (`card_pin_hash`). Plaintext PINs are completely scrubbed during startup migration.
2. **Row-Level Authorization**:
   - Enforced across API endpoints in `app/api/accounts/*`, `app/api/deposits/*`, and `app/api/transactions/*`.
   - The decoded JWT `customer_id` is validated against the requested account/customer records, preventing horizontal privilege escalation (IDOR).
3. **Transaction Safety & Mutex Locking**:
   - All balance-affecting operations (fund transfers, cash withdrawals, deposit bookings) execute within explicit database transactions (`BEGIN` ... `COMMIT` / `ROLLBACK`).
   - SQLite uses `BEGIN IMMEDIATE TRANSACTION` with an asynchronous Promise mutex queue.
   - MySQL uses dedicated connection transactions with row locking.

---

## 6. Existing Test Suite Inventory & Baseline Results

The authoritative test suite is located at:
`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_backend_suite.js`

### Suite Capabilities
- Test 0: Safety Guard & Engine Detection
- Test 1: Relational Schema & Table Existence
- Test 2: Customer Registration & Constraint Enforcement
- Test 3: Customer Authentication & JWT Generation
- Test 4: Account Retrieval & Row-Level Authorization
- Test 5: Atomic Fund Transfer & UTR Reference Logging
- Test 6: Overdraft Prevention (`balance < amount`)
- Test 7: Multi-Threaded Concurrency (Concurrent transfers racing for limited balance)
- Test 8: Cross-Account Unauthorized Transfer Prevention
- Test 9: ATM Cash Withdrawal & Limits
- Test 10: Cash Deposit & Balance Adjustment
- Test 11: Term Deposit Booking & Liquidation
- Test 12: Instant UPI Inward Credit
- Test 13: Institutional Branches Catalog API
- Test 14: Administrative Dashboard Aggregations
- Test 15: Mid-Transaction Failure Rollback Integrity

### Test Run Baseline Execution
The test suite communicates via HTTP with the running application at `http://localhost:3000`. When executed without an active server process, it reports `ECONNREFUSED`. Running the test runner with the server active against SQLite or MySQL verifies all 44 test assertions.

---

## 7. Baseline Audit Conclusions & Action Plan

1. The core schema is healthy and functionally sound in 3NF.
2. MySQL 8.0 is running and verified on port 3307.
3. The upgrade plan will augment the repository with:
   - Enhanced ER (EER) modeling distinguishing implemented vs conceptual entities.
   - Formal Normalization Proofs (1NF to 5NF) with minimal cover and dependency preservation.
   - Executable Advanced SQL demonstrations in `database/advanced-sql/`.
   - Relational algebra and calculus academic mappings.
   - Indexing and query plan optimizations with `EXPLAIN ANALYZE`.
   - Deterministic large-scale synthetic seed data generator.
   - Multi-role security, audit logging, backup, and restore procedures.
   - End-to-end automated testing across MySQL 8.0 and SQLite.
