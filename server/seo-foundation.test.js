import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { registerSeoFoundation } from './seo-foundation.js';
import { staticCacheControl } from './static-cache.js';

async function setupServer(t) {
  const distPath = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-seo-dist-'));
  fs.mkdirSync(path.join(distPath, 'privacy-policy'), { recursive: true });
  fs.mkdirSync(path.join(distPath, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(distPath, 'index.dev.html'), '<!doctype html><html lang="id"><head><link rel="canonical" href="https://maktab.my.id/" /></head><body><div id="root"><h1>Beranda</h1></div></body></html>');
  fs.writeFileSync(path.join(distPath, 'privacy-policy', 'index.html'), '<!doctype html><html lang="id"><head><link rel="canonical" href="https://maktab.my.id/privacy-policy"></head><body>Privasi</body></html>');
  fs.writeFileSync(path.join(distPath, 'assets', 'app-12345678.js'), 'console.log("ok");');
  fs.writeFileSync(path.join(distPath, 'logo.png'), 'PNG');

  const app = express();
  registerSeoFoundation(app, { express, distPath, siteUrl: 'https://maktab.my.id', staticCacheControl });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(distPath, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    get: (p) => fetch(`${base}${p}`, { redirect: 'manual' }),
  };
}

test('robots.txt and sitemap.xml return valid content types and canonical URLs', async (t) => {
  const { get } = await setupServer(t);

  const robots = await get('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('content-type') || '', /^text\/plain/);
  const robotsText = await robots.text();
  assert.match(robotsText, /^User-agent: \*/m);
  assert.match(robotsText, /^Disallow: \/api\//m);
  assert.match(robotsText, /^Sitemap: https:\/\/maktab\.my\.id\/sitemap\.xml$/m);

  const sitemap = await get('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type') || '', /^application\/xml/);
  const xml = await sitemap.text();
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/maktab\.my\.id\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/maktab\.my\.id\/privacy-policy<\/loc>/);
});

test('redirects consolidate index.dev.html and privacy-policy variants to canonical URLs', async (t) => {
  const { get } = await setupServer(t);

  const idx = await get('/index.dev.html');
  assert.equal(idx.status, 301);
  assert.equal(idx.headers.get('location'), '/');

  const idxAdmin = await get('/index.dev.html?admin=1');
  assert.equal(idxAdmin.status, 301);
  assert.equal(idxAdmin.headers.get('location'), '/?admin=1');

  const idxHtml = await get('/index.html');
  assert.equal(idxHtml.status, 301);
  assert.equal(idxHtml.headers.get('location'), '/');

  const privSlash = await get('/privacy-policy/');
  assert.equal(privSlash.status, 301);
  assert.equal(privSlash.headers.get('location'), '/privacy-policy');

  const privHtml = await get('/privacy-policy.html');
  assert.equal(privHtml.status, 301);
  assert.equal(privHtml.headers.get('location'), '/privacy-policy');

  const priv = await get('/privacy-policy');
  assert.equal(priv.status, 200);
  assert.equal(priv.headers.get('cache-control'), 'no-cache');
  assert.match(await priv.text(), /https:\/\/maktab\.my\.id\/privacy-policy/);
});

test('home and static assets return 200 while unknown paths and assets return real 404', async (t) => {
  const { get } = await setupServer(t);

  const home = await get('/');
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('cache-control'), 'no-cache');
  assert.match(await home.text(), /<div id="root"><h1>Beranda<\/h1><\/div>/);

  const asset = await get('/assets/app-12345678.js');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const logo = await get('/logo.png');
  assert.equal(logo.status, 200);

  const missingPage = await get('/halaman-tidak-ada');
  assert.equal(missingPage.status, 404);
  assert.match(missingPage.headers.get('content-type') || '', /^text\/html/);
  const missingHtml = await missingPage.text();
  assert.match(missingHtml, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(missingHtml, /Halaman Tidak Ditemukan \(404\)/);

  const missingAsset = await get('/assets/missing.js');
  assert.equal(missingAsset.status, 404);

  const missingApi = await get('/api/tidak-ada');
  assert.equal(missingApi.status, 404);
});
