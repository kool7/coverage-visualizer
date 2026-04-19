/**
 * Generates a synthetic .coverage SQLite file matching demo-python-project/src/*.py
 * Uses sql.js (already a project dependency) so no native modules needed.
 * Run: node scripts/generate-test-coverage-db.mjs
 */

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '../demo-python-project/.coverage');

// coverage.py bitmap: bit (n%8) in byte (n//8) set means line n was executed
function numsToNumBits(lineNums) {
  if (lineNums.length === 0) return Buffer.alloc(0);
  const max = Math.max(...lineNums);
  const nbytes = Math.floor(max / 8) + 1;
  const buf = Buffer.alloc(nbytes, 0);
  for (const n of lineNums) buf[Math.floor(n / 8)] |= (1 << (n % 8));
  return buf;
}

const SQL = await initSqlJs();
const db = new SQL.Database();

db.run(`
  CREATE TABLE meta (key TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(key));
  CREATE TABLE file (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, UNIQUE(path));
  CREATE TABLE line_bits (file_id INTEGER NOT NULL, numbits BLOB NOT NULL);
`);

db.run(`INSERT OR REPLACE INTO meta VALUES ('coverage_version', '7.4.0')`);
db.run(`INSERT OR REPLACE INTO meta VALUES ('timestamp', '${new Date().toISOString()}')`);

function insertFile(filePath, lineNums) {
  db.run('INSERT INTO file (path) VALUES (?)', [filePath]);
  const [{ values }] = db.exec('SELECT last_insert_rowid()');
  const id = values[0][0];
  db.run('INSERT INTO line_bits (file_id, numbits) VALUES (?, ?)', [id, numsToNumBits(lineNums)]);
}

// calculator.py — executed: 1,2,4,5,7,8,10,11  missing: 3,6,9,12
insertFile('src/calculator.py', [1, 2, 4, 5, 7, 8, 10, 11]);

// utils.py — format_percent (lines 1,2) + clamp (lines 5,6), all executed
insertFile('src/utils.py', [1, 2, 5, 6]);

// untested.py — nothing executed
insertFile('src/untested.py', []);

writeFileSync(outPath, Buffer.from(db.export()));
db.close();

console.log(`✓ Written: ${outPath}`);
console.log('  calculator.py → 8/12 lines (66.7%)');
console.log('  utils.py      → 4/4  lines (100%)');
console.log('  untested.py   → 0/9  lines (0%)');
