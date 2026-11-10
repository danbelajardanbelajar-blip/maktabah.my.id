/**
 * Modul untuk menggabungkan (merge) beberapa kategori sumber ke satu kategori tujuan.
 * Memindahkan seluruh kitab di books_meta (baik main maupun database tambahan jika ada)
 * dan menghapus kategori sumber yang telah kosong.
 */

export function mergeCategories(db, {
  sourceCategoryIds,
  targetCategoryId,
  newCategoryName,
  deleteSourceCategories = true,
  hasTambahan = false
}) {
  if (!db) throw new Error('Database tidak tersedia.');
  if (!Array.isArray(sourceCategoryIds) || sourceCategoryIds.length === 0) {
    throw new Error('Pilih setidaknya satu kategori sumber untuk digabungkan.');
  }

  // Sanitasi ID sumber (hanya integer valid)
  const sourceIds = Array.from(new Set(
    sourceCategoryIds.map(id => parseInt(id, 10)).filter(id => Number.isInteger(id))
  ));
  if (sourceIds.length === 0) {
    throw new Error('ID kategori sumber tidak valid.');
  }

  let finalTargetId = targetCategoryId != null ? parseInt(targetCategoryId, 10) : null;

  // Jika user memilih membuat kategori baru
  if (newCategoryName && typeof newCategoryName === 'string' && newCategoryName.trim()) {
    const trimmed = newCategoryName.trim();
    // Cek apakah sudah ada kategori dengan nama sama
    const existing = db.prepare('SELECT id, name FROM main.categories WHERE TRIM(name) = ?').get(trimmed);
    if (existing) {
      finalTargetId = existing.id;
    } else {
      const ins = db.prepare('INSERT INTO main.categories (name, catord, lvl) VALUES (?, 0, 0)').run(trimmed);
      finalTargetId = Number(ins.lastInsertRowid);
    }
  }

  if (finalTargetId == null || !Number.isInteger(finalTargetId)) {
    throw new Error('Kategori tujuan harus ditentukan.');
  }

  // Pastikan kategori tujuan ada di main.categories
  let targetCat = db.prepare('SELECT id, name FROM main.categories WHERE id = ?').get(finalTargetId);
  if (!targetCat) {
    // Jika target berasal dari kategori virtual/tambahan, daftarkan dulu ke main.categories
    const catName = `Kategori #${finalTargetId}`;
    db.prepare('INSERT OR IGNORE INTO main.categories (id, name, catord, lvl) VALUES (?, ?, 0, 0)').run(finalTargetId, catName);
    targetCat = db.prepare('SELECT id, name FROM main.categories WHERE id = ?').get(finalTargetId);
  }

  // Hapus targetId dari daftar sourceIds jika terikut (tidak menggabungkan ke dirinya sendiri)
  const effectiveSourceIds = sourceIds.filter(id => id !== finalTargetId);
  if (effectiveSourceIds.length === 0) {
    return {
      success: true,
      targetCategoryId: finalTargetId,
      targetCategoryName: targetCat?.name || `Kategori #${finalTargetId}`,
      booksMoved: 0,
      categoriesMerged: 0,
      categoriesDeleted: 0,
      message: 'Kategori tujuan sama dengan kategori sumber (tidak ada perubahan).'
    };
  }

  const placeholders = effectiveSourceIds.map(() => '?').join(',');

  // Jalankan seluruh proses pemindahan dalam satu transaksi atomik
  const runMerge = db.transaction(() => {
    let booksMoved = 0;

    // 1. Update main.books_meta
    const updateMain = db.prepare(`UPDATE main.books_meta SET cat = ? WHERE cat IN (${placeholders})`);
    const resMain = updateMain.run(finalTargetId, ...effectiveSourceIds);
    booksMoved += resMain.changes;

    // 2. Update tambahan.books_meta jika database tambahan terpasang
    if (hasTambahan) {
      try {
        const tableCheck = db.prepare("SELECT 1 FROM tambahan.sqlite_master WHERE type='table' AND name='books_meta'").get();
        if (tableCheck) {
          const updateTambahan = db.prepare(`UPDATE tambahan.books_meta SET cat = ? WHERE cat IN (${placeholders})`);
          const resTambahan = updateTambahan.run(finalTargetId, ...effectiveSourceIds);
          booksMoved += resTambahan.changes;
        }
      } catch (err) {
        console.warn('Peringatan saat update tambahan.books_meta pada merge:', err.message);
      }
    }

    // 3. Hapus kategori sumber dari main.categories jika diminta
    let categoriesDeleted = 0;
    if (deleteSourceCategories) {
      const delMain = db.prepare(`DELETE FROM main.categories WHERE id IN (${placeholders})`);
      const resDel = delMain.run(...effectiveSourceIds);
      categoriesDeleted += resDel.changes;
    }

    return { booksMoved, categoriesDeleted };
  });

  const result = runMerge();

  return {
    success: true,
    targetCategoryId: finalTargetId,
    targetCategoryName: targetCat.name,
    booksMoved: result.booksMoved,
    categoriesMerged: effectiveSourceIds.length,
    categoriesDeleted: result.categoriesDeleted,
    message: `${result.booksMoved} kitab dari ${effectiveSourceIds.length} kategori berhasil digabungkan ke kategori "${targetCat.name}".`
  };
}
