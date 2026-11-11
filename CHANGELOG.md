# Changelog & Catatan Perubahan Sistematis

Setiap perubahan kode di repositori ini dicatat secara sistematis dengan format:
`Waktu (detik, WIB/+07:00)` | `File` | `Baris` | `Bagian / Simbol` | `Ringkasan Perubahan`.

---

## [2026-11-11] — Penanganan Kitab Tanpa Judul pada Export & Import Transfer

**Latar belakang:**  
Pada paket `maktabah-bertahap-2026-11-11.mkt` (33 kategori, 5.785 kitab, 8.193 bagian), proses import berhenti pada bagian `7208 / 8193` dengan pesan `Metadata kitab tidak valid.` setelah `bkid: 107697` (`الزواجر عن اقتراف الكبائر`) karena record berikutnya (`bkid: 107698`) memiliki `bk: null` (0 halaman, 0 judul bab).

**Solusi:**
1. Jalur **export kategori** (`.json`, `.mkt`, `.db`) melewati kitab dengan judul kosong (`NULL`/spasi) dan menormalisasi metadata kategori/pengarang agar satu baris yatim tidak mematahkan paket, sementara **export satuan (`bookIds`)** tetap gagal cepat jika kitab yang diminta tidak valid.
2. Jalur **import** (`.json`, `.mkt`, `.db`) melewati kitab dengan judul kosong (`!hasBookTitle(b)`) alih-alih menggagalkan seluruh proses, sambil tetap menolak tipe data yang rusak (mis. `bk: 123`).

### Rincian Perubahan per File

| Waktu Perubahan (`WIB`) | File | Baris | Bagian / Simbol | Ringkasan Perubahan |
| :--- | :--- | :--- | :--- | :--- |
| `2026-11-11 22:57:38` | `server/large-transfer-worker.js` | `L5` | Import modul `./book-transfer.js` | Mengimpor `resolveBookSources`, `isValidCategoryMeta`, `isValidAuthorMeta`, `isValidPageRow`, `isValidTitleRow`. |
| `2026-11-11 22:57:38` | `server/large-transfer-worker.js` | `L30-38` | `metadata()` | Menormalisasi metadata kategori/pengarang dengan `isValidCategoryMeta` dan `isValidAuthorMeta`. |
| `2026-11-11 22:57:38` | `server/large-transfer-worker.js` | `L40-92` | `exportLargePackage()` | Memakai `resolveBookSources` (`L51`) serta validasi baris `isValidPageRow` (`L71`) dan `isValidTitleRow` (`L76`). |
| `2026-11-11 22:57:38` | `server/large-transfer-worker.js` | `L116-156` | `importLargePackage()` | Memakai `isValidPageRow` (`L141`), `isValidTitleRow` (`L146`), dan `importBooks` (`L137`) yang melewati kitab tanpa judul. |
| `2026-11-11 23:03:19` | `server/book-transfer.js` | `L18-45` | Validator shared | Menambah `isValidCategoryMeta` (`L18-20`), `hasBookTitle` (`L22`), `isValidBookRecord` (`L24-27`), `isValidBookMeta` (`L29`), `isValidAuthorMeta` (`L31-34`), `isValidPageRow` (`L36-40`), dan `isValidTitleRow` (`L42-45`). |
| `2026-11-11 23:03:19` | `server/book-transfer.js` | `L47-82` | `resolveBookSources()` | Helper resolusi sumber kitab (`main` lalu `tambahan`) yang melewati kitab invalid pada mode kategori dan melempar error pada mode satuan. |
| `2026-11-11 23:03:19` | `server/book-transfer.js` | `L94-131` | `validateBookPackage()` | Memakai `isValidBookRecord` (`L111`) serta validator kategori/pengarang/halaman/bab agar baris kitab tanpa judul boleh masuk ke tahap skip saat import. |
| `2026-11-11 23:03:19` | `server/book-transfer.js` | `L133-159` | `exportBooks()` | Menggunakan `resolveBookSources` (`L138`) serta validasi/normalisasi `L150-153`. |
| `2026-11-11 23:03:19` | `server/book-transfer.js` | `L161-175` | `exportCategories()` | Menggunakan `resolveBookSources` (`L168`) agar export kategori melewati kitab tanpa judul. |
| `2026-11-11 23:03:19` | `server/book-transfer.js` | `L177-224` | `importBooks()` | Melewati kitab apabila `!hasBookTitle(b)` (`L196`) dan tetap melewati jika `bkid` sudah ada. |
| `2026-11-11 23:03:22` | `server/compact-transfer-core.js` | `L6` | Import modul `./book-transfer.js` | Mengimpor `resolveBookSources`, `hasBookTitle`, dan validator metadata/baris. |
| `2026-11-11 23:03:22` | `server/compact-transfer-core.js` | `L34-73` | `exportCompact()` | Menggunakan `resolveBookSources` (`L46`), normalisasi `category`/`author` (`L60-62`), serta validasi `isValidPageRow`/`isValidTitleRow` (`L65-66`). |
| `2026-11-11 23:03:22` | `server/compact-transfer-core.js` | `L103-150` | `applyCompact()` | Mengubah `skip` (`L120`) menjadi `!hasBookTitle(b) \|\| ...` sehingga paket `.mkt` yang sudah ada dapat melanjutkan import melewati record kitab tanpa judul. |
| `2026-11-11 23:03:36` | `server/book-transfer.test.js` | `L201-231` | Unit test JSON transfer | Menambah pengujian skip export kategori & penolakan export satuan (`L201-211`), serta skip import kitab tanpa judul & penolakan judul non-string (`L213-231`). |
| `2026-11-11 23:03:39` | `server/large-transfer.test.js` | `L132-161` | Unit test `.db` transfer | Menambah pengujian export kategori/satuan `.db` (`L132-144`) dan import `.db` kitab tanpa judul/non-string (`L146-161`). |
| `2026-11-11 23:03:50` | `server/compact-transfer.test.js` | `L162-200` | Unit test `.mkt` transfer | Menambah pengujian `exportCompact` kategori vs satuan (`L162-177`) dan `applyCompact` skip kitab tanpa judul vs judul non-string (`L179-200`). |
