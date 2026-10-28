const path = require('path');
const fs = require('fs');
const TEST_DIR = path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306'),
    database: 'bankist'
  });
  
  console.log('--- LIVE BANKIST DATABASE BASELINE ---');
  const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  console.log('Base Table Count:', tables.length);
  
  const inventory = {};
  let totalRows = 0;
  for (const t of tables) {
    const tName = Object.values(t)[0];
    const [[{ cnt }]] = await conn.query(`SELECT COUNT(1) as cnt FROM \`${tName}\``);
    inventory[tName] = cnt;
    totalRows += cnt;
  }
  console.log('Row Counts:', JSON.stringify(inventory, null, 2));
  console.log('Total Rows across all base tables:', totalRows);

  const [[{ accBalanceSum }]] = await conn.query('SELECT CAST(SUM(balance) AS CHAR) as accBalanceSum FROM accounts');
  const [[{ txAmountSum }]] = await conn.query('SELECT CAST(SUM(amount) AS CHAR) as txAmountSum FROM transactions');
  const [[{ depPrincipalSum }]] = await conn.query('SELECT CAST(SUM(principal_amount) AS CHAR) as depPrincipalSum FROM deposits');
  
  console.log('Account Balance Sum (Exact):', accBalanceSum);
  console.log('Transaction Amount Sum (Exact):', txAmountSum);
  console.log('Deposit Principal Sum (Exact):', depPrincipalSum);

  // Check lien status distribution and columns
  const [lienCols] = await conn.query('DESCRIBE account_lien_records');
  console.log('Lien columns:', lienCols.map(c => `${c.Field} (${c.Type})`));
  const [liens] = await conn.query('SELECT * FROM account_lien_records');
  console.log('Lien Records Count:', liens.length);
  console.log('Lien Rows:', JSON.stringify(liens, null, 2));

  // Check OTP sessions columns and sample
  const [otpCols] = await conn.query('DESCRIBE otp_sessions');
  console.log('OTP columns:', otpCols.map(c => `${c.Field} (${c.Type})`));
  const [otpStats] = await conn.query(`
    SELECT 
      COUNT(1) as total,
      SUM(CASE WHEN otp_code IS NOT NULL AND otp_code != '' THEN 1 ELSE 0 END) as has_plaintext,
      SUM(CASE WHEN otp_hash IS NOT NULL AND otp_hash != '' THEN 1 ELSE 0 END) as has_hash
    FROM otp_sessions
  `);
  console.log('OTP Stats:', otpStats[0]);

  // Check transactions sample where sender_account or receiver_account has special values
  const [txSample] = await conn.query(`
    SELECT transaction_id, sender_account, receiver_account, type, amount, status, reference_number, description 
    FROM transactions 
    WHERE sender_account LIKE '%@%' OR receiver_account LIKE '%@%' OR sender_account IS NULL OR receiver_account IS NULL 
    LIMIT 10
  `);
  console.log('Transaction Sample with @ or NULL:', JSON.stringify(txSample, null, 2));

  // Check customer nominees and card columns in original customers & accounts
  const [custCols] = await conn.query('DESCRIBE customers');
  console.log('Customer columns:', custCols.map(c => `${c.Field} (${c.Type})`));
  const [custNomineeStats] = await conn.query(`
    SELECT 
      COUNT(1) as total,
      SUM(CASE WHEN nominee_name IS NOT NULL AND TRIM(nominee_name) != '' THEN 1 ELSE 0 END) as has_nominee,
      SUM(CASE WHEN card_pin IS NOT NULL AND TRIM(card_pin) != '' THEN 1 ELSE 0 END) as has_cust_card_pin,
      SUM(CASE WHEN card_pin_hash IS NOT NULL AND TRIM(card_pin_hash) != '' THEN 1 ELSE 0 END) as has_cust_card_pin_hash
    FROM customers
  `);
  console.log('Customer Nominee & Card PIN Stats:', custNomineeStats[0]);

  const [accCols] = await conn.query('DESCRIBE accounts');
  console.log('Account columns:', accCols.map(c => `${c.Field} (${c.Type})`));
  const [accCardStats] = await conn.query(`
    SELECT 
      COUNT(1) as total,
      SUM(CASE WHEN card_pin IS NOT NULL AND TRIM(card_pin) != '' THEN 1 ELSE 0 END) as has_acc_card_pin,
      SUM(CASE WHEN card_pin_hash IS NOT NULL AND TRIM(card_pin_hash) != '' THEN 1 ELSE 0 END) as has_acc_card_pin_hash
    FROM accounts
  `);
  console.log('Account Card PIN Stats:', accCardStats[0]);

  // Save baseline report to scratch
  const baseline = {
    captured_at: new Date().toISOString(),
    database: 'bankist',
    tables_count: tables.length,
    total_rows: totalRows,
    inventory,
    balances: {
      accounts_balance_sum: accBalanceSum,
      transactions_amount_sum: txAmountSum,
      deposits_principal_sum: depPrincipalSum
    },
    liens,
    otp_stats: otpStats[0],
    customer_stats: custNomineeStats[0],
    account_stats: accCardStats[0]
  };
  
  const scratchDir = path.resolve('C:/Users/MANAN/.gemini/antigravity/brain/ea3fc8f6-b56a-484e-aae2-e0dc4502e50e/scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
  fs.writeFileSync(path.resolve(scratchDir, 'live_database_baseline.json'), JSON.stringify(baseline, null, 2));
  console.log('Saved baseline to scratch/live_database_baseline.json');

  await conn.end();
})();

