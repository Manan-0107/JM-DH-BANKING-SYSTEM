const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const zipPath = path.resolve(__dirname, '..', 'JM-DH-BANKING-SYSTEM-SUBMISSION.zip');
if (!fs.existsSync(zipPath)) {
  console.error('ZIP file not found:', zipPath);
  process.exit(1);
}

const stat = fs.statSync(zipPath);
console.log('Archive verified at:', zipPath);
console.log('Size:', (stat.size / 1024 / 1024).toFixed(2), 'MB (' + stat.size + ' bytes)');

// Verify by reading entries through powershell script file
const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, '/')}')
$entries = $zip.Entries
Write-Host "Total entries: $($entries.Count)"

$forbiddenEnv = $entries | Where-Object { $_.FullName -match '(\.env$|\.env\.local)' }
Write-Host "Forbidden .env files: $($forbiddenEnv.Count)"

$forbiddenModules = $entries | Where-Object { $_.FullName -match 'node_modules' }
Write-Host "Forbidden node_modules: $($forbiddenModules.Count)"

$forbiddenNext = $entries | Where-Object { $_.FullName -match '\\.next' }
Write-Host "Forbidden .next cache: $($forbiddenNext.Count)"

$forbiddenSqlite = $entries | Where-Object { $_.FullName -match '\\.sqlite' }
Write-Host "Forbidden sqlite db: $($forbiddenSqlite.Count)"

$zip.Dispose()
`;

const tempPsFile = path.resolve(__dirname, 'verify_tmp.ps1');
fs.writeFileSync(tempPsFile, psScript);
try {
  const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsFile}"`, { encoding: 'utf8' });
  console.log('\n--- ZIP AUDIT METRICS ---');
  console.log(result.trim());
} finally {
  fs.unlinkSync(tempPsFile);
}
