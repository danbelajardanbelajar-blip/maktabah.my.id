const Database = require('better-sqlite3');
const db = new Database('maktabah.db');

const stmt = db.prepare(`
  SELECT p.id, p.book_id, snippet(pages_fts, -1, '<b>', '</b>', '...', 10) as snippet 
  FROM pages_fts f
  JOIN pages p ON f.rowid = p.rowid
  WHERE pages_fts MATCH 'رسول' 
  LIMIT 5;
`);

const start = performance.now();
const results = stmt.all();
const end = performance.now();

console.log(`Found ${results.length} results in ${(end - start).toFixed(2)} ms`);
results.forEach(r => console.log(`- Book ${r.book_id}, Page ${r.id}: ${r.snippet}`));
