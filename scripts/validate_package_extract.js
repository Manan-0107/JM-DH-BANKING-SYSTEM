const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const zipPath = path.resolve(__dirname, '..', 'JM-DH-BANKING-SYSTEM-SUBMISSION.zip');
const extractDest = path.resolve('C:/Users/MANAN/.gemini/antigravity-ide/brain/c82b10b1-574d-4ff5-ae39-96831f786ec0/scratch/validation_extracted');

console.log('--- 1. EXTRACTING SUBMISSION ZIP ---');
if (fs.existsSync(extractDest)) {
  fs.rmSync(extractDest, { recursive: true, force: true });
}
fs.mkdirSync(extractDest, { recursive: true });

const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/\\/g, '/')}', '${extractDest.replace(/\\/g, '/')}')
`;

const tmpPs = path.resolve(__dirname, 'extract_tmp.ps1');
fs.writeFileSync(tmpPs, psScript);
try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs}"`, { stdio: 'inherit' });
} finally {
  if (fs.existsSync(tmpPs)) fs.unlinkSync(tmpPs);
}

console.log('[PASS] Extracted successfully to:', extractDest);

console.log('\n--- 2. TOP-LEVEL STRUCTURE OF EXTRACTED ZIP ---');
const items = fs.readdirSync(extractDest);
for (const item of items) {
  const full = path.join(extractDest, item);
  const isDir = fs.statSync(full).isDirectory();
  console.log(`  - ${item} ${isDir ? '[DIR]' : '[FILE]'}`);
}

console.log('\n--- 3. CHECKING FORBIDDEN FILES IN EXTRACTED DIRECTORY ---');
let forbiddenCount = 0;
function scan(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules', '.next', '.git', 'archive'].includes(entry)) {
        console.error(`[FAIL] Forbidden directory: ${full}`);
        forbiddenCount++;
      }
      scan(full);
    } else {
      if (entry === '.env' || entry.endsWith('.sqlite') || entry.endsWith('.tsbuildinfo') || entry === 'banking.db') {
        console.error(`[FAIL] Forbidden file: ${full}`);
        forbiddenCount++;
      }
    }
  }
}
scan(extractDest);
if (forbiddenCount === 0) {
  console.log('[PASS] Zero forbidden files, caches, secrets, or obsolete prototypes in extracted ZIP.');
} else {
  console.error(`[FAIL] Found ${forbiddenCount} forbidden items.`);
  process.exit(1);
}
