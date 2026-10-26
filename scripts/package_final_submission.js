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

function copyFiltered(src, dest, ignoreList = []) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);

  const baseName = path.basename(src);
  if (ignoreList.includes(baseName)) return;

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      copyFiltered(path.join(src, item), path.join(dest, item), ignoreList);
    }
  } else {
    // Avoid copying secrets or build cache or sqlite database binaries
    if (baseName === '.env' || baseName.endsWith('.sqlite') || baseName.endsWith('.sqlite-journal') || baseName.endsWith('.tsbuildinfo') || baseName.endsWith('.log')) {
      return;
    }
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

const globalIgnores = [
  'node_modules',
  '.next',
  '.git',
  '.vscode',
  'staging_submission',
  'staging_security_patched',
  'staging_final_submission',
  'staging_verify_extraction',
  'scratch',
  'banking.db',
  'bankist.sqlite',
  'archive',
  'JM-DH-BANKING-SYSTEM-SUBMISSION.zip',
  'JM-DH-BANKING-SYSTEM-SECURITY-PATCHED.zip',
  'JM-DH-BANKING-SYSTEM-FINAL-SUBMISSION.zip'
];

console.log('1. Copying root documentation & SQL scripts...');
copyFiltered(path.join(projectRoot, 'README.md'), path.join(stagingDir, 'README.md'), globalIgnores);
copyFiltered(path.join(projectRoot, 'DBMS_VIVA_DEMONSTRATION_GUIDE.md'), path.join(stagingDir, 'DBMS_VIVA_DEMONSTRATION_GUIDE.md'), globalIgnores);
copyFiltered(path.join(projectRoot, 'database'), path.join(stagingDir, 'database'), globalIgnores);
copyFiltered(path.join(projectRoot, 'docs'), path.join(stagingDir, 'docs'), globalIgnores);
copyFiltered(path.join(projectRoot, 'scripts'), path.join(stagingDir, 'scripts'), globalIgnores);

console.log('2. Copying authoritative Next.js application & schemas...');
copyFiltered(
  path.join(projectRoot, 'DBMS project'),
  path.join(stagingDir, 'DBMS project'),
  globalIgnores
);

console.log('3. Validating that no secrets, caches, or node_modules are included in staging...');
function auditDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item === 'node_modules' || item === '.next' || item === '.git' || item === '.vscode') {
        throw new Error(`Forbidden directory found in staging: ${full}`);
      }
      auditDir(full);
    } else {
      if (item === '.env') {
        throw new Error(`Forbidden secret file found in staging: ${full}`);
      }
      if (item.endsWith('.sqlite') || item.endsWith('.sqlite-journal')) {
        throw new Error(`Forbidden sqlite DB binary found in staging: ${full}`);
      }
    }
  }
}
auditDir(stagingDir);
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
  'DBMS_VIVA_DEMONSTRATION_GUIDE.md',
  'database/advanced-sql/01_ddl_and_integrity.sql',
  'database/advanced-sql/04_stored_routines.sql',
  'database/advanced-sql/08_transactions_and_concurrency.sql',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/package.json',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/.env.example',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_backend_suite.js',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_persistence.js',
  'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/test_security_remediation.js',
  'scripts/run_all_dbms_tests.js'
];

for (const relPath of criticalFiles) {
  const fullExtracted = path.join(extractVerifyDir, relPath);
  if (!fs.existsSync(fullExtracted)) {
    throw new Error(`Missing expected file in extracted archive: ${relPath}`);
  }
}
console.log('   [PASS] All critical project, documentation, database, and test files verified in extracted package.');

// Verify package.json contains Next 15.5.28 and PostCSS 8.5.31
const extractedPkg = JSON.parse(fs.readFileSync(path.join(extractVerifyDir, 'DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/package.json'), 'utf8'));
if (extractedPkg.dependencies.next !== '^15.5.28') {
  throw new Error(`Extracted package.json next version mismatch: ${extractedPkg.dependencies.next}`);
}
if (!extractedPkg.overrides || extractedPkg.overrides.postcss !== '^8.5.31') {
  throw new Error(`Extracted package.json postcss override missing or mismatch`);
}
console.log('   [PASS] Extracted package.json verified: next@^15.5.28 and overrides.postcss@^8.5.31 confirmed.');

// 7. Clean up staging & extraction verify dirs
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.rmSync(extractVerifyDir, { recursive: true, force: true });
console.log('   [CLEANUP] Staging and extraction verification directories removed.');
console.log('====================================================');
console.log('PACKAGE INTEGRITY VERIFICATION COMPLETE: ALL CHECKS PASSED');
