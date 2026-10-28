const fs = require('fs');
const path = require('path');
const APP_DIR = path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');

const targetFiles = [
  'app/api/auth/login/route.ts',
  'app/api/auth/signup/route.ts',
  'app/api/accounts/my-accounts/route.ts',
  'app/api/accounts/open-additional/route.ts',
  'app/api/accounts/transfer/route.ts',
  'app/api/accounts/[id]/withdraw/route.ts',
  'app/api/transactions/my-transactions/route.ts',
  'app/api/upi/simulate-receive/route.ts',
  'app/api/dashboard/route.ts',
  'app/api/deposits/route.ts',
  'lib/db.ts'
];

targetFiles.forEach(f => {
  const fullPath = path.resolve(APP_DIR, f);
  if (fs.existsSync(fullPath)) {
    console.log(`\n================== ${f} ==================`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('query(') || line.includes('query `') || line.includes('SELECT') || line.includes('INSERT INTO') || line.includes('UPDATE ') || line.includes('FROM accounts') || line.includes('FROM customers') || line.includes('FROM transactions')) {
        console.log(`  L${i+1}: ${line.trim()}`);
      }
    });
  }
});

