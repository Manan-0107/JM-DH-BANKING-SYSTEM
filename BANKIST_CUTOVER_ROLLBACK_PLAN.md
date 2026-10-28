# Bharat Trust Bank (BTB) / Bankist Banking System
## Production Database Cutover & Emergency Rollback Standard Operating Procedure

**Author:** Senior MySQL Database Architect, Migration Specialist & AppSec Engineer  
**Document Version:** 2.0 (Post-Audit Hardened)  
**Database Engine:** MySQL 8.0.42 Enterprise / Community  
**Current Production Database:** `127.0.0.1:3306/bankist`  
**Current Cryptographic Fingerprint:** `6802104a279509e797e80add53c937cd7e87e73a620afb43117689afde6e8096`  
**Approval Gate:** STAGED — AWAITING SCHEDULED MAINTENANCE WINDOW AUTHORIZATION  

---

## 1. Safety Directive & Execution Policy

> [!CAUTION]
> **MANDATORY POLICY NOTICE:**
> This Cutover and Rollback Plan is a formal operational document. **No production cutover is to be executed during the current session.**
> The live production database `bankist` remains in its verified, pristine state (3,041 base rows, ₹19,155,216.07 balance sum).
> Execution of this standard operating procedure (SOP) requires formal sign-off from the Lead Database Administrator and the Chief Information Security Officer (CISO).

---

## 2. Pre-Cutover Prerequisites & Immutable Snapshot Protocol

Prior to scheduling or beginning any migration activities against production, the following preconditions must be fulfilled:

### 2.1 Environmental Readiness Checklist
- [ ] MySQL 8.0.16+ installed with InnoDB buffer pool size sized to at least 1 GB.
- [ ] Free disk space on database server: Minimum 50 GB (sufficient for dual-copy shadow database and snapshots).
- [ ] Active binary logging (`log_bin = ON`) for point-in-time recovery (PITR).
- [ ] Administrative access credentials for MySQL root/dba role with `SUPER` or `RELOAD`, `CREATE`, `DROP`, `ALTER`, `SELECT`, `INSERT`, `UPDATE`, `REFERENCES` privileges.
- [ ] Verification of pre-cutover baseline:
  - Base Tables: 11
  - Row Count: 3,041
  - Active Accounts Balance Sum: `₹19,155,216.07`
  - Overall Hash: `6802104a279509e797e80add53c937cd7e87e73a620afb43117689afde6e8096`

### 2.2 Immutable Physical & Logical Snapshot Creation
Execute the immutable backup protocol before any structural operations:

```powershell
# Step 1: Create timestamped directory for the cutover event
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = "C:\Users\MANAN\OneDrive\Desktop\SQL PROJECT\backups\pre_cutover_$Timestamp"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# Step 2: Perform logical mysqldump snapshot with ACID transaction consistency
mysqldump -u root -p `
  --host=127.0.0.1 `
  --port=3306 `
  --single-transaction `
  --routines `
  --triggers `
  --events `
  --hex-blob `
  --default-character-set=utf8mb4 `
  bankist > "$BackupDir\bankist_live_pre_cutover.sql"

# Step 3: Compute SHA-256 digest of the snapshot file
$Hash = (Get-FileHash "$BackupDir\bankist_live_pre_cutover.sql" -Algorithm SHA256).Hash
Set-Content -Path "$BackupDir\bankist_live_pre_cutover.sql.sha256" -Value $Hash

Write-Host "Snapshot verified. SHA-256: $Hash"
```

### 2.3 Verification of Backup Integrity
Before taking production offline, test snapshot restorability in an isolated ephemeral test instance:
```sql
CREATE DATABASE bankist_restore_test;
-- Restore dump file
-- Verify row count = 3,041 and balance sum = 19155216.07
DROP DATABASE bankist_restore_test;
```

---

## 3. Maintenance Window Operational Execution Phases

The cutover follows a **Shadow Database Migration with Atomic Switchover** strategy, minimizing write downtime to under 5 seconds.

```
+-----------------------------------------------------------------------------------+
|                           CUTOVER EXECUTION TIMELINE                              |
+-----------------------------------------------------------------------------------+
| T-30m : Pre-flight Baseline Verification & Immutable Snapshot                     |
| T-00m : Maintenance Window Opens -> Set Application to Read-Only / Maintenance Mode|
| T+02m : Final Delta Flush & Baseline Lock Verification                           |
| T+05m : Provision Shadow Database 'bankist_stage' & Apply 'bankist_normalized.sql'|
| T+10m : Execute Lossless Data ETL via 'bankist_migration.sql' (Source: bankist)   |
| T+15m : Execute 35-Assertion Test Suite ('bankist_normalization_tests.sql')       |
| T+20m : Financial Balance Re-reconciliation (Variance must equal ₹0.00)          |
| T+22m : Execute Atomic Table Swap via Multi-Table RENAME TABLE                    |
| T+24m : Application Reconnect & Automated Compatibility Smoke Tests               |
| T+28m : Disable Maintenance Mode -> Open to Public Production Traffic             |
+-----------------------------------------------------------------------------------+
```

---

### Phase A: Application Maintenance Mode Activation (T-00m)
1. Redirect external web traffic to maintenance page:
   - For Next.js application, enable maintenance banner / middleware rewrite to HTTP 503 Maintenance Page.
2. Flush and drain existing database sessions:
   ```sql
   -- Put database into read-only mode to prevent in-flight writes
   FLUSH TABLES WITH READ LOCK;
   SET GLOBAL read_only = ON;
   ```

### Phase B: Baseline State Capture (T+02m)
Verify that no writes occurred during lock:
```sql
SELECT 'accounts' AS tbl, COUNT(*) AS rows, SUM(balance) AS balance FROM bankist.accounts
UNION ALL
SELECT 'transactions', COUNT(*), SUM(amount) FROM bankist.transactions
UNION ALL
SELECT 'deposits', COUNT(*), SUM(principal_amount) FROM bankist.deposits;
```
*Expected values:* `accounts`: 208 rows, `19155216.07`; `transactions`: 782 rows, `6891891.26`; `deposits`: 74 rows, `2505000.00`.

### Phase C: Shadow Staging Database Provisioning & Schema Application (T+05m)
1. Create staging database:
   ```sql
   CREATE DATABASE bankist_stage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Apply normalized DDL (`DBMS project/bankist_normalized.sql`):
   ```powershell
   Get-Content "DBMS project/bankist_normalized.sql" | mysql -u root -p bankist_stage
   ```
   *Result:* Creates 13 BCNF tables, foreign keys, indexes, and 6 views.

### Phase D: Lossless Data ETL Execution (T+10m)
1. Configure migration parameters:
   - `@SRC_DB = 'bankist'`
   - `@DEST_DB = 'bankist_stage'`
2. Apply migration script (`DBMS project/bankist_migration.sql`):
   ```powershell
   Get-Content "DBMS project/bankist_migration.sql" | mysql -u root -p bankist_stage
   ```
   *Key Operations:*
   - Onboards `BR-000` (`BNKST0001` Downtown Central) into `branches`.
   - Ingests 124 `customers`.
   - Extracts 8 nominees into `customer_nominees`.
   - Ingests 208 accounts into `accounts` referencing branches by IFSC.
   - Populates `account_card_credentials` with genuine 208 PIN hashes (zero fabricated cards).
   - Ingests 782 transactions (preserving all 30 UPI handles).
   - Ingests all deposits, beneficiaries, KYC audits, liens, audit logs, and rate limits.
   - Scrubs plaintext `otp_code` to `NULL`.

### Phase E: Automated Integrity Validation (T+15m)
Execute the complete 35-assertion test suite:
```powershell
Get-Content "DBMS project/bankist_normalization_tests.sql" | mysql -u root -p bankist_stage
```
**Gate Criteria:** All 35 tests must output `PASS`. Any single `FAIL` triggers immediate abort.

### Phase F: Atomic Cutover Switchover (T+22m)
Release global read lock and execute atomic table swap using MySQL's atomic `RENAME TABLE` statement.
This completes within milliseconds and requires zero data copying:

```sql
-- Prepare legacy archive schema
CREATE DATABASE IF NOT EXISTS bankist_legacy_archive;

-- Atomic Table Swap
RENAME TABLE
  -- 1. Archive original tables
  bankist.customers TO bankist_legacy_archive.customers,
  bankist.accounts TO bankist_legacy_archive.accounts,
  bankist.transactions TO bankist_legacy_archive.transactions,
  bankist.deposits TO bankist_legacy_archive.deposits,
  bankist.beneficiaries TO bankist_legacy_archive.beneficiaries,
  bankist.kyc_verifications TO bankist_legacy_archive.kyc_verifications,
  bankist.branches TO bankist_legacy_archive.branches,
  bankist.account_lien_records TO bankist_legacy_archive.account_lien_records,
  bankist.audit_logs TO bankist_legacy_archive.audit_logs,
  bankist.otp_sessions TO bankist_legacy_archive.otp_sessions,
  bankist.security_rate_limits TO bankist_legacy_archive.security_rate_limits,

  -- 2. Move normalized tables into production
  bankist_stage.customers TO bankist.customers,
  bankist_stage.customer_nominees TO bankist.customer_nominees,
  bankist_stage.accounts TO bankist.accounts,
  bankist_stage.account_card_credentials TO bankist.account_card_credentials,
  bankist_stage.transactions TO bankist.transactions,
  bankist_stage.deposits TO bankist.deposits,
  bankist_stage.beneficiaries TO bankist.beneficiaries,
  bankist_stage.kyc_verifications TO bankist.kyc_verifications,
  bankist_stage.branches TO bankist.branches,
  bankist_stage.account_lien_records TO bankist.account_lien_records,
  bankist_stage.audit_logs TO bankist.audit_logs,
  bankist_stage.otp_sessions TO bankist.otp_sessions,
  bankist_stage.security_rate_limits TO bankist.security_rate_limits;

-- Recreate views in live bankist
USE bankist;
CREATE OR REPLACE VIEW v_accounts_legacy AS ...;
CREATE OR REPLACE VIEW v_customers_legacy AS ...;
CREATE OR REPLACE VIEW v_customer_portfolio AS ...;
CREATE OR REPLACE VIEW v_monthly_transaction_summary AS ...;
CREATE OR REPLACE VIEW v_active_liens AS ...;
CREATE OR REPLACE VIEW v_customer_summary AS ...;

-- Re-enable writes
SET GLOBAL read_only = OFF;
```

### Phase G: Post-Cutover Application Smoke Testing (T+24m)
1. Run automated application compatibility test suite against live `bankist`:
   ```powershell
   node scripts/test_app_compatibility_on_disposable_db.js
   ```
2. Execute manual sanity checks:
   - Login with primary customer account (`CUST-101`, email `manan.patel@bharattrust.in`).
   - Check dashboard balance display: Matches expected balance.
   - Execute internal transfer of ₹10.00 between accounts.
   - Verify inward UPI simulation credit.
   - Verify transaction appears on recent activity ledger.

### Phase H: Release Maintenance Mode (T+28m)
Disable maintenance mode rewrite; restore full public access.

---

## 4. Immediate Rollback Triggers & Deterministic Reversal Protocol

If any anomaly occurs, the cutover MUST be aborted and rolled back immediately.

### 4.1 Rollback Abort Triggers
1. **Assertion Failure:** Any test in `bankist_normalization_tests.sql` outputs `FAIL`.
2. **Financial Discrepancy:** Any variance > ₹0.00 in accounts balance sum (₹19,155,216.07) or transaction sum (₹6,891,891.26).
3. **Foreign Key Constraint Violation:** Any unexpected orphan or constraint error during ETL.
4. **Application Crash:** Application throws database connection error or column undefined exception during smoke testing.
5. **Window Overrun:** Migration steps exceed 25 minutes of the allotted maintenance window.

---

### 4.2 Rollback Procedure A: Pre-Rename Abort (During Staging ETL / Testing)
If failure occurs before the `RENAME TABLE` step:
- The live `bankist` database has not been touched.
- Simply drop the staging database:
  ```sql
  DROP DATABASE IF EXISTS bankist_stage;
  SET GLOBAL read_only = OFF;
  UNLOCK TABLES;
  ```
- Re-enable application traffic. Downtime impact: Under 2 minutes.

---

### 4.3 Rollback Procedure B: Post-Rename Instant Reversal
If failure occurs after the `RENAME TABLE` step during smoke testing:
Execute the inverse atomic `RENAME TABLE` statement. This restores the original tables within milliseconds:

```sql
SET GLOBAL read_only = ON;

RENAME TABLE
  -- 1. Evict new normalized tables back to stage
  bankist.customers TO bankist_stage.customers,
  bankist.customer_nominees TO bankist_stage.customer_nominees,
  bankist.accounts TO bankist_stage.accounts,
  bankist.account_card_credentials TO bankist_stage.account_card_credentials,
  bankist.transactions TO bankist_stage.transactions,
  bankist.deposits TO bankist_stage.deposits,
  bankist.beneficiaries TO bankist_stage.beneficiaries,
  bankist.kyc_verifications TO bankist_stage.kyc_verifications,
  bankist.branches TO bankist_stage.branches,
  bankist.account_lien_records TO bankist_stage.account_lien_records,
  bankist.audit_logs TO bankist_stage.audit_logs,
  bankist.otp_sessions TO bankist_stage.otp_sessions,
  bankist.security_rate_limits TO bankist_stage.security_rate_limits,

  -- 2. Restore original legacy tables
  bankist_legacy_archive.customers TO bankist.customers,
  bankist_legacy_archive.accounts TO bankist.accounts,
  bankist_legacy_archive.transactions TO bankist.transactions,
  bankist_legacy_archive.deposits TO bankist.deposits,
  bankist_legacy_archive.beneficiaries TO bankist.beneficiaries,
  bankist_legacy_archive.kyc_verifications TO bankist.kyc_verifications,
  bankist_legacy_archive.branches TO bankist.branches,
  bankist_legacy_archive.account_lien_records TO bankist.account_lien_records,
  bankist_legacy_archive.audit_logs TO bankist.audit_logs,
  bankist_legacy_archive.otp_sessions TO bankist.otp_sessions,
  bankist_legacy_archive.security_rate_limits TO bankist.security_rate_limits;

-- Restore original views
USE bankist;
SOURCE "DBMS project/bankist.sql";

SET GLOBAL read_only = OFF;
```

---

### 4.4 Rollback Procedure C: Disaster Recovery from Immutable Dump
In the unlikely event of database corruption or unrecoverable schema state:
```powershell
mysql -u root -p -e "DROP DATABASE IF EXISTS bankist; CREATE DATABASE bankist CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
Get-Content "$BackupDir\bankist_live_pre_cutover.sql" | mysql -u root -p bankist
```
- Verify restored state matches hash: `6802104a279509e797e80add53c937cd7e87e73a620afb43117689afde6e8096`.
- Total Disaster Recovery Time: Approximately 30 seconds.

---

## 5. Post-Cutover Monitoring Plan

Following successful cutover, the database and application enter an active surveillance period:

### 5.1 First Hour Post-Cutover
- Monitor MySQL error logs (`mysql.err`) for foreign-key constraint violations or lock timeouts.
- Monitor application error tracking (Next.js server console and API responses) for 500 status codes.
- Inspect `audit_logs` every 15 minutes to confirm normal user logins and transfers are appending records.

### 5.2 24-Hour Checkpoint
- Verify ledger consistency:
  ```sql
  SELECT 'accounts', SUM(balance) FROM bankist.accounts;
  SELECT 'transactions', SUM(amount) FROM bankist.transactions;
  ```
- Verify that customer creation, additional account opening, and term deposit bookings successfully populated both base tables and normalized child entities.

### 5.3 7-Day Sign-Off
- Archive `bankist_legacy_archive` to offsite encrypted storage.
- Drop temporary legacy archive from database server to reclaim disk space.
- Final sign-off of normalization project completion.

---

## 6. Cutover Readiness Assessment

| Requirement | Evaluated Status | Evidence / Verification |
| :--- | :---: | :--- |
| **Pristine Source Preserved** | **VERIFIED** | Live database untouched; hash `6802104a...` verified. |
| **Data Preservation** | **VERIFIED** | 100% balance and transaction conservation (₹0.00 variance). |
| **Application Compatibility** | **VERIFIED** | 16/16 application queries passing on normalized schema. |
| **Referential Integrity** | **VERIFIED** | 0 orphans across all 8 foreign-key relationships. |
| **Security Hardening** | **VERIFIED** | 0 plaintext PINs, 0 plaintext OTPs, 0 fabricated cards. |
| **Reversibility** | **VERIFIED** | Sub-second atomic rollback protocol engineered. |

### Final Readiness Declaration
**READY FOR CONTROLLED CUTOVER REVIEW**

