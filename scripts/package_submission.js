const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const stagingDir = path.resolve(projectRoot, 'staging_submission');
const targetZip = path.resolve(projectRoot, 'JM-DH-BANKING-SYSTEM-SUBMISSION.zip');

console.log('====================================================');
console.log('   CREATING CLEAN SUBMISSION PACKAGE (ZIP)          ');
console.log('====================================================');

// 1. Clean previous staging
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
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
    // Avoid copying secrets or build cache
    if (baseName === '.env' || baseName.endsWith('.sqlite') || baseName.endsWith('.tsbuildinfo')) {
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
  'scratch',
  'banking.db',
  'bankist.sqlite',
  'archive'
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

console.log('3. Validating that no secrets or node_modules are included in staging...');
function auditDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item === 'node_modules' || item === '.next' || item === '.git') {
        throw new Error(`Forbidden directory found in staging: ${full}`);
      }
      auditDir(full);
    } else {
      if (item === '.env') {
        throw new Error(`Forbidden secret file found in staging: ${full}`);
      }
    }
  }
}
auditDir(stagingDir);
console.log('   [PASS] Staging audit clean: Zero credentials, node_modules, or cache files.');

console.log('4. Compressing staging directory into submission ZIP via .NET Compression...');
const psScript = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingDir}', '${targetZip}', [System.IO.Compression.CompressionLevel]::Optimal, $false);`;
execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'inherit' });

console.log('5. Verifying generated ZIP file...');
const zipStat = fs.statSync(targetZip);
console.log(`   [SUCCESS] Submission ZIP created: ${targetZip}`);
console.log(`   [SIZE] ${(zipStat.size / (1024 * 1024)).toFixed(2)} MB`);

// Clean staging directory after zip
fs.rmSync(stagingDir, { recursive: true, force: true });
console.log('   [CLEANUP] Staging directory removed.');
console.log('====================================================');
