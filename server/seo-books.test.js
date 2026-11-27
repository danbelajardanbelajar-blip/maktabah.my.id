import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import express from 'express';
import { createBookSeoService, registerBookSeoRoutes, slugifyTitle } from './seo-books.js';
import { registerSeoFoundation } from './seo-foundation.js';
import { staticCacheControl } from './static-cache.js';

function createBookFixture(t, { maintenance = false, withDb = true } = {}) {
  const distPath = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-book-seo-'));
  fs.writeFileSync(path.join(distPath, 'index.dev.html'), '<!doctype html><html><body>Home</body></html>');

  let db = null;
  if (withDb) {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE authors (authid INTEGER PRIMARY KEY, auth TEXT, inf TEXT, HigriD INTEGER, AD INTEGER);
      CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER, inf TEXT, betaka TEXT);
      CREATE TABLE pages (id INTEGER PRIMARY KEY, book_id INTEGER, part INTEGER, page INTEGER, nass TEXT);
      CREATE TABLE titles (id INTEGER PRIMARY KEY, book_id INTEGER, lvl INTEGER, sub INTEGER, tit TEXT);
      CREATE TABLE visit_logs (id INTEGER PRIMARY KEY, path TEXT, ip TEXT, user_agent TEXT);
      INSERT INTO categories (id, name) VALUES (1, 'Fiqih Syafii');
      INSERT INTO authors (authid, auth, HigriD) VALUES (10, 'زين الدين المليباري', 987);
      INSERT INTO books_meta (bkid, bk, cat, authno, inf, betaka) VALUES (123, 'فتح المعين', 1, 10, 'Kitab fiqih', 'Syarah Qurratul Ain');
      INSERT INTO pages (id, book_id, part, page, nass) VALUES (1, 123, 1, 1, 'بسم الله'), (2, 123, 1, 2, 'الحمد لله');
      INSERT INTO titles (id, book_id, lvl, sub, tit) VALUES (1, 123, 1, 0, 'باب الطهارة'), (2, 123, 2, 1, 'فصل في الوضوء');
    `);
  }

  let isMaint = maintenance;
  const service = createBookSeoService({
    getDb: () => db,
    booksMeta: () => 'main.books_meta',
    authorsUnion: () => 'main.authors',
    pagesUnion: () => 'main.pages',
    titlesUnion: () => 'main.titles',
    isMaintenance: () => isMaint,
  });

  const app = express();
  registerBookSeoRoutes(app, { service, siteUrl: 'https://maktab.my.id' });
  registerSeoFoundation(app, { express, distPath, siteUrl: 'https://maktab.my.id', staticCacheControl });

  return {
    db,
    service,
    setMaintenance: (v) => { isMaint = v; },
    async start() {
      const server = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        db?.close();
        fs.rmSync(distPath, { recursive: true, force: true });
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      return (p) => fetch(`${base}${p}`, { redirect: 'manual' });
    },
  };
}

test('slugifyTitle builds clean ASCII slugs from Arabic and Latin titles', () => {
  assert.equal(slugifyTitle('فتح المعين'), 'fth-almayn');
  assert.equal(slugifyTitle('Fathul Mu\'in (Jilid 1)'), 'fathul-mu-in-jilid-1');
  assert.equal(slugifyTitle('***'), 'kitab');
});

test('GET /kitab/:id-:slug returns 200 HTML with JSON-LD, TOC, reader link, and zero visit_logs writes', async (t) => {
  const fixture = createBookFixture(t);
  const get = await fixture.start();

  const slug = slugifyTitle('فتح المعين');
  const res = await get(`/kitab/123-${slug}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /^text\/html/);
  const html = await res.text();
  assert.match(html, /<link rel="canonical" href="https:\/\/maktab\.my\.id\/kitab\/123-/);
  assert.match(html, /"@type":"Book"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /href="\/#\/read\/123"/);
  assert.match(html, /باب الطهارة/);
  assert.match(html, /Syarah Qurratul Ain/);
  assert.equal(fixture.db.prepare('SELECT COUNT(*) c FROM visit_logs').get().c, 0);
});

test('wrong slug or bare ID redirects 301 to canonical, missing ID returns 404, and cache invalidates cleanly', async (t) => {
  const fixture = createBookFixture(t);
  const get = await fixture.start();

  const expectedPath = `/kitab/123-${slugifyTitle('فتح المعين')}`;
  const bare = await get('/kitab/123');
  assert.equal(bare.status, 301);
  assert.equal(bare.headers.get('location'), expectedPath);

  const wrong = await get('/kitab/123-slug-lama');
  assert.equal(wrong.status, 301);
  assert.equal(wrong.headers.get('location'), expectedPath);

  const missing = await get('/kitab/999999-tidak-ada');
  assert.equal(missing.status, 404);

  const invalid = await get('/kitab/bukan-angka');
  assert.equal(invalid.status, 404);

  fixture.db.prepare('UPDATE books_meta SET bk = ? WHERE bkid = 123').run('فتح المعين الجديد');
  fixture.service.invalidate();
  const afterEdit = await get(expectedPath);
  assert.equal(afterEdit.status, 301);
  assert.equal(afterEdit.headers.get('location'), `/kitab/123-${slugifyTitle('فتح المعين الجديد')}`);
});

test('maintenance or unavailable database returns 503 with Retry-After instead of 404', async (t) => {
  const fixture = createBookFixture(t, { maintenance: true });
  const get = await fixture.start();

  const maintRes = await get(`/kitab/123-${slugifyTitle('فتح المعين')}`);
  assert.equal(maintRes.status, 503);
  assert.equal(maintRes.headers.get('retry-after'), '60');

  const noDbFixture = createBookFixture(t, { withDb: false });
  const getNoDb = await noDbFixture.start();
  const noDbRes = await getNoDb('/kitab/123-fth');
  assert.equal(noDbRes.status, 503);
});
