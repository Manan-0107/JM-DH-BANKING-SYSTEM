const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- TESTING SCHEMA INITIALIZATION ON CLEAN DATABASE ---');
const sqlFile = path.resolve(__dirname, '../DBMS project/bankist.sql');
let sqlContent = fs.readFileSync(sqlFile, 'utf8');

// Replace database target with bankist_clean_validation
const cleanSql = sqlContent.replace(/`bankist`/g, '`bankist_clean_validation`');
const tmpSql = path.resolve(__dirname, 'clean_init_tmp.sql');
fs.writeFileSync(tmpSql, cleanSql);

try {
  execSync('mysql -u root -P 3307 -h 127.0.0.1 -e "DROP DATABASE IF EXISTS bankist_clean_validation; CREATE DATABASE bankist_clean_validation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"');
  execSync(`mysql -u root -P 3307 -h 127.0.0.1 bankist_clean_validation -e "source ${tmpSql.replace(/\\/g, '/')}"`);
  
  const tables = execSync('mysql -u root -P 3307 -h 127.0.0.1 bankist_clean_validation -e "SHOW TABLES;"', { encoding: 'utf8' });
  console.log('Tables initialized in clean database:');
  console.log(tables.trim());
  
  const counts = execSync('mysql -u root -P 3307 -h 127.0.0.1 bankist_clean_validation -e "SELECT \'customers\' AS tbl, COUNT(*) AS count FROM customers UNION ALL SELECT \'accounts\', COUNT(*) FROM accounts UNION ALL SELECT \'transactions\', COUNT(*) FROM transactions;"', { encoding: 'utf8' });
  console.log('\nRow counts:');
  console.log(counts.trim());
  
  console.log('\n[PASS] Clean database initialization successful!');
} finally {
  if (fs.existsSync(tmpSql)) fs.unlinkSync(tmpSql);
  execSync('mysql -u root -P 3307 -h 127.0.0.1 -e "DROP DATABASE IF EXISTS bankist_clean_validation;"');
}
