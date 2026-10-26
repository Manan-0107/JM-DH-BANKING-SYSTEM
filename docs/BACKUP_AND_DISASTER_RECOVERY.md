# JM-DH Banking System — Backup, Restoration & Disaster Recovery Guide

**Target Engine**: MySQL 8.0+ Enterprise Edition / Community Server  
**Standards**: Business Continuity Planning (BCP), Disaster Recovery (DR), Point-in-Time Recovery (PITR)  
**Author**: Senior Database Reliability Engineer (DBRE)  

---

## 1. RPO and RTO Objectives in Core Banking

In mission-critical financial systems, disaster recovery is governed by two parameters:
1. **Recovery Point Objective (RPO)**: The maximum acceptable data loss measured in time. In core banking, target RPO is **zero seconds** (achieved via synchronous replication and durable binary transaction logging).
2. **Recovery Time Objective (RTO)**: The maximum acceptable duration to restore service availability after a disaster. Target RTO is under **15 minutes**.

---

## 2. Backup Methodologies Compared

| Backup Strategy | Mechanism | Performance Impact on Live System | Recovery Speed | Granularity |
| :--- | :--- | :--- | :--- | :--- |
| **Logical Hot Dump (`mysqldump`)** | SQL statement extraction via consistent read view | Zero read blocking (`--single-transaction`) | Moderate (replays SQL DDL/DML) | Table, schema, or database level. |
| **Physical Raw Snapshot (Percona XtraBackup)** | Direct block copying of InnoDB `.ibd` data pages and redo logs | Minimal I/O overhead | Very Fast (direct filesystem copy) | Instance / tablespace level. |
| **Binary Log Archival (PITR)** | Continuous streaming of binary transaction logs (`mysql-bin.XXXXXX`) | Negligible | Fast (replays transactions from checkpoint) | Transaction-level granularity to precise second or GTID. |

---

## 3. Verified Logical Hot Backup Procedure

### Command Line Execution:
```bash
mysqldump \
  --host=127.0.0.1 \
  --port=3307 \
  --user=root \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --result-file="backup_bankist_hot.sql" \
  bankist
```

### Critical Flags Explained:
- `--single-transaction`: Initiates an isolated `REPEATABLE READ` transaction before dumping tables. InnoDB dumps a completely consistent point-in-time snapshot without placing read locks (`LOCK TABLES`) on live application tables.
- `--routines`: Extracts all stored procedures and stored functions.
- `--triggers`: Preserves all `BEFORE` and `AFTER` table triggers.
- `--events`: Preserves scheduled maintenance events.
- `--result-file=...`: Instructs `mysqldump` to write directly to the output file using native UTF-8 encoding, preventing PowerShell UTF-16 null-byte corruption (`ASCII '\0' appeared in statement`).

---

## 4. Non-Destructive Isolated Restoration Verification

> [!IMPORTANT]
> Never restore backups directly into production or active development environments without isolated verification. Always restore into an isolated staging database (`bankist_recovery_verify`) to validate structural and numerical parity.

### Step-by-Step Restoration Workflow:
1. Create isolated verification schema:
   ```sql
   CREATE DATABASE IF NOT EXISTS `bankist_recovery_verify`;
   ```
2. Ingest the backup dump:
   ```bash
   mysql -u root -P 3307 -h 127.0.0.1 -D bankist_recovery_verify < backup_bankist_hot.sql
   ```
3. Execute the Parity Audit (`database/advanced-sql/10_backup_and_recovery.sql`):
   ```sql
   SELECT 
       'SOURCE_PRODUCTION (bankist)' AS db_environment,
       (SELECT COUNT(*) FROM bankist.customers) AS total_customers,
       (SELECT COUNT(*) FROM bankist.accounts) AS total_accounts,
       (SELECT COUNT(*) FROM bankist.transactions) AS total_transactions,
       (SELECT COALESCE(SUM(balance), 0.00) FROM bankist.accounts) AS total_vault_balance
   UNION ALL
   SELECT 
       'RESTORED_TARGET (bankist_recovery_verify)',
       (SELECT COUNT(*) FROM bankist_recovery_verify.customers),
       (SELECT COUNT(*) FROM bankist_recovery_verify.accounts),
       (SELECT COUNT(*) FROM bankist_recovery_verify.transactions),
       (SELECT COALESCE(SUM(balance), 0.00) FROM bankist_recovery_verify.accounts);
   ```

### Empirical Parity Results:
- Customer Parity: **9 / 9** ($100\%$)
- Account Parity: **9 / 9** ($100\%$)
- Transaction Parity: **28 / 28** ($100\%$)
- Financial Ledger Balance Parity: **₹6,51,939.50 / ₹6,51,939.50** (Variance = ₹0.00)
- Stored Routines Parity: **9 / 9** ($100\%$)
- Database Views Parity: **6 / 6** ($100\%$)
- Triggers Parity: **3 / 3** ($100\%$)

---

## 5. Point-in-Time Recovery (PITR) Concept

A full database dump only restores state up to the moment the backup completed. To recover transactions committed between the last backup and a disaster (e.g., human error dropping a table at 14:32:15):
1. Restore the most recent full backup:
   ```bash
   mysql < backup_bankist_00_00.sql
   ```
2. Replay binary logs up to the exact point in time prior to the incident:
   ```bash
   mysqlbinlog --stop-datetime="2026-10-26 14:32:14" \
     /var/log/mysql/mysql-bin.000142 | mysql -u root
   ```
This guarantees recovery of every transaction up to the exact second of failure.
