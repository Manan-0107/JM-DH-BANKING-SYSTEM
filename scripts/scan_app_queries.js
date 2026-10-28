const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');

function findFiles(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const filePath = path.resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extensions));
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const files = findFiles(APP_DIR, ['.ts', '.tsx', '.js', '.mjs']);
console.log('Total source files found in application:', files.length);

const queryMap = [];
const tablePatterns = ['customers', 'accounts', 'transactions', 'kyc_verifications', 'beneficiaries', 'deposits', 'branches', 'cards', 'otp_sessions', 'security_rate_limits', 'account_lien_records', 'audit_logs'];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const relPath = path.relative(APP_DIR, f);
  
  // Look for SQL query executions
  const matches = content.match(/query\s*\(\s*[`'"].*?[`'"]/gs) || [];
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    for (const t of tablePatterns) {
      if (new RegExp(`\\b${t}\\b`, 'i').test(line) && (line.includes('SELECT') || line.includes('INSERT') || line.includes('UPDATE') || line.includes('DELETE') || line.includes('FROM') || line.includes('JOIN'))) {
        queryMap.push({
          file: relPath,
          lineNum: idx + 1,
          table: t,
          line: line.trim()
        });
      }
    }
  });
}

console.log('Total SQL usage occurrences found:', queryMap.length);
const scratchDir = path.resolve('C:/Users/MANAN/.gemini/antigravity/brain/ea3fc8f6-b56a-484e-aae2-e0dc4502e50e/scratch');
fs.writeFileSync(path.resolve(scratchDir, 'app_sql_query_map.json'), JSON.stringify(queryMap, null, 2));

// Summary by file
const fileSummary = {};
for (const q of queryMap) {
  fileSummary[q.file] = (fileSummary[q.file] || 0) + 1;
}
console.log('Files with SQL usage:', JSON.stringify(fileSummary, null, 2));

