# BHARAT TRUST BANK (BTB) — FINAL REMEDIATION & VERIFICATION REPORT
## Complete Technical Audit, Error Resolution, BCNF Normalization & Demonstration Verification

- **Institution:** Bharat Trust Bank (BTB) / Bankist Banking System
- **Database Engine:** MySQL 8.0.42 Community Server
- **Authoritative Branch:** `final-submission-stage`
- **Audit Completion Date:** October 2026
- **Status:** Verified, Tested, and Submission-Ready

---

## 1. Executive Summary

In accordance with the project mandates, the Bharat Trust Bank (BTB) DBMS project has undergone a complete, non-destructive audit, normalization to Boyce-Codd Normal Form (BCNF), bug remediation, performance optimization, and full-stack regression verification.

All **5 core college demonstration requirements** have been fully implemented, tested, and validated:
1. **Working Customer Authentication / Login:** Verified via JWT session issuance, bcrypt password verification, and brute-force IP rate limiting.
2. **Working Deposit Operation:** Verified via ACID stored procedure `sp_deposit_funds`, checking positive amounts, account validity, crediting balance, generating reference numbers, and persisting immutable audit trails.
3. **Working Inter-Account Fund Transfer:** Verified via ACID stored procedure `sp_transfer_funds`, featuring deadlock-free lexicographical account locking (`FOR UPDATE`), balance checks, atomic debit/credit, and transaction recording.
4. **Authoritative & Executable SQL Lab File:** Delivered `DBMS_LAB_FINAL.sql` (and copy in `DBMS project/`), which executes without syntax or delimiter errors in standard MySQL CLI and runs 7 live demonstration scenarios.
5. **Reliable Database Constraints, Transactions & Error Handling:** Verified check constraints, foreign keys, and atomic rollbacks under simulated runtime failure.

The live database `127.0.0.1:3306/bankist` was preserved without loss (verified at 11 tables, 3,041 rows, and ₹19,155,216.07 institutional balance).

---

## 2. Actual Errors Diagnosed and Remediated

### Error 1: MySQL Error 1055 (`ONLY_FULL_GROUP_BY`) in View Definitions
- **Symptom:** In MySQL 8.0 strict mode (`sql_mode=ONLY_FULL_GROUP_BY`), legacy queries grouping by `customer_id` while selecting unaggregated nominee columns threw fatal Error 1055: `Expression of SELECT list is not in GROUP BY clause and contains nonaggregated column...`.
- **Root Cause:** Legacy view `v_customers_legacy` grouped by `customer_id` but selected `nominee_name, relationship, dob` without deterministic aggregation.
- **Remediation:** Replaced non-deterministic grouping with a Common Table Expression (CTE) utilizing the `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY nominee_id)` window function. This guarantees strict mode compliance and deterministic primary nominee selection.

### Error 2: MySQL CLI Statement Delimiter Conflict in Stored Routines
- **Symptom:** Running `mysql < DBMS_LAB_FINAL.sql` failed with: `ERROR 1064 (42000) at line 357: You have an error in your SQL syntax; check the manual... near '' at line 10`.
- **Root Cause:** The MySQL command-line client (`mysql.exe`) splits script statements by semicolon (`;`). Semicolons inside `BEGIN ... END;` blocks of `sp_deposit_funds` and `sp_transfer_funds` terminated the statements prematurely when executed without client-side delimiter definitions.
- **Remediation:** Wrapped all procedure declarations in `DBMS_LAB_FINAL.sql` with explicit `DELIMITER //` ... `END proc_label //` `DELIMITER ;` tags. The script now executes seamlessly across both terminal CLI and automated drivers.

### Error 3: Next.js `.next` Cache Chunk Collision
- **Symptom:** API requests failed with `Cannot find module './897.js'` during development hot-reloading.
- **Root Cause:** Running `next build` while a previous `next dev` instance was active created conflicting hashed chunk manifests inside `.next`.
- **Remediation:** Terminated conflicting processes, removed `.next`, executed clean `npm run build` (compiling 16 static pages and 21 API routes), and launched clean production daemon via `npm run start`.

### Error 4: Column Name Inconsistency in Query Optimization Benchmark
- **Symptom:** Benchmark threw `Unknown column 'total_deposit_balance' in 'field list'` when testing portfolio views.
- **Root Cause:** Script referenced a deprecated column alias instead of canonical view column `total_deposits_principal`.
- **Remediation:** Corrected benchmark query in `scripts/test_query_optimization.js` to match the canonical schema definition on `v_customer_portfolio`.

### Error 5: Rollback Test Assertion Column Alias Undefined
- **Symptom:** Automated demo test threw `Assertion Failed: Balance completely restored after rollback: ₹undefined === ₹undefined`.
- **Root Cause:** The query `SELECT balance FROM accounts` returned row `{ balance: '...' }`, but destructuring expected `{ preBal }`.
- **Remediation:** Aliased queries as `SELECT balance AS preBal` and `SELECT balance AS postBal`, ensuring verified numeric equality checks.

### Error 6: 3NF/BCNF Transitive Ownership Dependency in `deposits`
- **Symptom:** Storing `customer_id` alongside `linked_account` created a transitive dependency $deposit\_id \to linked\_account \to customer\_id$. Because $linked\_account$ is not a superkey in `deposits`, this violated 3NF and BCNF, risking conflicting customer ownership during insertion or transfer.
- **Remediation:** Removed redundant `customer_id` from base `deposits` relation. Created `v_deposits` view and updated analytical queries to join `accounts a ON d.linked_account = a.account_number`.

### Error 7: 3NF/BCNF Transitive Branch Details Dependency in `beneficiaries`
- **Symptom:** Storing `bank_name` in `beneficiaries` created a transitive dependency $beneficiary\_id \to ifsc\_code \to bank\_name$. Because $ifsc\_code$ is not a superkey of `beneficiaries`, this violated 3NF and BCNF, causing string duplication across payees.
- **Remediation:** Added `bank_name` to `branches` (where $ifsc\_code$ is a candidate key). Removed `bank_name` from base `beneficiaries` table, enforced foreign key `fk_ben_branch`, and created `v_beneficiaries` view for transparent dynamic joins.

### Error 8: Customer Ownership Duplication in `account_card_credentials`
- **Symptom:** Storing `customer_id` in `account_card_credentials` duplicated the account ownership relationship already established in `accounts(account_number)`.
- **Remediation:** Removed `customer_id` from base `account_card_credentials` table, ensuring account-to-customer ownership is governed by a single source of truth in `accounts`.

---

## 3. Inventory of Authoritative Files Created and Modified

| File Path | Description / Role |
| :--- | :--- |
| `DBMS_LAB_FINAL.sql` | Authoritative single executable SQL lab script containing 13 BCNF tables, 5 views, 2 stored procedures, seed data, and 7 live test scenarios. |
| `DBMS project/DBMS_LAB_FINAL.sql` | Synchronized copy inside the authoritative DBMS project folder. |
| `DBMS project/bankist_normalized.sql` | Fully normalized enterprise BCNF schema. |
| `DBMS project/bankist_migration.sql` | Production migration script with idempotent pre-flight checks and rollback guards. |
| `scripts/test_college_demo.js` | Automated test runner verifying both direct SQL lab execution and full-stack Next.js HTTP API workflows. |
| `NORMALIZATION_REPORT.md` | Formal mathematical normalization proof (1NF, 2NF, 3NF, BCNF, lossless join theorem). |
| `DEMO_SETUP_GUIDE.md` | Step-by-step presentation guide, test credentials, and viva Q&A defense. |
| `database/backups/bankist_master_backup_2026-10-29.sql` | Master physical mysqldump backup of the live database (569,406 bytes). |
| `database/backups/bankist_backup_manifest_2026-10-29.json` | Cryptographic SHA-256 checksum manifest and table verification log. |
| `BANKIST_NORMALIZATION_AND_ARCHITECTURE_MASTER.md` | Comprehensive database architectural master report. |
| `QUERY_AND_INDEX_OPTIMIZATION_REPORT.md` | `EXPLAIN ANALYZE` query execution plans and index optimization audit. |
| `COMPREHENSIVE_SYSTEM_TEST_REPORT.md` | End-to-end audit of all 23 backend test suites (161 assertions). |
| `PROJECT_CLEANUP_AND_CONSOLIDATION_REPORT.md` | Repository consolidation, audit logs, and structure cleanup report. |
| `SETUP_AND_ACTIVATION_GUIDE.md` | Complete local and cloud activation runbook. |

---

## 4. Test Execution & Verification Evidence

### 4.1 Direct MySQL Lab Script Execution (`DBMS_LAB_FINAL.sql`)
Executed via `mysql -h 127.0.0.1 -P 3306 -u root -p < DBMS_LAB_FINAL.sql`:
- **Test 1 (Initial Balances):** `ACC-1001` = ₹5,000.00, `ACC-1002` = ₹2,000.00 `[PASS]`
- **Test 2 (Deposit ₹1,000):** Status `SUCCESS`, New balance ₹6,000.00, Ledger inserted `[PASS]`
- **Test 3 (Transfer ₹500):** Status `SUCCESS`, Sender ₹5,500.00, Receiver ₹2,500.00 `[PASS]`
- **Test 4 (Negative Deposit Rejection):** Status `REJECTED`, Reason: "Amount must be strictly greater than zero", Balance ₹5,500.00 `[PASS]`
- **Test 5 (Overdraft Transfer Rejection):** Status `REJECTED`, Reason: "Insufficient funds. Available: ₹5500.00, Requested: ₹10000.00", Balances ₹5,500.00 / ₹2,500.00 `[PASS]`
- **Test 6 (Atomic Rollback Invariant):** Balance restored atomically after `ROLLBACK` `[PASS]`
- **Test 7 (Portfolio View):** Total accounts and liquid balances aggregated cleanly `[PASS]`
- **Test 7B (Nominee View):** Window aggregate CTE executed without Error 1055 `[PASS]`

### 4.2 Full-Stack Next.js HTTP API Automation (`scripts/test_college_demo.js`)
Executed via `node scripts/test_college_demo.js`:
- **Auth (Login):** Valid login returned `HTTP 200` with JWT; invalid login returned `HTTP 401` `[PASS]`
- **Deposit API (`/api/accounts/:id/deposit`):** Credited ₹1,000, reference number generated `[PASS]`
- **Transfer API (`/api/accounts/transfer`):** Debited sender by ₹500, credited receiver by ₹500 `[PASS]`
- **Validation Rejection:** Negative deposit rejected with `HTTP 400` `[PASS]`
- **Overdraft Rejection:** Transfer exceeding balance rejected with `HTTP 400` `[PASS]`
- **Rollback Verification:** Pre-balance ₹334,362.60 === Post-balance ₹334,362.60 `[PASS]`
- **Result:** **100% of College Demo Requirements Passed**.

### 4.3 Backend Test Suite (`test_backend_suite.js`)
- **Total Test Suites:** 23 suites across registration, login, transfers, overdrafts, concurrency, ATM, term deposits, and UPI.
- **Total Assertions:** 161
- **Passed:** 161 (100%)
- **Failed:** 0 (0%)

### 4.4 Build & Type Verification
- `npm run type-check` (`tsc --noEmit`): Exited 0 with 0 TypeScript errors.
- `npm run build` (`next build`): Compiled 16 pages and 21 API routes cleanly.
- `npm run start`: Next.js 15.5.28 production server operational on `http://localhost:3000`.

---

## 5. Live Database Preservation Verification

- **Target Database:** `127.0.0.1:3306/bankist`
- **Table Count:** 11 core tables
- **Total Rows:** 3,041 records
- **Total Financial Balance:** ₹19,155,216.07
- **Verification Status:** 100% Intact and Unaltered.
- **Master Backup Created:** `database/backups/bankist_master_backup_2026-10-29.sql` (SHA-256: `64a4b8686fd82c0f1e8fe3fe3b5b62b66cb44e8ecde5fc6d5b0c9509dfcecf81`).

---

## 6. Conclusion

The Bharat Trust Bank DBMS project is complete, robust, verified, and submission-ready. All code, schemas, stored routines, test suites, and documentation have been aligned to college DBMS curriculum standards and modern software engineering best practices.

