const path = require('path');
const assert = require('assert');

// Test the packaging exclusion logic against a broad suite of synthetic test paths
console.log('Running Packaging Exclusion Regression Tests (Synthetic Vectors)...');

const projectRoot = path.resolve(__dirname, '../../../../');

function isForbiddenItem(fullPath) {
  const baseName = path.basename(fullPath).toLowerCase();
  const normalizedRel = path.relative(projectRoot, fullPath).replace(/\\/g, '/').toLowerCase();

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
  if (normalizedRel.split('/').some((segment) => forbiddenDirNames.includes(segment))) return true;

  if (baseName === '.env' || (baseName.startsWith('.env.') && baseName !== '.env.example')) {
    return true;
  }

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

  if (
    baseName.includes('backup') ||
    baseName.endsWith('.bak') ||
    baseName.endsWith('.csv') ||
    baseName.endsWith('.log') ||
    baseName.endsWith('.tsbuildinfo') ||
    (baseName.endsWith('.zip') && normalizedRel !== '')
  ) {
    return true;
  }

  return false;
}

const testCases = [
  // SQLite and backup variants (Must all be FORBIDDEN)
  { path: 'bankist.sqlite', expectedForbidden: true },
  { path: 'bankist.sqlite.backup_2026-10-28T09-37-57-885Z', expectedForbidden: true },
  { path: 'bankist.sqlite.backup_2026-10-28T09-39-02-319Z', expectedForbidden: true },
  { path: 'bankist.sqlite.backup_phase2_2026-10-28T10-14-24-896Z.db', expectedForbidden: true },
  { path: 'test/banking.db', expectedForbidden: true },
  { path: 'test/wal_file.db-wal', expectedForbidden: true },
  { path: 'test/sqlite-journal', expectedForbidden: true },
  { path: 'test/temp.sqlite3', expectedForbidden: true },
  { path: 'database/backup_dump.bak', expectedForbidden: true },
  { path: 'database/backups/live_backup.sql', expectedForbidden: true },
  
  // Sensitive and raw data (Must all be FORBIDDEN)
  { path: 'DBMS project/test/.env', expectedForbidden: true },
  { path: 'DBMS project/test/.env.local', expectedForbidden: true },
  { path: 'DBMS project/test/.env.production', expectedForbidden: true },
  { path: 'data/customers_full_export.csv', expectedForbidden: true },
  { path: 'logs/npm-debug.log', expectedForbidden: true },
  { path: 'tsconfig.tsbuildinfo', expectedForbidden: true },
  { path: 'node_modules/express/index.js', expectedForbidden: true },
  { path: '.next/static/chunks/main.js', expectedForbidden: true },
  { path: 'pre_remediation_snapshot/diff.patch', expectedForbidden: true },
  
  // Legitimate required files (Must NOT be forbidden)
  { path: 'DBMS project/test/.env.example', expectedForbidden: false },
  { path: 'README.md', expectedForbidden: false },
  { path: 'SQLITE_TO_MYSQL_MIGRATION_REPORT.md', expectedForbidden: false },
  { path: 'scripts/migrate_sqlite_to_mysql.js', expectedForbidden: false },
  { path: 'DBMS_VIVA_DEMONSTRATION_GUIDE.md', expectedForbidden: false },
  { path: 'database/advanced-sql/01_ddl_and_integrity.sql', expectedForbidden: false },
  { path: 'database/advanced-sql/09_security_and_roles.sql', expectedForbidden: false },
  { path: 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/package.json', expectedForbidden: false },
  { path: 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/lib/db.ts', expectedForbidden: false },
  { path: 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/bankist.sql', expectedForbidden: false },
];

let passed = 0;
for (const tc of testCases) {
  const full = path.join(projectRoot, tc.path);
  const result = isForbiddenItem(full);
  assert.strictEqual(
    result,
    tc.expectedForbidden,
    `FAILED: Case "${tc.path}" expected forbidden=${tc.expectedForbidden}, got ${result}`
  );
  passed++;
}

console.log(`[PASS] All ${passed} synthetic packaging exclusion vectors verified successfully.`);
