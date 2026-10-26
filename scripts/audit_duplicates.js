const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const ignoreDirs = new Set(['.git', 'node_modules', '.next']);

const allFiles = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath);
      // Skip submission zip itself from duplicate analysis
      if (entry.name.endsWith('.zip')) continue;
      const content = fs.readFileSync(fullPath);
      const hash = crypto.createHash('md5').update(content).digest('hex');
      allFiles.push({
        path: relPath,
        size: content.length,
        hash,
        baseName: entry.name,
      });
    }
  }
}

walk(rootDir);

console.log(`Total non-ignored files audited: ${allFiles.length}`);

// Group by MD5 hash
const byHash = new Map();
for (const f of allFiles) {
  if (!byHash.has(f.hash)) byHash.set(f.hash, []);
  byHash.get(f.hash).push(f);
}

console.log('\n--- EXACT CONTENT DUPLICATES (Identical MD5 Hash) ---');
let dupCount = 0;
for (const [hash, files] of byHash.entries()) {
  if (files.length > 1) {
    dupCount++;
    console.log(`\nGroup ${dupCount} (Size: ${files[0].size} bytes, Hash: ${hash}):`);
    for (const f of files) {
      console.log(`  - ${f.path}`);
    }
  }
}

// Group by base name
const byName = new Map();
for (const f of allFiles) {
  if (!byName.has(f.baseName)) byName.set(f.baseName, []);
  byName.get(f.baseName).push(f);
}

console.log('\n--- SAME FILENAME MULTIPLE LOCATIONS ---');
for (const [name, files] of byName.entries()) {
  if (files.length > 1) {
    console.log(`\nFilename "${name}" found in ${files.length} locations:`);
    for (const f of files) {
      console.log(`  - ${f.path} (${f.size} bytes, hash: ${f.hash})`);
    }
  }
}
