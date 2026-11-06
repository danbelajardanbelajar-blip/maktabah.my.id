const error = (message, status = 400) => Object.assign(new Error(message), { status });
const validId = (id, zero = false) => Number.isSafeInteger(id) && id >= (zero ? 0 : 1);
const parseId = (value, zero = false) => {
  if (!/^\d+$/.test(value) || !validId(Number(value), zero)) throw error('ID tidak valid.');
  return Number(value);
};

// Only known book-owned records are removed; shared authors and files are retained.
const relations = {
  titles: ['book_id'], book_pdf: ['bkid'], book_shorts: ['bk'], user_comments: ['bk'],
  matn_sharh_books: ['matn', 'sharh'], matn_sharh_pages: ['matn', 'sharh'],
  tafsir_mapping: ['tafsir_bkid'], tafsir_ayah_mapping: ['tafsir_bkid'],
};

export function deleteCatalogue(db, { bookIds, categoryId, hasAdditional = false, hasTafsir = false }) {
  if (categoryId !== undefined ? !validId(categoryId, true)
    : !Array.isArray(bookIds) || !bookIds.length || bookIds.length > 50000 || bookIds.some(id => !validId(id))) {
    throw error('Pilihan kitab/kategori tidak valid.');
  }
  return db.transaction(() => {
    if (categoryId !== undefined && !db.prepare('SELECT 1 FROM main.categories WHERE id=?').get(categoryId)) throw error('Kategori tidak ditemukan.', 404);
    const ids = categoryId !== undefined
      ? db.prepare('SELECT bkid FROM main.books_meta WHERE cat=?').all(categoryId).map(b => b.bkid)
      : [...new Set(bookIds)];
    if (hasAdditional && (categoryId !== undefined
      ? db.prepare('SELECT 1 FROM tambahan.books_meta WHERE cat=? LIMIT 1').get(categoryId)
      : ids.some(id => db.prepare('SELECT 1 FROM tambahan.books_meta WHERE bkid=?').get(id)))) {
      throw error('Pilihan memuat kitab dari database sumber tambahan yang hanya dapat dibaca.', 409);
    }
    const total = { books: 0, pages: 0, titles: 0, related: 0, categories: 0 };
    const tables = new Set(db.prepare("SELECT name FROM main.sqlite_master WHERE type='table'").all().map(t => t.name));
    // FTS must be synchronized by the database trigger, in this same transaction.
    if (ids.length && tables.has('pages_fts') && !db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='trigger' AND tbl_name='pages' AND lower(sql) LIKE '%after delete%' AND lower(sql) LIKE '%pages_fts%'").get()) {
      throw error('Trigger indeks pencarian tidak tersedia; penghapusan dibatalkan.', 409);
    }
    for (let offset = 0; offset < ids.length; offset += 500) {
      const batch = ids.slice(offset, offset + 500), marks = batch.map(() => '?').join(',');
      for (const [table, columns] of Object.entries(relations)) {
        if (!tables.has(table)) continue;
        const deleted = db.prepare(`DELETE FROM main.${table} WHERE ${columns.map(c => `${c} IN (${marks})`).join(' OR ')}`).run(...columns.flatMap(() => batch)).changes;
        total[table === 'titles' ? 'titles' : 'related'] += deleted;
      }
      if (hasTafsir) {
        for (const table of ['tafsir_mapping', 'tafsir_ayah_mapping']) {
          if (db.prepare("SELECT 1 FROM tafsir.sqlite_master WHERE type='table' AND name=?").get(table)) {
            total.related += db.prepare(`DELETE FROM tafsir.${table} WHERE tafsir_bkid IN (${marks})`).run(...batch).changes;
          }
        }
      }
      total.pages += db.prepare(`DELETE FROM main.pages WHERE book_id IN (${marks})`).run(...batch).changes;
      total.books += db.prepare(`DELETE FROM main.books_meta WHERE bkid IN (${marks})`).run(...batch).changes;
    }
    if (categoryId !== undefined) {
      for (const table of ['book_requests', 'book_submissions']) {
        if (tables.has(table)) db.prepare(`UPDATE main.${table} SET category_id=NULL WHERE category_id=?`).run(categoryId);
      }
      total.categories = db.prepare('DELETE FROM main.categories WHERE id=?').run(categoryId).changes;
    }
    else if (!total.books) throw error('Kitab tidak ditemukan.', 404);
    return total;
  }).immediate();
}

export function registerBookDeletion(app, { getDb, requireAdmin, clearCache, hasAdditional, hasTafsir }) {
  const handle = selection => (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database belum tersedia.' });
    try {
      const deleted = deleteCatalogue(db, { ...selection(req), hasAdditional: hasAdditional(), hasTafsir: hasTafsir() });
      clearCache();
      res.json({ success: true, deleted });
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  };
  app.delete('/api/admin/books/bulk-delete', requireAdmin, handle(req => ({ bookIds: req.body?.bookIds })));
  app.delete('/api/admin/category/:id', requireAdmin, handle(req => ({ categoryId: parseId(req.params.id, true) })));
  app.delete('/api/admin/book/:id', requireAdmin, handle(req => ({ bookIds: [parseId(req.params.id)] })));
}
