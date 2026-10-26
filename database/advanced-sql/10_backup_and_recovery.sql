-- ============================================================================
-- JM-DH BANKING SYSTEM — ADVANCED DBMS DEMONSTRATION SUITE
-- MODULE 10: BACKUP, RESTORATION & DISASTER RECOVERY VERIFICATION (MySQL 8.0+)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Logical Backup Command Architecture (Non-Destructive Hot Backup)
-- Command executed from CLI (PowerShell / Bash) using native --result-file:
--
-- & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" `
--   -u root -P 3307 -h 127.0.0.1 `
--   --single-transaction `
--   --routines `
--   --triggers `
--   --events `
--   --result-file="backup_bankist_hot.sql" `
--   bankist
--
-- Architectural Note: `--single-transaction` starts an isolated Repeatable Read
-- transaction, dumping an authentic point-in-time snapshot of InnoDB tables 
-- without blocking online transactions or locking the application database!
-- Using `--result-file` avoids Windows PowerShell UTF-16 null-byte corruption.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 2. Restoration into Isolated Target Database (Never Destructive on Live DB)
-- ----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `bankist_recovery_verify` 
DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Verification Queries: Parity Check Between Source & Restored Databases
-- Compares row counts and financial totals between production and restored snapshot
-- ----------------------------------------------------------------------------

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

-- Schema Object Parity Check (Routines, Views, Triggers)
SELECT 
    'bankist' AS schema_name,
    (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'bankist') AS total_routines,
    (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'bankist') AS total_views,
    (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'bankist') AS total_triggers
UNION ALL
SELECT 
    'bankist_recovery_verify',
    (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'bankist_recovery_verify'),
    (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'bankist_recovery_verify'),
    (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'bankist_recovery_verify');
