# Bharat Trust Bank (BTB) — Core Banking DBMS Project

A production-grade, database-driven banking web application for academic DBMS demonstration, featuring atomic financial transactions, concurrency safety, row-level authorization, and exclusive MySQL 8.0+ enterprise database architecture.

---

## 📁 Repository Directory Structure & Authoritative Application Root

This repository preserves legacy project iterations while establishing the modern Next.js application as authoritative:

| Directory | Status | Description |
| :--- | :--- | :--- |
| **`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/`** | **⭐ AUTHORITATIVE** | **Active Application**: Next.js 15 App Router, MySQL 8.0+ exclusive database adapter, Tailwind CSS, authenticated API endpoints, and verification test suites. |
| `DBMS project/bankist.sql` | Authoritative DDL | Canonical MySQL 8.0 schema, views, constraints, and seed DDL script. |
| `docs/DBMS_VIVA_AND_EVALUATION_GUIDE.md` | Authoritative Guide | Comprehensive 27-point DBMS viva and evaluation guide. |
| `archive/legacy-prototype-express/` | Archived Reference | Historical Express.js prototype from earlier project iteration. |
| `archive/legacy-mockup-og/` | Archived Reference | Historical static HTML/CSS/JS frontend mockup. |

---

## 🚀 Quick Start (Running the Authoritative App)

### 1. MySQL 8.0+ Database Server
Ensure MySQL 8.0+ is running locally on port 3306 and create the `bankist` database:
```sql
CREATE DATABASE IF NOT EXISTS bankist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Import the authoritative schema:
```bash
mysql -u root -p bankist < "DBMS project/bankist.sql"
```

### 2. Navigate to Authoritative Project Directory
```bash
cd "DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test"
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure `.env` with your local MySQL credentials:
```env
# MySQL 8.0 Database Configuration (Exclusive Runtime Engine)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bankist

# JWT Authentication
JWT_SECRET=your_secure_32_byte_secret_here
JWT_EXPIRES_IN=24h

# Security & Demo Flags
ALLOW_TEST_OTP=false
ENABLE_DEMO_GRANT=true
```
> [!IMPORTANT]
> MySQL 8.0+ is the **exclusive, unconditional runtime engine**. All fallback paths have been permanently removed. If MySQL is unreachable, application startup will abort immediately with a fail-closed fatal error.

### 4. Install & Start Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📥 Authoritative CSV Data Integration & Reconciliation

Authoritative banking CSV datasets in the repository root can be safely integrated into MySQL 8.0+ with full referential validation:

### Dependency Order:
1. `branches.csv`
2. `customers.csv`
3. `accounts.csv`
4. `account_lien_records.csv`
5. `beneficiaries.csv`
6. `deposits.csv`
7. `transactions.csv`
8. `kyc_verifications.csv`
9. `audit_logs.csv`
10. `otp_sessions.csv`
11. `security_rate_limits.csv`

### Dry-Run Assessment (No Writes):
```bash
node scripts/import_csv_data.js --dry-run
```

### Live Transactional Import & Reconciliation:
```bash
node scripts/import_csv_data.js
```
*Guarantees: Strict conflict policy preserves active demo users and live balances. Plaintext PINs and OTP codes are strictly scrubbed to NULL with bcrypt hashing enforced.*

---

## 🧪 Automated Verification Test Suites

### 1. MySQL Exclusive Runtime Enforcement
```bash
npm run test:engine
```
Verifies unconditional MySQL connection, failure prevention, and fail-closed rejection of obsolete fallback flags.

### 2. Complete Security Remediation Suite
```bash
node test_security_remediation.js
```
Verifies persistent brute-force lockout, PIN vs password credential separation, HMAC-SHA256 OTP verification, replay protection, and sensitive credential sanitization.

### 3. Complete Backend Infrastructure Suite
```bash
npm run test:backend
```
Validates authentication, row-level authorization, overdraft prevention, multi-threaded concurrency, atomic transaction failure-driven rollback, term deposits, and ATM operations (161 assertions).

### 4. End-to-End Database Persistence Verification
```bash
npm run test:persistence
```
Verifies that onboarding grants, transfers, and ledger UTR records persist across full server restarts.

### 5. CSV Data & Remediation Regression Suite
```bash
node ../../../scripts/test_csv_and_remediation.js
```
Verifies 11-table MySQL schema parity, sensitive credential scrubbing, active login flow, legal lien encumbrance, and deposit lifecycles.

### 6. Static Type Check & Production Build
```bash
npm run type-check
npm run build
```

---

## 🏛️ Advanced DBMS Architecture & Documentation Suite

A complete, university-grade documentation package is located in [`docs/`](./docs/):

1. **[Baseline Audit Report](./docs/DBMS_BASELINE_AUDIT_REPORT.md)**: Repository inspection, active entry point identification, schema diffs, and engine adapter safety.
2. **[ER & Enhanced EER Modeling](./docs/ER_AND_EER_MODELING.md)**: Actual implemented ER diagram vs Enhanced EER conceptual model (account specialization, nominee weak entity).
3. **[Normalization Report (1NF to 5NF)](./docs/NORMALIZATION_REPORT_1NF_TO_5NF.md)**: Functional dependencies, candidate keys, minimal covers, decomposition steps, lossless joins, and normalization vs denormalization trade-offs.
4. **[Relational Algebra & Calculus Guide](./docs/RELATIONAL_ALGEBRA_AND_CALCULUS.md)**: Theoretical operators ($\sigma, \pi, \bowtie, \times, \cup, -, \div$), TRC, DRC, safe expressions, and Codd's equivalence.
5. **[Advanced SQL Directory](./database/advanced-sql/)**: Executable, well-commented SQL modules (`01_ddl_and_integrity.sql` through `10_backup_and_recovery.sql`).
6. **[Indexing & Query Optimization Report](./docs/INDEXING_AND_QUERY_OPTIMIZATION.md)**: B+tree clustered vs secondary indexes, selectivity, composite leftmost prefix rules, and EXPLAIN ANALYZE execution plan metrics.
7. **[ACID Transactions & Concurrency Report](./docs/ACID_TRANSACTIONS_AND_CONCURRENCY.md)**: Atomicity, consistency, isolation levels, multi-threaded race conditions, row-level locking (`SELECT ... FOR UPDATE`), and deadlock avoidance.
8. **[Database Security, RBAC & Roles](./docs/DATABASE_SECURITY_AND_ROLES.md)**: Least-privilege roles (`role_bank_admin`, `role_bank_teller`, `role_bank_auditor`, `role_bank_app_service`), MySQL row-level security patterns, and PII masking.
9. **[Backup & Disaster Recovery Guide](./docs/BACKUP_AND_DISASTER_RECOVERY.md)**: Hot backups (`mysqldump --single-transaction`), isolated sandbox restoration, checksum verification, and Point-In-Time Recovery (PITR).
10. **[Comprehensive Data Dictionary](./docs/DATABASE_SCHEMA_DICTIONARY.md)**: Detailed reference of all 11 tables/views, columns, datatypes, constraints, and business invariants.
11. **[Master Viva & Evaluation Guide](./docs/DBMS_VIVA_AND_EVALUATION_GUIDE.md)**: 27-point concept-to-implementation master matrix and top 25 viva examiner questions with technical proofs.

---

## ℹ️ Academic Simulation Notice

For this college DBMS capstone project:
- **Banking Rails**: Fund transfers, deposits, withdrawals, and UPI transactions execute against the real local relational database (SQLite/MySQL) using ACID transactions. They are not connected to live banking networks (RBI, NPCI, IMPS, NEFT, RTGS).
- **OTP & 2FA**: One-time passcodes and verification sessions are modeled in the database for demonstration and do not dispatch external SMS or carrier messages.
- **KYC & Identity**: PAN verification, Aadhaar demographic checks, and Video KYC flows create relational audit trail entries in `kyc_verifications` to demonstrate banking regulatory compliance schemas. They do not connect to external government identity databases (NSDL/UIDAI).

---

## 📚 Viva Preparation
For examiner demonstration questions, ACID transaction code blocks, and relational algebra queries, refer to [`docs/DBMS_VIVA_AND_EVALUATION_GUIDE.md`](./docs/DBMS_VIVA_AND_EVALUATION_GUIDE.md) and [`DBMS_VIVA_DEMONSTRATION_GUIDE.md`](./DBMS_VIVA_DEMONSTRATION_GUIDE.md).

