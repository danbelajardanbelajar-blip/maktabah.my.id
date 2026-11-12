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

## [2026-11-12 19:15:34 +07:00] — Database khusus perawi dari MDB, import lokal/online, dan koreksi kode kitab sumber

Waktu pencatatan: **2026-11-12 19:15:34 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `2d9f3dc`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 123 tes server lulus; TypeScript dan build produksi lulus; uji browser impor paket 42 MB, desktop/ponsel tanpa error; uji LOCAL_EXPORT_MODE=1 upload dan aktivasi lulus; git diff --check lulus. Pull server menunggu akses SSH yang valid.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-12-19-15-34-f5c3e6.json](docs/change-audit/2026-11-12-19-15-34-f5c3e6.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-12 19:00:22 +07:00 | `.gitignore` | — | 23–23 | dev-data/compact-transfer/ | modified |
| 2026-11-12 19:15:33 +07:00 | `AGENTS.md` | — | 1–15 | module/file | added |
| 2026-11-12 19:04:17 +07:00 | `README.md` | — | 25–26 | Login admin lokal, buka **Database Kitab → Import / Export Kitab**, lalu expor | modified |
| waktu penghapusan tidak direkam | `dist/assets/index-Bm-CgWzv.css` | 1–2 | — | module/file | deleted |
| 2026-11-12 19:12:16 +07:00 | `dist/assets/index-DBN47W4M.css` | — | 1–2 | module/file | added |
| 2026-11-12 19:12:16 +07:00 | `dist/assets/index.dev-BtzLlrud.js` | — | 1–16 | t, n, m, v, which, y, b, C | added |
| 2026-11-12 19:12:16 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-12 19:04:17 +07:00 | `docs/rowa-database.md` | — | 1–57 | module/file | added |
| 2026-11-12 18:57:01 +07:00 | `scripts/RowaMdbExport.java` | — | 1–41 | RowaMdbExport | added |
| 2026-11-12 18:58:13 +07:00 | `scripts/build-rowa-db.js` | — | 1–45 | temp, jsonl, before, run, rows, item, insert, after | added |
| 2026-11-12 19:15:33 +07:00 | `scripts/record-changes.js` | — | 1–44 | git, root, files, wib, parts, now, records, diff | added |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 21–21 | 21–22 | import { searchRowa } from './rowa-search.js'; | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 140–140 | 141–142 | app.use((req, res, next) => { | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | — | 686–687 | registerBookTransfer(app, { | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 1399–1399 | 1403–1404 | app.get('/api/rowa/search', (req, res) => { | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 1401–1401 | 1406–1406 | app.get('/api/rowa/search', (req, res) => { | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 1409–1409 | 1414–1415 | app.get('/api/rowa/:id', (req, res) => { | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 1415–1415 | 1421–1421 | app.get('/api/rowa/:id', (req, res) => { | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 1418–1418 | 1424–1424 | app.get('/api/rowa/:id', (req, res) => { | modified |
| 2026-11-12 19:03:00 +07:00 | `server/index.js` | 1422–1424 | 1428–1428 | app.get('/api/rowa/:id', (req, res) => { | modified |
| 2026-11-12 19:01:55 +07:00 | `server/rowa-codes.js` | — | 1–33 | CODE_SOURCE, BOOK_CODES, decodeWho, symbols, canonical, unknown, expanded, withRowaSources | added |
| 2026-11-12 19:01:55 +07:00 | `server/rowa-codes.test.js` | — | 1–19 | result | added |
| 2026-11-12 19:03:00 +07:00 | `server/rowa-database.js` | — | 1–135 | validId, createRowaStore, versions, pointer, file, open, db, m | added |
| 2026-11-12 19:03:15 +07:00 | `server/rowa-database.test.js` | — | 1–86 | directory, dir, makePackage, filename, src, before, preview, db | added |
| waktu penghapusan tidak direkam | `server/rowa-kutub.js` | 1–37 | — | module/file | deleted |
| waktu penghapusan tidak direkam | `server/rowa-kutub.test.js` | 1–36 | — | module/file | deleted |
| 2026-11-12 18:57:01 +07:00 | `server/rowa-package.js` | — | 1–81 | FORMAT, VERSION, MAX_PACKAGE, TEXT_FIELDS, norm, createRowaSchema, writeRowaRows, insert | added |
| 2026-11-12 18:59:41 +07:00 | `server/rowa-search.js` | 1–1 | 1–1 | searchRowa, q, page, limit, response, columns, iso, fields | modified |
| 2026-11-12 18:59:41 +07:00 | `server/rowa-search.js` | 14–16 | 14–14 | export function searchRowa(db, query, {buildFtsMatch,buildLikeMatch}) { | modified |
| 2026-11-12 18:59:41 +07:00 | `server/rowa-search.js` | 38–43 | 36–36 | export function searchRowa(db, query, {buildFtsMatch,buildLikeMatch}) { | modified |
| 2026-11-12 19:00:22 +07:00 | `server/rowa-search.test.js` | 43–43 | 43–43 | test('full names take precedence, with safe fallbacks for missing and whitespace | modified |
| 2026-11-12 19:00:22 +07:00 | `server/rowa-search.test.js` | 50–52 | 50–51 | test('searchRowa automatically extracts hadith books from telmez when kutub colu | modified |
| 2026-11-12 19:00:22 +07:00 | `server/rowa-search.test.js` | — | 53–57 | test('searchRowa automatically extracts hadith books from telmez when kutub colu | modified |
| 2026-11-12 18:59:41 +07:00 | `src/components/Admin.tsx` | — | 5–5 | import { BookTransfer } from './BookTransfer'; | modified |
| 2026-11-12 18:59:41 +07:00 | `src/components/Admin.tsx` | — | 1378–1378 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDatabase.tsx` | — | 1–72 | size, RowaDatabase, input, request, response, body, run, upload | added |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDictionary.tsx` | — | 21–24 | interface RowaResult { | modified |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDictionary.tsx` | — | 28–29 | interface RowaDetail extends RowaResult { | modified |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDictionary.tsx` | 232–232 | 238–238 | const ProfileModal = ({ | modified |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDictionary.tsx` | 236–236 | 242–242 | const ProfileModal = ({ | modified |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDictionary.tsx` | — | 256–256 | const ProfileModal = ({ | modified |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDictionary.tsx` | — | 259–260 | const ProfileModal = ({ | modified |
| 2026-11-12 19:01:55 +07:00 | `src/components/RowaDictionary.tsx` | — | 290–297 | const ProfileModal = ({ | modified |
| 2026-11-12 18:59:41 +07:00 | `src/lib/admin-navigation.ts` | 1–1 | 1–1 | adminParent, adminTitle, adminGroup, adminLocation, p, raw, id, v | modified |
| 2026-11-12 18:59:41 +07:00 | `src/lib/admin-navigation.ts` | — | 4–4 | const parents: Record<AdminView, AdminView> = { | modified |
| 2026-11-12 18:59:41 +07:00 | `src/lib/admin-navigation.ts` | — | 10–10 | const titles: Record<AdminView,string> = { | modified |
| 2026-11-12 18:59:41 +07:00 | `src/lib/admin-navigation.ts` | 16–16 | 18–18 | export const adminGroups: {label:string;views:AdminView[]}[] = [ | modified |
