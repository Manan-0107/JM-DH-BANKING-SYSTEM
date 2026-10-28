const fs = require('fs');
const path = require('path');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  const lines = content.split('\n');
  const header = lines[0].trim().split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = [];
    let insideQuote = false;
    let curVal = '';
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(curVal);
        curVal = '';
      } else {
        curVal += char;
      }
    }
    values.push(curVal);
    
    const obj = {};
    header.forEach((h, idx) => {
      let v = values[idx] !== undefined ? values[idx].trim() : '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      obj[h] = v === '' ? null : v;
    });
    rows.push(obj);
  }
  return { header, rows };
}

const baseDir = path.resolve(__dirname, '..');
const customers = parseCSV(path.join(baseDir, 'customers.csv'));
const accounts = parseCSV(path.join(baseDir, 'accounts.csv'));
const liens = parseCSV(path.join(baseDir, 'account_lien_records.csv'));
const beneficiaries = parseCSV(path.join(baseDir, 'beneficiaries.csv'));
const branches = parseCSV(path.join(baseDir, 'branches.csv'));
const deposits = parseCSV(path.join(baseDir, 'deposits.csv'));
const kyc = parseCSV(path.join(baseDir, 'kyc_verifications.csv'));
const otps = parseCSV(path.join(baseDir, 'otp_sessions.csv'));
const rateLimits = parseCSV(path.join(baseDir, 'security_rate_limits.csv'));
const txns = parseCSV(path.join(baseDir, 'transactions.csv'));
const audit = parseCSV(path.join(baseDir, 'audit_logs.csv'));

console.log('--- Row counts ---');
console.log('customers:', customers.rows.length);
console.log('accounts:', accounts.rows.length);
console.log('liens:', liens.rows.length);
console.log('beneficiaries:', beneficiaries.rows.length);
console.log('branches:', branches.rows.length);
console.log('deposits:', deposits.rows.length);
console.log('kyc:', kyc.rows.length);
console.log('otps:', otps.rows.length);
console.log('rateLimits:', rateLimits.rows.length);
console.log('txns:', txns.rows.length);
console.log('audit:', audit.rows.length);

const custIds = new Set(customers.rows.map(r => r.customer_id));
const accNums = new Set(accounts.rows.map(r => r.account_number));

// Check orphan accounts
const orphanAccs = accounts.rows.filter(r => !custIds.has(r.customer_id));
console.log('Orphan accounts:', orphanAccs.length);

// Check orphan liens
const orphanLiens = liens.rows.filter(r => !accNums.has(r.account_number));
console.log('Orphan liens:', orphanLiens.length);

// Check orphan beneficiaries
const orphanBens = beneficiaries.rows.filter(r => !custIds.has(r.customer_id));
console.log('Orphan beneficiaries:', orphanBens.length);

// Check orphan deposits
const orphanDepCust = deposits.rows.filter(r => !custIds.has(r.customer_id));
const orphanDepAcc = deposits.rows.filter(r => !accNums.has(r.linked_account));
console.log('Orphan deposit customers:', orphanDepCust.length, 'accounts:', orphanDepAcc.length);

// Check orphan KYC
const orphanKyc = kyc.rows.filter(r => !custIds.has(r.customer_id));
console.log('Orphan KYC:', orphanKyc.length);

// Check duplicate IDs in each
function checkDupes(name, rows, key) {
  const seen = new Set();
  const dupes = [];
  rows.forEach(r => {
    if (seen.has(r[key])) dupes.push(r[key]);
    seen.add(r[key]);
  });
  if (dupes.length > 0) console.log(name, 'duplicate', key, dupes);
  else console.log(name, 'has unique', key);
}

checkDupes('customers', customers.rows, 'customer_id');
checkDupes('accounts', accounts.rows, 'account_number');
checkDupes('liens', liens.rows, 'lien_id');
checkDupes('beneficiaries', beneficiaries.rows, 'beneficiary_id');
checkDupes('branches', branches.rows, 'branch_id');
checkDupes('deposits', deposits.rows, 'deposit_id');
checkDupes('kyc', kyc.rows, 'verification_id');
checkDupes('otps', otps.rows, 'session_id');
checkDupes('rateLimits', rateLimits.rows, 'key_id');
checkDupes('txns', txns.rows, 'transaction_id');
checkDupes('audit', audit.rows, 'log_id');

const statuses = {};
customers.rows.forEach(c => {
  statuses[c.status] = (statuses[c.status] || 0) + 1;
});
console.log('Customer Statuses in CSV:', statuses);
console.log('Sample customers in CSV:', customers.rows.slice(0, 5).map(c => ({
  id: c.customer_id,
  name: c.full_name,
  email: c.email,
  phone: c.phone,
  status: c.status,
  pin: c.card_pin,
  pin_hash: c.card_pin_hash?.slice(0, 15)
})));
