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

## [2026-11-12 19:44:04 +07:00] — Catat hasil pull VPS, aktivasi database perawi, dan verifikasi HTTPS

Waktu pencatatan: **2026-11-12 19:44:04 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `31808cc`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi deployment; tidak ada perubahan kode. HEAD VPS 31808cc cocok dengan GitHub; maktabah.service active; HTTP 200; hash JS/CSS online cocok; profil/pencarian Bukhari berkode ت س; jumlah kitab tetap 36.159. git diff --cached --check lulus.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-12-19-44-04-241a70.json](docs/change-audit/2026-11-12-19-44-04-241a70.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-12 19:44:03 +07:00 | `docs/deployment-log.md` | — | 1–19 | module/file | added |

## [2026-11-13 05:02:34 +07:00] — Penulis dan karya: database sumber, profil publik, tinjauan atribusi, import lokal/online, dan launcher lokal 3081

Waktu pencatatan: **2026-11-13 05:02:34 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `590c816`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 132 tes server lulus; TypeScript/build produksi lulus; sintaks startup lokal lulus; browser desktop/ponsel: import paket 14 MB, profil, metadata kitab, pembaca, reject/reset, riwayat, unduhan snapshot tanpa error JavaScript atau overflow; LOCAL_EXPORT_MODE=1 upload/aktivasi/tinjauan lulus; git diff --check lulus.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-05-02-34-431083.json](docs/change-audit/2026-11-13-05-02-34-431083.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 04:45:08 +07:00 | `.gitignore` | — | 24–24 | dev-data/rowa-database/ | modified |
| 2026-11-13 05:01:11 +07:00 | `Buka Penulis Lokal.bat` | — | 1–20 | module/file | added |
| 2026-11-13 04:57:10 +07:00 | `README.md` | — | 25–26 | Login admin lokal, buka **Database Kitab → Import / Export Kitab**, lalu expor | modified |
| waktu penghapusan tidak direkam | `dist/assets/index-DBN47W4M.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 05:00:19 +07:00 | `dist/assets/index-GqfaGxNR.css` | — | 1–2 | module/file | added |
| 2026-11-13 05:00:19 +07:00 | `dist/assets/index.dev-D2Uj4HUL.js` | — | 1–16 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 05:00:19 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 05:01:11 +07:00 | `docs/authors.md` | — | 1–68 | module/file | added |
| 2026-11-13 04:39:19 +07:00 | `scripts/AuthorMdbExport.java` | — | 1–33 | AuthorMdbExport | added |
| 2026-11-13 04:56:11 +07:00 | `scripts/build-author-db.js` | — | 1–58 | files, sha, hashes, libraries, run, records, authors, byName | added |
| 2026-11-13 05:01:11 +07:00 | `scripts/start_local.js` | — | 10–11 | dotenv.config({ path: path.join(root, '.env.local'), override: true, quiet: true | modified |
| 2026-11-13 05:01:11 +07:00 | `scripts/start_local.js` | 20–20 | 22–24 | const base = `http://127.0.0.1:${port}`; | modified |
| 2026-11-13 05:01:11 +07:00 | `scripts/start_local.js` | 31–31 | 35–35 | const openWeb = () => { | modified |
| 2026-11-13 05:01:11 +07:00 | `scripts/start_local.js` | — | 42–42 | const running=await status(); | modified |
| 2026-11-13 04:56:11 +07:00 | `server/author-package.js` | — | 1–85 | AUTHOR_FORMAT, AUTHOR_VERSION, AUTHOR_MAX_BYTES, normalizeIdentity, identityHash, matchAuthorIdentity, names, year | added |
| 2026-11-13 04:56:11 +07:00 | `server/author-store.js` | — | 1–80 | validId, createAuthorStore, versions, file, open, next, m, refresh | added |
| 2026-11-13 04:59:50 +07:00 | `server/authors.js` | — | 1–98 | err, paging, limit, findText, createAuthorService, invalidate, graph, db | added |
| 2026-11-13 04:59:50 +07:00 | `server/authors.test.js` | — | 1–83 | makePackage, filename, a, w, fixture, dir, clean, library | added |
| 2026-11-13 05:01:27 +07:00 | `server/index.js` | — | 23–24 | import { createRowaStore, registerRowaDatabase } from './rowa-database.js'; | modified |
| 2026-11-13 05:01:27 +07:00 | `server/index.js` | 142–142 | 144–146 | app.use((req, res, next) => { | modified |
| 2026-11-13 05:01:27 +07:00 | `server/index.js` | 361–361 | 365–365 | app.get('/api/local/status', (req, res) => { | modified |
| 2026-11-13 05:01:27 +07:00 | `server/index.js` | — | 692–695 | registerRowaDatabase(app, {store:rowaStore, requireAdmin}); | modified |
| 2026-11-13 05:01:27 +07:00 | `server/index.js` | — | 1241–1241 | app.get('/api/book/:id', (req, res) => { | modified |
| 2026-11-13 04:58:26 +07:00 | `server/navigation.test.js` | — | 17–20 | test('navigation supports legacy admin links and bounds malformed pagination',() | modified |
| 2026-11-13 04:51:13 +07:00 | `src/App.tsx` | — | 10–10 | import RowaDictionary from './components/RowaDictionary'; | modified |
| 2026-11-13 04:51:13 +07:00 | `src/App.tsx` | 31–31 | 32–32 | import { useEffect, useRef } from 'react'; | modified |
| 2026-11-13 04:51:13 +07:00 | `src/App.tsx` | — | 452–453 | function App() { | modified |
| 2026-11-13 04:51:13 +07:00 | `src/App.tsx` | — | 988–988 | function App() { | modified |
| 2026-11-13 04:48:51 +07:00 | `src/components/Admin.tsx` | — | 6–7 | import { RowaDatabase } from './RowaDatabase'; | modified |
| 2026-11-13 04:48:51 +07:00 | `src/components/Admin.tsx` | — | 1381–1382 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-13 04:47:14 +07:00 | `src/components/AuthorDatabase.tsx` | — | 1–24 | AuthorDatabase, input, request, r, body, run, upload, activate | added |
| 2026-11-13 04:59:50 +07:00 | `src/components/AuthorReview.tsx` | — | 1–43 | date, AuthorReview, detailId, request, r, data, loadCase, sequence | added |
| 2026-11-13 04:54:46 +07:00 | `src/components/Authors.tsx` | — | 1–39 | basisName, Authors, data, params, update, controller, endpoint, result | added |
| 2026-11-13 04:45:08 +07:00 | `src/components/MoreMenu.tsx` | — | 7–7 | const items: {tab?:AppTab;href?:string;label:string;icon:typeof Menu}[]=[ | modified |
| 2026-11-13 04:45:08 +07:00 | `src/lib/admin-navigation.ts` | 1–1 | 1–1 | adminParent, adminTitle, adminGroup, adminLocation, p, raw, id, v | modified |
| 2026-11-13 04:45:08 +07:00 | `src/lib/admin-navigation.ts` | — | 4–4 | const parents: Record<AdminView, AdminView> = { | modified |
| 2026-11-13 04:45:08 +07:00 | `src/lib/admin-navigation.ts` | — | 11–11 | const titles: Record<AdminView,string> = { | modified |
| 2026-11-13 04:45:08 +07:00 | `src/lib/admin-navigation.ts` | 18–18 | 20–20 | export const adminGroups: {label:string;views:AdminView[]}[] = [ | modified |
| 2026-11-13 04:48:51 +07:00 | `src/lib/back-navigation.ts` | — | 20–20 | export function backFallback(hash:string) { | modified |
| 2026-11-13 04:45:08 +07:00 | `src/lib/navigation.ts` | 1–2 | 1–2 | parseNavigation, params, found, navigationHash, routePage, routeCategories | modified |

## [2026-11-13 05:06:49 +07:00] — Catat deployment penulis lokal 3081 dan VPS beserta aktivasi paket serta verifikasi runtime

Waktu pencatatan: **2026-11-13 05:06:49 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `cad8667`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja, kode tidak berubah. Commit aplikasi cad8667 telah dipull VPS; layanan aktif. API lokal/online memverifikasi 966 penulis, 770 biografi, 5.610 kitab tertaut; browser ponsel pencarian/profil tanpa error; hash aset online cocok; 36.159 kitab online tetap ada; regresi Kamus Perawi lulus. git diff --cached --check lulus.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-05-06-49-071920.json](docs/change-audit/2026-11-13-05-06-49-071920.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 05:06:48 +07:00 | `docs/deployment-log.md` | — | 3–18 | module/file | modified |

## [2026-11-13 05:37:39 +07:00] — Linimasa premium Penulis dan Karya: kronologi sumber, filter abad, kartu bergantian, dan tampilan responsif

Waktu pencatatan: **2026-11-13 05:37:39 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `6d1694e`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 136 tes server lulus; TypeScript/build produksi lulus; browser memverifikasi kartu/axis desktop, alur vertikal 320–1440 px, hijau/gelap/krem, filter abad, waktu relatif/abad saja/tanpa tanggal, pagination dan kembali dari profil, tampilan kartu, tanpa error JavaScript atau overflow. git diff --check lulus. Backend lokal 3081 berhasil dimuat ulang setelah verifikasi proses dan transfer.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-05-37-39-e8f9c1.json](docs/change-audit/2026-11-13-05-37-39-e8f9c1.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 05:36:32 +07:00 | `dist/assets/index-BUrTUMsL.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-GqfaGxNR.css` | 1–2 | — | module/file | deleted |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-D2Uj4HUL.js` | 1–16 | — | module/file | deleted |
| 2026-11-13 05:36:32 +07:00 | `dist/assets/index.dev-Dq3MmhhG.js` | — | 1–16 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 05:36:32 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 05:36:23 +07:00 | `docs/authors.md` | — | 5–12 | Fitur publik tersedia di `#/penulis`. Nama penulis dapat dicari, diurutkan berda | modified |
| 2026-11-13 05:28:14 +07:00 | `server/author-chronology.js` | — | 1–18 | authorDeathDate, original, clean, unknown, century, n, match, year | added |
| 2026-11-13 05:28:14 +07:00 | `server/author-chronology.test.js` | — | 1–13 | c, rows | added |
| 2026-11-13 05:28:14 +07:00 | `server/authors.js` | — | 3–3 | import {normalizeIdentity,identityHash} from './author-package.js'; | modified |
| 2026-11-13 05:28:14 +07:00 | `server/authors.js` | 36–39 | 37–46 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-13 05:32:12 +07:00 | `server/authors.test.js` | — | 44–54 | test('review confirmation/rejection/reset, multiple authors, stale edit conflict | modified |
| 2026-11-13 05:36:23 +07:00 | `server/back-navigation.test.js` | — | 5–9 | import {backState,previousLocation,pushLocation,backFallback} from '../src/lib/b | modified |
| 2026-11-13 05:30:08 +07:00 | `src/components/AuthorTimeline.tsx` | — | 1–30 | dateOf, AuthorCard, date, AuthorTimeline, dated, rows, AuthorCards | added |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 2–2 | 2–2 | import {useEffect,useState} from 'react'; | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 5–5 | 5–8 | import {navigationHash,routePage} from '../lib/navigation'; | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | — | 11–11 | const basisName=(basis:string)=>basis==='admin-reviewed'?'Ditinjau admin':basis= | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 9–9 | 13–14 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 11–11 | 16–20 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 13–13 | 22–26 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 18–19 | 31–38 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 22–23 | 41–46 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 25–28 | 48–85 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/Authors.tsx` | 36–37 | 93–101 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:36:23 +07:00 | `src/components/author-journey.css` | — | 1–65 | module/file | added |
| 2026-11-13 05:32:12 +07:00 | `src/lib/back-navigation.ts` | 20–20 | 20–20 | export function backFallback(hash:string) { | modified |

Catatan koreksi verifikasi untuk commit d109841: pemeriksaan staged menemukan satu baris kosong berlebih pada akhir src/components/author-journey.css. Teks audit awal menyebut pemeriksaan whitespace lulus; status yang benar adalah ada temuan whitespace tersebut. Baris kosong dibetulkan pada commit tindak lanjut, tanpa perubahan perilaku, lalu pemeriksaan dan build diulang.


## [2026-11-13 05:38:52 +07:00] — Rapikan EOF stylesheet linimasa dan koreksi catatan pemeriksaan whitespace sebelumnya

Waktu pencatatan: **2026-11-13 05:38:52 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `d109841`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Perubahan whitespace saja; tidak mengubah perilaku. Build produksi dan TypeScript diulang dan lulus. git diff --cached --check lulus setelah koreksi. Hasil 136 tes dan uji browser fungsional tetap merujuk perubahan aplikasi d109841.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-05-38-52-b3d289.json](docs/change-audit/2026-11-13-05-38-52-b3d289.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 05:38:20 +07:00 | `src/components/author-journey.css` | 64–65 | — | module/file | modified |

## [2026-11-13 05:40:43 +07:00] — Catat deployment linimasa premium penulis beserta verifikasi lokal dan HTTPS

Waktu pencatatan: **2026-11-13 05:40:43 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `0a862f2`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja. Linimasa aktif di lokal 3081 dan VPS; browser desktop/ponsel tanpa error; overview 966/772/5.610; aset online sesuai hash build; 36.159 kitab tetap ada dan regresi perawi lulus. Pemeriksaan whitespace akhir bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-05-40-43-5723ea.json](docs/change-audit/2026-11-13-05-40-43-5723ea.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 05:40:43 +07:00 | `docs/deployment-log.md` | — | 3–16 | module/file | modified |

## [2026-11-13 05:59:42 +07:00] — Koreksi linimasa menjadi satu jalur tahun horizontal dengan pemuatan kiri kanan dan nama setelah klik

Waktu pencatatan: **2026-11-13 05:59:42 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `e56f28c`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 137 pengujian server lulus; TypeScript dan build lokal lulus; browser lokal 3082: tahun satu baris pada 320/390/768/1024/1440, nama tersembunyi sampai tahun diklik, muat kiri kanan menambah 10+10+10 tanpa duplikasi, grup tahun lengkap, profil dan tanggal tidak diketahui lulus, tanpa pageerror; diff whitespace bersih. Launcher lokal dipindah 3082 karena kontrol otomatis menolak penghentian proses 3081.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-05-59-42-1b11bd.json](docs/change-audit/2026-11-13-05-59-42-1b11bd.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 05:58:42 +07:00 | `Buka Penulis Lokal.bat` | 16–16 | 16–16 | if not exist "node_modules\dotenv\package.json" ( | modified |
| 2026-11-13 05:59:36 +07:00 | `dist/assets/index-BA1Cj2qV.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Dq3MmhhG.js` | 1–16 | — | module/file | deleted |
| 2026-11-13 05:59:36 +07:00 | `dist/assets/index.dev-OdtLzvJl.js` | — | 1–16 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 05:59:36 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 05:58:42 +07:00 | `docs/authors.md` | 7–7 | 7–7 | Fitur publik tersedia di `#/penulis`. Nama penulis dapat dicari, diurutkan berda | modified |
| 2026-11-13 05:58:42 +07:00 | `docs/authors.md` | 11–11 | 11–11 | Tahun pasti, `بعد` (setelah), `قبل` (sebelum), `نحو` (sekitar), dan ket | modified |
| 2026-11-13 05:58:42 +07:00 | `docs/authors.md` | 25–25 | 25–25 | Label **Kecocokan metadata** menjelaskan dasar relasinya; bukan klaim bahwa atri | modified |
| 2026-11-13 05:54:59 +07:00 | `server/authors.js` | — | 44–55 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-13 05:56:15 +07:00 | `server/authors.test.js` | — | 62–77 | test('library title edits/deletions and duplicate IDs invalidate public work lis | modified |
| 2026-11-13 05:59:27 +07:00 | `src/components/AuthorTimeline.tsx` | 1–1 | 1–2 | dateOf, AuthorCard, date, AuthorTimeline, rail, q, lastDirection, load | modified |
| 2026-11-13 05:59:27 +07:00 | `src/components/AuthorTimeline.tsx` | 17–25 | 18–53 | function AuthorCard({author,context,onOpen,compact=false}:{author:AuthorSummary; | modified |
| 2026-11-13 05:58:42 +07:00 | `src/components/Authors.tsx` | 35–35 | 35–35 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:58:42 +07:00 | `src/components/Authors.tsx` | 94–94 | 94–94 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:58:42 +07:00 | `src/components/Authors.tsx` | 97–97 | 97–97 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 05:55:55 +07:00 | `src/components/author-journey.css` | 33–36 | — | module/file | modified |
| 2026-11-13 05:55:55 +07:00 | `src/components/author-journey.css` | 49–55 | — | module/file | modified |
| 2026-11-13 05:55:55 +07:00 | `src/components/author-journey.css` | 60–61 | 49–50 | module/file | modified |
| 2026-11-13 05:55:55 +07:00 | `src/components/author-journey.css` | 63–63 | 52–65 | module/file | modified |

## [2026-11-13 06:00:47 +07:00] — Catat deployment koreksi linimasa tahun horizontal dan hasil browser online

Waktu pencatatan: **2026-11-13 06:00:47 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `fd39d9c`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja; fungsi fd39d9c aktif online, 137 tes lulus, browser lokal 3082 dan HTTPS lolos; hash aset sesuai; koleksi kitab dan perawi tetap sesuai. Lokal 3081 tidak dihentikan karena penolakan kontrol otomatis.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-06-00-47-f6af42.json](docs/change-audit/2026-11-13-06-00-47-f6af42.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 06:00:47 +07:00 | `docs/deployment-log.md` | — | 1–9 | module/file | modified |

## [2026-11-13 06:26:39 +07:00] — Tampilkan terjemahan dan penjelasan AI langsung dalam pembaca tanpa pindah halaman

Waktu pencatatan: **2026-11-13 06:26:39 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `042a4db`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 139 tes lulus; TypeScript dan build lokal lulus; browser lokal 3082: terjemahan seluruh halaman, penjelasan teks pilihan, alamat/pembaca/teks sumber tetap, error 409 dan retry, close serta perpindahan halaman membatalkan permintaan, HTML model di-escape, ponsel tanpa overflow atau pageerror. Pemeriksaan staged menemukan blank EOF pada renderer baru; diperbaiki sebelum commit, tes renderer/stream/cancel diulang lulus dan git diff --cached --check akhir bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-06-26-39-f997c8.json](docs/change-audit/2026-11-13-06-26-39-f997c8.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BA1Cj2qV.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 06:25:43 +07:00 | `dist/assets/index-mAgu00si.css` | — | 1–2 | module/file | added |
| 2026-11-13 06:25:43 +07:00 | `dist/assets/index.dev-DzwPpVbh.js` | — | 1–16 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 06:25:43 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 06:25:30 +07:00 | `docs/ai-improvements.md` | — | 40–48 | Kasus frasa «سافر تجد عوضا» mengungkap bahwa tanda kutip untuk tran | modified |
| 2026-11-13 06:23:28 +07:00 | `server/reader-ai.test.js` | — | 1–22 | controller, pending, result | added |
| 2026-11-13 06:22:44 +07:00 | `src/App.tsx` | 1063–1063 | — | function App() { | modified |
| 2026-11-13 06:22:44 +07:00 | `src/api.ts` | 202–202 | 202–202 | export const webAPI = { | modified |
| 2026-11-13 06:22:44 +07:00 | `src/api.ts` | 205–205 | 205–205 | export const webAPI = { | modified |
| 2026-11-13 06:22:44 +07:00 | `src/components/AskAI.tsx` | — | 1–1 | AskAI, failedRequest, lastQuestion, requestActive, handledQuestionVersion, endRef, inputRef, refresh | modified |
| 2026-11-13 06:22:44 +07:00 | `src/components/AskAI.tsx` | 14–72 | — | interface Message { | modified |
| 2026-11-13 06:22:45 +07:00 | `src/components/ReaderAiPanel.tsx` | — | 1–30 | ReaderAiPanel, heading, title, controller | added |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | 1–1 | 1–2 | buildArabicRegex, harakat, safeWord, highlightText, words, regexStr, regex, readingTextRef | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | 21–21 | — | export interface ReaderModalProps { | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | 66–66 | 66–66 | const highlightText = (text: string, query?: string) => { | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | — | 68–72 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | — | 74–75 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | 71–71 | 78–78 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | — | 84–84 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | 477–479 | 485–487 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 06:25:30 +07:00 | `src/components/ReaderModal.tsx` | 481–481 | 489–490 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 06:26:38 +07:00 | `src/lib/ai-markdown.ts` | — | 1–58 | renderMarkdown, lines, closeListsIfOpen, olMatch, ulMatch, inlineMarkdown | added |

## [2026-11-13 06:29:00 +07:00] — Catat deployment panel terjemahan dan penjelasan pembaca beserta uji provider online

Waktu pencatatan: **2026-11-13 06:29:00 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1d76c75`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja; fungsi 1d76c75 aktif lokal 3082 dan HTTPS, 139 tes dan build lulus, browser respons terkendali lulus, provider sungguhan translate/explain keduanya grounded di pembaca yang sama, hash aset online cocok. Frontend saja tanpa restart layanan.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-06-29-00-4713e9.json](docs/change-audit/2026-11-13-06-29-00-4713e9.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 06:28:59 +07:00 | `docs/deployment-log.md` | — | 1–9 | module/file | modified |

## [2026-11-13 06:47:09 +07:00] — Tambahkan halaman Kutub Hadis dan kelompok sumber 2 4 6 9 10 11 dengan edisi katalog nyata

Waktu pencatatan: **2026-11-13 06:47:09 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4ed3d8b`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 142 tes lulus; sintaks server/launcher, TypeScript dan build lokal lulus; browser lokal 3083 memverifikasi kelompok 2/4/6/9/10/11/17, 123 edisi, pencarian Arab/Latin, URL/reload/filter, pilih edisi dan baca serta kembali, viewport 320/390/768/1440 tanpa overflow/pageerror. Inspeksi MDB read-only dan kode Android didokumentasikan; ID sumber tidak dipakai sebagai ID web; Nasai Kubra/syarah serta konflik ID dikecualikan; staged diff whitespace bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-06-47-09-735233.json](docs/change-audit/2026-11-13-06-47-09-735233.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 06:44:09 +07:00 | `Buka Kutub Hadis Lokal.bat` | — | 1–20 | module/file | added |
| 2026-11-13 06:40:23 +07:00 | `Buka Penulis Lokal.bat` | 16–16 | 16–16 | if not exist "node_modules\dotenv\package.json" ( | modified |
| 2026-11-13 06:46:10 +07:00 | `dist/assets/index-DV29ooXM.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-mAgu00si.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 06:46:10 +07:00 | `dist/assets/index.dev-BIEZg86d.js` | — | 1–16 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-DzwPpVbh.js` | 1–16 | — | module/file | deleted |
| 2026-11-13 06:46:10 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 06:46:33 +07:00 | `docs/hadith-books.md` | — | 1–32 | module/file | added |
| 2026-11-13 06:44:09 +07:00 | `scripts/start_local.js` | 22–22 | 22–23 | const base = `http://127.0.0.1:${port}`; | modified |
| 2026-11-13 06:44:09 +07:00 | `scripts/start_local.js` | 24–24 | 25–25 | const adminUrl=authorMode?`${base}/#/admin?view=authors_database`:`${base}/?admi | modified |
| 2026-11-13 06:44:09 +07:00 | `scripts/start_local.js` | 35–35 | 36–36 | const openWeb = () => { | modified |
| 2026-11-13 06:44:09 +07:00 | `scripts/start_local.js` | — | 43–43 | const running=await status(); | modified |
| 2026-11-13 06:39:57 +07:00 | `server/data/hadith-books.json` | — | 1–384 | module/file | added |
| 2026-11-13 06:40:22 +07:00 | `server/hadith-books.js` | — | 1–26 | hadithCatalogue, hadithBooks, byId, previous, books, allowed, editions, registerHadithBooks | added |
| 2026-11-13 06:42:12 +07:00 | `server/hadith-books.test.js` | — | 1–29 | groups, g, result, app, server, url, route | added |
| 2026-11-13 06:40:23 +07:00 | `server/index.js` | — | 1–1 | __filename, __dirname, logPath, stripHarakat, generateWordVariations, chars, alefs, ya | modified |
| 2026-11-13 06:40:23 +07:00 | `server/index.js` | 365–365 | 366–366 | app.get('/api/local/status', (req, res) => { | modified |
| 2026-11-13 06:40:23 +07:00 | `server/index.js` | — | 694–694 | const authorStore=createAuthorStore(path.resolve(process.env.AUTHOR_DATABASE_DIR | modified |
| 2026-11-13 06:40:23 +07:00 | `src/App.tsx` | — | 1–1 | App, navigationHandler, loadedSearch, lastTabLocations, pendingSearch, searchRequest, openAiQuestion, cancelAiRedirect | modified |
| 2026-11-13 06:40:23 +07:00 | `src/App.tsx` | 32–32 | 33–33 | import { useEffect, useRef } from 'react'; | modified |
| 2026-11-13 06:40:23 +07:00 | `src/App.tsx` | — | 453–454 | function App() { | modified |
| 2026-11-13 06:45:59 +07:00 | `src/components/HadithBooks.tsx` | — | 1–55 | normalize, HadithBooks, params, update, controller, result, group, chosen | added |
| 2026-11-13 06:40:23 +07:00 | `src/components/MoreMenu.tsx` | — | 7–7 | const items: {tab?:AppTab;href?:string;label:string;icon:typeof Menu}[]=[ | modified |
| 2026-11-13 06:40:23 +07:00 | `src/lib/navigation.ts` | 1–2 | 1–2 | parseNavigation, params, found, navigationHash, routePage, routeCategories | modified |

## [2026-11-13 06:50:01 +07:00] — Catat deployment Kutub Hadis beserta inspeksi sumber dan verifikasi online

Waktu pencatatan: **2026-11-13 06:50:01 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `bbe2d03`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja; fungsi bbe2d03 aktif pada lokal 3083 dan HTTPS; 142 tes/build/browser lulus, 17 sumber/123 edisi sesuai; hash aset dan regresi kitab/penulis/perawi lulus. Backend lama menunggu I/O, pulih setelah restart yang didahului pemeriksaan persisted jobs dan compact_sessions tanpa transfer aktif.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-06-50-01-dfbd97.json](docs/change-audit/2026-11-13-06-50-01-dfbd97.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 06:50:01 +07:00 | `docs/deployment-log.md` | — | 1–10 | module/file | modified |

## [2026-11-13 07:19:48 +07:00] — Tambahkan pencarian isi Kutub Hadis terbatas kelompok kitab dan edisi dengan indeks Arab terpisah

Waktu pencatatan: **2026-11-13 07:19:48 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4ff6f72`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 146 tes server lulus; sintaks server/worker/launcher, TypeScript dan build lokal lulus; browser lokal 3085 lulus lingkup kelompok/kitab/edisi, kata/frasa, pagination tanpa duplikasi, sorotan dan tautan halaman asli, kembali/reload filter, auto retry 202, hasil kosong, 320/390/768/1440 tanpa overflow/pageerror. Indeks lokal 757.404 halaman quick_check ok; pencarian nyata sekitar 1 detik. Unit memverifikasi sumber read-only, gabungan database, harakat/hamzah, scope tidak bocor, indeks atomik/rebuild/retensi. Staged whitespace bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-07-19-48-6f6561.json](docs/change-audit/2026-11-13-07-19-48-6f6561.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 07:09:10 +07:00 | `.gitignore` | — | 25–26 | dev-data/authors-database/ | modified |
| 2026-11-13 07:09:55 +07:00 | `Buka Kutub Hadis Lokal.bat` | 16–16 | 16–16 | if not exist "node_modules\dotenv\package.json" ( | modified |
| waktu penghapusan tidak direkam | `dist/assets/index-DV29ooXM.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 07:18:30 +07:00 | `dist/assets/index-VvUxaVVz.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-BIEZg86d.js` | 1–16 | — | module/file | deleted |
| 2026-11-13 07:18:30 +07:00 | `dist/assets/index.dev-Dt-qlpeR.js` | — | 1–16 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 07:18:30 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 07:17:49 +07:00 | `docs/hadith-books.md` | — | 33–49 | Pengujian server mencakup komposisi kelompok, identitas judul, konflik ID, penge | modified |
| 2026-11-13 07:09:55 +07:00 | `scripts/start_local.js` | 43–43 | 43–43 | const running=await status(); | modified |
| 2026-11-13 07:17:49 +07:00 | `server/hadith-search-core.js` | — | 1–108 | fail, normalizeHadith, hadithMatch, words, hadithExcerpt, text, map, c | added |
| 2026-11-13 07:08:32 +07:00 | `server/hadith-search-worker.js` | — | 1–4 | module/file | added |
| 2026-11-13 07:09:55 +07:00 | `server/hadith-search.js` | — | 1–39 | registerHadithSearch, startBuild, dirtyFile, worker, preparing, paths, indexPath, stop | added |
| 2026-11-13 07:17:49 +07:00 | `server/hadith-search.test.js` | — | 1–59 | indexes, searchHadith, key, fixture, dir, db, b, paths | added |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | — | 1–1 | __filename, __dirname, logPath, stripHarakat, generateWordVariations, chars, alefs, ya | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | — | 187–188 | const askCache = new Map(); | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | 366–366 | 369–369 | app.get('/api/local/status', (req, res) => { | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | 520–520 | 523–523 | app.put('/api/admin/books/bulk-move', requireAdmin, (req, res) => { | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | 649–649 | 652–652 | app.post('/api/admin/categories/merge', requireAdmin, (req, res) => { | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | 689–689 | 692–692 | registerBookTransfer(app, { | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | — | 697–697 | const authorStore=createAuthorStore(path.resolve(process.env.AUTHOR_DATABASE_DIR | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | 700–700 | 704–704 | registerCompactTransfer(app,{ | modified |
| 2026-11-13 07:09:55 +07:00 | `server/index.js` | 706–706 | 710–710 | registerLargeTransfer(app, { | modified |
| 2026-11-13 07:00:30 +07:00 | `src/App.tsx` | 454–454 | 454–454 | function App() { | modified |
| 2026-11-13 07:17:49 +07:00 | `src/components/HadithBooks.tsx` | — | 1–1 | normalize, HadithBooks, params, mode, update, controller, result, group | modified |
| 2026-11-13 07:17:49 +07:00 | `src/components/HadithBooks.tsx` | 11–11 | 12–12 | const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0 | modified |
| 2026-11-13 07:17:49 +07:00 | `src/components/HadithBooks.tsx` | — | 16–16 | export function HadithBooks({openBook,readBook}:{openBook:(id:number)=>void;read | modified |
| 2026-11-13 07:17:49 +07:00 | `src/components/HadithBooks.tsx` | 29–30 | 31–32 | export function HadithBooks({openBook,readBook}:{openBook:(id:number)=>void;read | modified |
| 2026-11-13 07:17:49 +07:00 | `src/components/HadithBooks.tsx` | 38–40 | 40–48 | export function HadithBooks({openBook,readBook}:{openBook:(id:number)=>void;read | modified |
| 2026-11-13 07:17:49 +07:00 | `src/components/HadithBooks.tsx` | 42–43 | 50–51 | export function HadithBooks({openBook,readBook}:{openBook:(id:number)=>void;read | modified |
| 2026-11-13 07:09:55 +07:00 | `src/components/HadithTextSearch.tsx` | — | 1–36 | HadithTextSearch, query, key, controller, result | added |

## [2026-11-13 07:22:54 +07:00] — Catat deployment pencarian isi Kutub Hadis dan verifikasi indeks serta browser online

Waktu pencatatan: **2026-11-13 07:22:54 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `74cebb2`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja; fungsi 74cebb2 aktif lokal 3085 dan HTTPS, 146 tes/build/browser lulus; indeks lokal dan online 757.404 halaman; seluruh kelompok HTTP 200, scope terjaga, buka hasil dengan sorotan dan kembali/reload sesuai. Hash aset dan regresi kitab/penulis/perawi lulus. Tidak mengubah isi database sumber.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-07-22-54-7a0fce.json](docs/change-audit/2026-11-13-07-22-54-7a0fce.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 07:22:53 +07:00 | `docs/deployment-log.md` | — | 1–11 | module/file | modified |

## [2026-11-13 07:49:14 +07:00] — Hubungkan nama perawi pada cuplikan dan pembaca ke bithaqah Kamus Perawi tanpa pindah halaman

Waktu pencatatan: **2026-11-13 07:49:14 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `3e2dc2d`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 149 tes server lulus; TypeScript/build lokal lulus; browser lokal 3087 memverifikasi nama unik langsung, kandidat ambigu, profil asli/biografi, guru murid inline, Escape hanya menutup kartu, fokus kembali, cuplikan bersorotan, kamus perawi lama, tanpa pindah URL dan ponsel tanpa overflow/pageerror. Regresi AI dan pencarian isi lulus; pemilihan teks tetap utuh setelah penautan asinkron. Paket perawi lokal tervalidasi diaktifkan 07:37:34 WIB dari paket yang sudah tersedia: 8858 perawi/8854 biografi, AQUAL Bukhari 40413 dan WHO ت س. Basis pencocokan nama dijelaskan, tidak mengklaim identifikasi sanad. Staged whitespace bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-07-49-14-75995f.json](docs/change-audit/2026-11-13-07-49-14-75995f.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 07:39:01 +07:00 | `Buka Kutub Hadis Lokal.bat` | 16–16 | 16–16 | if not exist "node_modules\dotenv\package.json" ( | modified |
| 2026-11-13 07:46:49 +07:00 | `dist/assets/index-DWsuXFHp.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-VvUxaVVz.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 07:46:49 +07:00 | `dist/assets/index.dev-BL6DsWq1.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Dt-qlpeR.js` | 1–16 | — | module/file | deleted |
| 2026-11-13 07:46:49 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 07:47:48 +07:00 | `docs/hadith-books.md` | — | 50–66 | Lokal versi pencarian memakai `Buka Kutub Hadis Lokal.bat` pada port **3085**, d | modified |
| 2026-11-13 07:39:01 +07:00 | `scripts/start_local.js` | 43–43 | 43–43 | const running=await status(); | modified |
| 2026-11-13 07:39:01 +07:00 | `server/index.js` | — | 1–1 | __filename, __dirname, logPath, stripHarakat, generateWordVariations, chars, alefs, ya | modified |
| 2026-11-13 07:39:01 +07:00 | `server/index.js` | 144–144 | 145–145 | app.use((req, res, next) => { | modified |
| 2026-11-13 07:39:01 +07:00 | `server/index.js` | 369–369 | 370–370 | app.get('/api/local/status', (req, res) => { | modified |
| 2026-11-13 07:39:01 +07:00 | `server/index.js` | — | 697–697 | registerRowaDatabase(app, {store:rowaStore, requireAdmin}); | modified |
| 2026-11-13 07:33:50 +07:00 | `server/rowa-mentions.js` | — | 1–62 | invalid, normalizeRowaName, stops, base, words, createRowaNames, people, add | added |
| 2026-11-13 07:39:01 +07:00 | `server/rowa-mentions.test.js` | — | 1–29 | rows, index, mentions, make, db, first, app, server | added |
| 2026-11-13 07:36:44 +07:00 | `src/components/HadithTextSearch.tsx` | — | 1–1 | HadithTextSearch, query, key, controller, result | modified |
| 2026-11-13 07:36:44 +07:00 | `src/components/HadithTextSearch.tsx` | 30–30 | 31–32 | export function HadithTextSearch({q,group,source,edition,matching,page,onPage,re | modified |
| 2026-11-13 07:36:44 +07:00 | `src/components/ReaderModal.tsx` | — | 1–2 | buildArabicRegex, harakat, safeWord, highlightText, words, regexStr, regex, readingTextRef | modified |
| 2026-11-13 07:36:44 +07:00 | `src/components/ReaderModal.tsx` | — | 70–71 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 07:36:44 +07:00 | `src/components/ReaderModal.tsx` | — | 492–493 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 07:36:44 +07:00 | `src/components/ReaderModal.tsx` | 498–506 | 504–505 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-13 07:46:40 +07:00 | `src/components/RowaCards.tsx` | — | 1–44 | RowaCards, useRowaCards, RowaCardsProvider, origin, open, close, dialog, previous | added |
| 2026-11-13 07:37:00 +07:00 | `src/components/RowaDictionary.tsx` | — | 1–2 | SkeletonCard, DerajatBadge, EmptyState, ErrorBanner, SearchHint, LIMIT, inputRef, doSearch | modified |
| 2026-11-13 07:37:00 +07:00 | `src/components/RowaDictionary.tsx` | 2–2 | 4–4 | import React, { useState, useCallback, useRef } from 'react'; | modified |
| 2026-11-13 07:37:00 +07:00 | `src/components/RowaDictionary.tsx` | 4–4 | — | import { webAPI } from '../api'; | modified |
| 2026-11-13 07:37:00 +07:00 | `src/components/RowaDictionary.tsx` | 10–43 | 11–11 | import { rowaFullName } from '../lib/rowa-name'; | modified |
| 2026-11-13 07:37:00 +07:00 | `src/components/RowaDictionary.tsx` | 48–90 | — | interface SearchResponse { | modified |
| 2026-11-13 07:37:00 +07:00 | `src/components/RowaDictionary.tsx` | 150–364 | — | const SearchHint = () => ( | modified |
| 2026-11-13 07:37:00 +07:00 | `src/components/RowaDictionary.tsx` | 688–688 | 398–398 | const RowaDictionary: React.FC = () => { | modified |
| 2026-11-13 07:45:17 +07:00 | `src/components/RowaLinkedText.tsx` | — | 1–42 | tags, safeTemplate, template, el, style, linkNames, walker, text | added |
| 2026-11-13 07:46:40 +07:00 | `src/components/RowaProfileModal.tsx` | — | 1–291 | parseList, parseKutub, sep, formatYear, getKitabColor, RowaProfileModal, dialogRef, guruList | added |
| 2026-11-13 07:35:58 +07:00 | `src/components/rowa-links.css` | — | 1–2 | module/file | added |
| 2026-11-13 07:32:46 +07:00 | `src/lib/use-modal-focus.ts` | — | 10–11 | export function useModalFocus(onEscape?:()=>void, enabled=true) { | modified |
| 2026-11-13 07:36:44 +07:00 | `src/main.tsx` | — | 1–1 | module/file | modified |
| 2026-11-13 07:36:44 +07:00 | `src/main.tsx` | 8–8 | 9–9 | createRoot(document.getElementById('root')!).render( | modified |

## [2026-11-13 07:51:41 +07:00] — Catat deployment bithaqah perawi inline dan regresi AI pencarian serta kamus

Waktu pencatatan: **2026-11-13 07:51:41 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `0340341`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja; fungsi 0340341 aktif lokal 3087 dan HTTPS, 149 tes/build lulus. Browser lokal/online lulus untuk kartu sumber, kandidat ambigu, guru/murid, focus/Escape, pilihan teks saat tautan terlambat, regresi AI dan pencarian isi; tanpa pageerror. Hash aset dan regresi kitab/penulis/perawi sesuai. Aktivasi paket perawi lokal dan basis kecocokan nama dicatat.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-07-51-41-17cb75.json](docs/change-audit/2026-11-13-07-51-41-17cb75.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 07:51:40 +07:00 | `docs/deployment-log.md` | — | 1–11 | module/file | modified |

## [2026-11-13 08:11:22 +07:00] — Sembunyikan navigasi Kembali pada Beranda dan pertahankan konteks halaman lain

Waktu pencatatan: **2026-11-13 08:11:22 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `e5e9de9`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 7 tes navigasi/back-navigation lulus; TypeScript dan build lokal lulus; browser lokal 3087: Beranda langsung dan dengan riwayat tanpa tombol Kembali, browser back/forward berfungsi, halaman lain tetap memiliki Kembali, ponsel tanpa overflow, pembaca kembali ke Kutub Hadis, Escape pada bithaqah menjaga pembaca terbuka; tanpa pageerror. Staged whitespace bersih. Frontend saja tanpa perubahan database/backend.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-08-11-22-4f07c6.json](docs/change-audit/2026-11-13-08-11-22-4f07c6.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 08:09:51 +07:00 | `dist/assets/index.dev-nNJ5Hc0Y.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 08:09:51 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-13 08:09:37 +07:00 | `src/App.tsx` | 444–445 | 444–445 | function App() { | modified |

## [2026-11-13 08:12:15 +07:00] — Catat deployment Beranda tanpa tombol Kembali dan verifikasi navigasi online

Waktu pencatatan: **2026-11-13 08:12:15 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `9085849`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja; fungsi 9085849 aktif lokal dan HTTPS; 7 tes navigasi/build/browser lulus. Beranda tanpa Kembali pada desktop dan ponsel, halaman lain/pembaca/modal serta browser history tetap berfungsi. Frontend saja, layanan aktif tanpa restart.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-08-12-15-1e4002.json](docs/change-audit/2026-11-13-08-12-15-1e4002.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 08:12:14 +07:00 | `docs/deployment-log.md` | — | 1–7 | module/file | modified |

## [2026-11-13 08:23:51 +07:00] — Tambahkan tombol abjad Arab pada kartu penulis dengan hitungan global dan filter persisten

Waktu pencatatan: **2026-11-13 08:23:51 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `8e35bca`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 151 tes server lulus; TypeScript/build lokal lulus; browser lokal 3088 lulus jumlah 966 penulis/28 huruf, filter seluruh koleksi sebelum pagination, reset halaman, kembali profil/reload, gabungan q/abad, konsistensi linimasa, Semua mempertahankan filter lain, huruf kosong nonaktif, 320/390/768/1440 tanpa overflow/pageerror. Varian alif/hamzah dan nama asli diuji; tidak membuang awalan ال/ابن. Staged whitespace bersih; tanpa perubahan database.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-08-23-51-652f6f.json](docs/change-audit/2026-11-13-08-23-51-652f6f.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 08:19:13 +07:00 | `Buka Penulis Lokal.bat` | 16–16 | 16–16 | if not exist "node_modules\dotenv\package.json" ( | modified |
| 2026-11-13 08:20:40 +07:00 | `dist/assets/index-C_LdLGFB.css` | — | 1–2 | module/file | added |
| 2026-11-13 08:20:40 +07:00 | `dist/assets/index.dev-BVeSMuyb.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 08:20:40 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 08:23:50 +07:00 | `docs/authors.md` | 25–25 | 25–25 | Label **Kecocokan metadata** menjelaskan dasar relasinya; bukan klaim bahwa atri | modified |
| 2026-11-13 08:23:50 +07:00 | `docs/authors.md` | — | 77–89 | Pengujian browser memakai server dan database sementara: import paket lengkap, p | modified |
| 2026-11-13 08:19:13 +07:00 | `scripts/start_local.js` | — | 44–44 | if(running&&hadithMode&&!running.features?.includes('rowa-mentions-v1'))throw ne | modified |
| 2026-11-13 08:19:12 +07:00 | `server/author-initials.js` | — | 1–18 | AUTHOR_LETTERS, fold, authorInitial, letter, readAuthorInitial, authorInitialCounts, counts | added |
| 2026-11-13 08:19:12 +07:00 | `server/authors.js` | — | 4–4 | import {authorDeathDate,compareAuthorDates} from './author-chronology.js'; | modified |
| 2026-11-13 08:19:12 +07:00 | `server/authors.js` | 39–40 | 40–42 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-13 08:19:12 +07:00 | `server/authors.js` | — | 45–46 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-13 08:19:12 +07:00 | `server/authors.js` | 56–56 | 60–60 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-13 08:20:12 +07:00 | `server/authors.test.js` | — | 5–5 | import {createAuthorStore,registerAuthorTransfer} from './author-store.js';impor | modified |
| 2026-11-13 08:20:12 +07:00 | `server/authors.test.js` | — | 56–77 | test('chronology and era filters apply to the complete result before pagination' | modified |
| 2026-11-13 08:20:12 +07:00 | `server/back-navigation.test.js` | 6–6 | 6–6 | test('author profile fallback restores timeline filters and list page independen | modified |
| 2026-11-13 08:20:12 +07:00 | `server/back-navigation.test.js` | — | 8–8 | test('author profile fallback restores timeline filters and list page independen | modified |
| 2026-11-13 08:19:13 +07:00 | `server/index.js` | 370–370 | 370–370 | app.get('/api/local/status', (req, res) => { | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/AuthorTimeline.tsx` | 23–23 | 23–23 | export function AuthorTimeline({context,onOpen}:Props) { | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/AuthorTimeline.tsx` | 28–28 | 28–28 | export function AuthorTimeline({context,onOpen}:Props) { | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/AuthorTimeline.tsx` | 43–43 | 43–43 | export function AuthorTimeline({context,onOpen}:Props) { | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/Authors.tsx` | 17–17 | 17–18 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/Authors.tsx` | — | 34–34 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/Authors.tsx` | 35–37 | 37–39 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/Authors.tsx` | 41–41 | 43–44 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/Authors.tsx` | — | 80–87 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/Authors.tsx` | — | 96–96 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-13 08:19:13 +07:00 | `src/components/author-journey.css` | — | 66–69 | module/file | modified |

## [2026-11-13 08:25:51 +07:00] — Catat deployment tombol abjad penulis dan verifikasi filter global online

Waktu pencatatan: **2026-11-13 08:25:51 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `d2b602e`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Dokumentasi saja; fungsi d2b602e aktif lokal 3088 dan HTTPS, 151 tes/build/browser lulus. Jumlah global 966 dan huruf mim 98 sesuai, filter/pagination/profil/kembali/reload/abad/q serta linimasa terverifikasi, hash aset dan regresi kitab/perawi sesuai. Tanpa perubahan database.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-08-25-51-934d16.json](docs/change-audit/2026-11-13-08-25-51-934d16.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 08:25:51 +07:00 | `docs/deployment-log.md` | — | 1–8 | module/file | modified |

## [2026-11-13 08:46:45 +07:00] — Kamus Perawi: linimasa horizontal, kartu dan filter abjad global

Waktu pencatatan: **2026-11-13 08:46:45 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1d695ec`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 155 tests passed; TypeScript + production build passed; node --check passed; git diff --check passed; oxlint 0 errors (existing Fast Refresh export warning); Edge browser QA local: horizontal year-only rail, left/right load, selected-year reload, unknown-date pagination, global alphabet/reset page, search/profile context, century and mobile; reader narrator cards and author alphabet regressions passed. VPS deployment pending verification.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-08-46-45-e46224.json](docs/change-audit/2026-11-13-08-46-45-e46224.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 08:42:09 +07:00 | `Buka Kamus Perawi Lokal.bat` | — | 1–21 | module/file | added |
| 2026-11-13 08:46:12 +07:00 | `dist/assets/index-CNI-N0GB.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-C_LdLGFB.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 08:46:12 +07:00 | `dist/assets/index.dev-CCoZynYU.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 08:46:12 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 08:44:48 +07:00 | `docs/rowa-browse.md` | — | 1–23 | module/file | added |
| 2026-11-13 08:41:42 +07:00 | `scripts/start_local.js` | 23–23 | 23–24 | const hadithMode=process.argv.includes('--hadith'); | modified |
| 2026-11-13 08:41:42 +07:00 | `scripts/start_local.js` | 25–25 | 26–26 | const adminUrl=authorMode?`${base}/#/admin?view=authors_database`:`${base}/?admi | modified |
| 2026-11-13 08:41:42 +07:00 | `scripts/start_local.js` | 36–36 | 37–37 | const openWeb = () => { | modified |
| 2026-11-13 08:41:42 +07:00 | `scripts/start_local.js` | — | 44–44 | const running=await status(); | modified |
| 2026-11-13 08:37:41 +07:00 | `server/index.js` | — | 1–1 | __filename, __dirname, logPath, stripHarakat, generateWordVariations, chars, alefs, ya | modified |
| 2026-11-13 08:37:41 +07:00 | `server/index.js` | 370–370 | 371–371 | app.get('/api/local/status', (req, res) => { | modified |
| 2026-11-13 08:37:41 +07:00 | `server/index.js` | — | 699–699 | registerRowaMentions(app,()=>rowaStore.getDb()); | modified |
| 2026-11-13 08:46:00 +07:00 | `server/rowa-browse.js` | — | 1–67 | fail, rowaDeathDate, original, raw, sameOrAfter, year, match, date | added |
| 2026-11-13 08:42:09 +07:00 | `server/rowa-browse.test.js` | — | 1–11 | fixture, db, insert, date, browse, alpha, rail, selected | added |
| 2026-11-13 08:37:41 +07:00 | `src/components/RowaCards.tsx` | 9–9 | 9–9 | import {BackButton} from './BackButton'; | modified |
| 2026-11-13 08:37:41 +07:00 | `src/components/RowaCards.tsx` | — | 12–12 | export function RowaCardsProvider({children}:{children:ReactNode}) { | modified |
| 2026-11-13 08:37:41 +07:00 | `src/components/RowaCards.tsx` | 15–15 | 16–16 | export function RowaCardsProvider({children}:{children:ReactNode}) { | modified |
| 2026-11-13 08:37:41 +07:00 | `src/components/RowaCards.tsx` | 33–33 | 34–34 | export function RowaCardsProvider({children}:{children:ReactNode}) { | modified |
| 2026-11-13 08:37:41 +07:00 | `src/components/RowaCards.tsx` | 35–35 | 36–36 | export function RowaCardsProvider({children}:{children:ReactNode}) { | modified |
| 2026-11-13 08:45:33 +07:00 | `src/components/RowaDictionary.tsx` | 1–28 | 1–52 | number, RowaDictionary, openRowa, params, view, key, context, go | modified |
| 2026-11-13 08:45:33 +07:00 | `src/components/RowaDictionary.tsx` | 30–408 | 54–57 | const SkeletonCard = () => ( | modified |
| 2026-11-13 08:46:00 +07:00 | `src/components/RowaTimeline.tsx` | — | 1–28 | RowaTimeline, rail, load, controller, query, oldWidth, response, data | added |
| 2026-11-13 08:44:47 +07:00 | `src/components/rowa-browse.css` | — | 1–1 | module/file | added |

## [2026-11-13 08:48:29 +07:00] — Catatan deployment linimasa perawi dan perapian akhir launcher

Waktu pencatatan: **2026-11-13 08:48:29 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `2489659`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Feature 2489659 pushed/pulled; VPS HEAD verified; no active transfer/compact import before restart; maktabah.service active; online API counts/source verified; public Edge browser QA passed with no pageerror. BAT trailing empty line removed; staged diff --check passed. Documentation/whitespace only; no application rebuild needed.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-08-48-29-1a44bb.json](docs/change-audit/2026-11-13-08-48-29-1a44bb.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 08:47:07 +07:00 | `Buka Kamus Perawi Lokal.bat` | 21–21 | — | if errorlevel 1 ( | modified |
| 2026-11-13 08:48:29 +07:00 | `docs/rowa-browse.md` | — | 24–33 | Pemeriksaan sebelum push: `node --test server/*.test.js` (155 lulus), `npm run b | modified |

## [2026-11-13 09:05:36 +07:00] — Rumpun kategori Hasil Bahsul Masail dan Kitab Turats berdasarkan aksara nama

Waktu pencatatan: **2026-11-13 09:05:36 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b940490`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 157 tests passed; TypeScript/production build passed; staged diff --check passed; oxlint 0 errors with pre-existing Catalog hook warning. Local Edge QA: 139 categories assigned once (11 Latin,128 Arabic), unchanged API data, category 321/0 navigation, back, Latin/Arabic search and empty groups, responsive 320/390/768/1440 with no pageerror. No database/schema changes. Online deployment pending verification.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-09-05-36-c6e161.json](docs/change-audit/2026-11-13-09-05-36-c6e161.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-CNI-N0GB.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 09:03:40 +07:00 | `dist/assets/index-DEcz1-FK.css` | — | 1–2 | module/file | added |
| 2026-11-13 09:03:40 +07:00 | `dist/assets/index.dev-B0z19LR9.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 09:03:40 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 09:05:35 +07:00 | `docs/category-families.md` | — | 1–14 | module/file | added |
| 2026-11-13 09:03:29 +07:00 | `server/category-families.test.js` | — | 1–19 | categories, groups | added |
| 2026-11-13 09:03:29 +07:00 | `src/components/Catalog.tsx` | — | 7–7 | import { navigationHash, parseNavigation, routePage } from '../lib/navigation'; | modified |
| 2026-11-13 09:03:29 +07:00 | `src/components/Catalog.tsx` | — | 170–170 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-13 09:03:29 +07:00 | `src/components/Catalog.tsx` | 205–205 | 207–207 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-13 09:03:29 +07:00 | `src/components/Catalog.tsx` | 263–264 | 265–275 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-13 09:03:29 +07:00 | `src/components/Catalog.tsx` | 273–273 | 284–284 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-13 09:03:29 +07:00 | `src/components/Catalog.tsx` | — | 289–290 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-13 09:02:59 +07:00 | `src/lib/category-families.ts` | — | 1–20 | categoryFamily, letters, arabic, latin, groupCategoryFamilies | added |

## [2026-11-13 09:07:19 +07:00] — Verifikasi deployment rumpun kategori lokal dan online

Waktu pencatatan: **2026-11-13 09:07:19 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b6f69d3`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Feature b6f69d3 pushed/pulled on VPS; service active without restart (frontend only); served JS/CSS verified; public Edge QA passed, no pageerror, API data unchanged. Online dataset 138 categories (11/127), local 139 (11/128); initial equal-count assertion corrected to actual per-environment data. Documentation only; staged diff check passed.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-09-07-19-777b24.json](docs/change-audit/2026-11-13-09-07-19-777b24.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 09:07:18 +07:00 | `docs/category-families.md` | — | 15–22 | Verifikasi lokal: 157 tes otomatis lulus; TypeScript dan build produksi lulus; o | modified |

## [2026-11-13 09:57:02 +07:00] — Label Masa Percobaan yang jelas pada judul Tanya AI

Waktu pencatatan: **2026-11-13 09:57:02 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `069a1b1`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: TypeScript and production build passed; 20 existing AI/history/session tests passed; Edge local QA at 320/390/768/1440px: trial label and heading visible, no page overflow or pageerror, no AI question submitted. Staged diff --check passed. Header-only UI change; no database/backend change.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-09-57-02-516447.json](docs/change-audit/2026-11-13-09-57-02-516447.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 09:56:14 +07:00 | `dist/assets/index-BVWVepuA.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DEcz1-FK.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 09:56:14 +07:00 | `dist/assets/index.dev-B0S5CQb4.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 09:56:14 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 09:56:03 +07:00 | `src/components/AskAI.tsx` | 121–122 | 121–125 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |

## [2026-11-13 10:17:40 +07:00] — Tanya AI: relevansi sumber, pemeriksaan klaim dan konteks pertanyaan lanjutan

Waktu pencatatan: **2026-11-13 10:17:40 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `38a0744`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 164 full-suite tests passed; 24 targeted AI/relevance tests passed after final source-context check; TypeScript/production build, node syntax and staged diff checks passed. Edge local QA: user-question-only context, reload, new-chat reset and mobile; reader inline-AI regression passed using mocked provider, no pageerror. Regression covers witir vs tarawih, customary count vs preferred ruling, negative/malformed semantic verdicts, context-aware cache/history and citation compaction. Real provider/online verification follows deployment.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-10-17-40-a8326b.json](docs/change-audit/2026-11-13-10-17-40-a8326b.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 10:15:30 +07:00 | `dist/assets/index.dev-8SvpTZYz.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 10:15:30 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-13 10:16:40 +07:00 | `docs/ai-improvements.md` | — | 49–64 | Renderer Markdown dipakai bersama dengan Tanya AI dan melakukan escape HTML sebe | modified |
| 2026-11-13 10:13:44 +07:00 | `server/ai-relevance.js` | — | 1–37 | topics, normalizedTopicText, tokens, questionTopics, words, topicSearchConstraint, matchesQuestionTopic, sourceWords | added |
| 2026-11-13 10:10:25 +07:00 | `server/ai-relevance.test.js` | — | 1–21 | module/file | added |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | — | 2–2 | import {conversationalReply} from './ai-conversation.js'; | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 26–26 | 27–27 | export function readAiConfig(filename, env = process.env) { | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 37–37 | 38–38 | export async function generateGemini({ keys, model }, prompt, { fetchImpl = fetc | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 69–69 | 70–70 | export async function generateGemini({ keys, model }, prompt, { fetchImpl = fetc | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | — | 72–72 | export function retrieveAiReferences(db, question, additional = false, catalogue | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 80–82 | 82–85 | export function retrieveAiReferences(db, question, additional = false, catalogue | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | — | 142–142 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 153–154 | 157–160 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 156–156 | 162–162 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 177–178 | 183–184 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 180–181 | 186–187 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 183–183 | 189–190 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 198–198 | 205–205 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 200–200 | 207–207 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 202–202 | 209–221 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 205–209 | 224–226 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:17:38 +07:00 | `server/ask-ai.js` | 212–213 | 229–230 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:15:19 +07:00 | `server/ask-ai.test.js` | 29–30 | 29–32 | async function serve(t,f,fetchImpl,extras={}) { | modified |
| 2026-11-13 10:15:19 +07:00 | `server/ask-ai.test.js` | 159–159 | 161–161 | test('selected page is loaded from database, contextual history/cache stay separ | modified |
| 2026-11-13 10:15:19 +07:00 | `server/ask-ai.test.js` | 161–161 | 163–163 | test('unverified prose is suppressed in favor of original source quotes without | modified |
| 2026-11-13 10:15:19 +07:00 | `server/ask-ai.test.js` | 167–167 | 169–169 | test('unverified prose is suppressed in favor of original source quotes without | modified |
| 2026-11-13 10:15:19 +07:00 | `server/ask-ai.test.js` | 174–174 | 176–176 | test('stream reports actual retrieval/generation/verification, cached branch ski | modified |
| 2026-11-13 10:15:19 +07:00 | `server/ask-ai.test.js` | — | 228–271 | test('reported Arabic poem resolves original quote IDs despite Latin translitera | modified |
| 2026-11-13 10:14:38 +07:00 | `src/App.tsx` | 448–448 | 448–448 | function App() { | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | 15–15 | 15–15 | interface Message { | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | — | 21–22 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | — | 75–75 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | 81–81 | 84–84 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | 87–87 | 90–90 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | 92–92 | 95–95 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | 105–106 | 108–109 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-13 10:14:38 +07:00 | `src/components/AskAI.tsx` | 218–218 | 221–221 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-13 10:07:42 +07:00 | `src/lib/ai-source.ts` | 3–3 | 3–3 | export type AiIntent='explain'\|'translate'; | modified |

## [2026-11-13 10:21:23 +07:00] — Ringankan pemeriksaan makna AI dengan sumber terpakai dan anggaran waktu bersama

Waktu pencatatan: **2026-11-13 10:21:23 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `08e76d8`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 24 targeted tests passed including reviewer receiving only cited source IDs; node syntax and staged diff passed. Full suite 164 and UI production build previously passed for 08e76d8; frontend unchanged in this follow-up. VPS 08e76d8 active and public context QA passed. First real witir request hit semantic-review timeout without releasing unverified prose; reviewer input reduced, stage maximum35s bounded by shared80s request budget. Screenshot domain verified as iframe wrapper for maktab.my.id.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-10-21-23-b49876.json](docs/change-audit/2026-11-13-10-21-23-b49876.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 10:21:22 +07:00 | `docs/ai-improvements.md` | — | 65–72 | Verifikasi: 164 tes otomatis, TypeScript/build produksi, sintaks dan diff; regre | modified |
| 2026-11-13 10:20:32 +07:00 | `server/ask-ai.js` | — | 169–170 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:20:32 +07:00 | `server/ask-ai.js` | 186–186 | 188–188 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:20:32 +07:00 | `server/ask-ai.js` | 205–205 | 207–207 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:20:32 +07:00 | `server/ask-ai.js` | 212–214 | — | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:20:32 +07:00 | `server/ask-ai.js` | — | 216–218 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 10:21:21 +07:00 | `server/ask-ai.test.js` | 268–268 | 268–268 | test('only cited evidence remains visible and its citation numbers stay valid af | modified |
