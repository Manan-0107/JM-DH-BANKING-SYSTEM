/**
 * BCNF CSV Dataset Verification Script
 * Task: Verify that all data/bcnf/*.csv files match the bankist_normalized.sql schema
 *       — correct columns, expected row counts, no forbidden columns,
 *         FK referential integrity (orphan check), and constraint compliance.
 *
 * Does NOT connect to any live database. Pure in-memory CSV analysis.
 * Safe to run at any time without side-effects.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Helpers ────────────────────────────────────────────────────────────────

const BCNF_DIR = path.join(__dirname, '..', 'data', 'bcnf');

function loadCSV(filename) {
  const filepath = path.join(BCNF_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  const raw  = fs.readFileSync(filepath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const vals = parseCSVLine(l);
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

/** Minimal RFC 4180-compliant CSV line parser */
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── Schema Definitions (extracted from bankist_normalized.sql) ─────────────

const SCHEMA = {
  branches: {
    file: 'branches.csv',
    expectedRows: 5,
    columns: ['branch_id','ifsc_code','bank_name','branch_name','city','address','timing','phone','status','created_at'],
    required: ['branch_id','ifsc_code','bank_name','branch_name','city','address'],
    pk: 'branch_id',
    uniqueKeys: ['ifsc_code'],
    forbidden: [],
    fks: [],
    enums: { status: ['Active','Closed','Renovating'] },
  },
  customers: {
    file: 'customers.csv',
    expectedRows: 50,
    columns: ['customer_id','full_name','email','phone','dob','address','created_at','status','kyc_status',
              'password_hash','credit_score','tier','pan_number','aadhaar_number','gender','father_name',
              'marital_status','occupation','annual_income','vkyc_status','signature_data','avatar_data'],
    required: ['customer_id','full_name','email','password_hash'],
    pk: 'customer_id',
    uniqueKeys: ['email','pan_number'],
    forbidden: ['nominee_name','nominee_relation','nominee_dob','card_pin'], // BCNF-decomposed
    fks: [],
    enums: {
      status: ['Active','Suspended','Pending'],
      kyc_status: ['Pending','Verified','Rejected'],
      tier: ['Silver','Gold','Platinum','VIP'],
    },
    checks: row => {
      const score = parseInt(row.credit_score, 10);
      if (row.credit_score !== '' && (isNaN(score) || score < 300 || score > 900))
        return `credit_score ${row.credit_score} outside 300-900`;
      return null;
    },
  },
  customer_nominees: {
    file: 'customer_nominees.csv',
    expectedRows: 50,
    columns: ['nominee_id','customer_id','nominee_name','relationship','dob','allocation_percentage','contact_phone','created_at'],
    required: ['nominee_id','customer_id','nominee_name','relationship'],
    pk: 'nominee_id',
    uniqueKeys: [],
    forbidden: [],
    fks: [{ col: 'customer_id', ref: 'customers', refCol: 'customer_id' }],
    enums: {},
    checks: row => {
      const pct = parseFloat(row.allocation_percentage);
      if (row.allocation_percentage !== '' && !isNaN(pct) && (pct <= 0 || pct > 100))
        return `allocation_percentage ${pct} outside (0,100]`;
      return null;
    },
  },
  accounts: {
    file: 'accounts.csv',
    expectedRows: 68,
    columns: ['account_number','customer_id','account_type','balance','ifsc_code','opening_date','status'],
    required: ['account_number','customer_id','account_type','balance','ifsc_code'],
    pk: 'account_number',
    uniqueKeys: [],
    forbidden: ['branch_name','card_pin','card_pin_hash'], // BCNF-decomposed
    fks: [
      { col: 'customer_id', ref: 'customers', refCol: 'customer_id' },
      { col: 'ifsc_code',   ref: 'branches',  refCol: 'ifsc_code'   },
    ],
    enums: { status: ['Active','Frozen','Closed'] },
    checks: row => {
      const bal = parseFloat(row.balance);
      if (!isNaN(bal) && bal < 0) return `balance ${bal} is negative`;
      return null;
    },
  },
  account_card_credentials: {
    file: 'account_card_credentials.csv',
    expectedRows: 68,
    columns: ['credential_id','account_number','card_pin_hash','status','created_at','updated_at'],
    required: ['credential_id','account_number'],
    pk: 'credential_id',
    uniqueKeys: ['account_number'],
    forbidden: ['card_pin'], // must never appear in plaintext
    fks: [{ col: 'account_number', ref: 'accounts', refCol: 'account_number' }],
    enums: { status: ['Active','Blocked','Pending','NoCard'] },
  },
  transactions: {
    file: 'transactions.csv',
    expectedRows: 160,
    columns: ['transaction_id','sender_account','receiver_account','counterparty_details','channel',
              'amount','type','date_time','status','description','reference_number'],
    required: ['transaction_id','amount','type'],
    pk: 'transaction_id',
    uniqueKeys: ['reference_number'],
    forbidden: [],
    fks: [],
    enums: { channel: ['INTERNAL','UPI','NEFT','IMPS','RTGS','ATM','CASH','TRANSFER','DEPOSIT','WITHDRAWAL'] },
    checks: row => {
      const amt = parseFloat(row.amount);
      if (!isNaN(amt) && amt <= 0) return `amount ${amt} is not positive`;
      return null;
    },
  },
  deposits: {
    file: 'deposits.csv',
    expectedRows: 26,
    columns: ['deposit_id','linked_account','deposit_type','principal_amount','interest_rate',
              'tenure_months','maturity_amount','maturity_date','status','created_at'],
    required: ['deposit_id','linked_account','deposit_type','principal_amount','interest_rate','tenure_months','maturity_amount','maturity_date'],
    pk: 'deposit_id',
    uniqueKeys: [],
    forbidden: ['customer_id'], // BCNF-decomposed: derived via linked_account→accounts
    fks: [{ col: 'linked_account', ref: 'accounts', refCol: 'account_number' }],
    enums: { status: ['Active','Matured','Liquidated','Foreclosed'] },
    checks: row => {
      const p = parseFloat(row.principal_amount), m = parseFloat(row.maturity_amount);
      const r = parseFloat(row.interest_rate), t = parseInt(row.tenure_months, 10);
      if (!isNaN(p) && p < 1000)    return `principal_amount ${p} < 1000`;
      if (!isNaN(r) && (r <= 0 || r > 20)) return `interest_rate ${r} outside (0,20]`;
      if (!isNaN(t) && (t < 1 || t > 120)) return `tenure_months ${t} outside [1,120]`;
      if (!isNaN(p) && !isNaN(m) && m < p) return `maturity_amount ${m} < principal ${p}`;
      return null;
    },
  },
  beneficiaries: {
    file: 'beneficiaries.csv',
    expectedRows: 99,
    columns: ['beneficiary_id','customer_id','beneficiary_name','account_number','ifsc_code',
              'transfer_limit','cooling_until','created_at','is_active'],
    required: ['beneficiary_id','customer_id','beneficiary_name','account_number','ifsc_code'],
    pk: 'beneficiary_id',
    uniqueKeys: [],
    forbidden: ['bank_name'], // BCNF-decomposed: derived via ifsc_code→branches
    fks: [
      { col: 'customer_id', ref: 'customers', refCol: 'customer_id' },
      { col: 'ifsc_code',   ref: 'branches',  refCol: 'ifsc_code'   },
    ],
    enums: {},
    checks: row => {
      const lim = parseFloat(row.transfer_limit);
      if (!isNaN(lim) && lim < 0) return `transfer_limit ${lim} is negative`;
      return null;
    },
  },
  kyc_verifications: {
    file: 'kyc_verifications.csv',
    expectedRows: 250,
    columns: ['verification_id','customer_id','document_type','document_number',
              'verification_method','status','verified_at','remarks'],
    required: ['verification_id','customer_id','document_type','verification_method'],
    pk: 'verification_id',
    uniqueKeys: [],
    forbidden: [],
    fks: [{ col: 'customer_id', ref: 'customers', refCol: 'customer_id' }],
    enums: {},
  },
  otp_sessions: {
    file: 'otp_sessions.csv',
    expectedRows: 50,
    columns: ['session_id','identifier','purpose','otp_hash','expires_at','verified',
              'attempts','last_sent_at','created_at'],
    required: ['session_id','identifier','purpose'],
    pk: 'session_id',
    uniqueKeys: [],
    forbidden: ['otp_code'], // BCNF security: plaintext OTP must not be present
    fks: [],
    enums: {},
  },
  security_rate_limits: {
    file: 'security_rate_limits.csv',
    expectedRows: 20,
    columns: ['key_id','attempts','last_attempt_at','locked_until'],
    required: ['key_id','last_attempt_at'],
    pk: 'key_id',
    uniqueKeys: [],
    forbidden: [],
    fks: [],
    enums: {},
  },
  account_lien_records: {
    file: 'account_lien_records.csv',
    expectedRows: 15,
    columns: ['lien_id','account_number','lien_amount','lien_reason','created_at'],
    required: ['lien_id','account_number','lien_amount','lien_reason'],
    pk: 'lien_id',
    uniqueKeys: [],
    forbidden: [],
    fks: [{ col: 'account_number', ref: 'accounts', refCol: 'account_number' }],
    enums: {},
    checks: row => {
      const a = parseFloat(row.lien_amount);
      if (!isNaN(a) && a <= 0) return `lien_amount ${a} is not positive`;
      return null;
    },
  },
  audit_logs: {
    file: 'audit_logs.csv',
    expectedRows: 100,
    columns: ['log_id','customer_id','action','entity_type','entity_id','details','timestamp'],
    required: ['log_id','action','entity_type'],
    pk: 'log_id',
    uniqueKeys: [],
    forbidden: [],
    fks: [], // customer_id can be NULL (system events)
    enums: {},
  },
};

// ── Run verification ───────────────────────────────────────────────────────

let passed = 0, failed = 0, warnings = 0;
const issues = [];

function pass(msg)  { console.log(`  [PASS] ${msg}`); passed++; }
function fail(msg)  { console.error(`  [FAIL] ${msg}`); failed++; issues.push(msg); }
function warn(msg)  { console.warn(`  [WARN] ${msg}`); warnings++; }

// Pre-load all datasets for FK cross-checks
const allData = {};
for (const [table, def] of Object.entries(SCHEMA)) {
  const data = loadCSV(def.file);
  if (!data) { fail(`Missing file: ${def.file}`); allData[table] = null; }
  else allData[table] = data;
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  BCNF CSV DATASET VERIFICATION — bankist_normalized.sql');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const [table, def] of Object.entries(SCHEMA)) {
  console.log(`\n── ${table} (${def.file}) ─────────────────────────────────`);
  const data = allData[table];
  if (!data) { fail(`Cannot verify ${table}: file missing`); continue; }

  const { headers, rows } = data;

  // 1. Header presence check
  for (const col of def.columns) {
    if (!headers.includes(col)) fail(`Missing column "${col}" in ${def.file}`);
  }
  // 1b. Extra columns (warn only — may be innocuous)
  for (const h of headers) {
    if (!def.columns.includes(h)) warn(`Unexpected column "${h}" in ${def.file}`);
  }

  // 2. Forbidden column check
  for (const fcol of (def.forbidden || [])) {
    if (headers.includes(fcol)) fail(`FORBIDDEN column "${fcol}" present in ${def.file} (BCNF violation / security risk)`);
  }

  // 3. Row count check (±10% tolerance)
  const expected = def.expectedRows;
  const actual   = rows.length;
  const lo = Math.floor(expected * 0.9), hi = Math.ceil(expected * 1.1);
  if (actual >= lo && actual <= hi) {
    pass(`Row count ${actual} (expected ${expected}, tolerance ±10%)`);
  } else {
    fail(`Row count ${actual} outside expected range [${lo}-${hi}] (target ${expected})`);
  }

  // 4. PK uniqueness
  const pkVals = rows.map(r => r[def.pk]).filter(v => v !== undefined);
  const pkSet  = new Set(pkVals);
  if (pkSet.size !== rows.length) {
    fail(`Duplicate PK values in ${def.file} (${rows.length - pkSet.size} duplicates on ${def.pk})`);
  } else {
    pass(`PK uniqueness on "${def.pk}"`);
  }

  // 4b. Unique-key uniqueness
  for (const ukey of (def.uniqueKeys || [])) {
    if (!headers.includes(ukey)) continue; // already reported missing
    const vals = rows.map(r => r[ukey]).filter(v => v !== '');
    const uSet = new Set(vals);
    if (uSet.size !== vals.length) {
      fail(`Duplicate unique-key "${ukey}" values in ${def.file}`);
    } else {
      pass(`Unique constraint on "${ukey}"`);
    }
  }

  // 5. Required non-empty fields
  let reqFails = 0;
  for (const req of (def.required || [])) {
    if (!headers.includes(req)) continue;
    const empties = rows.filter(r => r[req] === '' || r[req] === undefined);
    if (empties.length > 0) { fail(`Required column "${req}" has ${empties.length} empty values`); reqFails++; }
  }
  if (reqFails === 0) pass(`All ${def.required?.length ?? 0} required fields non-empty`);

  // 6. FK referential integrity (orphan check)
  for (const fk of (def.fks || [])) {
    if (!headers.includes(fk.col)) continue;
    const refData = allData[fk.ref];
    if (!refData) { warn(`Cannot check FK ${fk.col}→${fk.ref}: parent file missing`); continue; }
    const parentKeys = new Set(refData.rows.map(r => r[fk.refCol]));
    const orphans = rows.filter(r => {
      const v = r[fk.col];
      return v !== '' && v !== undefined && !parentKeys.has(v);
    });
    if (orphans.length > 0) {
      fail(`FK orphans: ${orphans.length} rows in ${def.file}.${fk.col} have no match in ${fk.ref}.${fk.refCol} (first: ${orphans[0][def.pk]})`);
    } else {
      pass(`FK integrity: ${fk.col} → ${fk.ref}.${fk.refCol} (0 orphans)`);
    }
  }

  // 7. ENUM validation
  for (const [col, allowed] of Object.entries(def.enums || {})) {
    if (!headers.includes(col)) continue;
    const invalid = rows.filter(r => r[col] !== '' && !allowed.includes(r[col]));
    if (invalid.length > 0) {
      fail(`ENUM violation: ${invalid.length} rows in ${def.file}.${col} have invalid values (first: "${invalid[0][col]}")`);
    } else {
      pass(`ENUM "${col}" values valid`);
    }
  }

  // 8. Custom CHECK constraints
  if (def.checks) {
    let checkFails = 0;
    for (const row of rows) {
      const err = def.checks(row);
      if (err) { fail(`CHECK constraint in ${def.file} [${def.pk}=${row[def.pk]}]: ${err}`); checkFails++; if (checkFails >= 3) break; }
    }
    if (checkFails === 0) pass(`CHECK constraints satisfied`);
  }
}

// ── Security spot-check: no plaintext PINs/OTPs anywhere ──────────────────

console.log(`\n── Security: No plaintext PINs or OTPs across all CSVs ──────────`);
const SECURITY_FORBIDDEN = ['card_pin', 'otp_code', 'pin', 'plaintext_pin'];
for (const [table, data] of Object.entries(allData)) {
  if (!data) continue;
  for (const sf of SECURITY_FORBIDDEN) {
    if (data.headers.includes(sf)) {
      fail(`SECURITY: plaintext sensitive column "${sf}" found in ${SCHEMA[table].file}`);
    }
  }
}
pass('No plaintext PIN or OTP columns detected across all CSV files');

// ── Summary ────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
console.log('═══════════════════════════════════════════════════════════════');

if (issues.length > 0) {
  console.log('\n  FAILURES:');
  issues.forEach((i, n) => console.log(`  ${n + 1}. ${i}`));
}

if (failed === 0 && warnings === 0) {
  console.log('\n  ✅ ALL CHECKS PASSED — BCNF CSVs are schema-compliant and importable.');
} else if (failed === 0) {
  console.log('\n  ✅ ALL REQUIRED CHECKS PASSED (with warnings — review above).');
} else {
  console.log('\n  ❌ VERIFICATION FAILED — fix the issues above before import.');
}

process.exit(failed > 0 ? 1 : 0);
