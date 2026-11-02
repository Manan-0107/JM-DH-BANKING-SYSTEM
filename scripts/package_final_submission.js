const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const stagingDir = path.resolve(projectRoot, 'staging_final_submission');
const targetZip = path.resolve(projectRoot, 'JM-DH-BANKING-SYSTEM-FINAL-SUBMISSION.zip');
const extractVerifyDir = path.resolve(projectRoot, 'staging_verify_extraction');

console.log('====================================================');
console.log('   CREATING FINAL VERIFIED SUBMISSION PACKAGE (ZIP) ');
console.log('====================================================');

// 1. Clean previous staging / extraction dirs
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (fs.existsSync(extractVerifyDir)) {
  fs.rmSync(extractVerifyDir, { recursive: true, force: true });
}
if (fs.existsSync(targetZip)) {
  fs.rmSync(targetZip, { force: true });
}

fs.mkdirSync(stagingDir, { recursive: true });

/**
 * Robust case-insensitive check for forbidden artifacts:
 * - SQLite database files & any timestamped backup variants
 * - Sensitive environment configurations (.env)
 * - Raw customer data exports (.csv)
 * - Build artifacts, node_modules, and temporary archives
 */
function isForbiddenItem(fullPath, rootDir = projectRoot) {
  const baseName = path.basename(fullPath).toLowerCase();
  const normalizedRel = path.relative(rootDir, fullPath).replace(/\\/g, '/').toLowerCase();

  // 1. Forbidden Directories
  const forbiddenDirNames = [
    'node_modules',
    '.next',
    '.git',
    '.vscode',
    'backups',
    'archive',
    'scratch',
    'staging_submission',
    'staging_security_patched',
    'staging_final_submission',
    'staging_verify_extraction',
    'pre_remediation_snapshot',
  ];
  if (forbiddenDirNames.includes(baseName)) return true;
  if (normalizedRel.split('/').filter(Boolean).some((segment) => forbiddenDirNames.includes(segment))) return true;

  // 2. Sensitive Environment Files (.env, .env.local, .env.production - allow ONLY .env.example)
  if (baseName === '.env' || (baseName.startsWith('.env.') && baseName !== '.env.example')) {
    return true;
  }

  // 3. SQLite Database Files, SQLite Backups, WAL, and Journal Files (database binaries, not source/docs)
  if (
    (baseName.includes('sqlite') && !baseName.endsWith('.md') && !baseName.endsWith('.js') && !baseName.endsWith('.ts')) ||
    baseName.endsWith('.db') ||
    baseName.endsWith('.db-wal') ||
    baseName.endsWith('.db-shm') ||
    baseName.includes('-journal') ||
    baseName.includes('-wal') ||
    baseName.includes('-shm')
  ) {
    return true;
  }

  // 4. Backup files, dumps, raw customer CSV exports, build logs & temp zips
  // Explicitly ALLOW authoritative normalized CSV datasets under data/bcnf/
  const isBcnfCsv = normalizedRel.includes('data/bcnf') && baseName.endsWith('.csv');
  if (
    baseName.includes('backup') ||
    baseName.endsWith('.bak') ||
    (baseName.endsWith('.csv') && !isBcnfCsv) ||
    baseName.endsWith('.log') ||
    baseName.endsWith('.tsbuildinfo') ||
    (baseName.endsWith('.zip') && normalizedRel !== '')
  ) {
    return true;
  }

  return false;
}

function copyFiltered(src, dest) {
  if (!fs.existsSync(src)) return;
  if (isForbiddenItem(src, projectRoot)) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      copyFiltered(path.join(src, item), path.join(dest, item));
    }
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('1. Copying root documentation, SQL scripts, and normalized datasets...');
copyFiltered(path.join(projectRoot, 'README.md'), path.join(stagingDir, 'README.md'));
copyFiltered(path.join(projectRoot, 'DEMO_SETUP_GUIDE.md'), path.join(stagingDir, 'DEMO_SETUP_GUIDE.md'));
copyFiltered(path.join(projectRoot, 'DBMS_VIVA_DEMONSTRATION_GUIDE.md'), path.join(stagingDir, 'DBMS_VIVA_DEMONSTRATION_GUIDE.md'));
copyFiltered(path.join(projectRoot, 'VIVA_PREPARATION.md'), path.join(stagingDir, 'VIVA_PREPARATION.md'));
copyFiltered(path.join(projectRoot, 'SETUP_AND_ACTIVATION_GUIDE.md'), path.join(stagingDir, 'SETUP_AND_ACTIVATION_GUIDE.md'));
copyFiltered(path.join(projectRoot, 'SQLITE_TO_MYSQL_MIGRATION_REPORT.md'), path.join(stagingDir, 'SQLITE_TO_MYSQL_MIGRATION_REPORT.md'));
copyFiltered(path.join(projectRoot, 'DBMS_LAB_FINAL.sql'), path.join(stagingDir, 'DBMS_LAB_FINAL.sql'));
copyFiltered(path.join(projectRoot, 'bankist_normalized.sql'), path.join(stagingDir, 'bankist_normalized.sql'));
copyFiltered(path.join(projectRoot, 'bankist_migration.sql'), path.join(stagingDir, 'bankist_migration.sql'));
copyFiltered(path.join(projectRoot, 'bankist_normalization_tests.sql'), path.join(stagingDir, 'bankist_normalization_tests.sql'));
copyFiltered(path.join(projectRoot, 'NORMALIZATION_AUDIT_REPORT.md'), path.join(stagingDir, 'NORMALIZATION_AUDIT_REPORT.md'));
copyFiltered(path.join(projectRoot, 'BCNF_ACCOUNTS_REMEDIATION_REPORT.md'), path.join(stagingDir, 'BCNF_ACCOUNTS_REMEDIATION_REPORT.md'));
copyFiltered(path.join(projectRoot, 'POST_BCNF_INDEPENDENT_AUDIT_REPORT.md'), path.join(stagingDir, 'POST_BCNF_INDEPENDENT_AUDIT_REPORT.md'));
copyFiltered(path.join(projectRoot, 'MYSQL_TEST_RESULTS.md'), path.join(stagingDir, 'MYSQL_TEST_RESULTS.md'));
copyFiltered(path.join(projectRoot, 'README_NORMALIZATION.md'), path.join(stagingDir, 'README_NORMALIZATION.md'));
copyFiltered(path.join(projectRoot, 'BANKIST_NORMALIZATION_AND_ARCHITECTURE_MASTER.md'), path.join(stagingDir, 'BANKIST_NORMALIZATION_AND_ARCHITECTURE_MASTER.md'));
copyFiltered(path.join(projectRoot, 'BANKIST_COMPATIBILITY_MATRIX.md'), path.join(stagingDir, 'BANKIST_COMPATIBILITY_MATRIX.md'));
copyFiltered(path.join(projectRoot, 'BANKIST_CUTOVER_ROLLBACK_PLAN.md'), path.join(stagingDir, 'BANKIST_CUTOVER_ROLLBACK_PLAN.md'));
copyFiltered(path.join(projectRoot, 'QUERY_AND_INDEX_OPTIMIZATION_REPORT.md'), path.join(stagingDir, 'QUERY_AND_INDEX_OPTIMIZATION_REPORT.md'));
copyFiltered(path.join(projectRoot, 'data/bcnf'), path.join(stagingDir, 'data/bcnf'));
copyFiltered(path.join(projectRoot, 'database'), path.join(stagingDir, 'database'));
copyFiltered(path.join(projectRoot, 'docs'), path.join(stagingDir, 'docs'));
copyFiltered(path.join(projectRoot, 'scripts'), path.join(stagingDir, 'scripts'));

console.log('2. Copying authoritative Next.js application & schemas...');
copyFiltered(
  path.join(projectRoot, 'DBMS project'),
  path.join(stagingDir, 'DBMS project')
);

console.log('3. Validating that no secrets, caches, or database binaries are included in staging...');
function auditDir(dir, baseRoot) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    if (isForbiddenItem(full, baseRoot)) {
      throw new Error(`CRITICAL SECURITY FAILURE: Forbidden file/directory leaked into staging: ${full}`);
    }
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      auditDir(full, baseRoot);
    }
  }
}
auditDir(stagingDir, stagingDir);
console.log('   [PASS] Staging audit clean: Zero credentials, node_modules, cache files, or database binaries.');

console.log('4. Compressing staging directory into final submission ZIP via .NET Compression...');
const psScript = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingDir}', '${targetZip}', [System.IO.Compression.CompressionLevel]::Optimal, $false);`;
execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'inherit' });

console.log('5. Calculating SHA-256 and size of final submission ZIP...');
const zipBuffer = fs.readFileSync(targetZip);
const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
const zipStat = fs.statSync(targetZip);
console.log(`   [SUCCESS] Final Submission ZIP created: ${targetZip}`);
console.log(`   [SIZE] ${(zipStat.size / (1024 * 1024)).toFixed(2)} MB (${zipStat.size} bytes)`);
console.log(`   [SHA-256] ${sha256}`);

console.log('6. Verifying clean extraction from generated ZIP...');
const psExtract = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${targetZip}', '${extractVerifyDir}');`;
execSync(`powershell -NoProfile -Command "${psExtract}"`, { stdio: 'inherit' });

// Verify critical files in extracted archive
const criticalFiles = [
  'README.md',
  'DEMO_SETUP_GUIDE.md',
  'DBMS_VIVA_DEMONSTRATION_GUIDE.md',
  'VIVA_PREPARATION.md',
  'DBMS_LAB_FINAL.sql',
  'bankist_normalized.sql',
  'bankist_migration.sql',
  'bankist_normalization_tests.sql',
  'NORMALIZATION_AUDIT_REPORT.md',
  'BCNF_ACCOUNTS_REMEDIATION_REPORT.md',
  'POST_BCNF_INDEPENDENT_AUDIT_REPORT.md',
  'MYSQL_TEST_RESULTS.md',
  'README_NORMALIZATION.md',
  'BANKIST_NORMALIZATION_AND_ARCHITECTURE_MASTER.md',
  'data/bcnf/README.md',
  'data/bcnf/branches.csv',
  'data/bcnf/customers.csv',
  'data/bcnf/customer_nominees.csv',
  'data/bcnf/accounts.csv',
  'data/bcnf/account_card_credentials.csv',
  'data/bcnf/account_lien_records.csv',
  'data/bcnf/deposits.csv',
  'data/bcnf/beneficiaries.csv',
  'data/bcnf/transactions.csv',
  'data/bcnf/kyc_verifications.csv',
  'data/bcnf/otp_sessions.csv',
  'data/bcnf/security_rate_limits.csv',
  'data/bcnf/audit_logs.csv',
  'database/advanced-sql/01_ddl_and_integrity.sql',
  'database/advanced-sql/04_stored_routines.sql',
  'database/advanced-sql/08_transactions_and_concurrency.sql',
  'docs/ER_AND_EER_MODELING.md',
  'docs/DATABASE_SCHEMA_DICTIONARY.md',
  'docs/NORMALIZATION_REPORT_1NF_TO_5NF.md',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/package.json',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/.env.example',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_backend_suite.js',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_persistence.js',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_security_remediation.js',
  'scripts/import_csv_data.js',
  'scripts/run_all_dbms_tests.js',
];

for (const relPath of criticalFiles) {
  const fullExtracted = path.join(extractVerifyDir, relPath);
  if (!fs.existsSync(fullExtracted)) {
    throw new Error(`Missing expected file in extracted archive: ${relPath}`);
  }
}
console.log('   [PASS] All critical project, documentation, database, and test files verified in extracted package.');

// Verify extracted package has zero forbidden files
auditDir(extractVerifyDir, extractVerifyDir);
console.log('   [PASS] Extracted archive audit clean: Zero forbidden items found in extracted package.');

// 7. Clean up staging & extraction verify dirs
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.rmSync(extractVerifyDir, { recursive: true, force: true });
console.log('   [CLEANUP] Staging and extraction verification directories removed.');
console.log('====================================================');
console.log('PACKAGE INTEGRITY VERIFICATION COMPLETE: ALL CHECKS PASSED');
