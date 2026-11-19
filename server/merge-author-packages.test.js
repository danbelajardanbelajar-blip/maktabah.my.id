import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import Database from 'better-sqlite3';
import {authorSchema,normalizeIdentity} from './author-package.js';

const script = fileURLToPath(new URL('../scripts/merge-author-packages.js', import.meta.url));
function makePackage(file, {authors, works, links, source}) {
  const db = new Database(file);authorSchema(db);
  db.prepare('INSERT INTO manifest VALUES(?,?,?,?,?,?,?)').run('maktabah-authors', 1, '2026-11-13T00:00:00.000Z', source, 'a'.repeat(64), authors.length, works.length);
  for (const [id, name] of authors) db.prepare('INSERT INTO authors VALUES(?,?,?,?,?,?)').run(id, name, '', '', `src ${id}`, normalizeIdentity(name));
  for (const [id, title] of works) db.prepare('INSERT INTO works VALUES(?,?,?,?,?)').run(id, title, '', 'src', normalizeIdentity(title));
  for (const [book, author] of links) db.prepare('INSERT INTO attributions VALUES(?,?,?,?)').run(book, author, 'metadata-exact', 'bukti');
  db.close();
}

test('old links are kept only for books the new package leaves unlinked', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-authors-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const works = [[1, 'كتاب أ'], [2, 'كتاب ب'], [3, 'كتاب ج'], [4, 'كتاب د']];
  // New source: book 1 → author 1 (with harakat), book 2 → author 2; it has no author for books 3–4.
  makePackage(path.join(dir, 'new.db'), {source:'Golden', works, authors:[[1, 'أَبُو العَلاء'], [2, 'ابن كثير']], links:[[1, 1], [2, 2]]});
  // Old package: book 1 → other id with the plain name, book 3 → an author missing from the new source
  // whose id is taken in the new package, book 4 → a name the new package already has (id differs).
  makePackage(path.join(dir, 'old.db'), {source:'Lama', works, authors:[[1, 'الكوثري'], [7, 'أبو العلاء'], [9, 'ابن كثير']], links:[[1, 7], [3, 1], [4, 9]]});
  const output = path.join(dir, 'out.db');
  const result = JSON.parse(execFileSync(process.execPath, [script, path.join(dir, 'new.db'), path.join(dir, 'old.db'), output], {encoding:'utf8'}));
  assert.deepEqual([result.keptLinks, result.addedAuthors, result.reusedAuthors, result.authors, result.matched], [2, 1, 1, 3, 4]);
  const db = new Database(output, {readonly:true});
  const links = db.prepare('SELECT t.book_id, a.name FROM attributions t JOIN authors a ON a.id=t.author_id ORDER BY t.book_id').all().map(r => [r.book_id, r.name]);
  assert.deepEqual(links, [[1, 'أَبُو العَلاء'], [2, 'ابن كثير'], [3, 'الكوثري'], [4, 'ابن كثير']], 'new data wins; missing authors are added under a free id; same names are reused');
  assert.equal(db.prepare('SELECT id FROM authors WHERE name=?').get('الكوثري').id, 3);
  assert.equal(db.prepare('SELECT authors FROM manifest').get().authors, 3);
  assert.match(db.prepare('SELECT source FROM manifest').get().source, /^Golden \+ relasi lama dipertahankan dari old\.db$/);
  db.close();
  assert.throws(() => execFileSync(process.execPath, [script, path.join(dir, 'new.db'), path.join(dir, 'old.db'), output], {stdio:'pipe'}), /sudah ada/);
});
