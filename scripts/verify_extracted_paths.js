const fs = require('fs');
const path = require('path');

const extractedRoot = path.resolve('C:/Users/MANAN/.gemini/antigravity-ide/brain/c82b10b1-574d-4ff5-ae39-96831f786ec0/scratch/validation_extracted');
console.log('--- VALIDATING EXTRACTED PACKAGE PATHS & SCRIPTS ---');

const requiredPaths = [
  'README.md',
  'DBMS_VIVA_DEMONSTRATION_GUIDE.md',
  'database/advanced-sql/01_ddl_and_integrity.sql',
  'database/advanced-sql/02_advanced_queries.sql',
  'database/advanced-sql/03_views_and_materialized_views.sql',
  'database/advanced-sql/04_stored_routines.sql',
  'database/advanced-sql/05_triggers_and_events.sql',
  'database/advanced-sql/06_relational_algebra_and_calculus.sql',
  'database/advanced-sql/07_indexing_and_optimization.sql',
  'database/advanced-sql/08_transactions_and_concurrency.sql',
  'database/advanced-sql/09_security_and_roles.sql',
  'database/advanced-sql/10_backup_and_recovery.sql',
  'docs/ACID_TRANSACTIONS_AND_CONCURRENCY.md',
  'docs/BACKUP_AND_DISASTER_RECOVERY.md',
  'docs/DATABASE_SCHEMA_DICTIONARY.md',
  'docs/DATABASE_SECURITY_AND_ROLES.md',
  'docs/DBMS_BASELINE_AUDIT_REPORT.md',
  'docs/DBMS_VIVA_AND_EVALUATION_GUIDE.md',
  'docs/ER_AND_EER_MODELING.md',
  'docs/INDEXING_AND_QUERY_OPTIMIZATION.md',
  'docs/NORMALIZATION_REPORT_1NF_TO_5NF.md',
  'docs/RELATIONAL_ALGEBRA_AND_CALCULUS.md',
  'scripts/generate_seed_data.js',
  'scripts/run_all_dbms_tests.js',
  'DBMS project/bankist.sql',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/package.json',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/package-lock.json',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/.env.example',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/tsconfig.json',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/next.config.mjs',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_backend_suite.js',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_persistence.js',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/lib/api-helpers.ts',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/lib/auth.ts',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/lib/db.ts',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/lib/dictionary.ts',
];

let missing = 0;
for (const rel of requiredPaths) {
  const full = path.join(extractedRoot, rel);
  if (!fs.existsSync(full)) {
    console.error(`[MISSING] ${rel}`);
    missing++;
  } else {
    console.log(`[FOUND]   ${rel}`);
  }
}

if (missing === 0) {
  console.log('\n[PASS] All 36 required application files, schemas, documentation, and test scripts exist in the extracted package!');
} else {
  console.error(`\n[FAIL] Missing ${missing} required files.`);
  process.exit(1);
}
