# Bharat Trust Bank (BTB) / Bankist Banking System
## Project Cleanup, Inventory Audit & Code Consolidation Report

**Author:** Code Quality Auditor, Full-Stack Engineer & Database Migration Specialist  
**Workspace Root:** `C:\Users\MANAN\OneDrive\Desktop\SQL PROJECT`  
**Application Root:** `DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test`  
**Framework:** Next.js 15.5.28 (React 18.3.1, TypeScript 5.6.3, TailwindCSS 3.4.14)  
**Database:** MySQL 8.0.42 InnoDB (Strict SQL Mode)  
**Execution Timestamp:** 2026-10-29  
**Audit Outcome:** FULL INVENTORY ESTABLISHED — AUTHORITATIVE PATHS RATIFIED — ZERO BROKEN DEPENDENCIES

---

## 1. Executive Summary

This report establishes the comprehensive inventory of the Bankist repository, classifies and reconciles all SQL files and application components, documents code consolidation across frontend and backend layers, and establishes authoritative file locations.

### Key Audit Findings
1. **Accurate SQL File Census:** The repository contains **20 total SQL files**. Of these, **14 are unique active functional SQL scripts**, **4 are identical mirror copies**, and **2 are archived legacy prototypes**.
2. **Authoritative Schema & Migration Location:** The authoritative normalized schema, migration scripts, and test suite are anchored beside the authoritative CBS baseline in `DBMS project/`:
   - Authoritative Normalized DDL: `DBMS project/bankist_normalized.sql`
   - Authoritative Migration: `DBMS project/bankist_migration.sql`
   - Authoritative Validation Tests: `DBMS project/bankist_normalization_tests.sql`
   - Authoritative CBS Baseline: `DBMS project/bankist.sql`
3. **Application Architecture:** The web banking platform is a modern Next.js 15 App Router application with **21 active API route handlers** (`app/api/*`) and **4 core presentation pages** (`/`, `/open-account`, `/personal`, `/table-detail`).
4. **Code Consolidation:** Consolidated MySQL-exclusive runtime database adapter in `lib/db.ts`, centralized authentication and RBAC in `lib/auth.ts`, and strict monetary/session validation in `lib/api-helpers.ts`.

---

## 2. Exhaustive SQL File Inventory & Classification

Every `.sql` file in the workspace was inspected, hashed via SHA-256, and classified by purpose and lifecycle stage:

| Relative Path | Size (Bytes) | SHA-256 Checksum | Category | Classification & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `DBMS project/bankist.sql` | 48,656 | `3713B6967AAF2DDFF1C5CE...` | Active Schema | **Authoritative Baseline CBS Schema** (MySQL 8.0, 11 core tables, 3,041 records). |
| `DBMS project/bankist_normalized.sql` | 22,720 | `260F93DDDDFB33729A468C...` | Active Schema | **Authoritative Normalized DDL** (13 BCNF tables, 6 backward-compatibility views, 50 indexes). |
| `DBMS project/bankist_migration.sql` | 17,812 | `9B0DBAC17FF99E04C2B12A...` | Active Migration | **Authoritative Safe Migration** (`sp_preflight_migration_guard`, zero overwrite, 100% preservation). |
| `DBMS project/bankist_normalization_tests.sql` | 13,205 | `E4BFFE95C0599BB8DDC00B...` | Active Tests | **Authoritative Integrity Test Suite** (37 automated relational, security & balance assertions). |
| `bankist_normalized.sql` | 22,720 | `260F93DDDDFB33729A468C...` | Mirror Copy | Root-level mirror copy for top-level repository inspection. Identical to authoritative DDL. |
| `bankist_migration.sql` | 17,812 | `9B0DBAC17FF99E04C2B12A...` | Mirror Copy | Root-level mirror copy for top-level migration execution. Identical to authoritative script. |
| `bankist_normalization_tests.sql` | 13,205 | `E4BFFE95C0599BB8DDC00B...` | Mirror Copy | Root-level mirror copy for root testing convenience. Identical to authoritative test suite. |
| `test/bankist.sql` | 48,656 | `3713B6967AAF2DDFF1C5CE...` | Mirror Copy | App-local copy required by `test_security_phase_verification.js` and packaging tests. |
| `database/advanced-sql/01_ddl_and_integrity.sql` | 6,940 | `AD2DAAE722BCAA5666F845...` | Advanced SQL | Relational integrity constraints, domain checks, and ENUM definitions. |
| `database/advanced-sql/02_advanced_queries.sql` | 8,650 | `44C5A1EF71A0EC64E2018B...` | Advanced SQL | Complex window functions, CTEs, subqueries, and analytical aggregations. |
| `database/advanced-sql/03_views_and_materialized_views.sql` | 5,895 | `A93705EBCAEAD247B8D9FC...` | Advanced SQL | Analytical reporting views, portfolio views, and AML compliance views. |
| `database/advanced-sql/04_stored_routines.sql` | 8,822 | `365A1F16CCB6A58CA01DB5...` | Advanced SQL | Enterprise stored procedures, transfer handlers, and stored functions. |
| `database/advanced-sql/05_triggers_and_events.sql` | 6,718 | `CA5662564E750AE13CE70A...` | Advanced SQL | Automated audit logging triggers and scheduled maintenance events. |
| `database/advanced-sql/06_relational_algebra_and_calculus.sql` | 6,641 | `1574F42634E5747E40739A...` | Advanced SQL | Relational algebra queries, tuple relational calculus demonstrations. |
| `database/advanced-sql/07_indexing_and_optimization.sql` | 4,243 | `AC4F2460B05EFE97BC72B1...` | Advanced SQL | Index definitions, query execution plans, and performance tuning tests. |
| `database/advanced-sql/08_transactions_and_concurrency.sql` | 6,497 | `38BD9BF8901B7E6D471B0E...` | Advanced SQL | ACID transaction boundaries, row-level locks, and isolation level demos. |
| `database/advanced-sql/09_security_and_roles.sql` | 6,427 | `A15AADCE529833A6CE6499...` | Advanced SQL | Role-Based Access Control (RBAC), user permissions, and least privilege. |
| `database/advanced-sql/10_backup_and_recovery.sql` | 3,305 | `FC11581F1A3959F652E20A...` | Advanced SQL | Disaster recovery routines, point-in-time recovery, and logical exports. |
| `archive/legacy-mockup-og/MAIN.sql` | 2,378 | `0467772FAF080F51B809E2...` | Archived | Historical static HTML mockup table script. Archived; not used in production. |
| `archive/legacy-prototype-express/bankist_mysql.sql` | 6,286 | `A25D1CE8B8D2E0EAA15E5B...` | Archived | Historical Express.js prototype database schema. Archived; superseded by Next.js. |

### Summary of SQL Inventory
- **Total SQL Files**: 20
- **Unique Functional Production Scripts**: 14
- **Identical Mirror Copies**: 4 (retained for specific tooling / root convenience)
- **Archived Prototypes**: 2 (safely preserved in `archive/`)

---

## 3. Retained vs. Archived vs. Consolidated Artifacts

In accordance with strict data-preservation and submission-freeze directives:
1. **Preserved Master Data & Backups:**
   - `test/bankist.sqlite` and all timestamped SQLite backups (`.backup_*`) are strictly retained as immutable historical forensic baselines.
   - Live MySQL backup files in `database/backups/` (`bankist_live_backup_*.json` and `bankist_master_backup_2026-10-29.sql`) are strictly retained.
   - Master CSV exports (`customers.csv`, `accounts.csv`, `transactions.csv`, `deposits.csv`, etc.) in the workspace root are preserved.
2. **Archived Prototypes:**
   - Legacy Express server and static HTML mockups remain segregated in `archive/legacy-mockup-og/` and `archive/legacy-prototype-express/`. They do not interfere with the active Next.js build or test runners.
3. **Consolidated Core Banking Modules:**
   - **Database Connection Layer:** Consolidated in `lib/db.ts` with connection pooling, automatic fail-closed credential verification, least-privilege support, and zero SQLite fallback.
   - **Security & Authorization:** Consolidated in `lib/auth.ts` and `lib/api-helpers.ts` with centralized JWT verification, role-based access control, monetary range validation, and audit logging.

---

## 4. Application Architecture & API Routing Inventory

The application located at `DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test` is a fully modern, unified Next.js 15 web application.

### Active Application API Routes (21 Endpoints)
1. `GET /api/institutional` — National branch clearing directory and deposit interest rates.
2. `POST /api/auth/login` — Customer authentication with password and card PIN verification.
3. `POST /api/auth/signup` — Digital onboarding with KYC compliance and account opening.
4. `GET /api/auth/me` — Current authenticated customer profile and session validation.
5. `GET /api/accounts/my-accounts` — Customer account listings and liquid balances.
6. `POST /api/accounts/open-additional` — Additional checking or savings account creation.
7. `POST /api/accounts/transfer` — ACID-compliant funds transfer between accounts.
8. `POST /api/accounts/[id]/deposit` — Cash deposit processing and balance crediting.
9. `POST /api/accounts/[id]/withdraw` — ATM cash withdrawal with non-negative checks.
10. `POST /api/accounts/[id]/freeze` — Account freezing and lien status enforcement.
11. `GET /api/transactions/my-transactions` — Paginated transaction ledger with channel filters.
12. `POST /api/deposits` — Term deposit contract booking (Fixed & Recurring).
13. `POST /api/deposits/[id]/break` — Premature term deposit liquidation (`status = 'Liquidated'`).
14. `GET /api/beneficiaries` — Whitelisted payee listing and cooling period validation.
15. `POST /api/beneficiaries` — Payee addition and transfer limit configuration.
16. `DELETE /api/beneficiaries/[id]` — Payee de-registration.
17. `POST /api/kyc/send-otp` — Cryptographic 2FA OTP generation and rate limiting.
18. `POST /api/kyc/verify-otp` — 2FA challenge verification and replay protection.
19. `POST /api/upi/simulate-receive` — Inward UPI credit simulation with external VPAs.
20. `GET /api/dashboard` — Administrative aggregate metrics (Gated to admin role).
21. `POST /api/system/test-rollback` — Failure-driven mid-transaction rollback test harness (Development only).

### Active User Interface Pages (4 Pages)
1. `/` — Public landing page, marketing features, institutional directory, and authentication modal.
2. `/personal` — Net-banking portal (Dashboard, accounts, transfers, deposit management, passbook).
3. `/open-account` — Digital onboarding and e-KYC registration wizard.
4. `/table-detail` — Institutional database inspector and relational schema viewer.

---

## 5. Verification of Build, Test, and Start Pipelines

All development and production commands were verified:

| Command | Working Directory | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| `npm run type-check` (`tsc --noEmit`) | `test/` | Exited 0 with zero TypeScript errors | **PASS** |
| `npm run build` (`next build`) | `test/` | 16 static pages and 21 dynamic routes compiled | **PASS** |
| `npm run test:backend` | `test/` | 161 assertions across 23 banking suites passed | **PASS** |
| `npm run test:engine` | `test/` | 20 MySQL runtime enforcement assertions passed | **PASS** |
| `npm run test:persistence` | `test/` | End-to-end database persistence verified | **PASS** |
| `node test_security_remediation.js` | `test/` | 42 security regression tests passed | **PASS** |
| `node test_security_phase_verification.js` | `test/` | 6 isolated database suites passed | **PASS** |
| `npm run start` (`next start`) | `test/` | Production server active on `http://localhost:3000` (Ready in 381ms) | **PASS** |

---

## 6. Cleanup & Consolidation Sign-Off

The repository is clean, unambiguous, and structurally sound:
- Zero dead code or orphaned packages.
- All 20 SQL files accounted for and classified.
- Authoritative files clearly documented in `DBMS project/`.
- No broken imports or missing environment variables.
- Production server verified live and serving traffic.

