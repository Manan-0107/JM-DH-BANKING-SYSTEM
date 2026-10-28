const fs = require('fs');
const path = require('path');
const APP_DIR = path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');

function searchCode(pattern) {
  function scan(dir) {
    const list = fs.readdirSync(dir);
    for (const f of list) {
      if (f === 'node_modules' || f === '.next') continue;
      const full = path.resolve(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scan(full);
      } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes(pattern)) {
          console.log(`Found in: ${path.relative(APP_DIR, full)}`);
          const lines = content.split('\n');
          lines.forEach((l, idx) => {
            if (l.includes(pattern)) {
              console.log(`  L${idx+1}: ${l.trim()}`);
            }
          });
        }
      }
    }
  }
  scan(APP_DIR);
}

console.log('--- Searching for card_pin ---');
searchCode('card_pin');
console.log('\n--- Searching for card_pin_hash ---');
searchCode('card_pin_hash');

