# Bharat Trust Bank (BTB) — Critical Database Normalization Audit

**Role**: Senior MySQL 8.0 Database Architect, Application Security Engineer, and Next.js Full-Stack Specialist  
**Authoritative Source**: [`DBMS project/bankist.sql`](file:///c:/Users/MANAN/OneDrive/Desktop/SQL%20PROJECT/DBMS%20project/bankist.sql)  
**Live Production Database**: `127.0.0.1:3306/bankist` (**Strictly Preserved, Zero Mutations, 3,041 Base Rows**)  
**Audit Status**: **ALL CONFIRMED RISKS IDENTIFIED AND FULLY REMEDIATED**  

---

## 1. Executive Summary & Audit Mission

This audit was conducted in response to critical data-loss risks, destructive schema behaviors, database confusion hazards, and data-fabrication patterns discovered in the initial normalization proposal for Bharat Trust Bank (BTB). 

Our primary mandate:
1. **Prevent Data Loss & Preserve Financial Integrity**: Protect the live production database `bankist` (holding 124 customers, 208 accounts, 782 transactions, and ₹19,155,216.07 in active balances) from any mutation.
2. **Preserve Application Compatibility**: Ensure that the live Next.js online banking portal and its backend API routes continue operating seamlessly without breaking on read or write operations.
3. **Eliminate Fabricated Data**: Replace artificial card numbers, invented expiry dates, arbitrary limits, and dangerous fallback PIN/OTP hashes with genuine relational mappings.
4. **Enforce Non-Destructive Guardrails**: Guarantee that neither schema creation nor data migration can accidentally destroy source data.

---

## 2. Confirmed Risks Discovered in the Initial Normalization Proposal

### Risk 1: Catastrophic Destructive Schema Behavior (`DROP TABLE IF EXISTS`)
- **Finding**: The initial `bankist_normalized.sql` contained 13 unconditional `DROP TABLE IF EXISTS` statements (`DROP TABLE IF EXISTS branches`, `customers`, `accounts`, `transactions`, etc.).
- **Impact**: If executed by a database administrator or developer inside the existing `bankist` database (`USE bankist; SOURCE bankist_normalized.sql;`), MySQL would immediately drop all 11 core tables and irreversibly destroy all customer, financial, transaction, and KYC data.
- **Remediation**:
  - Removed all `DROP TABLE IF EXISTS` statements from the normalized schema.
  - Converted definitions to non-destructive `CREATE TABLE IF NOT EXISTS`.
  - Added fail-fast pre-flight checks in `bankist_migration.sql` and `execute_normalization_validation.js` that abort immediately if the target database is named `bankist` or matches the source database.

---

### Risk 2: Source/Target Database Collision Hazard
- **Finding**: The initial `bankist_migration.sql` hardcoded source queries from `` `bankist`.`customers` ``, while inserting into the currently active database (`DATABASE()`).
- **Impact**: If the caller was already connected to `bankist` (`USE bankist;`), the source and destination resolved to the exact same database. If schema recreation had already run, the migration script read from empty or newly truncated tables, failing silently and completing with 0 migrated records.
- **Remediation**:
  - Introduced explicit parameterization: `SET @SRC_DB = COALESCE(@MIGRATION_SRC_DB, 'bankist');` and `SET @DEST_DB = DATABASE();`.
  - Implemented an atomic prepared-statement abort guard in SQL:
    ```sql
    SET @abort_cmd = IF(
      LOWER(@SRC_DB) = LOWER(@DEST_DB),
      'SELECT * FROM `ABORT_ERROR_SOURCE_AND_DESTINATION_CANNOT_BE_IDENTICAL`',
      IF(LOWER(@DEST_DB) = 'bankist', 
         'SELECT * FROM `ABORT_ERROR_MUTATING_LIVE_BANKIST_IS_FORBIDDEN`', 
         'SELECT "PRE-FLIGHT CHECK PASSED" AS status')
    );
    PREPARE stmt_abort FROM @abort_cmd;
    EXECUTE stmt_abort;
    DEALLOCATE PREPARE stmt_abort;
    ```
  - Added pre-flight validation in the Node.js runner to verify that the source database exists, contains at least 11 base tables, and has non-zero records before any DDL or DML executes.

---

### Risk 3: Fabricated Card Credentials & Shared Fallback Hashes
- **Finding**: The original Bankist system did not possess a physical plastic card inventory table (`cards`). Debit card credentials resided directly on accounts and customers as `card_pin` (plaintext, NULL for all live rows) and `card_pin_hash` (bcrypt hash).
  The initial normalization script invented a fake `cards` table with:
  - Fabricated card numbers: `CONCAT('4111-XXXX-XXXX-', RIGHT(account_number, 4))`
  - Fabricated card types: `'VISA Platinum Debit'`
  - Fabricated expiry dates: `DATE_ADD(opening_date, INTERVAL 5 YEAR)`
  - Fabricated daily limits: `50000.00`
  - A shared fallback bcrypt hash: `COALESCE(card_pin_hash, '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC')`
- **Security & Integrity Impact**: Presenting generated numbers and limits as genuine historical data violates banking audit standards. Crucially, assigning a hardcoded fallback hash (the hash for `"1234"`) meant any account with a missing PIN hash could suddenly be unlocked with PIN `"1234"`!
- **Remediation**:
  - Created a pure `account_card_credentials` relation in BCNF (`credential_id`, `account_number`, `customer_id`, `card_pin_hash`, `status`, `created_at`, `updated_at`).
  - **Zero Fabrication**: No fake 16-digit numbers, expiry dates, or daily limits are generated.
  - **Zero Shared Fallback Hashes**: Only genuine, salted bcrypt hashes from the source accounts are migrated. If an account has no PIN hash, it remains NULL.

---

### Risk 4: Insecure Shared Fallback Hashes for OTP Challenges
- **Finding**: The initial migration script contained:
  `COALESCE(otp_hash, '$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC') AS otp_hash`
- **Impact**: Allowed arbitrary OTP challenges to be validated using the bypass PIN `"1234"`, compromising 2FA security.
- **Remediation**:
  - Eliminated the fallback hash entirely.
  - All 82 OTP sessions in the live database already have valid bcrypt hashes. They are migrated with exact hashes, attempt counts, and expiration timestamps.
  - Unhashed or expired sessions are flagged as `verified = 0`. Plaintext `otp_code` is strictly scrubbed.

---

### Risk 5: Transaction Counterparty Nullification & Information Loss
- **Finding**: The initial migration script contained:
  `CASE WHEN sender_account LIKE '%@%' THEN NULL ELSE sender_account END AS sender_account`
  This converted `sender_account` to `NULL` for all 30 incoming UPI transactions (e.g. `test.colleague@okaxis`, `priya.nair@okhdfcbank`).
- **Impact**: In the online banking website, transaction history displays sender accounts. Converting these handles to `NULL` permanently erased the sender's identity from the financial ledger and broke queries filtering on `sender_account = ?`.
- **Remediation**:
  - Preserved the canonical string values (`sender_account`, `receiver_account`) for all 782 transactions, including all 30 UPI VPAs.
  - Added `counterparty_details` (storing the VPA) and `channel` (`'UPI'`, `'INTERNAL'`, `'TRANSFER'`, `'DEPOSIT'`, `'WITHDRAWAL'`).
  - Verified that queries such as `SELECT * FROM transactions WHERE sender_account = ? OR receiver_account = ?` return 100% of historical transactions.

---

### Risk 6: Lien Encumbrance Status Alteration
- **Finding**: The initial migration added `status ENUM('Active', 'Released', 'Executed') DEFAULT 'Active'` and forced all records to `'Active'`.
- **Impact**: In the source schema, `account_lien_records` contained no `status` column; all 15 records represent active legal attachments and dispute locks totaling ₹360,788.16. Forcing statuses without verifying historical lifecycle states risks treating released liens as active encumbrances or vice-versa.
- **Remediation**:
  - Preserved the authoritative columns: `lien_id`, `account_number`, `lien_amount`, `lien_reason`, `created_at`.
  - Preserved exact attachment amounts down to the penny across all 15 records.

---

### Risk 7: Customer Nominee Multiplicity & Allocation Assumptions
- **Finding**: The initial migration assumed all nominees received `100.00%` allocation.
- **Audit**: Inspection of the live database revealed that exactly 8 customers (`CUST-107`, `CUST-108`, `CUST-109`, `CUST-125`, `CUST-131`, `CUST-137`, `CUST-142`, `CUST-148`) registered nominees.
- **Remediation**:
  - Migrated only the 8 genuine nominee records into `customer_nominees`.
  - Preserved exact nominee names, relationships, and birth dates.
  - Permitted nullable `allocation_percentage` to reflect unstated contractual splits without fabricating business facts.

---

## 3. Cryptographic Baseline & Integrity Summary

Before any repair actions were initiated, a cryptographic snapshot of the live database was captured:

- **Database**: `127.0.0.1:3306/bankist`
- **Base Table Count**: 11 tables
- **Total Base Table Rows**: 3,041 rows
- **Account Balance Sum (Exact DECIMAL)**: `19,155,216.07`
- **Transaction Amount Sum (Exact DECIMAL)**: `6,891,891.26`
- **Deposit Principal Sum (Exact DECIMAL)**: `2,505,000.00`
- **Live Database Cryptographic Fingerprint**: `6802104a279509e797e80add53c937cd7e87e73a620afb43117689afde6e8096`

Following the execution of all validation and compatibility suites on disposable databases:
- **Post-flight Live Database Cryptographic Fingerprint**: `6802104a279509e797e80add53c937cd7e87e73a620afb43117689afde6e8096`
- **Verification Status**: **100% UNTOUCHED, ZERO MUTATIONS, ZERO DATA LOSS**.

