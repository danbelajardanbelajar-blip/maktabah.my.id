import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import { exportLargePackage, inspectLargePackage, importLargePackage } from './large-transfer-worker.js';
import { registerLargeTransfer } from './large-transfer.js';

const seed = fileURLToPath(new URL('../dev-data/seed/maktabah.db', import.meta.url));
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-large-'));
  const source = path.join(directory, 'source.db'), destination = path.join(directory, 'destination.db'), output = path.join(directory, 'package.db');
  fs.copyFileSync(seed, source); fs.copyFileSync(seed, destination);
  const db = new Database(destination);
  db.exec('DELETE FROM titles; DELETE FROM pages; DELETE FROM books_meta; DELETE FROM categories; DELETE FROM authors;'); db.close();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, source, destination, output, backup: path.join(directory, 'backup.db') };
}

test('large SQLite package round trip preserves complete books and empty categories', async t => {
  const f = fixture(t);
  const src = new Database(f.source);
  src.prepare('INSERT INTO categories (id,name) VALUES (999999,?)').run('Empty category');
  const cat = src.prepare('SELECT cat FROM books_meta WHERE bkid=1').get().cat;
  src.prepare('UPDATE pages SET part=?,page=? WHERE book_id=1 AND id=(SELECT min(id) FROM pages WHERE book_id=1)').run('مقدمة', 'الغلاف');
  const pages = src.prepare('SELECT * FROM pages WHERE book_id=1 ORDER BY rowid').all();
  src.close();
  const before = fs.statSync(f.source);
  const exported = exportLargePackage({ dbPath: f.source, outputPath: f.output, selection: { categoryIds: [cat, 999999] } });
  assert.equal(exported.books, 1);
  const info = inspectLargePackage(f.output);
  assert.equal(info.categories.length, 2);
  const result = await importLargePackage({ dbPath: f.destination, inputPath: f.output, backupPath: f.backup });
  assert.equal(result.imported, 1); assert.equal(result.importedCategories, 2);
  const dest = new Database(f.destination);
  assert.deepEqual(dest.prepare('SELECT * FROM pages WHERE book_id=1 ORDER BY rowid').all(), pages);
  assert.equal(dest.prepare('SELECT name FROM categories WHERE id=999999').get().name, 'Empty category');
  dest.prepare("INSERT INTO pages_fts(pages_fts,rank) VALUES('integrity-check',1)").run();
  dest.close();
  const backup = new Database(f.backup, { readonly: true }); assert.equal(backup.prepare('SELECT count(*) n FROM books_meta').get().n, 0); backup.close();
  assert.equal(fs.statSync(f.source).mtimeMs, before.mtimeMs);
  const second = await importLargePackage({ dbPath: f.destination, inputPath: f.output, backupPath: path.join(f.directory, 'backup2.db') });
  assert.equal(second.imported, 0); assert.equal(second.skipped, 1);
});

test('mid-import SQL failure rolls back the entire package', async t => {
  const f = fixture(t);
  exportLargePackage({ dbPath: f.source, outputPath: f.output, selection: { bookIds: [1, 2] } });
  const dest = new Database(f.destination);
  dest.exec("CREATE TRIGGER forced_failure BEFORE INSERT ON books_meta WHEN new.bkid=2 BEGIN SELECT raise(ABORT,'forced rollback'); END"); dest.close();
  await assert.rejects(importLargePackage({ dbPath: f.destination, inputPath: f.output, backupPath: f.backup }), /forced rollback/);
  const check = new Database(f.destination);
  assert.equal(check.prepare('SELECT count(*) n FROM books_meta').get().n, 0);
  assert.equal(check.prepare('SELECT count(*) n FROM pages').get().n, 0); check.close();
});

test('original full database and packages with executable triggers are rejected', t => {
  const f = fixture(t);
  assert.throws(() => inspectLargePackage(f.source), /bukan paket/);
  exportLargePackage({ dbPath: f.source, outputPath: f.output, selection: { bookIds: [1] } });
  const packet = new Database(f.output); packet.exec('CREATE TRIGGER injected AFTER INSERT ON pages BEGIN SELECT 1; END'); packet.close();
  assert.throws(() => inspectLargePackage(f.output), /trigger/);
  const old = fs.statSync(f.output).size;
  assert.throws(() => exportLargePackage({ dbPath: f.source, outputPath: f.output, selection: { bookIds: [1] } }), /sudah ada/);
  assert.equal(fs.statSync(f.output).size, old);
});

test('export and import work beyond 50 MB without loading all pages at once', { timeout: 120000 }, async t => {
  const f = fixture(t);
  const src = new Database(f.source);
  src.exec('DROP TRIGGER pages_ai; DROP TRIGGER pages_ad; DROP TRIGGER pages_au; DELETE FROM pages; DELETE FROM titles; DELETE FROM books_meta WHERE bkid<>1;');
  const text = 'نص اختبار النقل الكبير '.repeat(1800);
  const insert = src.prepare('INSERT INTO pages (id,book_id,part,page,seal,nass) VALUES (?,1,1,?,?,?)');
  src.transaction(() => { for (let i = 1; i <= 1000; i++) insert.run(i, i, '', text); })(); src.close();
  const exported = exportLargePackage({ dbPath: f.source, outputPath: f.output, selection: { bookIds: [1] } });
  assert.ok(exported.bytes > 50 * 1024 * 1024, `Package must exceed 50 MB; got ${exported.bytes}`);
  const result = await importLargePackage({ dbPath: f.destination, inputPath: f.output, backupPath: f.backup });
  assert.equal(result.pages, 1000);
  const dest = new Database(f.destination);
  assert.equal(dest.prepare('SELECT nass FROM pages WHERE book_id=1 AND id=1000').get().nass, text);
  assert.ok(dest.prepare("SELECT rowid FROM pages_fts WHERE pages_fts MATCH 'اختبار' LIMIT 1").get()); dest.close();
});

test('upload, background validation, import status and download routes require appropriate authorization', async t => {
  const f = fixture(t);
  exportLargePackage({ dbPath: f.source, outputPath: f.output, selection: { bookIds: [1] } });
  const db = new Database(f.destination);
  const app = express(); app.use(express.json());
  const runtime = { importing: false };
  const api = registerLargeTransfer(app, { getDb: () => db, getDbPath: () => f.destination, getAdditionalPath: () => null,
    requireAdmin: (req, res, next) => req.headers.authorization === 'Bearer test' ? next() : res.sendStatus(401),
    localExportMode: false, runtime, directory: path.join(f.directory, 'jobs'), clearCache: () => {},
  });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/large-transfer`;
  const headers = { Authorization: 'Bearer test' };
  const wait = async id => {
    for (let i = 0; i < 200; i++) {
      const r = await fetch(`${base}/jobs/${id}`, { headers }); const job = await r.json();
      if (!['running', 'uploading'].includes(job.status)) return job;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('Background job timed out');
  };
  try {
    assert.equal((await fetch(`${base}/upload`, { method: 'POST', body: 'invalid' })).status, 401);
    const upload = await fetch(`${base}/upload`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync(f.output) });
    assert.equal(upload.status, 202);
    const uploaded = await upload.json();
    const preview = await wait(uploaded.id); assert.equal(preview.status, 'ready'); assert.equal(preview.result.books, 1);
    assert.equal((await fetch(`${base}/jobs/${uploaded.id}`)).status, 401);
    const started = await fetch(`${base}/jobs/${uploaded.id}/import`, { method: 'POST', headers }); assert.equal(started.status, 202);
    const done = await wait(uploaded.id); assert.equal(done.status, 'done', done.error); assert.equal(done.result.imported, 1); assert.equal(runtime.importing, false);
    const exported = await fetch(`${base}/export`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ bookIds: [1] }) });
    const exportJob = await wait((await exported.json()).id); assert.equal(exportJob.status, 'ready', exportJob.error);
    const download = await fetch(new URL(exportJob.downloadUrl, base).href); assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /\.db/); await download.arrayBuffer();
    assert.equal((await fetch(`${base}/file/${'0'.repeat(48)}`)).status, 404);
  } finally { api.close(); await new Promise(resolve => server.close(resolve)); db.close(); }
});
