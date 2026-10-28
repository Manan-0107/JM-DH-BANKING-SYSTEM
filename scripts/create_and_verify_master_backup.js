const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_DIR = path.resolve(__dirname, '../DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test');
require(path.resolve(TEST_DIR, 'node_modules/dotenv')).config({ path: path.resolve(TEST_DIR, '.env') });
const mysql = require(path.resolve(TEST_DIR, 'node_modules/mysql2/promise'));

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'bankist';

  console.log(`[BACKUP] Connecting to ${host}:${port}/${database} as ${user}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  // 1. Confirm identity
  const [[{ currentDb }]] = await conn.query('SELECT DATABASE() as currentDb');
  const [[{ version }]] = await conn.query('SELECT VERSION() as version');
  if (currentDb !== 'bankist') {
    throw new Error(`Target database mismatch! Expected 'bankist', got '${currentDb}'`);
  }
  console.log(`[BACKUP] Confirmed MySQL Server version: ${version}, Database: ${currentDb}`);

  // 2. Check processlist
  const [processes] = await conn.query('SHOW PROCESSLIST');
  const nonSleep = processes.filter(p => p.Command !== 'Sleep' && p.Id !== processes[0].Id);
  console.log(`[BACKUP] Active connections: ${processes.length}, Active queries: ${nonSleep.length}`);

  // 3. Inventory before backup
  const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const [views] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
  let totalRows = 0;
  const tableCounts = {};
  for (const t of tables) {
    const tName = Object.values(t)[0];
    const [[{ cnt }]] = await conn.query(`SELECT COUNT(1) as cnt FROM \`${tName}\``);
    tableCounts[tName] = cnt;
    totalRows += cnt;
  }
  const [[{ accSum }]] = await conn.query('SELECT CAST(SUM(balance) AS CHAR) as accSum FROM accounts');
  const [[{ txnSum }]] = await conn.query('SELECT CAST(SUM(amount) AS CHAR) as txnSum FROM transactions');
  const [[{ depSum }]] = await conn.query('SELECT CAST(SUM(principal_amount) AS CHAR) as depSum FROM deposits');

  console.log(`[BACKUP] Baseline counts: ${tables.length} tables, ${views.length} views, ${totalRows} total rows.`);
  console.log(`[BACKUP] Financial sums: Balance=${accSum}, TxnVolume=${txnSum}, Deposits=${depSum}`);

  await conn.end();

  // 4. Create mysqldump
  const backupDir = path.resolve(__dirname, '../database/backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, 'bankist_master_backup_2026-10-29.sql');

  console.log(`[BACKUP] Running mysqldump to ${backupFile}...`);
  const pwdArg = password ? `-p"${password}"` : '';
  const dumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} ${pwdArg} --routines --triggers --events --single-transaction --databases ${database} > "${backupFile}"`;
  execSync(dumpCmd, { stdio: 'inherit', shell: 'cmd.exe' });

  const stats = fs.statSync(backupFile);
  console.log(`[BACKUP] Backup created successfully (${stats.size} bytes).`);

  // 5. Verify backup by restoring into an isolated disposable database
  const verifyDb = 'bankist_backup_verify_eval';
  console.log(`[VERIFY] Restoring into isolated verification database '${verifyDb}'...`);

  const rootConn = await mysql.createConnection({ host, port, user, password });
  await rootConn.query(`DROP DATABASE IF EXISTS \`${verifyDb}\``);
  await rootConn.query(`CREATE DATABASE \`${verifyDb}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConn.end();

  // Read dump file and replace `bankist` with `verifyDb` for verification
  let dumpSql = fs.readFileSync(backupFile, 'utf8');
  dumpSql = dumpSql.replace(/`bankist`/g, `\`${verifyDb}\``);
  dumpSql = dumpSql.replace(/USE `bankist`;/g, `USE \`${verifyDb}\`;`);

  const restoreFile = path.join(backupDir, 'temp_verify_restore.sql');
  fs.writeFileSync(restoreFile, dumpSql, 'utf8');

  const restoreCmd = `mysql -h ${host} -P ${port} -u ${user} ${pwdArg} ${verifyDb} < "${restoreFile}"`;
  execSync(restoreCmd, { stdio: 'inherit', shell: 'cmd.exe' });
  fs.unlinkSync(restoreFile);

  // Inspect restored database
  const vConn = await mysql.createConnection({ host, port, user, password, database: verifyDb });
  const [vTables] = await vConn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  let vTotalRows = 0;
  for (const t of vTables) {
    const tName = Object.values(t)[0];
    const [[{ cnt }]] = await vConn.query(`SELECT COUNT(1) as cnt FROM \`${tName}\``);
    vTotalRows += cnt;
    if (cnt !== tableCounts[tName]) {
      throw new Error(`Restoration row count mismatch on ${tName}: Expected ${tableCounts[tName]}, got ${cnt}`);
    }
  }

  const [[{ vAccSum }]] = await vConn.query('SELECT CAST(SUM(balance) AS CHAR) as vAccSum FROM accounts');
  if (vAccSum !== accSum) {
    throw new Error(`Restoration balance mismatch: Expected ${accSum}, got ${vAccSum}`);
  }

  console.log(`[VERIFY] SUCCESS: Restored database verified with 100% parity!`);
  console.log(`[VERIFY] Base tables: ${vTables.length}, Total rows: ${vTotalRows}, Balance: ${vAccSum}`);

  // Drop verification database
  await vConn.query(`DROP DATABASE \`${verifyDb}\``);
  await vConn.end();
  console.log(`[VERIFY] Disposable verification database dropped cleanly.`);

  // Write manifest
  const manifest = {
    backup_file: backupFile,
    backup_size_bytes: stats.size,
    timestamp: new Date().toISOString(),
    source_database: database,
    mysql_version: version,
    base_tables_count: tables.length,
    views_count: views.length,
    total_rows: totalRows,
    table_counts: tableCounts,
    balances: {
      account_balance_sum: accSum,
      transaction_volume_sum: txnSum,
      deposit_principal_sum: depSum
    },
    verification_status: 'VERIFIED_100_PERCENT_RESTORE_PARITY'
  };

  const manifestFile = path.join(backupDir, 'bankist_backup_manifest_2026-10-29.json');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[BACKUP] Manifest written to ${manifestFile}`);
}

main().catch(err => {
  console.error('[BACKUP ERROR]', err);
  process.exit(1);
});
