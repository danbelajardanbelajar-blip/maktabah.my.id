import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {
  validateNuOnlineUrl,
  parseNuOnlineListHtml,
  parseNuOnlineArticleHtml,
  splitArticleIntoPages,
  registerNuOnline,
} from './nu-online.js';

const SAMPLE_LIST_HTML = `
<div>
  <a href="/bahtsul-masail/hukum-shalat-jumat-tanah-nonwakaf-abc12">
    <img alt="Hukum Shalat Jumat di Tanah Nonwakaf" src="x.jpg" />
  </a>
  <a href="https://islam.nu.or.id/bahtsul-masail/zakat-profesi-menurut-fikih-xyz99">
    <h2>Zakat Profesi Menurut Fikih Klasik</h2>
  </a>
  <a href="/bahtsul-masail">Home</a>
</div>
`;

const SAMPLE_ARTICLE_HTML = `
<html>
<head>
  <script type="application/ld+json">
  {"@type":"NewsArticle","headline":"Hukum Shalat Jumat di Tanah Nonwakaf","datePublished":"2026-11-21T16:41:19+07:00","author":{"name":"Muhammad Zainul Mujahid"}}
  </script>
</head>
<body>
  <h1>Hukum Shalat Jumat di Tanah Nonwakaf</h1>
  <div class="w-full detail-style" id="detail-content">
    <p><strong>Pertanyaan</strong></p>
    <p>Bagaimana hukum shalat Jumat di atas tanah desa?</p>
    <div class="font-roboto"><div><p>Baca Juga</p></div></div><a href="/lain"><h2>Artikel Lain</h2></a>
    <p><strong>Jawaban</strong></p>
    <p>Dalam kitab <em>I'anatut Thalibin</em> disebutkan: يُشْتَرَطُ أَنْ يَكُونَ الْبِنَاءُ مَمْلُوكًا.</p>
    <p>Editor: Zainuddin Lubis</p>
  </div>
  <nav class="mx-auto mt-7">
    <p>Tags</p>
    <p>Terpopuler</p>
    <p>Khutbah Jumat Lainnya</p>
  </nav>
</body>
</html>
`;

test('validateNuOnlineUrl only allows HTTPS nu.or.id hosts', () => {
  assert.equal(validateNuOnlineUrl('https://islam.nu.or.id/bahtsul-masail/test#frag'), 'https://islam.nu.or.id/bahtsul-masail/test');
  assert.throws(() => validateNuOnlineUrl('http://islam.nu.or.id/bahtsul-masail/test'), (e) => e.status === 400);
  assert.throws(() => validateNuOnlineUrl('https://evil.example.com/bahtsul-masail/test'), (e) => e.status === 400);
});

test('parseNuOnlineListHtml and parseNuOnlineArticleHtml extract clean metadata and body', () => {
  const posts = parseNuOnlineListHtml(SAMPLE_LIST_HTML);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].url, 'https://islam.nu.or.id/bahtsul-masail/hukum-shalat-jumat-tanah-nonwakaf-abc12');
  assert.equal(posts[0].title, 'Hukum Shalat Jumat di Tanah Nonwakaf');
  assert.equal(posts[1].title, 'Zakat Profesi Menurut Fikih Klasik');

  const article = parseNuOnlineArticleHtml(SAMPLE_ARTICLE_HTML, posts[0].url);
  assert.equal(article.title, 'Hukum Shalat Jumat di Tanah Nonwakaf');
  assert.equal(article.author, 'Muhammad Zainul Mujahid');
  assert.equal(article.containsBahtsulMasail, true);
  assert.ok(article.fullText.includes('يُشْتَرَطُ أَنْ يَكُونَ الْبِنَاءُ مَمْلُوكًا'));
  assert.ok(article.fullText.includes('Editor: Zainuddin Lubis'));
  assert.ok(!article.fullText.includes('Baca Juga'));
  assert.ok(!article.fullText.includes('Tags'));
  assert.ok(!article.fullText.includes('Terpopuler'));
  assert.ok(!article.fullText.includes('Khutbah Jumat Lainnya'));
});

test('splitArticleIntoPages splits long text cleanly at paragraph boundaries', () => {
  const longText = Array.from({ length: 10 }, (_, i) => `Paragraf ${i + 1}: ` + 'ا'.repeat(600)).join('\n\n');
  const pages = splitArticleIntoPages(longText, 1500);
  assert.ok(pages.length >= 4);
  assert.ok(pages.every((p) => p.length <= 1500));
});

test('registerNuOnline indexes, previews, and imports article as 1 new book', async (t) => {
  const db = new Database(':memory:');
  const stateDb = new Database(':memory:');
  t.after(() => {
    db.close();
    stateDb.close();
  });

  db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, catord INTEGER, lvl INTEGER);
    CREATE TABLE authors (authid INTEGER PRIMARY KEY, auth TEXT, inf TEXT, HigriD TEXT, AD TEXT);
    CREATE TABLE books_meta (bkid INTEGER PRIMARY KEY, bk TEXT, cat INTEGER, authno INTEGER, inf TEXT, betaka TEXT);
    CREATE TABLE pages (id INTEGER, book_id INTEGER, part INTEGER, page INTEGER, seal TEXT, nass TEXT, PRIMARY KEY(book_id, id));
    INSERT INTO categories VALUES (1, 'Hasil Bahtsul Masail', 1, 0);
  `);

  const mockFetch = async (url) => {
    if (String(url).includes('?page=')) {
      return new Response(SAMPLE_LIST_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return new Response(SAMPLE_ARTICLE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
  };

  const app = express();
  app.use(express.json());
  let invalidated = 0;
  registerNuOnline(app, {
    getDb: () => db,
    getStateDb: () => stateDb,
    requireAdmin: (req, res, next) => (req.headers.authorization === 'Bearer ok' ? next() : res.status(401).json({ error: '401' })),
    hasAdditional: () => false,
    invalidateCache: () => { invalidated++; },
    fetchImpl: mockFetch,
  });

  const server = app.listen(0);
  t.after(() => server.close());
  const port = server.address().port;
  const auth = { Authorization: 'Bearer ok', 'Content-Type': 'application/json' };

  // 1. Index
  const idxRes = await fetch(`http://127.0.0.1:${port}/api/admin/nu-online/index`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ startPage: 1, pageCount: 1, keyword: 'bahtsul masail' }),
  });
  assert.equal(idxRes.status, 200);
  const idxJson = await idxRes.json();
  assert.equal(idxJson.matched, 2);
  assert.equal(idxJson.newCount, 2);

  // 2. List posts
  const listRes = await fetch(`http://127.0.0.1:${port}/api/admin/nu-online/posts`, { headers: auth });
  const listJson = await listRes.json();
  assert.equal(listJson.total, 2);
  assert.equal(listJson.stats.imported, 0);

  // 3. Preview article
  const targetUrl = idxJson.posts[0].url;
  const prevRes = await fetch(`http://127.0.0.1:${port}/api/admin/nu-online/preview?url=${encodeURIComponent(targetUrl)}`, { headers: auth });
  assert.equal(prevRes.status, 200);
  const prevJson = await prevRes.json();
  assert.equal(prevJson.article.title, 'Hukum Shalat Jumat di Tanah Nonwakaf');

  // 4. Import article as 1 new book
  const impRes = await fetch(`http://127.0.0.1:${port}/api/admin/nu-online/import`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      url: targetUrl,
      title: prevJson.article.title,
      author: prevJson.article.author,
      catId: 1,
      content: prevJson.article.fullText,
      publishedAt: prevJson.article.publishedAt,
    }),
  });
  assert.equal(impRes.status, 201);
  const impJson = await impRes.json();
  assert.equal(impJson.book.bkid, 1);
  assert.equal(invalidated, 1);

  const books = db.prepare('SELECT * FROM books_meta').all();
  assert.equal(books.length, 1);
  assert.ok(books[0].inf.includes(targetUrl));

  // Index reflects imported_bkid
  const listAfter = await (await fetch(`http://127.0.0.1:${port}/api/admin/nu-online/posts`, { headers: auth })).json();
  assert.equal(listAfter.stats.imported, 1);
});
