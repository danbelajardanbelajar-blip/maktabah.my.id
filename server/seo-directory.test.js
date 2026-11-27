import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import express from 'express';
import { registerDirectorySeoRoutes } from './seo-directory.js';
import { registerSeoFoundation } from './seo-foundation.js';
import { staticCacheControl } from './static-cache.js';
import { slugifyTitle } from './seo-utils.js';

function setupFixture(t) {
  const distPath = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-dir-seo-'));
  fs.writeFileSync(path.join(distPath, 'index.dev.html'), '<!doctype html><html><body>Home</body></html>');

  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER, inf TEXT, betaka TEXT);
    INSERT INTO categories VALUES (1, 'Fiqih Syafii');
    INSERT INTO books_meta VALUES (10, 'فتح المعين', 1, 1, '', ''), (11, 'صحيح البخاري', 1, 1, '', '');
  `);

  const rowaDb = new Database(':memory:');
  rowaDb.exec(`
    CREATE TABLE rowa (id INTEGER PRIMARY KEY, Name TEXT, KUNIA TEXT, TABAQ TEXT, DEATH TEXT, ROTB TEXT, WHO TEXT, AQUAL TEXT);
    CREATE TABLE rowa_logs (id INTEGER PRIMARY KEY, rowa_id INTEGER);
    INSERT INTO rowa VALUES (5, 'أبو هريرة', 'أبو هريرة', 'صحابي', '57 هـ', 'صحابي', 'ع', 'صحابي جليل');
  `);

  const mockAuthorService = {
    authorList: () => ({
      data: [{ id: 7, name: 'الإمام النووي', workCount: 1, deathDate: { label: '676 H' } }],
      total: 1,
      totalPages: 1,
    }),
    detail: (id) => {
      if (id !== 7) { const e = new Error('Not found'); e.status = 404; throw e; }
      return {
        data: { id: 7, name: 'الإمام النووي', deathDate: { label: '676 H' }, biography: 'فقيه ومحدث شافعي', sourceRef: 'الأعلام' },
        works: [{ book_id: 10, title: 'فتح المعين', status: 'confirmed' }],
        total: 1,
      };
    },
  };

  const app = express();
  registerDirectorySeoRoutes(app, {
    getDb: () => db,
    booksMeta: () => 'main.books_meta',
    getRowaDb: () => rowaDb,
    authorService: mockAuthorService,
    isMaintenance: () => false,
    siteUrl: 'https://maktab.my.id',
  });
  registerSeoFoundation(app, { express, distPath, siteUrl: 'https://maktab.my.id', staticCacheControl });

  return async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
      rowaDb.close();
      fs.rmSync(distPath, { recursive: true, force: true });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return {
      get: (p) => fetch(`${base}${p}`, { redirect: 'manual' }),
      rowaDb,
    };
  };
}

test('author, rowa, category, katalog, and kutub-hadis SEO pages return 200/301/404 without logging', async (t) => {
  const start = setupFixture(t);
  const { get, rowaDb } = await start();

  const authorSlug = slugifyTitle('الإمام النووي', 'penulis');
  const aRedirect = await get('/penulis/7');
  assert.equal(aRedirect.status, 301);
  assert.equal(aRedirect.headers.get('location'), `/penulis/7-${authorSlug}`);

  const aPage = await get(`/penulis/7-${authorSlug}`);
  assert.equal(aPage.status, 200);
  const aHtml = await aPage.text();
  assert.match(aHtml, /"@type":"Person"/);
  assert.match(aHtml, /href="\/kitab\/10-/);

  const rowaSlug = slugifyTitle('أبو هريرة', 'perawi');
  const rPage = await get(`/perawi/5-${rowaSlug}`);
  assert.equal(rPage.status, 200);
  const rHtml = await rPage.text();
  assert.match(rHtml, /صحابي جليل/);
  assert.equal(rowaDb.prepare('SELECT COUNT(*) c FROM rowa_logs').get().c, 0);

  const kat = await get('/katalog');
  assert.equal(kat.status, 200);
  assert.match(await kat.text(), /href="\/kategori\/1-/);

  const catSlug = slugifyTitle('Fiqih Syafii', 'kategori');
  const catPage = await get(`/kategori/1-${catSlug}`);
  assert.equal(catPage.status, 200);
  assert.match(await catPage.text(), /href="\/kitab\/10-/);

  const hadith = await get('/kutub-hadis');
  assert.equal(hadith.status, 200);
  assert.match(await hadith.text(), /href="\/kitab\/11-/);

  assert.equal((await get('/penulis/9999-tidak-ada')).status, 404);
  assert.equal((await get('/perawi/9999-tidak-ada')).status, 404);
  assert.equal((await get('/kategori/9999-tidak-ada')).status, 404);
});
