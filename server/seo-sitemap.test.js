import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import { registerSitemapRoutes } from './seo-sitemap.js';

function createSitemapFixture(t, { maintenance = false } = {}) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER, inf TEXT, betaka TEXT);
    INSERT INTO categories VALUES (1, 'Fiqih Syafii'), (2, 'Hadis');
    INSERT INTO books_meta VALUES (10, 'فتح المعين', 1, 1, 'Kitab fiqih klasik', 'Syarah Qurratul Ain'), (11, 'صحيح البخاري', 2, 1, '', '');
  `);

  const rowaDb = new Database(':memory:');
  rowaDb.exec(`
    CREATE TABLE rowa (id INTEGER PRIMARY KEY, Name TEXT, A_esm TEXT, IsoName TEXT, WHO TEXT, AQUAL TEXT);
    INSERT INTO rowa VALUES (5, 'أبو هريرة', 'أبو هريرة', '', 'ع', '${'أ'.repeat(120)}');
  `);

  const authorService = {
    authorList: () => ({
      data: [{ id: 7, name: 'الإمام النووي', workCount: 2, hasBiography: true }],
    }),
  };

  let isMaint = maintenance;
  const app = express();
  const ctrl = registerSitemapRoutes(app, {
    getDb: () => db,
    booksMeta: () => 'main.books_meta',
    getRowaDb: () => rowaDb,
    authorService,
    isMaintenance: () => isMaint,
    siteUrl: 'https://maktab.my.id',
  });

  return {
    db,
    ctrl,
    setMaintenance: (v) => { isMaint = v; },
    async start() {
      const server = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        db.close();
        rowaDb.close();
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      return (p) => fetch(`${base}${p}`);
    },
  };
}

test('sitemap index and all 5 curated pilot sub-sitemaps return valid XML and invalidate cleanly', async (t) => {
  const fixture = createSitemapFixture(t);
  const get = await fixture.start();

  const indexRes = await get('/sitemap.xml');
  assert.equal(indexRes.status, 200);
  assert.match(indexRes.headers.get('content-type') || '', /^application\/xml/);
  const indexXml = await indexRes.text();
  assert.match(indexXml, /<sitemapindex/);
  for (const sub of ['/sitemap-static.xml', '/sitemap-books.xml', '/sitemap-authors.xml', '/sitemap-rowa.xml', '/sitemap-categories.xml']) {
    assert.match(indexXml, new RegExp(sub));
    const subRes = await get(sub);
    assert.equal(subRes.status, 200);
    assert.match(await subRes.text(), /<urlset/);
  }

  fixture.db.prepare('UPDATE books_meta SET bk = ? WHERE bkid = 10').run('فتح المعين الجديد');
  fixture.ctrl.invalidate();
  const updatedBooks = await (await get('/sitemap-books.xml')).text();
  assert.match(updatedBooks, /10-fth-almayn-aljdy/);
});

test('dynamic sub-sitemaps return 503 during maintenance', async (t) => {
  const fixture = createSitemapFixture(t, { maintenance: true });
  const get = await fixture.start();

  const booksRes = await get('/sitemap-books.xml');
  assert.equal(booksRes.status, 503);
  assert.equal(booksRes.headers.get('retry-after'), '60');
});
