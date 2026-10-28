const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const appRoot = path.join(projectRoot, 'DBMS project', 'JM-DH-BANKING-SYSTEM-main', 'JM-DH-BANKING-SYSTEM-main', 'test');
const sqlite3 = require(path.join(appRoot, 'node_modules', 'sqlite3')).verbose();

function openDb(filePath, mode) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, mode || sqlite3.OPEN_READWRITE, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function main() {
  const sqlitePath = path.join(appRoot, 'bankist.sqlite');

  console.log('================================================================');
  console.log('   PHASE 1 & 2: SQLITE INVENTORY & CONSISTENT RECOVERABLE BACKUP ');
  console.log('================================================================');
  console.log(`Source SQLite Database: ${sqlitePath}`);

  if (!fs.existsSync(sqlitePath)) {
    console.error(`ERROR: SQLite database file not found at ${sqlitePath}`);
    process.exit(1);
  }

  // Calculate original file hash & size
  const origBuffer = fs.readFileSync(sqlitePath);
  const origHash = crypto.createHash('sha256').update(origBuffer).digest('hex');
  const origSize = origBuffer.length;
  console.log(`Original Size: ${origSize} bytes (${(origSize / 1024).toFixed(2)} KB)`);
  console.log(`Original SHA-256: ${origHash}`);

  // Phase 2: Create consistent backup
  // In SQLite, opening a transaction with BEGIN IMMEDIATE, copying bytes, and COMMIT ensures zero dirty writes
  const db = await openDb(sqlitePath);
  await runAsync(db, 'PRAGMA busy_timeout = 5000;');
  await runAsync(db, 'PRAGMA foreign_keys = ON;');

  // Check integrity before backup
  const integrityCheck = await allAsync(db, 'PRAGMA integrity_check;');
  console.log(`SQLite Integrity Check: ${JSON.stringify(integrityCheck)}`);
  if (!integrityCheck || integrityCheck[0].integrity_check !== 'ok') {
    throw new Error(`Integrity check failed: ${JSON.stringify(integrityCheck)}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `bankist.sqlite.backup_phase2_${timestamp}.db`;
  const backupPath = path.join(appRoot, backupFilename);

  console.log('\n--- Creating Consistent SQLite Backup ---');
  // VACUUM INTO produces an atomic, transactionally clean, vacuumed backup file
  try {
    await runAsync(db, `VACUUM INTO '${backupPath.replace(/\\/g, '/')}'`);
    console.log(`VACUUM INTO completed successfully.`);
  } catch (vacErr) {
    console.log(`VACUUM INTO not supported or failed (${vacErr.message}), using file copy with lock...`);
    fs.copyFileSync(sqlitePath, backupPath);
  }

  const backupBuffer = fs.readFileSync(backupPath);
  const backupHash = crypto.createHash('sha256').update(backupBuffer).digest('hex');
  const backupSize = backupBuffer.length;
  console.log(`Backup File: ${backupPath}`);
  console.log(`Backup Size: ${backupSize} bytes (${(backupSize / 1024).toFixed(2)} KB)`);
  console.log(`Backup SHA-256: ${backupHash}`);

  // Phase 1: Complete Inventory
  console.log('\n--- Phase 1: Complete SQLite Database Inventory ---');

  // Discover all objects
  const masterObjects = await allAsync(db, `
    SELECT type, name, tbl_name, sql 
    FROM sqlite_master 
    WHERE name NOT LIKE 'sqlite_%' 
    ORDER BY type, name
  `);

  const tables = masterObjects.filter(o => o.type === 'table');
  const views = masterObjects.filter(o => o.type === 'view');
  const triggers = masterObjects.filter(o => o.type === 'trigger');
  const customIndexes = masterObjects.filter(o => o.type === 'index');

  console.log(`Discovered Database Objects:`);
  console.log(`- Tables:   ${tables.length}`);
  console.log(`- Views:    ${views.length}`);
  console.log(`- Triggers: ${triggers.length}`);
  console.log(`- Indexes:  ${customIndexes.length}`);

  const inventory = {
    sourceDatabase: sqlitePath,
    originalChecksum: origHash,
    originalSizeBytes: origSize,
    backupFile: backupPath,
    backupChecksum: backupHash,
    backupSizeBytes: backupSize,
    timestamp: new Date().toISOString(),
    tables: [],
    views: views.map(v => ({ name: v.name, sql: v.sql })),
    triggers: triggers.map(t => ({ name: t.name, sql: t.sql })),
    indexes: customIndexes.map(i => ({ name: i.name, table: i.tbl_name, sql: i.sql }))
  };

  for (const t of tables) {
    const tableName = t.name;
    const countRow = await getAsync(db, `SELECT COUNT(*) as count FROM "${tableName}"`);
    const rowCount = countRow ? countRow.count : 0;

    const columns = await allAsync(db, `PRAGMA table_info("${tableName}")`);
    const foreignKeys = await allAsync(db, `PRAGMA foreign_key_list("${tableName}")`);
    const indexList = await allAsync(db, `PRAGMA index_list("${tableName}")`);

    // Check null counts per column
    const nullCounts = {};
    for (const col of columns) {
      const nullRow = await getAsync(db, `SELECT COUNT(*) as count FROM "${tableName}" WHERE "${col.name}" IS NULL`);
      nullCounts[col.name] = nullRow ? nullRow.count : 0;
    }

    // Check duplicate primary keys (if PK defined)
    const pkCols = columns.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
    let duplicatePkCount = 0;
    if (pkCols.length > 0) {
      const pkExpr = pkCols.map(c => `"${c}"`).join(', ');
      const dupRow = await getAsync(db, `
        SELECT COUNT(*) as dup_count FROM (
          SELECT ${pkExpr}, COUNT(*) as c FROM "${tableName}" GROUP BY ${pkExpr} HAVING c > 1
        )
      `);
      duplicatePkCount = dupRow ? dupRow.dup_count : 0;
    }

    const indexesWithCols = [];
    for (const idx of indexList) {
      const info = await allAsync(db, `PRAGMA index_info("${idx.name}")`);
      indexesWithCols.push({
        name: idx.name,
        unique: idx.unique === 1,
        origin: idx.origin,
        partial: idx.partial === 1,
        columns: info.map(i => i.name)
      });
    }

    const tableObj = {
      name: tableName,
      rowCount,
      sql: t.sql,
      primaryKey: pkCols,
      columns: columns.map(c => ({
        cid: c.cid,
        name: c.name,
        type: c.type,
        notnull: c.notnull === 1,
        defaultValue: c.dflt_value,
        pk: c.pk,
        nullCount: nullCounts[c.name]
      })),
      foreignKeys: foreignKeys.map(fk => ({
        id: fk.id,
        seq: fk.seq,
        table: fk.table,
        from: fk.from,
        to: fk.to,
        onUpdate: fk.on_update,
        onDelete: fk.on_delete,
        match: fk.match
      })),
      indexes: indexesWithCols,
      duplicatePkCount
    };

    inventory.tables.push(tableObj);
    console.log(`\nTable: [${tableName}]`);
    console.log(`  - Rows: ${rowCount}`);
    console.log(`  - PK: [${pkCols.join(', ')}]`);
    console.log(`  - Columns (${columns.length}): ${columns.map(c => c.name).join(', ')}`);
    console.log(`  - Foreign Keys: ${foreignKeys.length}`);
    console.log(`  - Indexes: ${indexList.length}`);
    console.log(`  - Duplicate PK Violations: ${duplicatePkCount}`);
  }

  db.close();

  // Save inventory JSON
  const inventoryJsonPath = path.join(projectRoot, 'scripts', 'sqlite_inventory.json');
  fs.writeFileSync(inventoryJsonPath, JSON.stringify(inventory, null, 2), 'utf8');
  console.log(`\n[SUCCESS] SQLite Inventory saved to: ${inventoryJsonPath}`);

  return inventory;
}

main().catch(err => {
  console.error('Fatal error during SQLite inventory:', err);
  process.exit(1);
});
