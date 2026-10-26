# Bharat Trust Bank (BTB) — Core Banking DBMS Project

A database-driven banking web application for academic DBMS demonstration, featuring atomic financial transactions, concurrency safety, row-level authorization, and dual-mode database support.

---

## 📁 Repository Directory Structure & Authoritative Application Root

This repository preserves legacy project iterations while establishing the modern Next.js 14 application as authoritative:

| Directory | Status | Description |
| :--- | :--- | :--- |
| **`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/`** | **⭐ AUTHORITATIVE** | **Active Modern Application**: Next.js 14 App Router, dual-engine database adapter (SQLite/MySQL), Tailwind CSS, API endpoints, and verification test suites. |
| `DBMS project/bankist.sql` | Supporting | Production MySQL 8.0 schema and seed DDL script. |
| `DBMS_VIVA_DEMONSTRATION_GUIDE.md` | Documentation | Comprehensive DBMS Viva preparation guide with ER diagrams, 3NF schema, joins, views, and Q&A. |
| `test/` | Legacy Prototype | Earlier Express.js backend prototype (Dhrumil). |
| `og/` | Reference Archive | Original static HTML/CSS/JS frontend mockup (Bankist). |

---

## 🚀 Quick Start (Running the Authoritative App)

### 1. Navigate to Authoritative Project Directory
```bash
cd "DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test"
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
- By default, `USE_MYSQL=false` uses embedded SQLite (`bankist.sqlite`) with automatic table creation and demo seeding out of the box.
- To connect to a live MySQL 8.0+ server, configure `.env`:
```env
USE_MYSQL=true
ALLOW_SQLITE_FALLBACK=false
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bankist
JWT_SECRET=your_secure_32_byte_secret_here
```
> [!IMPORTANT]
> When `USE_MYSQL=true`, the system strictly connects to MySQL and will abort startup if MySQL is unreachable. Automatic fallback to SQLite is only allowed if `ALLOW_SQLITE_FALLBACK=true` is explicitly enabled in development mode (prohibited in production to avoid silent data divergence).

### 3. Install & Start Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Verification Test Suites

### Complete Backend Infrastructure Suite
Validates authentication, row-level authorization, overdraft prevention, multi-threaded concurrency, atomic transaction failure-driven rollback, term deposits, and ATM operations:
```bash
node test_backend_suite.js
```

### End-to-End Database Persistence Verification
Verifies that onboarding grants, transfers, and ledger UTR records persist across full server restarts:
```bash
node test_persistence.js
```

### Advanced DBMS Capstone Verification Suite (MySQL 8.0)
Validates all 31 DBMS criteria including DDL constraints, window functions, recursive CTEs, materialized summary table refreshes, stored routines, triggers, ACID transaction rollbacks, race condition prevention, RBAC roles, and backup parity:
```bash
node scripts/run_all_dbms_tests.js
```

### Synthetic Scale Seed Data Generator
Generates reproducible, relationally-sound synthetic banking data (customers, accounts, transactions, beneficiaries, deposits, and branches) with configurable scale:
```bash
node scripts/generate_seed_data.js --customers 100 --transactions 1000
```

### Static Type Check
```bash
npx tsc --noEmit
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

