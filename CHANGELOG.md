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

## [2026-11-13 10:29:36 +07:00] — Catat verifikasi nyata perbaikan konteks dan relevansi Tanya AI

Waktu pencatatan: **2026-11-13 10:29:36 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `ab98f6d`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: VPS ab98f6d active after push/pull and safe restart; final full suite 164 passed; public context/browser QA passed; wrapper iframe target verified. Real witir query: no_context in ~4s, no fallback references/evidence. Real selected-page translation: success/grounded/reviewed in2.824s, matching canonical source and one reference. Earlier reviewer TIMEOUT attempts documented without claiming guaranteed zero errors. Documentation-only change; staged diff passed.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-10-29-36-0db307.json](docs/change-audit/2026-11-13-10-29-36-0db307.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 10:29:36 +07:00 | `docs/ai-improvements.md` | — | 73–82 | Domain `maktabah.quizb.my.id` menyajikan pembungkus iframe dengan src `https://m | modified |

## [2026-11-13 16:29:20 +07:00] — Admin Log Tanya AI: detail pertanyaan, jawaban, dan rujukan yang dapat diklik

Waktu pencatatan: **2026-11-13 16:29:20 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `fda5569`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/ai-history.js & server/ask-ai.js OK; node --test server/*.test.js 165/165 lulus (termasuk tes baru meta_json audit); oxlint tanpa error baru; npm run build (tsc -b + vite) sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-16-29-20-e48972.json](docs/change-audit/2026-11-13-16-29-20-e48972.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BVWVepuA.css` | 1–2 | — | module/file | deleted |
| 2026-11-13 16:28:22 +07:00 | `dist/assets/index-DZ1745-4.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-8SvpTZYz.js` | 1–17 | — | module/file | deleted |
| 2026-11-13 16:28:22 +07:00 | `dist/assets/index.dev-BkuRGvqy.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 16:28:22 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-13 16:26:42 +07:00 | `server/ai-history.js` | — | 5–14 | const SESSION=Symbol('ai-browser-session'); | modified |
| 2026-11-13 16:26:42 +07:00 | `server/ai-history.js` | — | 20–20 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-13 16:26:42 +07:00 | `server/ai-history.js` | 23–24 | 34–35 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-13 16:27:43 +07:00 | `server/ai-history.test.js` | — | 24–40 | test('two browsers on the same IP have isolated history; legacy rows remain admi | modified |
| 2026-11-13 16:26:46 +07:00 | `server/ask-ai.js` | 162–162 | 162–162 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 16:26:46 +07:00 | `server/ask-ai.js` | 180–180 | 180–180 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 16:26:46 +07:00 | `server/ask-ai.js` | 234–234 | 234–234 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-13 16:27:32 +07:00 | `src/components/Admin.tsx` | — | 14–14 | import { StorageCleanup } from './StorageCleanup'; | modified |
| 2026-11-13 16:27:32 +07:00 | `src/components/Admin.tsx` | — | 1086–1086 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-13 16:27:32 +07:00 | `src/components/Admin.tsx` | 1190–1190 | 1192–1195 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-13 16:27:32 +07:00 | `src/components/Admin.tsx` | 1225–1226 | 1230–1232 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-13 16:27:32 +07:00 | `src/components/Admin.tsx` | — | 1248–1248 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-13 16:27:32 +07:00 | `src/components/AskLogDetail.tsx` | — | 1–90 | parse, v, formatLogTime, d, AskLogDetail, ref, meta, context | added |

## [2026-11-13 18:22:26 +07:00] — Tampilkan seluruh rujukan pada detail log Tanya AI

Waktu pencatatan: **2026-11-13 18:22:26 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b551976`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/ai-history.js lulus; node --test server/ai-history.test.js 2/2 lulus; npm run build (TypeScript dan Vite) sukses; git diff --check lulus

Audit terstruktur beserta hash isi staged dan diff: [2026-11-13-18-22-26-dd5be5.json](docs/change-audit/2026-11-13-18-22-26-dd5be5.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-13 18:21:57 +07:00 | `dist/assets/index.dev-IDAKDhOu.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-13 18:21:57 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-13 18:21:32 +07:00 | `server/ai-history.js` | 5–5 | — | const SESSION=Symbol('ai-browser-session'); | modified |
| 2026-11-13 18:21:32 +07:00 | `server/ai-history.js` | 11–12 | 10–11 | export function auditMeta(payload={}) { | modified |
| 2026-11-13 18:21:32 +07:00 | `server/ai-history.test.js` | 25–25 | 25–25 | test('two browsers on the same IP have isolated history; legacy rows remain admi | modified |
| 2026-11-13 18:21:32 +07:00 | `server/ai-history.test.js` | 31–31 | 31–33 | test('admin audit metadata stores mode, cited sources and quotes for later answe | modified |
| 2026-11-13 18:21:32 +07:00 | `server/ai-history.test.js` | 37–38 | 39–41 | test('admin audit metadata stores mode, cited sources and quotes for later answe | modified |
| 2026-11-13 18:21:32 +07:00 | `src/components/AskLogDetail.tsx` | 67–67 | 67–67 | export function AskLogDetail({ row, onClose }: { row: AskLogRow; onClose: () => | modified |
| 2026-11-13 18:21:32 +07:00 | `src/components/AskLogDetail.tsx` | 69–69 | 69–69 | export function AskLogDetail({ row, onClose }: { row: AskLogRow; onClose: () => | modified |
| 2026-11-13 18:21:32 +07:00 | `src/components/AskLogDetail.tsx` | 76–77 | 76–77 | export function AskLogDetail({ row, onClose }: { row: AskLogRow; onClose: () => | modified |

## [2026-11-14 21:00:59 +07:00] — Hapus redirect Tanya AI berdasarkan jumlah kata; pertahankan kata/frasa pemicu dan tanda tanya

Waktu pencatatan: **2026-11-14 21:00:59 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `f6c7856`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 14 tes detector/navigasi/back-navigation; node --check server/ai-query-detector.test.js; npm run build (TypeScript dan Vite); diff ditinjau dan git diff --cached --check. Build memberi peringatan konfigurasi Vite dan ukuran bundle, tanpa error. Deployment belum dilakukan: SSH ubuntu@43.173.50.61 menolak autentikasi kunci (Permission denied publickey,password); HEAD server dan perilaku online versi baru belum terverifikasi.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-14-21-00-59-09b93e.json](docs/change-audit/2026-11-14-21-00-59-09b93e.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-14 21:00:02 +07:00 | `dist/assets/index.dev-CDY5dfig.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-14 21:00:02 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-14 20:59:13 +07:00 | `server/ai-query-detector.test.js` | 63–67 | 63–77 | test('detectAiQuery detects Arabic question particles and phrases', () => { | modified |
| 2026-11-14 20:59:13 +07:00 | `server/ai-query-detector.test.js` | 69–72 | 79–91 | test('detectAiQuery detects long conversational sentences (word count >= 6 or 5 | modified |
| 2026-11-14 20:59:13 +07:00 | `src/lib/ai-query-detector.ts` | 3–3 | 3–3 | export interface AiQueryDetectionResult { | modified |
| 2026-11-14 20:59:13 +07:00 | `src/lib/ai-query-detector.ts` | 52–58 | — | const ARABIC_QUESTION_PHRASES = [ | modified |
| 2026-11-14 20:59:13 +07:00 | `src/lib/ai-query-detector.ts` | 74–75 | 67–68 | export function normalizeQueryForDetection(text: string): string { | modified |
| 2026-11-14 20:59:13 +07:00 | `src/lib/ai-query-detector.ts` | 152–176 | — | export function detectAiQuery(rawQuery: string): AiQueryDetectionResult { | modified |

## [2026-11-14 21:14:56 +07:00] — Saran kata terverifikasi pada hasil pencarian kosong

Waktu pencatatan: **2026-11-14 21:14:56 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `e7a453f`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 47 tes search-suggestions/ask-ai/ai-query-detector/ai-errors/navigation/back-navigation; node --check server/index.js dan server/search-suggestions.js; oxlint modul/test/komponen baru; TypeScript dan build produksi lokal; diff dan staged whitespace. Browser Chrome headless 1440/390 px dengan respons terkendali: tombol saran mencari literal tanpa redirect AI, mode/kategori tetap, hasil positif menyembunyikan saran, kegagalan endpoint saran tetap menampilkan hasil kosong dan tombol Tanya AI, tanpa pageerror/overflow. Data nyata lokal: typo الفقخ memprioritaskan الفقه; endpoint judul memastikan hasil tersedia (847 untuk الفقه). AI diuji memakai provider tiruan; tidak mengklaim uji provider nyata. Build memberi peringatan Vite konfigurasi/ukuran bundle tanpa error. SSH deployment ubuntu@43.173.50.61 menolak autentikasi kunci (Permission denied publickey,password); pull, HEAD server, restart dan fungsi online versi baru belum terverifikasi. Build/install tidak dijalankan di hosting; database dan rahasia tidak di-stage.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-14-21-14-56-bd59e0.json](docs/change-audit/2026-11-14-21-14-56-bd59e0.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-14 21:12:54 +07:00 | `dist/assets/index-CZxWudRA.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DZ1745-4.css` | 1–2 | — | module/file | deleted |
| 2026-11-14 21:12:54 +07:00 | `dist/assets/index.dev-CuIoOxSu.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-14 21:12:54 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-14 21:13:52 +07:00 | `docs/search-suggestions.md` | — | 1–11 | module/file | added |
| 2026-11-14 21:07:42 +07:00 | `server/index.js` | — | 22–22 | import { registerAskAi } from './ask-ai.js'; | modified |
| 2026-11-14 21:07:42 +07:00 | `server/index.js` | — | 1476–1479 | app.get('/api/toc/:bookId', (req, res) => { | modified |
| 2026-11-14 21:12:32 +07:00 | `server/search-suggestions.js` | — | 1–148 | normalizeSuggestion, wordDistance, rows, row, textMatch, words, options, hasSuggestionResults | added |
| 2026-11-14 21:12:32 +07:00 | `server/search-suggestions.test.js` | — | 1–119 | key, response, likeMatch, fixture, db, app, server, request | added |
| 2026-11-14 21:12:09 +07:00 | `src/App.tsx` | — | 21–21 | import { detectAiQuery } from './lib/ai-query-detector'; | modified |
| 2026-11-14 21:12:09 +07:00 | `src/App.tsx` | — | 856–857 | function App() { | modified |
| 2026-11-14 21:07:42 +07:00 | `src/api.ts` | — | 58–59 | export const webAPI = { | modified |
| 2026-11-14 21:07:42 +07:00 | `src/components/SearchSuggestions.tsx` | — | 1–28 | SearchSuggestions, categoryKey, controller | added |

## [2026-11-14 22:08:22 +07:00] — Log aktivitas Kutub Hadis dan Penulis & Karya pada admin

Waktu pencatatan: **2026-11-14 22:08:22 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `6bb2fb7`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 50 tes library-activity/hadith-search/hadith-books/authors/admin-navigation/admin-loader/navigation/back-navigation/search-suggestions/ai-query-detector; node --check server/index.js, server/authors.js, server/hadith-search.js, server/library-activity.js; oxlint file modul/test/hook/komponen log baru; TypeScript dan build produksi lokal; diff ditinjau dan staged whitespace lulus. Browser Chrome headless dengan server lengkap serta database/paket penulis sintetis sementara: perekaman katalog/filter/edisi/detail/pembaca/pencarian isi/profil/linimasa/tahun; akses log tanpa admin 401; statistik dashboard dan log; filter teks/jenis; pagination; CSV menjaga hasil nol; 1440 dan 390 piksel tanpa overflow halaman/pageerror. Tema green/sepia/dark diperiksa, termasuk kontras input dan screenshot akhir. Riwayat sumber tidak direkonstruksi, tidak mengubah/import dataset produksi. Build hanya memberi peringatan konfigurasi Vite dan ukuran bundle tanpa error. SSH ubuntu@43.173.50.61 menolak autentikasi kunci (Permission denied publickey,password); pull/HEAD server/restart dan fungsi online versi baru belum terverifikasi; tidak menghentikan transfer atau menjalankan install/build di hosting.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-14-22-08-22-1585b7.json](docs/change-audit/2026-11-14-22-08-22-1585b7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-CZxWudRA.css` | 1–2 | — | module/file | deleted |
| 2026-11-14 22:07:00 +07:00 | `dist/assets/index-DlP13NX6.css` | — | 1–2 | module/file | added |
| 2026-11-14 22:07:00 +07:00 | `dist/assets/index.dev-Br7rxYnW.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-14 22:07:00 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-14 22:07:01 +07:00 | `dist/privacy-policy.html` | 18–18 | 18–18 | a{color:#047857;overflow-wrap:anywhere} | modified |
| 2026-11-14 22:07:01 +07:00 | `dist/privacy-policy/index.html` | 18–18 | 18–18 | a{color:#047857;overflow-wrap:anywhere} | modified |
| 2026-11-14 22:04:38 +07:00 | `docs/library-activity.md` | — | 1–24 | module/file | added |
| 2026-11-14 21:58:19 +07:00 | `server/admin-navigation.test.js` | — | 18–18 | test('admin routes restore nested entities and all menu views belong to exactly | modified |
| 2026-11-14 21:56:32 +07:00 | `server/authors.js` | 113–115 | 113–122 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-14 21:56:32 +07:00 | `server/authors.js` | 117–117 | 124–124 | export function registerAuthors(app,{service,requireAdmin}) { | modified |
| 2026-11-14 21:53:58 +07:00 | `server/hadith-search.js` | 4–4 | 4–4 | import {activeHadithIndex} from './hadith-search-core.js'; | modified |
| 2026-11-14 21:53:58 +07:00 | `server/hadith-search.js` | — | 31–32 | export function registerHadithSearch(app,{getPaths,isBusy=()=>false,directory}) | modified |
| 2026-11-14 21:58:19 +07:00 | `server/hadith-search.test.js` | 54–54 | 54–54 | test('HTTP worker endpoint searches real fixture text and rejects maintenance an | modified |
| 2026-11-14 21:58:19 +07:00 | `server/hadith-search.test.js` | — | 59–60 | test('HTTP worker endpoint searches real fixture text and rejects maintenance an | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | — | 23–23 | import { registerSearchSuggestions } from './search-suggestions.js'; | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | — | 149–149 | app.use((req, res, next) => { | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | — | 349–353 | function booksMeta() { | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | — | 579–580 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | — | 598–599 | app.get('/api/admin/logs/:type', requireAdmin, (req, res) => { | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | 702–702 | 713–713 | const authorStore=createAuthorStore(path.resolve(process.env.AUTHOR_DATABASE_DIR | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | 704–704 | 715–715 | registerHadithBooks(app,()=>{if(!db)throw Error('Database unavailable');return d | modified |
| 2026-11-14 21:59:25 +07:00 | `server/index.js` | 706–706 | 717–717 | registerAuthorTransfer(app,{store:authorStore,requireAdmin}); | modified |
| 2026-11-14 22:02:20 +07:00 | `server/library-activity.js` | — | 1–79 | libraryLogTables, actions, contextKeys, text, sanitizeLibraryActivity, context, value, createLibraryActivity | added |
| 2026-11-14 21:59:24 +07:00 | `server/library-activity.test.js` | — | 1–92 | fixture, db, activity, app, service, server, request, r | added |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | — | 15–15 | import { AskLogDetail } from './AskLogDetail'; | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 33–33 | 34–34 | const downloadCSV = (data: any[], filename: string) => { | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 90–91 | 91–92 | const Pagination = ({ page, total, limit, onChange, loading, onLimitChange }: an | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | — | 1068–1071 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | — | 1097–1097 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | — | 1101–1101 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 1114–1114 | 1121–1122 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 1142–1142 | 1150–1152 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | — | 1185–1197 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 1190–1190 | 1213–1213 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 1198–1198 | 1221–1221 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | — | 1251–1251 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 1247–1247 | 1271–1271 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | 1349–1349 | 1373–1373 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Admin.tsx` | — | 1434–1435 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-14 21:56:33 +07:00 | `src/components/AuthorTimeline.tsx` | — | 2–2 | import {useEffect,useRef,useState} from 'react'; | modified |
| 2026-11-14 21:56:33 +07:00 | `src/components/AuthorTimeline.tsx` | 48–48 | 49–49 | export function AuthorTimeline({context,onOpen}:Props) { | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Authors.tsx` | — | 2–2 | import {useEffect,useState} from 'react'; | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Authors.tsx` | 32–32 | 33–33 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Authors.tsx` | 35–35 | 36–36 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Authors.tsx` | — | 52–53 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-14 22:06:46 +07:00 | `src/components/Authors.tsx` | 103–103 | 106–106 | export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook | modified |
| 2026-11-14 21:59:24 +07:00 | `src/components/HadithBooks.tsx` | — | 2–2 | import {HadithTextSearch} from './HadithTextSearch'; | modified |
| 2026-11-14 21:59:24 +07:00 | `src/components/HadithBooks.tsx` | — | 33–36 | export function HadithBooks({openBook,readBook}:{openBook:(id:number)=>void;read | modified |
| 2026-11-14 21:59:24 +07:00 | `src/components/HadithBooks.tsx` | 56–56 | 61–61 | export function HadithBooks({openBook,readBook}:{openBook:(id:number)=>void;read | modified |
| 2026-11-14 21:55:27 +07:00 | `src/components/HadithTextSearch.tsx` | — | 2–2 | import {RowaLinkedText,escapeRowaHtml} from './RowaLinkedText'; | modified |
| 2026-11-14 21:55:27 +07:00 | `src/components/HadithTextSearch.tsx` | 33–33 | 34–34 | export function HadithTextSearch({q,group,source,edition,matching,page,onPage,re | modified |
| 2026-11-14 21:56:32 +07:00 | `src/components/LibraryLogData.tsx` | — | 1–19 | LibraryLogData, parsed | added |
| 2026-11-14 21:55:26 +07:00 | `src/components/Privacy.tsx` | 4–4 | 4–4 | const Privacy: React.FC = () => { | modified |
| 2026-11-14 21:55:26 +07:00 | `src/components/Privacy.tsx` | — | 27–27 | const Privacy: React.FC = () => { | modified |
| 2026-11-14 21:55:27 +07:00 | `src/lib/admin-navigation.ts` | 1–1 | 1–1 | adminParent, adminTitle, adminGroup, adminLocation, p, raw, id, v | modified |
| 2026-11-14 21:55:27 +07:00 | `src/lib/admin-navigation.ts` | 8–8 | 8–8 | const parents: Record<AdminView, AdminView> = { | modified |
| 2026-11-14 21:55:27 +07:00 | `src/lib/admin-navigation.ts` | 15–15 | 15–15 | const titles: Record<AdminView,string> = { | modified |
| 2026-11-14 21:55:27 +07:00 | `src/lib/admin-navigation.ts` | 21–21 | 21–21 | export const adminGroups: {label:string;views:AdminView[]}[] = [ | modified |
| 2026-11-14 21:55:26 +07:00 | `src/lib/library-activity.ts` | — | 1–22 | recordLibraryActivity, useCatalogueActivity, serialized, timer | added |

## [2026-11-14 22:27:20 +07:00] — Kecualikan seluruh kitab dari rujukan AI berdasarkan nama pada halaman mana pun

Waktu pencatatan: **2026-11-14 22:27:20 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `c4c6b0a`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 48 tes ai-book-policy/ask-ai/ai-evidence/ai-source/ai-relevance/ai-errors/ai-history/ai-stream/ai-conversation; node --check server/index.js, server/ask-ai.js, server/ai-book-policy.js, server/ai-book-policy-worker.js; oxlint modul/worker/tes kebijakan; npx tsc -b; diff ditinjau dan staged whitespace lulus. Verifikasi mencakup empat nama, harakat/tatweel/alif/HTML/spasi, pemicu pada halaman lain, seluruh kitab/katalog, dua database dan ID lintas sumber, penjelasan/terjemahan pembaca HTTP 403, namespace cache lama dan validasi cache baru, mutasi saat generasi/review, pencarian kandidat pengganti, pembatalan dan kegagalan storage. Worker SQLite file hanya-baca dibuktikan hash sumber tidak berubah; perubahan koneksi eksternal terdeteksi. HTTP fixture file-backed melalui worker lulus dan status menyediakan sourcePolicyVersion. Provider tiruan, tanpa perubahan dataset produksi atau klaim uji provider nyata. Hanya backend/tes/dokumentasi; aset frontend tidak berubah sehingga build frontend tidak diperlukan. SSH ubuntu@43.173.50.61 menolak autentikasi kunci (Permission denied publickey,password); pull/HEAD server/restart/fungsi online versi baru belum terverifikasi. Tidak menjalankan install/build di hosting atau menghentikan transfer.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-14-22-27-20-dd97d2.json](docs/change-audit/2026-11-14-22-27-20-dd97d2.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-14 22:26:49 +07:00 | `docs/ai-book-policy.md` | — | 1–29 | module/file | added |
| 2026-11-14 22:18:42 +07:00 | `server/ai-book-policy-worker.js` | — | 1–19 | excluded | added |
| 2026-11-14 22:21:37 +07:00 | `server/ai-book-policy.js` | — | 1–102 | AI_BOOK_POLICY_VERSION, excludedAiNames, patterns, normalizePolicyText, containsExcludedAiName, normalized, fault, unavailable | added |
| 2026-11-14 22:24:04 +07:00 | `server/ai-book-policy.test.js` | — | 1–80 | fixture, db, put, refs, dir, hash, before, other | added |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | — | 9–9 | import crypto from 'node:crypto'; | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 70–70 | 71–71 | export async function generateGemini({ keys, model }, prompt, { fetchImpl = fetc | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | — | 76–76 | export function retrieveAiReferences(db, question, additional = false, catalogue | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 81–82 | 83–84 | export function retrieveAiReferences(db, question, additional = false, catalogue | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 97–97 | 99–99 | export function retrieveAiReferences(db, question, additional = false, catalogue | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 113–113 | 115–115 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 149–149 | 151–151 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 160–160 | 162–162 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 162–162 | 164–171 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 185–185 | 194–206 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | 191–191 | 212–212 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | — | 218–219 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | — | 233–234 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.js` | — | 256–258 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.test.js` | — | 9–11 | import { readAiConfig, generateGemini, retrieveAiReferences, registerAskAi } fro | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.test.js` | 13–13 | 16–16 | const response = text => new Response(JSON.stringify({ candidates:[{content:{par | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.test.js` | 17–17 | 20–20 | function fixture(t) { | modified |
| 2026-11-14 22:26:43 +07:00 | `server/ask-ai.test.js` | — | 275–342 | test('only cited evidence remains visible and its citation numbers stay valid af | modified |
| 2026-11-14 22:17:38 +07:00 | `server/index.js` | — | 24–24 | import {createLibraryActivity,registerLibraryActivity} from './library-activity. | modified |
| 2026-11-14 22:17:38 +07:00 | `server/index.js` | 193–193 | 194–194 | let invalidateHadithIndex=()=>{}; | modified |
| 2026-11-14 22:17:38 +07:00 | `server/index.js` | — | 775–775 | app.put('/api/admin/page/:bookId/:pageId', requireAdmin, (req, res) => { | modified |
| 2026-11-14 22:17:38 +07:00 | `server/index.js` | — | 787–787 | app.delete('/api/admin/page/:bookId/:pageId', requireAdmin, (req, res) => { | modified |

## [2026-11-14 23:24:12 +07:00] — Tanya AI: pencarian rujukan cepat di worker dan jatah waktu terpisah

Waktu pencatatan: **2026-11-14 23:24:12 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4511b53`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 197 tes server lulus (termasuk 4 tes baru: worker off-thread, timeout pencarian, pemilihan kandidat, snippet per halaman); node --check dan oxlint lulus; frontend tidak berubah sehingga build tidak diperlukan. Uji DB lokal الشافعي: query lama 91.217 ms, jalur baru 2.548 ms di worker tanpa memblokir event loop.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-14-23-24-12-9ca507.json](docs/change-audit/2026-11-14-23-24-12-9ca507.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-14 23:19:23 +07:00 | `server/ai-retrieval-worker.js` | — | 1–13 | module/file | added |
| 2026-11-14 23:24:04 +07:00 | `server/ai-retrieval.js` | — | 1–101 | AI_CANDIDATE_LIMIT, AI_RETRIEVAL_TIMEOUT, clean, ignored, searchTerms, fault, searchTimeout, searchUnavailable | added |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | 2–2 | 2–2 | import {conversationalReply} from './ai-conversation.js'; | modified |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | — | 10–11 | import {AI_BOOK_POLICY_VERSION,filterAllowedAiReferences,assertAllowedAiBook} fr | modified |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | 15–17 | — | const fault = (message, code = 'AI_ERROR', status = 502) => Object.assign(new Er | modified |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | 71–106 | — | export async function generateGemini({ keys, model }, prompt, { fetchImpl = fetc | modified |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | — | 142–142 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | — | 144–144 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | — | 160–163 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:20:52 +07:00 | `server/ask-ai.js` | 198–199 | 167–168 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:21:18 +07:00 | `server/ask-ai.test.js` | — | 9–9 | import { readAiConfig, generateGemini, retrieveAiReferences, registerAskAi } fro | modified |
| 2026-11-14 23:21:18 +07:00 | `server/ask-ai.test.js` | — | 344–376 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |

## [2026-11-14 23:26:46 +07:00] — Catatan deployment perbaikan timeout Tanya AI

Waktu pencatatan: **2026-11-14 23:26:46 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `5e8dd22`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Uji HTTPS online sesudah deploy: من هو الشافعي 6,6 s HTTP 200 tanpa timeout; حكم صلاة الجماعة 4,0 s; siapa guru imam syafii 9,6 s grounded.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-14-23-26-46-a9ba53.json](docs/change-audit/2026-11-14-23-26-46-a9ba53.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-14 23:26:45 +07:00 | `docs/deployment-log.md` | — | 1–9 | module/file | modified |

## [2026-11-14 23:38:02 +07:00] — Tanya AI: kualitas rujukan dan alasan penolakan reviewer

Waktu pencatatan: **2026-11-14 23:38:02 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `5845344`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 200 tes server lulus (tes baru: kualitas halaman/daftar isi/encoding, passage, kata aspek, log penolakan reviewer); TypeScript dan build produksi lulus; oxlint tanpa error. Uji DB lokal: daftar isi dan halaman OCR rusak tidak lagi terpilih; حكم صلاة الجماعة memunculkan halaman 'حكم صلاة الجماعة في المسجد'; من هو الشافعي memunculkan halaman biografi Imam asy-Syafi'i. Jawaban Gemini belum diuji lokal (API key hanya di server).

Audit terstruktur beserta hash isi staged dan diff: [2026-11-14-23-38-02-aa908a.json](docs/change-audit/2026-11-14-23-38-02-aa908a.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-14 23:35:46 +07:00 | `dist/assets/index.dev-CdbXY2HS.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-14 23:35:46 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-14 23:34:03 +07:00 | `server/ai-history.js` | — | 12–14 | export function auditMeta(payload={}) { | modified |
| 2026-11-14 23:34:03 +07:00 | `server/ai-relevance.js` | 35–36 | 35–41 | export const reviewSystem='Anda pemeriksa relevansi dan dukungan jawaban, bukan | modified |
| 2026-11-14 23:34:03 +07:00 | `server/ai-relevance.js` | — | 43–43 | export function readRelevanceReview(text) { | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | — | 3–3 | import {matchesQuestionTopic,topicSearchConstraint} from './ai-relevance.js'; | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | 4–4 | 5–5 | import {matchesQuestionTopic,topicSearchConstraint} from './ai-relevance.js'; | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | — | 9–9 | export const AI_RETRIEVAL_TIMEOUT = 20000; | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | — | 17–63 | const searchUnavailable = () => fault('Pencarian rujukan kitab belum dapat disel | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | 20–32 | 69–81 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | 34–37 | 83–90 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | 39–40 | — | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | 42–43 | 93–103 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | 46–46 | 106–106 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-14 23:37:10 +07:00 | `server/ai-retrieval.js` | 51–51 | 111–111 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | 2–2 | 2–2 | import {conversationalReply} from './ai-conversation.js'; | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | 184–184 | 184–186 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | 191–191 | 193–193 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | 207–207 | 209–209 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | 209–209 | 211–211 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | 212–212 | 214–215 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | — | 223–223 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:33:50 +07:00 | `server/ask-ai.js` | 231–231 | 235–235 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-14 23:37:11 +07:00 | `server/ask-ai.test.js` | 9–9 | 9–9 | import { readAiConfig, generateGemini, retrieveAiReferences, registerAskAi } fro | modified |
| 2026-11-14 23:37:11 +07:00 | `server/ask-ai.test.js` | — | 377–404 | test('each ranked page keeps its own snippet',t=>{ | modified |
| 2026-11-14 23:34:16 +07:00 | `src/components/AskLogDetail.tsx` | 7–7 | 7–11 | type AuditReference = { bkid?: number \| null; pageId?: number \| null; title?: st | modified |
| 2026-11-14 23:34:16 +07:00 | `src/components/AskLogDetail.tsx` | — | 70–90 | export function AskLogDetail({ row, onClose }: { row: AskLogRow; onClose: () => | modified |

## [2026-11-15 04:33:34 +07:00] — Catat uji online kualitas rujukan Tanya AI

Waktu pencatatan: **2026-11-15 04:33:34 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1516583`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Uji HTTPS: حكم صلاة الجماعة grounded 6,0 s; من هو الشافعي 2,2 s dan siapa guru imam syafii 4,8 s no_context tanpa timeout; aset online sama dengan build 1516583

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-04-33-34-6e69d5.json](docs/change-audit/2026-11-15-04-33-34-6e69d5.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 04:33:25 +07:00 | `docs/deployment-log.md` | — | 1–8 | module/file | modified |

## [2026-11-15 04:41:29 +07:00] — Tanya AI: biografi imam lewat nama lengkap

Waktu pencatatan: **2026-11-15 04:41:29 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `6eb8cbf`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 209 tes server lulus (37 tes Tanya AI, termasuk tes biografi baru); oxlint bersih; DB lokal: من هو الشافعي dan siapa guru imam syafii kini memunculkan entri محمد بن إدريس الشافعي, 3-4 s

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-04-41-29-a5caae.json](docs/change-audit/2026-11-15-04-41-29-a5caae.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 04:36:46 +07:00 | `server/ai-retrieval.js` | 21–21 | 21–22 | const ASPECTS = [ | modified |
| 2026-11-15 04:36:46 +07:00 | `server/ai-retrieval.js` | — | 27–40 | const ASPECTS = [ | modified |
| 2026-11-15 04:36:46 +07:00 | `server/ai-retrieval.js` | 43–46 | 58–58 | export function pageQuality(text) { | modified |
| 2026-11-15 04:36:46 +07:00 | `server/ai-retrieval.js` | 49–55 | 61–75 | export function pagePassage(text, words, size = AI_PASSAGE_LENGTH) { | modified |
| 2026-11-15 04:36:46 +07:00 | `server/ai-retrieval.js` | 76–76 | 96–99 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 04:36:46 +07:00 | `server/ai-retrieval.js` | 87–87 | 110–110 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 04:36:46 +07:00 | `server/ai-retrieval.js` | — | 120–121 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 04:39:50 +07:00 | `server/ask-ai.test.js` | 9–9 | 9–9 | import { readAiConfig, generateGemini, retrieveAiReferences, registerAskAi } fro | modified |
| 2026-11-15 04:39:50 +07:00 | `server/ask-ai.test.js` | — | 397–408 | test('passages center on the densest query window and stay exact page text',t=>{ | modified |

## [2026-11-15 04:43:51 +07:00] — Catat uji online biografi imam Tanya AI

Waktu pencatatan: **2026-11-15 04:43:51 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `40eb699`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: HTTPS: من هو الشافعي grounded 4,8 s; حكم صلاة الجماعة grounded 4,2 s; siapa guru imam syafii no_context 6,3 s; tanpa timeout

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-04-43-51-46ecf9.json](docs/change-audit/2026-11-15-04-43-51-46ecf9.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 04:43:50 +07:00 | `docs/deployment-log.md` | — | 1–6 | module/file | modified |

## [2026-11-15 04:45:51 +07:00] — Ringkasan terbanyak, filter seluruh riwayat, penghapusan log, dan pengecualian aktivitas admin

Waktu pencatatan: **2026-11-15 04:45:51 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `79c7fc1`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 209 tes regresi server pada snapshot terisolasi, 52 tes integrasi setelah kode dasar terbaru diselaraskan, serta 8 tes fitur setelah penyempurnaan snapshot baca; lint modul/test/helper/komponen baru; node --check server/index.js, server/admin-logs.js, server/admin-log-identity.js; TypeScript dan build produksi lokal. Browser Chrome headless dengan server lengkap dan database sementara: delapan log, ringkasan lima teratas, pagination server, filter kelompok, penghapusan 510 baris, snapshot mempertahankan catatan baru, batal hapus, hapus pilihan, CSV, visitor tetap tercatat, admin Bearer/cookie tidak tercatat, logout kembali mencatat visitor, 1440/390 px dan tema green/sepia/dark tanpa overflow/pageerror. File sumber fitur cocok hash snapshot yang diuji. Tidak menghapus catatan/database produksi. Diff dan staged whitespace lulus. Build hanya memberi peringatan konfigurasi Vite dan ukuran bundle tanpa error. Perubahan lain di ai-retrieval/tes AI ditangani terpisah dan tidak dicakup audit ini. SSH ubuntu@43.173.50.61 menolak autentikasi kunci (Permission denied publickey,password); pull/HEAD server/restart/fungsi online versi baru belum terverifikasi; tidak menjalankan install/build di hosting atau menghentikan transfer.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-04-45-51-e18fc1.json](docs/change-audit/2026-11-15-04-45-51-e18fc1.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 04:40:42 +07:00 | `dist/assets/index-BWQ9QzD0.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DlP13NX6.css` | 1–2 | — | module/file | deleted |
| 2026-11-15 04:40:42 +07:00 | `dist/assets/index.dev-CSrdI66x.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-CdbXY2HS.js` | 1–17 | — | module/file | deleted |
| 2026-11-15 04:40:42 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-15 04:38:55 +07:00 | `docs/admin-log-management.md` | — | 1–28 | module/file | added |
| 2026-11-15 04:38:55 +07:00 | `docs/library-activity.md` | 5–5 | 5–5 | Admin → Aktivitas menyediakan **Log Kutub Hadis** dan **Log Penulis & Karya**. | modified |
| 2026-11-15 04:38:55 +07:00 | `docs/library-activity.md` | 18–18 | 18–18 | Pencarian isi hadis dan hasil API penulis dicatat di server sesudah permintaan b | modified |
| 2026-11-15 04:27:47 +07:00 | `server/admin-log-identity.js` | — | 1–16 | cookieName, adminActivityIdentity, bearer, cookie, setAdminActivityCookie | added |
| 2026-11-15 04:39:57 +07:00 | `server/admin-logs.js` | — | 1–88 | tables, fail, column, definitions, table, query, page, filtersFor | added |
| 2026-11-15 04:33:05 +07:00 | `server/admin-logs.test.js` | — | 1–89 | fixture, db, fields, first, filtered, date, type, filters | added |
| 2026-11-15 04:33:05 +07:00 | `server/admin-request-identity.test.js` | — | 1–17 | options, result, request | added |
| 2026-11-15 04:29:11 +07:00 | `server/ai-history.js` | — | 37–37 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | — | 25–26 | import {invalidateAiBookPolicy} from './ai-book-policy.js'; | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | — | 330–332 | try { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | — | 356–356 | const libraryActivity = createLibraryActivity(() => stateDb); | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | — | 510–510 | app.post('/api/admin/login', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | — | 518–518 | app.post('/api/admin/logout', requireAdmin, (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 546–546 | 554–554 | app.post('/api/log/download', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 558–558 | 566–566 | app.post('/api/log/visit', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 590–640 | 598–598 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 953–957 | — | app.get('/api/search', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | — | 1093–1095 | app.get('/api/search', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 1161–1161 | 1117–1117 | app.get('/api/download/:id', async (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 1209–1209 | 1165–1165 | const handlePdfExport = async (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 1268–1268 | 1224–1224 | app.get('/api/book/:id', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 1425–1425 | 1381–1381 | app.get('/api/quran/surah/:id', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | 1466–1466 | 1422–1422 | app.get('/api/rowa/:id', (req, res) => { | modified |
| 2026-11-15 04:29:22 +07:00 | `server/index.js` | — | 1520–1522 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-15 04:29:11 +07:00 | `server/library-activity.js` | — | 38–38 | export function createLibraryActivity(getStateDb) { | modified |
| 2026-11-15 04:29:11 +07:00 | `src/api.ts` | 296–298 | 296–298 | export const webAPI = { | modified |
| 2026-11-15 04:29:11 +07:00 | `src/api.ts` | — | 301–306 | export const webAPI = { | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | — | 16–16 | import { LibraryLogData } from './LibraryLogData'; | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1068–1085 | 1069–1108 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1087–1152 | 1110–1112 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1185–1186 | 1145–1147 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1188–1194 | 1149–1159 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1196–1199 | 1161–1166 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1213–1213 | 1180–1180 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1221–1221 | 1188–1188 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1223–1223 | 1190–1190 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1271–1271 | 1238–1238 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 04:39:57 +07:00 | `src/components/Admin.tsx` | 1359–1359 | 1326–1327 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-15 04:30:38 +07:00 | `src/components/AdminLogSummary.tsx` | — | 1–17 | AdminLogSummary | added |
| 2026-11-15 04:27:47 +07:00 | `src/lib/admin-request-identity.ts` | — | 1–17 | adminRequestOptions, url, headers, installAdminRequestIdentity, original | added |
| 2026-11-15 04:27:47 +07:00 | `src/main.tsx` | — | 6–8 | import App from './App.tsx' | modified |

## [2026-11-15 06:52:50 +07:00] — Tanya AI: kutipan per kalimat dan arah teks

Waktu pencatatan: **2026-11-15 06:52:50 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `ca2c329`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 211 tes server lulus (2 tes baru: kutipan per kalimat lintas baris, tampilan «» satu paragraf, dir=auto per paragraf); tsc dan oxlint bersih; build frontend sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-06-52-50-7069c3.json](docs/change-audit/2026-11-15-06-52-50-7069c3.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 06:52:39 +07:00 | `dist/assets/index.dev-Dqs6Krnx.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-15 06:52:39 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-15 06:50:25 +07:00 | `server/ai-evidence.js` | — | 23–38 | export function verifiedReferences(db,refs,additional=false) { | modified |
| 2026-11-15 06:50:25 +07:00 | `server/ai-evidence.js` | 31–39 | 47–50 | export function quoteCatalog(refs){ | modified |
| 2026-11-15 06:50:25 +07:00 | `server/ai-evidence.js` | 69–69 | 80–82 | export function verifyAnswer(text,refs,catalog){ | modified |
| 2026-11-15 06:51:23 +07:00 | `server/ai-evidence.test.js` | 2–2 | 2–2 | import test from 'node:test';import assert from 'node:assert/strict';import Data | modified |
| 2026-11-15 06:51:23 +07:00 | `server/ai-evidence.test.js` | — | 43–60 | test('joined line breaks restore exact original quote; synthetic FTS ellipses ca | modified |
| 2026-11-15 06:50:42 +07:00 | `server/reader-ai.test.js` | 20–20 | 20–20 | test('reader and chat AI render formatting while escaping model HTML',()=>{ | modified |
| 2026-11-15 06:50:42 +07:00 | `server/reader-ai.test.js` | — | 23–26 | test('reader and chat AI render formatting while escaping model HTML',()=>{ | modified |
| 2026-11-15 06:50:26 +07:00 | `src/lib/ai-markdown.ts` | 31–31 | 31–31 | export function renderMarkdown(text: string): string { | modified |
| 2026-11-15 06:50:26 +07:00 | `src/lib/ai-markdown.ts` | 35–35 | 35–35 | export function renderMarkdown(text: string): string { | modified |
| 2026-11-15 06:50:26 +07:00 | `src/lib/ai-markdown.ts` | 41–41 | 41–42 | export function renderMarkdown(text: string): string { | modified |

## [2026-11-15 06:57:13 +07:00] — Tanya AI: kutipan diawali huruf dan nomor rujukan rapi

Waktu pencatatan: **2026-11-15 06:57:13 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1b5e648`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 212 tes server lulus (tes baru: unit kutipan diawali huruf, [1.1] menjadi [1] tanpa duplikat); oxlint bersih; uji online 1b5e648 menemukan «: أما…» dan [1.10]. [1]

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-06-57-13-314ce4.json](docs/change-audit/2026-11-15-06-57-13-314ce4.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 06:56:29 +07:00 | `server/ai-evidence.js` | 31–31 | 31–32 | export function quoteUnits(text,{min=60,max=600}={}){ | modified |
| 2026-11-15 06:56:29 +07:00 | `server/ai-evidence.js` | — | 74–75 | export function verifyAnswer(text,refs,catalog){ | modified |
| 2026-11-15 06:55:41 +07:00 | `server/ai-evidence.test.js` | — | 61–71 | test('quotes are whole sentences across wrapped lines and display as one paragra | modified |

## [2026-11-15 07:00:18 +07:00] — Tanya AI: rujukan kutipan berkelompok

Waktu pencatatan: **2026-11-15 07:00:18 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4fee5da`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 213 tes server lulus (tes baru: [1.1, 2.1] menjadi [1][2] sebelum penomoran ulang); oxlint bersih; uji online 4fee5da: tiga pertanyaan grounded, tersisa rujukan berkelompok

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-07-00-18-bc2a82.json](docs/change-audit/2026-11-15-07-00-18-bc2a82.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 07:00:17 +07:00 | `docs/deployment-log.md` | — | 1–7 | module/file | modified |
| 2026-11-15 06:59:24 +07:00 | `server/ai-evidence.js` | 75–75 | 75–75 | export function verifyAnswer(text,refs,catalog){ | modified |
| 2026-11-15 06:59:31 +07:00 | `server/ai-evidence.test.js` | — | 72–82 | test('quote units start at a letter and quote IDs in prose become source numbers | modified |

## [2026-11-15 07:01:45 +07:00] — Catat uji online rujukan kutipan berkelompok

Waktu pencatatan: **2026-11-15 07:01:45 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `0ff85d7`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: HTTPS: hukum membeli saham grounded 6,0 s dengan [1][2][3]; حكم صلاة الجماعة grounded 4,7 s; siapa guru imam syafii no_context 5,0 s

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-07-01-45-6f8abc.json](docs/change-audit/2026-11-15-07-01-45-6f8abc.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 07:01:44 +07:00 | `docs/deployment-log.md` | — | 1–5 | module/file | modified |

## [2026-11-15 07:27:32 +07:00] — Tanya AI: percobaan ulang Arab, halaman lanjutan, dan saring tokoh

Waktu pencatatan: **2026-11-15 07:27:32 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `ce70924`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 216 tes server lulus (3 tes baru: halaman lanjutan, percobaan kedua berhasil, dua alasan tercatat bila keduanya ditolak); oxlint dan git diff --check bersih; DB lokal: siapa guru imam syafii kini menyertakan المختصر الوجيز hlm. 17 (أخذ الإمام الشافعي عن أهل الحجاز… الإمام مالك) dan tanpa arsip PISS-KTB

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-07-27-32-848341.json](docs/change-audit/2026-11-15-07-27-32-848341.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | — | 95–95 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | — | 101–101 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | 101–101 | 103–103 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | 104–104 | 106–106 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | — | 112–113 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | — | 118–128 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | — | 131–131 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | — | 138–139 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:23:53 +07:00 | `server/ai-retrieval.js` | 123–125 | 141–143 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | — | 70–70 | export async function generateGemini({ keys, model }, prompt, { fetchImpl = fetc | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | — | 176–176 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | 181–181 | 183–183 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | — | 189–189 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | 188–190 | 191–191 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | 192–192 | 193–193 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | 197–198 | — | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | 200–219 | 199–240 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | 221–223 | 242–244 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:25:24 +07:00 | `server/ask-ai.js` | 226–226 | 247–247 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:26:44 +07:00 | `server/ask-ai.test.js` | 406–406 | 406–446 | test('biography questions about a named imam prefer his full-name entry over nam | modified |

## [2026-11-15 07:34:06 +07:00] — Tanya AI: utamakan entri sang imam dan pisahkan catatan kaki

Waktu pencatatan: **2026-11-15 07:34:06 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `75e26a5`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 218 tes server lulus (2 tes baru: entri sendiri di atas biografi ulama lain, kutipan tidak melewati garis catatan kaki); oxlint bersih; DB lokal: siapa imam syafii tidak lagi memuat الشمائل (biografi al-Tirmidzi), siapa guru imam syafii memuat hlm. 16 lalu 17

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-07-34-06-cb2604.json](docs/change-audit/2026-11-15-07-34-06-cb2604.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 07:32:27 +07:00 | `server/ai-evidence.js` | — | 29–31 | export function quoteUnits(text,{min=60,max=600}={}){ | modified |
| 2026-11-15 07:32:38 +07:00 | `server/ai-evidence.test.js` | — | 83–87 | test('grouped quote IDs in prose become separate source citations that survive r | modified |
| 2026-11-15 07:32:14 +07:00 | `server/ai-retrieval.js` | 101–101 | 101–105 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:32:14 +07:00 | `server/ai-retrieval.js` | 117–117 | 121–123 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:32:14 +07:00 | `server/ai-retrieval.js` | 128–128 | 134–134 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:33:23 +07:00 | `server/ask-ai.test.js` | — | 411–417 | test('biography questions about a named imam prefer his full-name entry over nam | modified |

## [2026-11-15 07:41:46 +07:00] — Tanya AI: cari di dalam kitab yang disebut

Waktu pencatatan: **2026-11-15 07:41:46 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `38ef866`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 220 tes server lulus (2 tes baru: pembatasan ke kitab yang disebut, pertanyaan Indonesia berjudul Arab tetap diterjemahkan dan pesan berbahasa Indonesia); oxlint bersih; DB lokal: kata kunci أسباب الفقر untuk kitab تعليم المتعلم menemukan hlm. 63 (الكذب يورث الفقر، كثرة النوم تورث الفقر) dalam 0,4 detik

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-07-41-46-a1b2dc.json](docs/change-audit/2026-11-15-07-41-46-a1b2dc.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 07:39:28 +07:00 | `server/ai-retrieval.js` | — | 84–113 | export function pagePassage(text, words, size = AI_PASSAGE_LENGTH, anchors = []) | modified |
| 2026-11-15 07:39:28 +07:00 | `server/ai-retrieval.js` | 86–86 | 116–116 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:39:28 +07:00 | `server/ai-retrieval.js` | 91–91 | 121–130 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:39:28 +07:00 | `server/ai-retrieval.js` | 93–93 | 132–132 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:39:28 +07:00 | `server/ai-retrieval.js` | 149–149 | 188–189 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 07:40:16 +07:00 | `server/ask-ai.js` | 10–10 | 10–10 | import {AI_BOOK_POLICY_VERSION,filterAllowedAiReferences,assertAllowedAiBook} fr | modified |
| 2026-11-15 07:40:16 +07:00 | `server/ask-ai.js` | 178–178 | 178–178 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:40:16 +07:00 | `server/ask-ai.js` | 193–193 | 193–193 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:40:16 +07:00 | `server/ask-ai.js` | 247–247 | 247–247 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 07:41:09 +07:00 | `server/ask-ai.test.js` | 9–9 | 9–9 | import { readAiConfig, generateGemini, retrieveAiReferences, registerAskAi } fro | modified |
| 2026-11-15 07:41:09 +07:00 | `server/ask-ai.test.js` | — | 418–442 | test('his own entry ranks above another scholars biography that only mentions hi | modified |

## [2026-11-15 08:04:43 +07:00] — Tanya AI: catatan kaki tidak memblokir kitab, pesan pengecualian jujur

Waktu pencatatan: **2026-11-15 08:04:43 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `6ba9720`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 222 tes server lulus (2 tes baru: nama di catatan kaki tidak mengecualikan kitab tetapi cuplikan yang memuatnya tetap ditolak; jawaban menyebut kitab yang dikecualikan); oxlint bersih; DB lokal: تعليم المتعلم (93084, 108544, tambahan 8404) kini lolos kebijakan, sebelumnya terblokir karena catatan kaki hlm. 24 dan 45

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-08-04-43-b858a5.json](docs/change-audit/2026-11-15-08-04-43-b858a5.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 08:02:35 +07:00 | `server/ai-book-policy.js` | 4–4 | 4–4 | import {sourceText} from './ai-source.js'; | modified |
| 2026-11-15 08:02:35 +07:00 | `server/ai-book-policy.js` | — | 10–12 | export const normalizePolicyText = text => sourceText(text).normalize('NFKC') | modified |
| 2026-11-15 08:02:35 +07:00 | `server/ai-book-policy.js` | 27–27 | 30–30 | export function scanAiBooks(db, bookIds, schemas=['main']) { | modified |
| 2026-11-15 08:02:35 +07:00 | `server/ai-book-policy.js` | 95–95 | 98–98 | export async function filterAllowedAiReferences(db, references, additional=false | modified |
| 2026-11-15 08:02:35 +07:00 | `server/ai-book-policy.js` | 100–100 | 103–103 | export async function assertAllowedAiBook(db, reference, additional=false, optio | modified |
| 2026-11-15 08:03:58 +07:00 | `server/ai-book-policy.test.js` | — | 81–89 | test('missing page storage cannot approve a book for use as evidence',async t=>{ | modified |
| 2026-11-15 08:02:56 +07:00 | `server/ask-ai.js` | — | 160–161 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 08:02:56 +07:00 | `server/ask-ai.js` | 172–172 | 174–174 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 08:02:56 +07:00 | `server/ask-ai.js` | 193–194 | 195–199 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 08:03:58 +07:00 | `server/ask-ai.test.js` | 340–340 | 340–340 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-15 08:03:58 +07:00 | `server/ask-ai.test.js` | — | 443–452 | test('an Indonesian question naming an Arabic book still gets Arabic keywords an | modified |

## [2026-11-15 08:13:50 +07:00] — Tanya AI: tambah الألباني dan varian nama pengecualian

Waktu pencatatan: **2026-11-15 08:13:50 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `8aaaec8`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 222 tes server lulus (tes varian diperluas: بن/ابن تيمية/تيميه, لابن/وابن, محمد ابن عبدالوهاب, عبد العزيز بن باز, ابن عثيمين, الألباني/الألبانى/للألباني; tidak cocok untuk الباني, عبد الوهاب الشعراني, ابن بازل); oxlint bersih; pemeriksaan DB lokal: sampel 40 kitab hadits, الألباني menambah 1 blokir (رياض الصالحين ط- أخرى, tahqiq al-Albani); ditemukan salah deteksi lama: perawi محمد بن عبد الوهاب memblokir صحيح مسلم dan Sunan

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-08-13-50-ee6469.json](docs/change-audit/2026-11-15-08-13-50-ee6469.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 08:11:26 +07:00 | `server/ai-book-policy.js` | 4–6 | 4–15 | import {sourceText} from './ai-source.js'; | modified |
| 2026-11-15 08:11:26 +07:00 | `server/ai-book-policy.js` | 8–8 | 17–17 | export const normalizePolicyText = text => sourceText(text).normalize('NFKC') | modified |
| 2026-11-15 08:09:34 +07:00 | `server/ai-book-policy.test.js` | 19–21 | 19–27 | function fixture(t, filename=':memory:') { | modified |
| 2026-11-15 08:09:35 +07:00 | `server/ask-ai.test.js` | 340–340 | 340–340 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |

## [2026-11-15 08:26:35 +07:00] — Tanya AI: hapus محمد بن عبد الوهاب dari pengecualian

Waktu pencatatan: **2026-11-15 08:26:35 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `e47b067`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 222 tes server lulus (sanad حدثنا محمد بن عبد الوهاب الفراء kini tidak diblokir; empat nama lain tetap); oxlint bersih; DB lokal: dari 40 kitab hadits, blokir turun dari 17 menjadi 7 (صحيح مسلم 3 edisi, سنن الترمذي 6 edisi, سنن ابن ماجه, سنن النسائي الكبرى kembali tersedia)

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-08-26-35-455086.json](docs/change-audit/2026-11-15-08-26-35-455086.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 08:25:13 +07:00 | `server/ai-book-policy.js` | 4–5 | 4–5 | import {sourceText} from './ai-source.js'; | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ai-book-policy.js` | 11–11 | — | const patterns = [ | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ai-book-policy.test.js` | 14–14 | 14–14 | function fixture(t, filename=':memory:') { | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ai-book-policy.test.js` | 19–19 | 19–19 | function fixture(t, filename=':memory:') { | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ai-book-policy.test.js` | 22–22 | — | test('all five names match despite harakat, tatweel, HTML entities, line breaks, | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ai-book-policy.test.js` | 27–27 | 26–27 | test('all five names match despite harakat, tatweel, HTML entities, line breaks, | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ask-ai.test.js` | 287–287 | 287–287 | test('selected-page explanation and translation reject the entire excluded book | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ask-ai.test.js` | 340–340 | 340–340 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-15 08:25:13 +07:00 | `server/ask-ai.test.js` | 446–446 | 446–446 | test('when every matching page belongs to an excluded book, the reply names the | modified |

## [2026-11-15 08:45:09 +07:00] — Tanya AI: isi kitab dari mukadimah dan percobaan ulang istilah kitab

Waktu pencatatan: **2026-11-15 08:45:09 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `aa2b39a`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 224 tes server lulus (2 tes baru: isi kitab dari halaman pembuka; jawaban Arab yang ditolak diulang dengan istilah kitab); oxlint bersih; DB lokal: apa isi kitab إحياء علوم الدين kini memberi hlm. 1-3 (mukadimah dan empat rubu') dan dikenali sebagai pertanyaan Indonesia

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-08-45-09-3b7dc8.json](docs/change-audit/2026-11-15-08-45-09-3b7dc8.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 08:43:21 +07:00 | `server/ai-retrieval.js` | 86–86 | 86–89 | export const mostlyArabic = text => { | modified |
| 2026-11-15 08:43:21 +07:00 | `server/ai-retrieval.js` | 90–90 | 93–94 | export const mostlyArabic = text => { | modified |
| 2026-11-15 08:43:21 +07:00 | `server/ai-retrieval.js` | — | 128–136 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 08:43:21 +07:00 | `server/ai-retrieval.js` | 128–128 | 141–141 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 08:43:21 +07:00 | `server/ai-retrieval.js` | — | 206–206 | export function retrieveAiCandidates(db, question, additional = false, catalogue | modified |
| 2026-11-15 08:41:19 +07:00 | `server/ask-ai.js` | — | 70–70 | export async function generateGemini({ keys, model }, prompt, { fetchImpl = fetc | modified |
| 2026-11-15 08:41:19 +07:00 | `server/ask-ai.js` | — | 189–203 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 08:41:19 +07:00 | `server/ask-ai.js` | 238–238 | 254–257 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 08:41:19 +07:00 | `server/ask-ai.js` | 243–243 | 262–262 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 08:41:19 +07:00 | `server/ask-ai.js` | 249–249 | 268–268 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-15 08:44:25 +07:00 | `server/ask-ai.test.js` | — | 453–475 | test('when every matching page belongs to an excluded book, the reply names the | modified |

## [2026-11-15 08:47:44 +07:00] — Catat uji online kitab yang disebut dan istilah kitab

Waktu pencatatan: **2026-11-15 08:47:44 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1715b3c`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: HTTPS: isi kitab Ihya grounded 6,8 s; تعليم المتعلم penyebab faqir grounded 5,4 s; قضاء صلاة الميت grounded 8,5 s via percobaan ulang istilah kitab; صلاة بلا إمام grounded 4,5 s

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-08-47-44-167b63.json](docs/change-audit/2026-11-15-08-47-44-167b63.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 08:47:43 +07:00 | `docs/deployment-log.md` | — | 1–6 | module/file | modified |

## [2026-11-15 09:47:03 +07:00] — Admin: peringkat log sesuai jenis log

Waktu pencatatan: **2026-11-15 09:47:03 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `afbc220`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 224 tes server lulus (tes admin-logs: kelompok per jenis log, filter kelompok yang tidak ada ditolak); tsc dan oxlint bersih; build frontend sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-09-47-03-f0da0d.json](docs/change-audit/2026-11-15-09-47-03-f0da0d.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 09:46:52 +07:00 | `dist/assets/index.dev-Clg0O7TL.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Dqs6Krnx.js` | 1–17 | — | module/file | deleted |
| 2026-11-15 09:46:52 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-15 09:45:05 +07:00 | `server/admin-logs.js` | 11–11 | 11–18 | function definitions(db,type) { | modified |
| 2026-11-15 09:45:13 +07:00 | `server/admin-logs.test.js` | 22–22 | 22–22 | test('rankings, filters and pagination cover all records beyond the previous 500 | modified |
| 2026-11-15 09:45:13 +07:00 | `server/admin-logs.test.js` | 39–39 | 39–42 | test('questions, pages and per-feature targets are aggregated without trusting i | modified |
| 2026-11-15 09:45:31 +07:00 | `src/components/Admin.tsx` | 1145–1145 | 1145–1145 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-15 09:45:30 +07:00 | `src/components/AdminLogSummary.tsx` | 2–3 | 2–14 | export interface LogTopItem {value:string;count:number;} | modified |
| 2026-11-15 09:45:30 +07:00 | `src/components/AdminLogSummary.tsx` | 6–8 | 17–19 | export function AdminLogSummary({top,total,onChoose,disabled}:{top:Record<string | modified |

## [2026-11-15 10:58:16 +07:00] — Pencarian teks: total dibatasi dan berjalan di worker

Waktu pencatatan: **2026-11-15 10:58:16 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `afa27ba`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 228 tes server lulus (4 tes baru text-search: urutan frasa persis lalu AND, batas hitung 10.000, dua perpustakaan, worker dengan batas waktu); tsc dan build lulus; DB lokal: الله 32 ms (sebelumnya hitungan 7,9 juta halaman), قال الله 139 ms, kueri pengguna 111 ms; online sebelum perbaikan: الله/قال الله/في من >120 detik dan menahan seluruh server

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-10-58-16-3c311f.json](docs/change-audit/2026-11-15-10-58-16-3c311f.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Clg0O7TL.js` | 1–17 | — | module/file | deleted |
| 2026-11-15 10:58:11 +07:00 | `dist/assets/index.dev-DKI0Reem.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-15 10:58:11 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-15 10:55:49 +07:00 | `server/index.js` | — | 30–30 | import { searchRowa } from './rowa-search.js'; | modified |
| 2026-11-15 10:55:49 +07:00 | `server/index.js` | 901–901 | 902–902 | app.delete('/api/admin/book-submission/:id', requireAdmin, (req, res) => { | modified |
| 2026-11-15 10:55:49 +07:00 | `server/index.js` | 907–909 | 908–910 | app.get('/api/search', (req, res) => { | modified |
| 2026-11-15 10:55:49 +07:00 | `server/index.js` | 915–986 | 916–916 | app.get('/api/search', (req, res) => { | modified |
| 2026-11-15 10:55:49 +07:00 | `server/index.js` | 988–1090 | 918–927 | app.get('/api/search', (req, res) => { | modified |
| 2026-11-15 10:55:49 +07:00 | `server/index.js` | — | 929–929 | app.get('/api/search', (req, res) => { | modified |
| 2026-11-15 10:55:49 +07:00 | `server/index.js` | 1096–1096 | 934–934 | app.get('/api/search', (req, res) => { | modified |
| 2026-11-15 10:55:25 +07:00 | `server/text-search-worker.js` | — | 1–13 | module/file | added |
| 2026-11-15 10:55:33 +07:00 | `server/text-search.js` | — | 1–84 | SEARCH_COUNT_CAP, searchPages, schemas, offset, filters, books, fts, from | added |
| 2026-11-15 10:56:34 +07:00 | `server/text-search.test.js` | — | 1–62 | library, db, create, put, match, all, started, result | added |
| 2026-11-15 10:56:08 +07:00 | `src/App.tsx` | — | 50–51 | function App() { | modified |
| 2026-11-15 10:56:08 +07:00 | `src/App.tsx` | 282–282 | 284–284 | function App() { | modified |
| 2026-11-15 10:56:08 +07:00 | `src/App.tsx` | 285–285 | 287–287 | function App() { | modified |
| 2026-11-15 10:56:08 +07:00 | `src/App.tsx` | 304–304 | 306–306 | function App() { | modified |
| 2026-11-15 10:56:08 +07:00 | `src/App.tsx` | — | 314–314 | function App() { | modified |
| 2026-11-15 10:56:08 +07:00 | `src/App.tsx` | 752–752 | 755–755 | function App() { | modified |

## [2026-11-15 11:22:26 +07:00] — Catat uji online pencarian teks

Waktu pencatatan: **2026-11-15 11:22:26 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `27eedfa`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: HTTPS: kueri pengguna 0,56 s; الله 0,29 s; قال الله 2,3 s; في من 12,1 s dengan /api/health tetap 1,4 s selama pencarian

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-11-22-26-6e7a56.json](docs/change-audit/2026-11-15-11-22-26-6e7a56.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 11:22:25 +07:00 | `docs/deployment-log.md` | — | 1–6 | module/file | modified |

## [2026-11-15 12:16:54 +07:00] — Saran pencarian juga untuk hasil sedikit

Waktu pencatatan: **2026-11-15 12:16:54 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `6c28ab6`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 229 tes server lulus (tes baru: hasil 1-4 memakai koreksi lokal dan satu panggilan Gemini, hasil 5-19 hanya koreksi lokal; pencarian >=20 hasil tidak memakai kuota); tsc dan build lulus; DB lokal: hitungan dibatasi 20 hasil, 27-111 ms, kata umum dengan filter kategori 365 ms

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-12-16-54-0c1ca7.json](docs/change-audit/2026-11-15-12-16-54-0c1ca7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 12:16:43 +07:00 | `dist/assets/index.dev-DIFosRPN.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-15 12:16:43 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | 35–35 | 35–40 | function textMatch(query) { | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | 37–37 | 42–43 | export function hasSuggestionResults(db, additional, query, mode, categories, li | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | 41–43 | 47–50 | export function hasSuggestionResults(db, additional, query, mode, categories, li | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | 45–45 | 52–52 | export function hasSuggestionResults(db, additional, query, mode, categories, li | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | — | 54–54 | export function hasSuggestionResults(db, additional, query, mode, categories, li | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | 81–82 | 89–92 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | 99–99 | 109–109 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-15 12:14:44 +07:00 | `server/search-suggestions.js` | 127–127 | 137–137 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-15 12:15:16 +07:00 | `server/search-suggestions.test.js` | 5–5 | 5–5 | import express from 'express'; | modified |
| 2026-11-15 12:15:16 +07:00 | `server/search-suggestions.test.js` | — | 11–13 | const likeMatch = query => query.replace(/[\u064B-\u065F\u0670]/g,'').replace(/[ | modified |
| 2026-11-15 12:15:16 +07:00 | `server/search-suggestions.test.js` | 60–60 | 63–63 | test('AI alternatives are verified, deduplicated, cached by mode/category, and c | modified |
| 2026-11-15 12:15:16 +07:00 | `server/search-suggestions.test.js` | 62–62 | 65–67 | test('positive searches, invalid inputs, maintenance and local export never cons | modified |
| 2026-11-15 12:15:16 +07:00 | `server/search-suggestions.test.js` | 86–86 | 91–92 | test('concurrent requests share one provider call and request limits bound publi | modified |
| 2026-11-15 12:15:16 +07:00 | `server/search-suggestions.test.js` | — | 126–136 | test('three verified local alternatives avoid AI and prefer frequent catalogue t | modified |
| 2026-11-15 12:16:06 +07:00 | `src/App.tsx` | — | 855–860 | function App() { | modified |
| 2026-11-15 12:16:05 +07:00 | `src/components/SearchSuggestions.tsx` | 4–5 | 4–7 | import {webAPI} from '../api'; | modified |
| 2026-11-15 12:16:05 +07:00 | `src/components/SearchSuggestions.tsx` | 19–19 | 21–21 | export function SearchSuggestions({query, mode, categories, onSearch}: { | modified |
| 2026-11-15 12:16:05 +07:00 | `src/components/SearchSuggestions.tsx` | 21–22 | 23–24 | export function SearchSuggestions({query, mode, categories, onSearch}: { | modified |

## [2026-11-15 12:50:19 +07:00] — Saran pencarian di atas daftar hasil

Waktu pencatatan: **2026-11-15 12:50:19 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `338ee5e`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: tsc dan build frontend lulus; hanya posisi tampilan yang berubah (di bawah baris Total Hasil, di atas daftar), aturan saran tetap

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-12-50-19-83376a.json](docs/change-audit/2026-11-15-12-50-19-83376a.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 12:50:09 +07:00 | `dist/assets/index.dev-Cd4wLIyH.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-15 12:50:09 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-15 12:49:52 +07:00 | `src/App.tsx` | — | 760–765 | function App() { | modified |
| 2026-11-15 12:49:52 +07:00 | `src/App.tsx` | 855–859 | — | function App() { | modified |
| 2026-11-15 12:49:53 +07:00 | `src/components/SearchSuggestions.tsx` | 4–4 | 4–4 | import {webAPI} from '../api'; | modified |
| 2026-11-15 12:49:53 +07:00 | `src/components/SearchSuggestions.tsx` | 6–7 | 6–7 | import {webAPI} from '../api'; | modified |
| 2026-11-15 12:49:53 +07:00 | `src/components/SearchSuggestions.tsx` | 21–21 | 21–21 | export function SearchSuggestions({query, mode, categories, onSearch, afterResul | modified |
| 2026-11-15 12:49:53 +07:00 | `src/components/SearchSuggestions.tsx` | 23–24 | 23–24 | export function SearchSuggestions({query, mode, categories, onSearch, afterResul | modified |

## [2026-11-15 12:54:25 +07:00] — Saran pencarian: jangan sarankan varian ejaan kueri itu sendiri

Waktu pencatatan: **2026-11-15 12:54:25 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `faf9b84`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 230 tes server lulus (tes baru: احياء علوم الدبن tidak menyarankan إحياء علوم الدبن); oxlint bersih; uji online faf9b84: kotak saran tampil di bawah Total Hasil dan di atas daftar (browser), tahajut 1 hasil menyarankan Tahajjud/صلاة التهجد

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-12-54-25-d87119.json](docs/change-audit/2026-11-15-12-54-25-d87119.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 12:53:17 +07:00 | `server/search-suggestions.js` | 127–127 | 127–129 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-15 12:53:17 +07:00 | `server/search-suggestions.js` | 131–131 | 133–133 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-15 12:53:19 +07:00 | `server/search-suggestions.test.js` | — | 137–145 | test('searches with few results still get suggestions; the model is used only wh | modified |

## [2026-11-15 13:01:33 +07:00] — Catat uji online saran pencarian

Waktu pencatatan: **2026-11-15 13:01:33 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4ce0390`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Browser dan API online: posisi kotak saran benar, varian ejaan kueri tidak disarankan balik, pencarian dengan banyak hasil tanpa saran

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-13-01-33-7c70ff.json](docs/change-audit/2026-11-15-13-01-33-7c70ff.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 13:01:33 +07:00 | `docs/deployment-log.md` | — | 1–6 | module/file | modified |

## [2026-11-15 19:22:52 +07:00] — Fitur Pesan: chat pengunjung-admin melayang dengan notifikasi realtime

Waktu pencatatan: **2026-11-15 19:22:52 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `c015e8f`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js: 239 lulus (8 tes pesan server + 3 tes klien baru); npx tsc --noEmit -p . lulus; oxlint file baru 0 peringatan; npm run build sukses; uji browser lokal (DB uji kecil): kirim pesan ponsel 375px, balasan admin memunculkan badge realtime via SSE, tombol sembunyi saat gulir turun & muncul saat gulir naik, tersembunyi saat kitab dibuka, panel admin menerima pesan realtime dan membalas, tata letak desktop 1280px tidak bertumpuk

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-19-22-52-d5e562.json](docs/change-audit/2026-11-15-19-22-52-d5e562.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BWQ9QzD0.css` | 1–2 | — | module/file | deleted |
| 2026-11-15 19:19:58 +07:00 | `dist/assets/index-CPQduW1l.css` | — | 1–2 | module/file | added |
| 2026-11-15 19:19:58 +07:00 | `dist/assets/index.dev-BSHgaGOK.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Cd4wLIyH.js` | 1–17 | — | module/file | deleted |
| 2026-11-15 19:19:58 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-15 19:10:05 +07:00 | `server/ai-history.js` | — | 17–28 | export function auditMeta(payload={}) { | modified |
| 2026-11-15 19:10:05 +07:00 | `server/ai-history.js` | 25–35 | 37–37 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-15 19:11:37 +07:00 | `server/index.js` | — | 27–27 | import {registerAdminLogs} from './admin-logs.js'; | modified |
| 2026-11-15 19:11:37 +07:00 | `server/index.js` | 591–591 | 592–593 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-15 19:11:37 +07:00 | `server/index.js` | — | 602–602 | registerAdminLogs(app,{getStateDb:()=>stateDb,requireAdmin,isBusy:()=>Boolean(tr | modified |
| 2026-11-15 19:15:43 +07:00 | `server/messages-client.test.js` | — | 1–23 | m, current | added |
| 2026-11-15 19:11:29 +07:00 | `server/messages.js` | — | 1–244 | MESSAGE_LIMITS, STREAM_LIMITS, now, iso, cleanMessageText, createMessageStore, db, current | added |
| 2026-11-15 19:12:11 +07:00 | `server/messages.test.js` | — | 1–117 | fixture, db, app, requireAdmin, messages, server, base, send | added |
| 2026-11-15 19:14:03 +07:00 | `src/App.tsx` | — | 28–28 | import { Collection } from './components/Collection'; | modified |
| 2026-11-15 19:14:03 +07:00 | `src/App.tsx` | — | 1068–1070 | function App() { | modified |
| 2026-11-15 19:14:20 +07:00 | `src/components/Admin.tsx` | — | 12–12 | import { AdminNavigation } from './AdminNavigation'; | modified |
| 2026-11-15 19:14:20 +07:00 | `src/components/Admin.tsx` | — | 1395–1395 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-15 19:19:32 +07:00 | `src/components/AdminMessages.tsx` | — | 1–195 | threadName, AdminMessages, listRef, selectedRef, handle, message, loadList, res | added |
| 2026-11-15 19:19:31 +07:00 | `src/components/MessageWidget.tsx` | — | 1–232 | isAdminBrowser, MessageWidget, listRef, inputRef, lastId, viewing, apply, markRead | added |
| 2026-11-15 19:14:11 +07:00 | `src/index.css` | — | 47–52 | b { | modified |
| 2026-11-15 19:14:20 +07:00 | `src/lib/admin-navigation.ts` | 1–1 | 1–1 | adminParent, adminTitle, adminGroup, adminLocation, p, raw, id, v | modified |
| 2026-11-15 19:14:20 +07:00 | `src/lib/admin-navigation.ts` | 7–7 | 7–7 | const parents: Record<AdminView, AdminView> = { | modified |
| 2026-11-15 19:14:20 +07:00 | `src/lib/admin-navigation.ts` | 14–14 | 14–14 | const titles: Record<AdminView,string> = { | modified |
| 2026-11-15 19:14:20 +07:00 | `src/lib/admin-navigation.ts` | 22–22 | 22–22 | export const adminGroups: {label:string;views:AdminView[]}[] = [ | modified |
| 2026-11-15 19:13:54 +07:00 | `src/lib/messages.ts` | — | 1–90 | MESSAGE_MAX, request, res, auth, messagesAPI, adminMessagesAPI, mergeMessages, byId | added |

## [2026-11-15 19:26:07 +07:00] — Catat uji deployment fitur Pesan

Waktu pencatatan: **2026-11-15 19:26:07 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `e606bf9`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Uji online https://maktab.my.id: aset build e606bf9 tersaji; endpoint pesan, validasi, honeypot, 401 admin, SSE lewat nginx tanpa buffer; tombol responsif, sembunyi saat gulir turun dan saat membaca kitab

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-19-26-07-cdf5bb.json](docs/change-audit/2026-11-15-19-26-07-cdf5bb.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 19:26:01 +07:00 | `docs/deployment-log.md` | — | 1–7 | module/file | modified |

## [2026-11-15 19:38:28 +07:00] — Pesan melayang mode admin: baca dan balas tanpa membuka panel admin

Waktu pencatatan: **2026-11-15 19:38:28 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `0ecb77b`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js: 239 lulus; npx tsc --noEmit -p . lulus; oxlint file berubah 0 peringatan; npm run build sukses; uji browser lokal (DB uji kecil, login admin uji): tombol melayang menampilkan 'Pesan Pengunjung · Mode admin', pesan pengunjung baru menaikkan badge realtime saat panel tertutup, membuka percakapan dan membalas dari panel melayang tersimpan dan badge kembali 0; halaman admin Pesan Pengunjung (kini memakai hook bersama) tetap memuat daftar dan percakapan; tombol melayang tetap tersembunyi di panel admin

Audit terstruktur beserta hash isi staged dan diff: [2026-11-15-19-38-28-ce2541.json](docs/change-audit/2026-11-15-19-38-28-ce2541.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-15 19:37:19 +07:00 | `dist/assets/index-Bo_y6Yh2.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-CPQduW1l.css` | 1–2 | — | module/file | deleted |
| 2026-11-15 19:37:19 +07:00 | `dist/assets/index.dev-B10OIskn.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-BSHgaGOK.js` | 1–17 | — | module/file | deleted |
| 2026-11-15 19:37:19 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-15 19:36:00 +07:00 | `src/App.tsx` | 1069–1069 | 1069–1069 | function App() { | modified |
| 2026-11-15 19:35:29 +07:00 | `src/components/AdminInboxMini.tsx` | — | 1–80 | AdminInboxMini, listRef, inputRef, reply | added |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 1–1 | 1–1 | AdminMessages, inbox, listRef, reply, unreadTotal | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 3–7 | 3–4 | import { MessageCircle, Send, Trash2, Search, Bell, BellOff, ArrowLeft, RefreshC | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 9–12 | 6–6 | import type { ChatMessage, MessageThreadRow } from '../lib/messages'; | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 14–17 | 8–9 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 19–22 | — | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 24–26 | — | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 29–85 | — | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 89–107 | 17–17 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-15 19:34:54 +07:00 | `src/components/AdminMessages.tsx` | 166–166 | 76–76 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | — | 10–11 | import type { ChatMessage } from '../lib/messages'; | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 11–11 | 13–13 | import type { ChatMessage } from '../lib/messages'; | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 13–15 | 15–19 | const isAdminBrowser = () => { try { return Boolean(localStorage.getItem('adminT | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | — | 37–46 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 58–58 | 72–72 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 79–79 | 93–96 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 81–81 | 98–106 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 85–85 | 110–110 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 90–90 | 115–115 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 148–148 | — | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 158–159 | 182–183 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | — | 196–196 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 173–178 | 198–198 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 195–216 | 215–235 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 221–221 | 240–240 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 224–224 | 243–243 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:36:00 +07:00 | `src/components/MessageWidget.tsx` | 226–226 | 245–245 | export function MessageWidget({ suppressed }: { suppressed: boolean }) { | modified |
| 2026-11-15 19:34:45 +07:00 | `src/lib/use-admin-inbox.ts` | — | 1–121 | threadName, useAdminInbox, selectedRef, handle, message, loadList, res, openThread | added |

## [2026-11-17 00:12:50 +07:00] — feat(search): senyap kecualikan kitab 4 nama ulama dari pencarian teks dan judul kecuali pencarian lanjut

Waktu pencatatan: **2026-11-17 00:12:50 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `35711ed`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 244/244 server unit tests lulus, oxlint 0 error, build tsc dan vite lulus

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-00-12-50-579b8d.json](docs/change-audit/2026-11-17-00-12-50-579b8d.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 00:12:01 +07:00 | `dist/assets/index.dev-CYsU2H5k.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-17 00:12:01 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-17 00:10:26 +07:00 | `server/index.js` | — | 32–32 | import { searchPagesOffThread, SEARCH_COUNT_CAP } from './text-search.js'; | modified |
| 2026-11-17 00:10:26 +07:00 | `server/index.js` | — | 338–347 | try { | modified |
| 2026-11-17 00:10:26 +07:00 | `server/index.js` | — | 931–932 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-17 00:10:26 +07:00 | `server/index.js` | 927–927 | 940–940 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-17 00:10:26 +07:00 | `server/index.js` | — | 1356–1368 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-17 00:10:09 +07:00 | `server/search-policy.js` | — | 1–190 | ensureSearchPolicySchema, ensureTempExcludedTable, ins, getExcludedBookIds, rows, invalidateSearchPolicyCache, syncMetadataExclusions, schemas | added |
| 2026-11-17 00:12:20 +07:00 | `server/search-policy.test.js` | — | 1–127 | setupFixture, db, stateDb, excluded, scanned, rows, updated, found | added |
| 2026-11-17 00:05:04 +07:00 | `server/text-search.js` | 11–11 | 11–11 | export const SEARCH_COUNT_CAP = 10000; | modified |
| 2026-11-17 00:05:04 +07:00 | `server/text-search.js` | — | 21–24 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-17 00:01:29 +07:00 | `server/text-search.test.js` | — | 63–88 | test('file-backed searches run in a read-only worker with the same results and a | modified |
| 2026-11-17 00:09:38 +07:00 | `src/App.tsx` | — | 286–286 | function App() { | modified |
| 2026-11-17 00:09:38 +07:00 | `src/App.tsx` | 287–287 | 288–288 | function App() { | modified |
| 2026-11-17 00:09:38 +07:00 | `src/App.tsx` | 290–290 | 291–291 | function App() { | modified |
| 2026-11-17 00:09:19 +07:00 | `src/api.ts` | 212–212 | 212–212 | export const webAPI = { | modified |
| 2026-11-17 00:09:19 +07:00 | `src/api.ts` | — | 215–215 | export const webAPI = { | modified |
| 2026-11-17 00:09:19 +07:00 | `src/api.ts` | 218–218 | 219–219 | export const webAPI = { | modified |
| 2026-11-17 00:09:19 +07:00 | `src/api.ts` | — | 222–222 | export const webAPI = { | modified |

## [2026-11-17 00:18:30 +07:00] — feat(policy): broaden taymiyyah and albaniyyah pattern matching

Waktu pencatatan: **2026-11-17 00:18:30 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `88209ee`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 245/245 tests lulus, oxlint 0 error

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-00-18-30-1c1310.json](docs/change-audit/2026-11-17-00-18-30-1c1310.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 00:16:25 +07:00 | `server/ai-book-policy.js` | 10–10 | 10–10 | const patterns = [ | modified |
| 2026-11-17 00:16:25 +07:00 | `server/ai-book-policy.js` | 13–13 | 13–13 | const patterns = [ | modified |
| 2026-11-17 00:16:38 +07:00 | `server/ai-book-policy.test.js` | 21–21 | 21–21 | test('all four names match despite harakat, tatweel, HTML entities, line breaks, | modified |
| 2026-11-17 00:16:38 +07:00 | `server/ai-book-policy.test.js` | 24–24 | 24–24 | test('all four names match despite harakat, tatweel, HTML entities, line breaks, | modified |

## [2026-11-17 00:32:49 +07:00] — feat(search): senyap cegah query teks dan judul mengandung 4 ulama dalam pencarian biasa dan perluas pola al-baziyyah

Waktu pencatatan: **2026-11-17 00:32:49 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `948c9e8`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 246/246 tests lulus, oxlint 0 error

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-00-32-49-c6ef50.json](docs/change-audit/2026-11-17-00-32-49-c6ef50.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 00:30:19 +07:00 | `server/ai-book-policy.js` | — | 12–12 | const patterns = [ | modified |
| 2026-11-17 00:31:14 +07:00 | `server/ai-book-policy.test.js` | 22–22 | 22–22 | test('all four names match despite harakat, tatweel, HTML entities, line breaks, | modified |
| 2026-11-17 00:31:03 +07:00 | `server/index.js` | 24–24 | 24–24 | import {createLibraryActivity,registerLibraryActivity} from './library-activity. | modified |
| 2026-11-17 00:31:03 +07:00 | `server/index.js` | — | 932–934 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-17 00:31:03 +07:00 | `server/index.js` | — | 1350–1354 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-17 00:31:47 +07:00 | `server/search-policy.test.js` | — | 13–13 | import { | modified |
| 2026-11-17 00:31:47 +07:00 | `server/search-policy.test.js` | — | 129–144 | test('title search excludes policy books in basic mode while including in advanc | modified |

## [2026-11-17 00:35:28 +07:00] — fix(search): remove duplicate isAdvanced declaration in search_titles

Waktu pencatatan: **2026-11-17 00:35:28 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `3cd00ca`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node -c server/index.js syntax valid, 19 tests passed

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-00-35-28-26f109.json](docs/change-audit/2026-11-17-00-35-28-26f109.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 00:34:45 +07:00 | `server/index.js` | 1369–1369 | — | app.get('/api/search_titles', (req, res) => { | modified |

## [2026-11-17 08:08:27 +07:00] — Kata 'hukum' tunggal tidak lagi mengalihkan pencarian ke Tanya AI

Waktu pencatatan: **2026-11-17 08:08:27 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `f96a8bf`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js: 247 lulus, 0 gagal; npm run build (tsc -b + vite build) lulus; git diff --check bersih

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-08-08-27-5f3992.json](docs/change-audit/2026-11-17-08-08-27-5f3992.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 08:07:31 +07:00 | `dist/assets/index.dev-DQ3QdHMm.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-17 08:07:31 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-17 08:06:53 +07:00 | `server/ai-query-detector.test.js` | 29–29 | 29–29 | test('detectAiQuery detects Indonesian question words and legal/fiqh intent', () | modified |
| 2026-11-17 08:06:53 +07:00 | `server/ai-query-detector.test.js` | 80–80 | 80–80 | test('detectAiQuery still redirects short and long searches with explicit questi | modified |
| 2026-11-17 08:06:53 +07:00 | `server/ai-query-detector.test.js` | — | 94–105 | test('detectAiQuery still redirects short and long searches with explicit questi | modified |
| 2026-11-17 08:06:52 +07:00 | `src/lib/ai-query-detector.ts` | 16–17 | 16–18 | const QUESTION_WORDS_INDONESIAN_ENGLISH = new Set([ | modified |

## [2026-11-17 08:12:30 +07:00] — Catat uji deployment kata 'hukum' tunggal

Waktu pencatatan: **2026-11-17 08:12:30 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `2c75c84`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Uji online: aset index.dev-DQ3QdHMm.js cocok hash build lokal 2c75c84; hukum/hukum waris ke pencarian teks; apa hukum riba/hukum waris? ke Tanya AI

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-08-12-30-a8debc.json](docs/change-audit/2026-11-17-08-12-30-a8debc.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 08:12:30 +07:00 | `docs/deployment-log.md` | — | 1–6 | module/file | modified |

## [2026-11-17 08:33:17 +07:00] — Pesan: link dapat diklik, lampiran file/gambar dengan tempel clipboard, dan izin admin

Waktu pencatatan: **2026-11-17 08:33:17 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `23ee767`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: node --test server/*.test.js 255/255 (termasuk tes baru message-attachments, lampiran/izin/akses/migrasi kolom di messages.test.js, linkify & checkAttachment di messages-client.test.js); node --check server/messages.js, server/message-attachments.js, server/index.js; npx tsc -b; npm run build; oxlint file terkait (1 peringatan fast-refresh, tanpa error); git diff --cached --check. Browser lokal port 3091 (mini DB): bawaan tanpa tombol lampiran dan tempel gambar ditolak; setelah izin aktif tempel gambar + teks link terkirim, gambar tampil, link target _blank rel noopener; PDF nama Arab terkirim sebagai kartu unduhan; admin mini inbox memuat gambar via blob, balasan admin dengan gambar tempelan + link www; centang izin di halaman admin tersimpan; ponsel 375 px tanpa overflow. Data uji lokal, token uji, dan file uji telah dihapus. Probe produksi: nginx menerima body JSON 12 MB (jalur honeypot, tanpa penyimpanan).

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-08-33-17-abe42b.json](docs/change-audit/2026-11-17-08-33-17-abe42b.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-Bo_y6Yh2.css` | 1–2 | — | module/file | deleted |
| 2026-11-17 08:32:12 +07:00 | `dist/assets/index-Dfc9lM06.css` | — | 1–2 | module/file | added |
| 2026-11-17 08:32:12 +07:00 | `dist/assets/index.dev-CfoemnRu.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-DQ3QdHMm.js` | 1–17 | — | module/file | deleted |
| 2026-11-17 08:32:12 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-17 08:31:45 +07:00 | `docs/messages.md` | — | 1–37 | module/file | added |
| 2026-11-17 08:22:27 +07:00 | `server/index.js` | 613–613 | 613–613 | registerAdminLogs(app,{getStateDb:()=>stateDb,requireAdmin,isBusy:()=>Boolean(tr | modified |
| 2026-11-17 08:20:42 +07:00 | `server/message-attachments.js` | — | 1–91 | ATTACHMENT_LIMITS, IMAGE_TYPES, FILE_TYPES, EXT_ALIASES, starts, detectImage, isText, FILE_SIGNATURES | added |
| 2026-11-17 08:23:50 +07:00 | `server/message-attachments.test.js` | — | 1–44 | b64, PNG, parsed, bigImage, bigFile | added |
| 2026-11-17 08:27:00 +07:00 | `server/messages-client.test.js` | 3–3 | 3–4 | import assert from 'node:assert/strict'; | modified |
| 2026-11-17 08:27:00 +07:00 | `server/messages-client.test.js` | — | 21–52 | test('live and reloaded messages merge once, in order', () => { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 1–3 | MESSAGE_LIMITS, STREAM_LIMITS, now, iso, cleanMessageText, publicMessage, createMessageStore, db | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 5–5 | import {browserSession} from './ai-history.js'; | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 23–28 | export function cleanMessageText(value) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 33–33 | 43–48 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 40–43 | 55–59 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 46–46 | 62–63 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 48–48 | 65–65 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 70–79 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 66–67 | 93–94 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 71–71 | 98–98 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 147–147 | function createHub() { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 124–125 | 152–153 | function createHub() { | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 158–167 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 134–134 | — | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 136–138 | 173–176 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 150–150 | — | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 189–194 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 196–196 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 158–158 | 202–202 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 207–209 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 165–165 | 212–213 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 169–169 | 217–217 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 243–274 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 218–218 | — | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 299–303 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 223–223 | 307–309 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | 229–229 | 315–315 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 322–322 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:22:21 +07:00 | `server/messages.js` | — | 324–324 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | — | 5–7 | import Database from 'better-sqlite3'; | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | — | 11–12 | import {adminActivityIdentity} from './admin-log-identity.js'; | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | 13–13 | 18–19 | async function fixture(t, {busy = false} = {}) { | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | 15–15 | 21–21 | async function fixture(t, {busy = false} = {}) { | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | 22–22 | 28–28 | async function fixture(t, {busy = false} = {}) { | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | 47–47 | 53–53 | test('a visitor conversation with an admin reply stays isolated per browser and | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | 66–66 | 72–72 | test('a visitor conversation with an admin reply stays isolated per browser and | modified |
| 2026-11-17 08:23:49 +07:00 | `server/messages.test.js` | — | 124–187 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | 3–3 | 3–3 | import { ArrowLeft, Send, ExternalLink, Trash2 } from 'lucide-react'; | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | — | 6–6 | import type { useAdminInbox } from '../lib/use-admin-inbox'; | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | 10–10 | 11–11 | type Inbox = ReturnType<typeof useAdminInbox>; | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | — | 14–14 | export function AdminInboxMini({ inbox, onOpenFull }: { inbox: Inbox; onOpenFull | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | 17–17 | 19–20 | export function AdminInboxMini({ inbox, onOpenFull }: { inbox: Inbox; onOpenFull | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | 59–59 | 62–62 | export function AdminInboxMini({ inbox, onOpenFull }: { inbox: Inbox; onOpenFull | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | 65–68 | 68–73 | export function AdminInboxMini({ inbox, onOpenFull }: { inbox: Inbox; onOpenFull | modified |
| 2026-11-17 08:25:37 +07:00 | `src/components/AdminInboxMini.tsx` | 71–72 | 76–77 | export function AdminInboxMini({ inbox, onOpenFull }: { inbox: Inbox; onOpenFull | modified |
| 2026-11-17 08:26:21 +07:00 | `src/components/AdminMessages.tsx` | 3–3 | 3–4 | import { MessageCircle, Send, Trash2, Search, Bell, BellOff, ArrowLeft, RefreshC | modified |
| 2026-11-17 08:26:21 +07:00 | `src/components/AdminMessages.tsx` | — | 6–46 | import { threadName, useAdminInbox } from '../lib/use-admin-inbox'; | modified |
| 2026-11-17 08:26:21 +07:00 | `src/components/AdminMessages.tsx` | — | 55–55 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 08:26:21 +07:00 | `src/components/AdminMessages.tsx` | 17–17 | 60–60 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 08:26:21 +07:00 | `src/components/AdminMessages.tsx` | 35–35 | 78–79 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 08:26:21 +07:00 | `src/components/AdminMessages.tsx` | 87–87 | 131–131 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 08:26:21 +07:00 | `src/components/AdminMessages.tsx` | 93–97 | 137–145 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 08:31:10 +07:00 | `src/components/MessageParts.tsx` | — | 1–168 | MessageText, useAttachmentUrl, wanted, downloadWithToken, url, a, FileCard, className | added |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 6–7 | 6–7 | import { | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 9–9 | 9–9 | import { | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | — | 12–12 | import { AdminInboxMini } from './AdminInboxMini'; | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | — | 32–33 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 59–59 | 62–62 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 75–75 | 78–82 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 88–88 | 95–95 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | — | 161–167 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 155–156 | 169–170 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 161–161 | 175–175 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 163–163 | 177–177 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 165–165 | 179–179 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 196–196 | 210–210 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 208–208 | 222–222 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 215–215 | 229–229 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 222–224 | 236–240 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:26:42 +07:00 | `src/components/MessageWidget.tsx` | 227–228 | 243–244 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 08:24:07 +07:00 | `src/lib/linkify.ts` | — | 1–46 | URL_PATTERN, TRAILING, trimTrailing, before, last, safeHref, url, linkifyText | added |
| 2026-11-17 08:24:32 +07:00 | `src/lib/messages.ts` | 2–2 | 2–3 | MESSAGE_MAX, IMAGE_ACCEPT, FILE_EXTENSIONS, FILE_ACCEPT, attachmentKind, ext, formatBytes, checkAttachment | modified |
| 2026-11-17 08:24:32 +07:00 | `src/lib/messages.ts` | — | 5–6 | export type MessageThreadRow = {id:number; name:string; ip?:string; user_agent?: | modified |
| 2026-11-17 08:24:32 +07:00 | `src/lib/messages.ts` | — | 8–49 | export const MESSAGE_MAX = 2000; | modified |
| 2026-11-17 08:24:32 +07:00 | `src/lib/messages.ts` | 17–18 | 62–63 | export const messagesAPI = { | modified |
| 2026-11-17 08:24:32 +07:00 | `src/lib/messages.ts` | 24–24 | 69–69 | export const adminMessagesAPI = { | modified |
| 2026-11-17 08:24:32 +07:00 | `src/lib/messages.ts` | — | 71–78 | export const adminMessagesAPI = { | modified |
| 2026-11-17 08:25:36 +07:00 | `src/lib/use-admin-inbox.ts` | 2–2 | 2–2 | import { useCallback, useEffect, useRef, useState } from 'react'; | modified |
| 2026-11-17 08:25:36 +07:00 | `src/lib/use-admin-inbox.ts` | 83–83 | 83–83 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-17 08:25:36 +07:00 | `src/lib/use-admin-inbox.ts` | 98–98 | 98–98 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-17 08:25:36 +07:00 | `src/lib/use-admin-inbox.ts` | 100–100 | 100–100 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-17 08:25:36 +07:00 | `src/lib/use-admin-inbox.ts` | 104–104 | 104–104 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |

## [2026-11-17 08:42:21 +07:00] — Pesan: izin lampiran per percakapan (centang di dalam percakapan), bukan pengaturan global

Waktu pencatatan: **2026-11-17 08:42:21 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `6122435`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: node --test server/*.test.js 255/255 (messages.test.js: izin per percakapan 401/400/404, percakapan lain tetap tanpa izin, pencabutan izin menolak gambar, event SSE settings ke pengunjung dan permissions ke admin); node --check server/messages.js; npx tsc -b; npm run build; oxlint file terkait (1 peringatan fast-refresh, tanpa error); git diff --cached --check. Browser lokal port 3091: pengunjung tanpa tombol lampiran; izin gambar dari admin muncul langsung di panel pengunjung tanpa reload; pengunjung lain tetap tanpa izin; centang 'Izinkan pengunjung ini: kirim file / kirim gambar' tampil di dalam percakapan pada inbox mini dan halaman admin, tersimpan per percakapan; bar pengaturan global sudah tidak ada. Data uji, token uji, dan tabel visitor_message_settings lokal dihapus.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-08-42-21-50bcbe.json](docs/change-audit/2026-11-17-08-42-21-50bcbe.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 08:40:00 +07:00 | `dist/assets/index-C8qXYjkK.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-Dfc9lM06.css` | 1–2 | — | module/file | deleted |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-CfoemnRu.js` | 1–17 | — | module/file | deleted |
| 2026-11-17 08:40:00 +07:00 | `dist/assets/index.dev-MN8Gn6-l.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| 2026-11-17 08:40:00 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-17 08:39:32 +07:00 | `docs/messages.md` | 16–18 | 16–20 | Teks pesan tetap disimpan dan ditampilkan sebagai teks biasa, bukan HTML. `src/l | modified |
| 2026-11-17 08:39:32 +07:00 | `docs/messages.md` | 36–37 | 38–39 | Teks pesan tetap disimpan dan ditampilkan sebagai teks biasa, bukan HTML. `src/l | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 43–44 | 43–43 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | — | 48–51 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 72–78 | 75–77 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 97–97 | 96–96 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 147–147 | — | function createHub() { | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 158–158 | 156–157 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 173–173 | — | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 175–176 | 173–174 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 189–189 | 187–188 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 191–192 | 190–192 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 195–195 | — | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 198–198 | — | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | 259–274 | — | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:37:47 +07:00 | `server/messages.js` | — | 300–313 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 08:38:49 +07:00 | `server/messages.test.js` | — | 123–126 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-17 08:38:49 +07:00 | `server/messages.test.js` | 128–128 | 132–132 | const pdf = Buffer.from('%PDF-1.4\n%test\n'); | modified |
| 2026-11-17 08:38:49 +07:00 | `server/messages.test.js` | 135–142 | 139–155 | test('attachments follow the admin switches, are typed by content and only reach | modified |
| 2026-11-17 08:38:49 +07:00 | `server/messages.test.js` | 159–160 | 172–172 | test('attachments follow the admin switches, are typed by content and only reach | modified |
| 2026-11-17 08:38:49 +07:00 | `server/messages.test.js` | 163–164 | 175–180 | test('attachments follow the admin switches, are typed by content and only reach | modified |
| 2026-11-17 08:38:49 +07:00 | `server/messages.test.js` | 167–167 | — | test('attachments follow the admin switches, are typed by content and only reach | modified |
| 2026-11-17 08:38:23 +07:00 | `src/components/AdminInboxMini.tsx` | 6–6 | 6–6 | import type { useAdminInbox } from '../lib/use-admin-inbox'; | modified |
| 2026-11-17 08:38:23 +07:00 | `src/components/AdminInboxMini.tsx` | — | 70–70 | export function AdminInboxMini({ inbox, token, onOpenFull }: { inbox: Inbox; tok | modified |
| 2026-11-17 08:38:22 +07:00 | `src/components/AdminMessages.tsx` | 3–4 | 3–3 | import { MessageCircle, Send, Trash2, Search, Bell, BellOff, ArrowLeft, RefreshC | modified |
| 2026-11-17 08:38:22 +07:00 | `src/components/AdminMessages.tsx` | 6–46 | 5–5 | import { threadName, useAdminInbox } from '../lib/use-admin-inbox'; | modified |
| 2026-11-17 08:38:22 +07:00 | `src/components/AdminMessages.tsx` | 78–78 | — | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 08:38:22 +07:00 | `src/components/AdminMessages.tsx` | — | 96–96 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 08:38:09 +07:00 | `src/components/MessageParts.tsx` | 91–91 | 91–116 | export function MessageBody({ message, mine, token }: { message: ChatMessage; mi | modified |
| 2026-11-17 08:38:01 +07:00 | `src/lib/messages.ts` | 4–4 | 4–4 | export type ChatMessage = {id:number; sender:'visitor'\|'admin'; body:string; cre | modified |
| 2026-11-17 08:38:01 +07:00 | `src/lib/messages.ts` | 71–72 | 71–71 | export const adminMessagesAPI = { | modified |
| 2026-11-17 08:38:01 +07:00 | `src/lib/use-admin-inbox.ts` | — | 90–97 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-17 08:38:01 +07:00 | `src/lib/use-admin-inbox.ts` | — | 119–132 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-17 08:38:01 +07:00 | `src/lib/use-admin-inbox.ts` | 120–120 | 142–142 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |

## [2026-11-17 10:12:28 +07:00] — feat(messages): tanda terkirim (✓) dan dibaca (✓✓) per pesan

Waktu pencatatan: **2026-11-17 10:12:28 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `207a8e7`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 257/257 lulus; tsc --noEmit bersih; oxlint tanpa error baru; npm run build sukses (index.dev-Ctn--hM9.js); uji browser lokal: ✓/✓✓ di panel pengunjung berubah langsung saat admin membuka percakapan, inbox admin menampilkan Dibaca/Terkirim sesuai

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-10-12-28-046c0e.json](docs/change-audit/2026-11-17-10-12-28-046c0e.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 10:10:13 +07:00 | `dist/assets/index-BVMZo2yL.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-C8qXYjkK.css` | 1–2 | — | module/file | deleted |
| 2026-11-17 10:10:13 +07:00 | `dist/assets/index.dev-Ctn--hM9.js` | — | 1–17 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-MN8Gn6-l.js` | 1–17 | — | module/file | deleted |
| 2026-11-17 10:10:13 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-17 10:12:15 +07:00 | `docs/messages.md` | — | 36–57 | Teks pesan tetap disimpan dan ditampilkan sebagai teks biasa, bukan HTML. `src/l | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | — | 52–64 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | 89–89 | 102–107 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | 96–96 | 114–114 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | 173–174 | 191–193 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | 222–222 | 241–245 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | 270–270 | 293–293 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | 273–273 | 296–297 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | 292–292 | 316–317 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 10:03:57 +07:00 | `server/messages.js` | — | 320–320 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-17 10:07:15 +07:00 | `server/messages.test.js` | 53–53 | 53–53 | test('a visitor conversation with an admin reply stays isolated per browser and | modified |
| 2026-11-17 10:07:15 +07:00 | `server/messages.test.js` | 72–72 | 72–72 | test('a visitor conversation with an admin reply stays isolated per browser and | modified |
| 2026-11-17 10:07:15 +07:00 | `server/messages.test.js` | — | 127–165 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-17 10:04:56 +07:00 | `src/components/AdminInboxMini.tsx` | 6–6 | 6–6 | import type { useAdminInbox } from '../lib/use-admin-inbox'; | modified |
| 2026-11-17 10:04:56 +07:00 | `src/components/AdminInboxMini.tsx` | 63–63 | 63–63 | export function AdminInboxMini({ inbox, token, onOpenFull }: { inbox: Inbox; tok | modified |
| 2026-11-17 10:04:56 +07:00 | `src/components/AdminMessages.tsx` | 5–5 | 5–5 | import { threadName, useAdminInbox } from '../lib/use-admin-inbox'; | modified |
| 2026-11-17 10:04:56 +07:00 | `src/components/AdminMessages.tsx` | 90–90 | 90–90 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-17 10:04:37 +07:00 | `src/components/MessageParts.tsx` | 3–3 | 3–3 | import type { ClipboardEvent, DragEvent } from 'react'; | modified |
| 2026-11-17 10:04:37 +07:00 | `src/components/MessageParts.tsx` | 5–5 | 5–5 | import { linkifyText } from '../lib/linkify'; | modified |
| 2026-11-17 10:04:37 +07:00 | `src/components/MessageParts.tsx` | — | 91–110 | export function MessageBody({ message, mine, token }: { message: ChatMessage; mi | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 6–6 | 6–6 | import { | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 12–12 | 12–12 | import { AdminInboxMini } from './AdminInboxMini'; | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | — | 26–28 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 62–62 | 65–65 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 65–65 | 68–68 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 78–78 | 81–85 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 98–98 | 105–105 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 100–100 | 107–107 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 165–166 | 172–173 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:09:31 +07:00 | `src/components/MessageWidget.tsx` | 223–223 | 230–230 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-17 10:04:14 +07:00 | `src/lib/messages.ts` | 4–4 | 4–4 | export type ChatMessage = {id:number; sender:'visitor'\|'admin'; body:string; cre | modified |
| 2026-11-17 10:04:14 +07:00 | `src/lib/messages.ts` | 62–62 | 62–62 | export const messagesAPI = { | modified |
| 2026-11-17 10:04:55 +07:00 | `src/lib/use-admin-inbox.ts` | — | 98–107 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |

## [2026-11-17 10:42:05 +07:00] — docs: catat verifikasi online izin lampiran per percakapan dan tanda baca

Waktu pencatatan: **2026-11-17 10:42:05 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `2119225`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Bundle online cocok hash dengan build lokal; /api/messages mengembalikan readUpTo dan settings per percakapan; endpoint izin tanpa auth 401

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-10-42-05-396fc5.json](docs/change-audit/2026-11-17-10-42-05-396fc5.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 10:42:03 +07:00 | `docs/deployment-log.md` | — | 181–192 | Kredensial SSH tidak dicatat di file ini, repositori, atau perintah deployment y | modified |

## [2026-11-17 10:52:41 +07:00] — fix(messages): tanda dibaca di admin langsung (stream admin pakai token)

Waktu pencatatan: **2026-11-17 10:52:41 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `5093916`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 258/258 lulus; tsc bersih; oxlint bersih untuk file berubah; npm run build sukses (index.dev-Cxjj-1Ka.js); uji browser lokal tanpa cookie admin: ✓ -> ✓✓ di inbox admin 16 ms setelah pengunjung membaca, percakapan baru masuk daftar admin secara live

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-10-52-41-f161be.json](docs/change-audit/2026-11-17-10-52-41-f161be.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Ctn--hM9.js` | 1–17 | — | module/file | deleted |
| 2026-11-17 10:51:33 +07:00 | `dist/assets/index.dev-Cxjj-1Ka.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-17 10:51:33 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-17 10:52:39 +07:00 | `docs/messages.md` | — | 54–55 | Di bawah setiap pesan milik sendiri ada tanda di samping jam: | modified |
| 2026-11-17 10:50:15 +07:00 | `server/messages-client.test.js` | — | 5–5 | import {linkifyText,safeHref} from '../src/lib/linkify.ts'; | modified |
| 2026-11-17 10:50:15 +07:00 | `server/messages-client.test.js` | — | 58–65 | test('visitor messages are an admin view under Masukan', () => { | modified |
| 2026-11-17 10:49:01 +07:00 | `server/messages.test.js` | — | 132–137 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-17 10:48:24 +07:00 | `src/lib/auth-event-source.ts` | — | 1–71 | parseEventBlock, line, colon, field, AuthEventSource, controller, res, reader | added |
| 2026-11-17 10:48:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 4–4 | import type { ChatMessage, MessageThreadRow } from './messages'; | modified |
| 2026-11-17 10:48:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 46–48 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-17 10:48:34 +07:00 | `src/lib/use-admin-inbox.ts` | 64–65 | 68–69 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-17 10:48:34 +07:00 | `src/lib/use-admin-inbox.ts` | 68–68 | 72–75 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |

## [2026-11-17 11:28:01 +07:00] — docs: catat verifikasi online stream admin dengan token

Waktu pencatatan: **2026-11-17 11:28:01 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `ad769fc`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Bundle online cocok hash dengan build lokal; stream admin token salah 401; API pesan normal

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-11-28-01-909dc7.json](docs/change-audit/2026-11-17-11-28-01-909dc7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-17 11:28:00 +07:00 | `docs/deployment-log.md` | — | 193–201 | Waktu ini adalah pencatatan verifikasi online, bukan waktu pull di server. | modified |

## [2026-11-17 22:48:03 +07:00] — feat(admin): import Word (.docx) menjadi kitab baru

Waktu pencatatan: **2026-11-17 22:48:03 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `c4e989d`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 265/265 lulus (7 tes baru docx-import); tsc bersih; oxlint bersih untuk file berubah; npm run build sukses (index.dev-C81r78rS.js); uji browser server asli + salinan DB seed di viewport 375px: pratinjau 5 halaman/4 judul/1 catatan kaki, import ID 15399, /api/book, /api/toc, pencarian teks dan catatan kaki terverifikasi

Audit terstruktur beserta hash isi staged dan diff: [2026-11-17-22-48-03-4d4d1a.json](docs/change-audit/2026-11-17-22-48-03-4d4d1a.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BVMZo2yL.css` | 1–2 | — | module/file | deleted |
| 2026-11-17 22:42:59 +07:00 | `dist/assets/index-R2USTLa4.css` | — | 1–2 | module/file | added |
| 2026-11-17 22:42:59 +07:00 | `dist/assets/index.dev-C81r78rS.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Cxjj-1Ka.js` | 1–22 | — | module/file | deleted |
| 2026-11-17 22:42:59 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-17 22:47:53 +07:00 | `docs/word-import.md` | — | 1–53 | module/file | added |
| 2026-11-17 22:39:28 +07:00 | `server/book-transfer.js` | — | 4–4 | import { buildCategorySqlCase } from './known-categories.js'; | modified |
| 2026-11-17 22:39:28 +07:00 | `server/book-transfer.js` | — | 236–249 | export function registerBookTransfer(app, { getDb, getDbPath, requireAdmin, hasA | modified |
| 2026-11-17 22:39:28 +07:00 | `server/book-transfer.js` | 237–237 | 252–252 | export function registerBookTransfer(app, { getDb, getDbPath, requireAdmin, hasA | modified |
| 2026-11-17 22:39:28 +07:00 | `server/book-transfer.js` | 244–254 | 259–312 | export function registerBookTransfer(app, { getDb, getDbPath, requireAdmin, hasA | modified |
| 2026-11-17 22:42:35 +07:00 | `server/docx-import.js` | — | 1–248 | WORD_LIMITS, SPLIT_MODES, fail, readZip, count, out, method, nameLength | added |
| 2026-11-17 22:40:25 +07:00 | `server/docx-import.test.js` | — | 1–169 | require, sampleDocx, doc, zip, locals, raw, local, entry | added |
| 2026-11-17 22:41:32 +07:00 | `src/components/BookTransfer.tsx` | — | 7–7 | import { LargeTransfer } from './LargeTransfer'; | modified |
| 2026-11-17 22:41:32 +07:00 | `src/components/BookTransfer.tsx` | 21–21 | 22–22 | export function BookTransfer({ token, onLogout, onBack, onChanged, onStorage }: | modified |
| 2026-11-17 22:41:32 +07:00 | `src/components/BookTransfer.tsx` | 138–139 | 139–140 | export function BookTransfer({ token, onLogout, onBack, onChanged, onStorage }: | modified |
| 2026-11-17 22:41:32 +07:00 | `src/components/BookTransfer.tsx` | 143–145 | 144–147 | export function BookTransfer({ token, onLogout, onBack, onChanged, onStorage }: | modified |
| 2026-11-17 22:41:32 +07:00 | `src/components/BookTransfer.tsx` | 160–160 | 162–162 | export function BookTransfer({ token, onLogout, onBack, onChanged, onStorage }: | modified |
| 2026-11-17 22:41:21 +07:00 | `src/components/WordImport.tsx` | — | 1–171 | MAX_BYTES, arabic, readAsDataUrl, reader, WordImport, inputRef, setBusy, post | added |

## [2026-11-18 07:37:00 +07:00] — feat(ai): riwayat tanya AI global pada dashboard dan riwayat pribadi pada halaman tanya AI

Waktu pencatatan: **2026-11-18 07:37:00 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `f1497fc`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 265 tes server lulus (termasuk tes scope=global dan isolasi per-session di ai-history.test.js); tsc -b lulus tanpa error; oxlint 0 error; npm run build sukses menghasilkan dist/assets/index.dev-CGIBHMKI.js; git diff staged bersih

Audit terstruktur beserta hash isi staged dan diff: [2026-11-18-07-37-00-5b553b.json](docs/change-audit/2026-11-18-07-37-00-5b553b.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-18 07:35:49 +07:00 | `dist/assets/index.dev-CGIBHMKI.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-18 07:35:49 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-18 07:32:22 +07:00 | `server/ai-history.js` | 42–42 | 42–42 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-18 07:32:22 +07:00 | `server/ai-history.js` | 44–45 | 44–46 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-18 07:32:22 +07:00 | `server/ai-history.js` | 47–47 | 48–50 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-18 07:32:22 +07:00 | `server/ai-history.js` | 49–49 | 52–61 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-18 07:32:22 +07:00 | `server/ai-history.js` | 52–52 | 64–66 | export function registerAiHistory(app,{getStateDb}) { | modified |
| 2026-11-18 07:32:45 +07:00 | `server/ai-history.test.js` | 7–7 | 7–7 | import {registerAiHistory} from './ai-history.js'; | modified |
| 2026-11-18 07:32:45 +07:00 | `server/ai-history.test.js` | 11–11 | 11–11 | test('two browsers on the same IP have isolated history; legacy rows remain admi | modified |
| 2026-11-18 07:32:45 +07:00 | `server/ai-history.test.js` | 17–20 | 17–31 | test('two browsers on the same IP have isolated history; legacy rows remain admi | modified |
| 2026-11-18 07:33:46 +07:00 | `src/App.tsx` | 259–259 | 259–259 | function App() { | modified |
| 2026-11-18 07:33:46 +07:00 | `src/App.tsx` | 646–646 | 646–646 | function App() { | modified |
| 2026-11-18 07:33:46 +07:00 | `src/App.tsx` | 656–656 | 656–656 | function App() { | modified |
| 2026-11-18 07:33:29 +07:00 | `src/api.ts` | 277–278 | 277–281 | export const webAPI = { | modified |
| 2026-11-18 07:34:19 +07:00 | `src/components/AskAI.tsx` | 215–215 | 215–215 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |
| 2026-11-18 07:34:19 +07:00 | `src/components/AskAI.tsx` | 231–231 | 231–231 | export default function AskAI({ openBook, initialQuestion = '', questionVersion | modified |

## [2026-11-18 21:44:59 +07:00] — feat(admin): tambah icon view web di sebelah kiri tombol logout pada header admin

Waktu pencatatan: **2026-11-18 21:44:59 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `9af038b`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: tsc -b lulus tanpa error; oxlint 0 error; npm run build produksi sukses menghasilkan dist/assets/index.dev-DBn9EBhc.js; 4 tes navigasi/identitas admin lulus; git diff staged terverifikasi rapi

Audit terstruktur beserta hash isi staged dan diff: [2026-11-18-21-44-59-54fded.json](docs/change-audit/2026-11-18-21-44-59-54fded.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index.dev-CGIBHMKI.js` | 1–22 | — | module/file | deleted |
| 2026-11-18 21:44:21 +07:00 | `dist/assets/index.dev-DBn9EBhc.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-18 21:44:21 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-18 21:43:02 +07:00 | `src/components/Admin.tsx` | 21–21 | 21–21 | import type { AdminView } from '../lib/admin-navigation'; | modified |
| 2026-11-18 21:43:02 +07:00 | `src/components/Admin.tsx` | — | 1361–1361 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |

## [2026-11-18 22:03:52 +07:00] — feat(admin): grafik harian seluruh log dan rincian aktivitas hari ini pada header admin

Waktu pencatatan: **2026-11-18 22:03:52 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b161ea7`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/admin-logs.test.js lulus (7 tes termasuk agregasi harian & tren 7 hari); tsc -b lulus tanpa error; oxlint 0 error; npm run build sukses (dist/assets/index.dev-BxDvxzwY.js dan index-DVH1WChB.css); git diff staged rapi

Audit terstruktur beserta hash isi staged dan diff: [2026-11-18-22-03-52-65f42a.json](docs/change-audit/2026-11-18-22-03-52-65f42a.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-18 22:03:08 +07:00 | `dist/assets/index-DVH1WChB.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-R2USTLa4.css` | 1–2 | — | module/file | deleted |
| 2026-11-18 22:03:08 +07:00 | `dist/assets/index.dev-BxDvxzwY.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-DBn9EBhc.js` | 1–22 | — | module/file | deleted |
| 2026-11-18 22:03:08 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-18 22:01:43 +07:00 | `server/admin-logs.test.js` | — | 93–114 | test('admin activity cookies are HttpOnly, same-site and cleared on logout',()=> | modified |
| 2026-11-18 21:59:08 +07:00 | `server/index.js` | — | 606–648 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-18 22:01:15 +07:00 | `src/components/Admin.tsx` | — | 23–23 | import { CategoryMergeModal } from './CategoryMergeModal'; | modified |
| 2026-11-18 22:01:15 +07:00 | `src/components/Admin.tsx` | — | 1361–1361 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-18 22:02:28 +07:00 | `src/components/AdminDailyChart.tsx` | — | 1–303 | LOG_META, AdminDailyChart, maxTotal, isToday, heightPct, Icon, val, parts | added |

## [2026-11-18 22:21:58 +07:00] — feat(admin): tanda status terjawab atau menyerah pada list log tanya AI

Waktu pencatatan: **2026-11-18 22:21:58 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `41bf498`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: tsc -b lulus 0 error; oxlint 0 error; 55 unit tests lulus; build produksi index.dev-BlKRhWQo.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-18-22-21-58-a5150d.json](docs/change-audit/2026-11-18-22-21-58-a5150d.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-18 22:21:38 +07:00 | `dist/assets/index-770Vpm03.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DVH1WChB.css` | 1–2 | — | module/file | deleted |
| 2026-11-18 22:21:38 +07:00 | `dist/assets/index.dev-BlKRhWQo.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-BxDvxzwY.js` | 1–22 | — | module/file | deleted |
| 2026-11-18 22:21:38 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-18 22:20:25 +07:00 | `src/components/Admin.tsx` | — | 1070–1171 | const SubmissionsView = ({ token, onLogout }: { token: string, onLogout: () => v | modified |
| 2026-11-18 22:20:25 +07:00 | `src/components/Admin.tsx` | — | 1266–1279 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:20:25 +07:00 | `src/components/Admin.tsx` | 1183–1184 | 1299–1302 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:20:25 +07:00 | `src/components/Admin.tsx` | 1221–1225 | 1339–1354 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:20:25 +07:00 | `src/components/Admin.tsx` | 1234–1234 | 1363–1363 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |

## [2026-11-18 22:44:11 +07:00] — feat(admin): card jumlah sukses jawab dan gagal jawab serta filter status di log tanya AI

Waktu pencatatan: **2026-11-18 22:44:11 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `250bd92`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: tsc -b lulus 0 error; oxlint 0 error; 56 unit tests lulus; build produksi index.dev-2FCPuIGP.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-18-22-44-11-389d45.json](docs/change-audit/2026-11-18-22-44-11-389d45.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-770Vpm03.css` | 1–2 | — | module/file | deleted |
| 2026-11-18 22:43:58 +07:00 | `dist/assets/index-BhI0iUzC.css` | — | 1–2 | module/file | added |
| 2026-11-18 22:43:58 +07:00 | `dist/assets/index.dev-2FCPuIGP.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-18 22:43:58 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-18 22:41:18 +07:00 | `server/admin-logs.js` | 18–18 | 18–28 | function definitions(db,type) { | modified |
| 2026-11-18 22:41:18 +07:00 | `server/admin-logs.js` | 22–22 | 32–32 | function filtersFor(def,raw={}) { | modified |
| 2026-11-18 22:41:18 +07:00 | `server/admin-logs.js` | — | 48–51 | function filtersFor(def,raw={}) { | modified |
| 2026-11-18 22:41:18 +07:00 | `server/admin-logs.js` | — | 70–81 | export function readAdminLogs(db,type,raw={}) { | modified |
| 2026-11-18 22:41:18 +07:00 | `server/admin-logs.js` | 63–63 | 89–89 | export function readAdminLogs(db,type,raw={}) { | modified |
| 2026-11-18 22:41:42 +07:00 | `server/admin-logs.test.js` | — | 115–134 | test('daily stats aggregate all 8 log types for today and compute 7-day trend',t | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | — | 1178–1178 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | 1180–1180 | 1181–1181 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | 1183–1184 | 1184–1185 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | 1215–1215 | 1216–1216 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | 1229–1229 | 1230–1230 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | 1232–1232 | 1233–1233 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | — | 1235–1287 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | — | 1314–1316 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-18 22:42:59 +07:00 | `src/components/Admin.tsx` | 1268–1277 | 1325–1343 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |

## [2026-11-19 20:44:46 +07:00] — feat(authors): gabung paket penulis lama + label sumber build

Waktu pencatatan: **2026-11-19 20:44:46 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `d069a67`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 268/268 lulus (tes baru merge-author-packages); oxlint bersih; paket Golden digabung: inspectAuthorPackage OK, integrity ok, install ke store sementara + authorList: 3.109 penulis, 2.912 punya kitab, 16.135 relasi, 0 relasi lama hilang

Audit terstruktur beserta hash isi staged dan diff: [2026-11-19-20-44-46-b660d4.json](docs/change-audit/2026-11-19-20-44-46-b660d4.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-19 20:44:45 +07:00 | `docs/authors.md` | — | 67–97 | Argumen database tambahan boleh `-`. Hash manifest adalah gabungan hash dua MDB | modified |
| 2026-11-19 20:42:52 +07:00 | `scripts/build-author-db.js` | 6–7 | 6–7 | import {authorSchema,normalizeIdentity,matchAuthorIdentity,AUTHOR_FORMAT,AUTHOR_ | modified |
| 2026-11-19 20:42:52 +07:00 | `scripts/build-author-db.js` | 51–51 | 51–51 | try { | modified |
| 2026-11-19 20:42:51 +07:00 | `scripts/merge-author-packages.js` | — | 1–46 | prevSource, byKey, linked, hasWork, putAuthor, mapped, key, id | added |
| 2026-11-19 20:43:50 +07:00 | `server/merge-author-packages.test.js` | — | 1–41 | script, makePackage, db, dir, works, output, result, links | added |

## [2026-11-20 07:18:44 +07:00] — Samakan arti hari ini di log admin menjadi sejak 00:00 WIB

Waktu pencatatan: **2026-11-20 07:18:44 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1c89f90`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/index.js dan admin-logs.js OK; node --test server/*.test.js 269/269 lulus (tes baru: log 1 detik sebelum 00:00 WIB tidak dihitung hari ini); npm run build (tsc -b + vite) sukses; oxlint tanpa error baru

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-07-18-44-511375.json](docs/change-audit/2026-11-20-07-18-44-511375.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 07:18:26 +07:00 | `dist/assets/index.dev-CSAmZmvI.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-20 07:18:26 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-20 07:17:21 +07:00 | `docs/library-activity.md` | 3–3 | 3–3 | module/file | modified |
| 2026-11-20 07:16:52 +07:00 | `server/admin-logs.js` | — | 2–4 | const tables={search:'search_logs',ask:'ask_logs',visit:'visit_logs',download:'d | modified |
| 2026-11-20 07:16:52 +07:00 | `server/admin-logs.js` | 66–66 | 69–69 | export function readAdminLogs(db,type,raw={}) { | modified |
| 2026-11-20 07:16:52 +07:00 | `server/admin-logs.js` | 74–75 | 77–78 | export function readAdminLogs(db,type,raw={}) { | modified |
| 2026-11-20 07:17:16 +07:00 | `server/admin-logs.test.js` | 5–5 | 5–5 | import express from 'express'; | modified |
| 2026-11-20 07:17:16 +07:00 | `server/admin-logs.test.js` | 102–102 | 102–102 | test('daily stats aggregate all 8 log types for today and compute 7-day trend',t | modified |
| 2026-11-20 07:17:16 +07:00 | `server/admin-logs.test.js` | — | 135–145 | test('tanya AI logs compute answered and failed stats and allow filtering by sta | modified |
| 2026-11-20 07:16:52 +07:00 | `server/index.js` | 26–26 | 26–26 | import {adminActivityIdentity,setAdminActivityCookie} from './admin-log-identity | modified |
| 2026-11-20 07:16:52 +07:00 | `server/index.js` | 617–617 | 617–617 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-20 07:16:52 +07:00 | `src/components/Admin.tsx` | 1290–1290 | 1290–1290 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |

## [2026-11-20 07:22:57 +07:00] — Catat verifikasi online 75bc98d

Waktu pencatatan: **2026-11-20 07:22:57 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `75bc98d`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Hash aset online cocok dengan build lokal; endpoint admin tanpa autentikasi 401

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-07-22-57-37cebe.json](docs/change-audit/2026-11-20-07-22-57-37cebe.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 07:22:57 +07:00 | `docs/deployment-log.md` | — | 202–210 | Waktu ini adalah pencatatan verifikasi online, bukan waktu pull di server. | modified |

## [2026-11-20 09:30:38 +07:00] — Keluarkan Ibnu Taimiyah dari daftar blokir kitab (kebijakan v5) dan periksa ulang status pencarian lama

Waktu pencatatan: **2026-11-20 09:30:38 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `c7716c7`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 271/271 lulus (tes baru: varian ابن تيمية tidak diblokir; kitab blokir versi lama diperiksa ulang bertahap); node --check OK; oxlint tanpa error; uji waktu baca-saja pada D:/db/maktabah.db: 2.433 halaman 0,8 dtk

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-09-30-38-e4404d.json](docs/change-audit/2026-11-20-09-30-38-e4404d.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 1–1 | 1–1 | module/file | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 3–3 | 3–3 | module/file | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 5–5 | 5–5 | Tanya AI mengecualikan seluruh kitab apabila satu atau lebih halaman `pages.nass | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 7–7 | 7–7 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 9–13 | 9–13 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 15–15 | 15–19 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 17–17 | 21–21 | Jika seluruh sumber tersaring, respons menjelaskan belum ditemukannya konteks ya | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 19–19 | 23–26 | Jika seluruh sumber tersaring, respons menjelaskan belum ditemukannya konteks ya | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 21–21 | 28–28 | Sumber berbasis file dipindai melalui worker dengan koneksi SQLite hanya-baca; t | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 23–23 | 30–30 | Hasil pemeriksaan disimpan dalam memori per koneksi/sumber dan maksimal 2.048 ID | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 25–25 | 32–32 | Hasil pemeriksaan disimpan dalam memori per koneksi/sumber dan maksimal 2.048 ID | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 27–27 | 34–34 | Tes meliputi keempat nama dan normalisasinya, pemicu pada halaman lain, katalog, | modified |
| 2026-11-20 09:30:21 +07:00 | `docs/ai-book-policy.md` | 29–29 | 36–72 | Perubahan hanya backend dan tes/dokumentasi, sehingga tidak memerlukan perubahan | modified |
| 2026-11-20 09:28:03 +07:00 | `server/ai-book-policy.js` | 4–5 | 4–8 | import {sourceText} from './ai-source.js'; | modified |
| 2026-11-20 09:28:03 +07:00 | `server/ai-book-policy.js` | 7–7 | 10–10 | export const excludedAiNames = ['ابن تيمية','ابن باز','ابن عث | modified |
| 2026-11-20 09:28:03 +07:00 | `server/ai-book-policy.js` | 10–10 | — | const patterns = [ | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | 14–14 | 14–14 | function fixture(t, filename=':memory:') { | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | 19–19 | 19–19 | function fixture(t, filename=':memory:') { | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | 21–21 | — | test('all four names match despite harakat, tatweel, HTML entities, line breaks, | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | — | 22–22 | test('all four names match despite harakat, tatweel, HTML entities, line breaks, | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | — | 26–27 | test('all four names match despite harakat, tatweel, HTML entities, line breaks, | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | 39–39 | 41–41 | test('same book ID in either attached source is excluded and other books remain | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | 65–65 | 67–67 | test('file-backed scanning is read-only and detects edits by an external connect | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | 90–90 | 92–92 | test('a name only in an editor footnote does not exclude the book, but an excerp | modified |
| 2026-11-20 09:28:44 +07:00 | `server/ai-book-policy.test.js` | 92–93 | 94–95 | test('a name only in an editor footnote does not exclude the book, but an excerp | modified |
| 2026-11-20 09:29:10 +07:00 | `server/ask-ai.test.js` | 278–278 | 278–278 | test('whole-book exclusion removes clean-looking hits and catalogue metadata wit | modified |
| 2026-11-20 09:29:10 +07:00 | `server/ask-ai.test.js` | 287–287 | 287–287 | test('selected-page explanation and translation reject the entire excluded book | modified |
| 2026-11-20 09:29:10 +07:00 | `server/ask-ai.test.js` | 310–310 | 310–310 | test('a book becoming excluded during generation or semantic review cannot be re | modified |
| 2026-11-20 09:29:10 +07:00 | `server/ask-ai.test.js` | 337–337 | 337–337 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-20 09:29:10 +07:00 | `server/ask-ai.test.js` | 340–340 | 340–340 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-20 09:29:10 +07:00 | `server/ask-ai.test.js` | 446–446 | 446–446 | test('when every matching page belongs to an excluded book, the reply names the | modified |
| 2026-11-20 09:28:11 +07:00 | `server/index.js` | 32–32 | 32–32 | import { searchPagesOffThread, SEARCH_COUNT_CAP } from './text-search.js'; | modified |
| 2026-11-20 09:28:11 +07:00 | `server/index.js` | 342–343 | 342–348 | try { | modified |
| 2026-11-20 09:28:11 +07:00 | `server/index.js` | 346–346 | 351–352 | try { | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 1–1 | 1–1 | ensureSearchPolicySchema, POLICY_UPSERT, excludedReason, reconcileSearchPolicyBatch, schemas, stale, rows, decisions | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | — | 20–65 | export function ensureSearchPolicySchema(stateDb) { | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 61–61 | 107–107 | export function syncMetadataExclusions(db, stateDb, { hasTambahan = false } = {} | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 75–75 | 121–121 | export function syncMetadataExclusions(db, stateDb, { hasTambahan = false } = {} | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 77–77 | 123–123 | export function syncMetadataExclusions(db, stateDb, { hasTambahan = false } = {} | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 114–114 | 160–160 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 119–119 | 165–165 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 131–131 | 177–177 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 139–139 | 185–185 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 167–167 | 213–213 | export function scanFtsCandidateBooks(db, stateDb, { hasTambahan = false, limitP | modified |
| 2026-11-20 09:28:03 +07:00 | `server/search-policy.js` | 184–184 | 230–230 | export function scanFtsCandidateBooks(db, stateDb, { hasTambahan = false, limitP | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | — | 12–12 | import { | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | 13–13 | 14–14 | import { | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | 36–36 | 37–37 | test('search policy syncs title and author exclusions accurately', t => { | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | 43–43 | 44–44 | test('search policy syncs title and author exclusions accurately', t => { | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | 96–96 | 97–97 | test('scanFtsCandidateBooks identifies books matching FTS terms and evaluates bo | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | 110–110 | 111–111 | test('title search excludes policy books in basic mode while including in advanc | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | 131–131 | 132–132 | test('search query for excluded name returns empty in basic mode and allows in a | modified |
| 2026-11-20 09:28:59 +07:00 | `server/search-policy.test.js` | — | 146–179 | test('search query for excluded name returns empty in basic mode and allows in a | modified |

## [2026-11-20 09:34:57 +07:00] — Persempit pola Ibnu Baz ke البازية (kebijakan v6) dan pindahkan pemeriksaan ulang ke worker

Waktu pencatatan: **2026-11-20 09:34:57 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `3273833`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 272/272 lulus (tes baru: البازي/elang tidak diblokir; pemeriksaan ulang database file lewat worker); node --check OK; oxlint tanpa error baru; uji hanya-baca D:/db/maktabah.db: kitab 225, 346, 5564 terbuka dalam 5,0 dtk dengan event loop tetap berjalan (46 tick 100 ms)

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-09-34-57-3a51f8.json](docs/change-audit/2026-11-20-09-34-57-3a51f8.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 09:34:44 +07:00 | `docs/ai-book-policy.md` | 3–3 | 3–3 | module/file | modified |
| 2026-11-20 09:34:44 +07:00 | `docs/ai-book-policy.md` | 11–11 | 11–11 | Sebuah kitab dikecualikan seluruhnya bila satu atau lebih halaman `pages.nass` m | modified |
| 2026-11-20 09:34:44 +07:00 | `docs/ai-book-policy.md` | — | 25–25 | Nama tetap cocok walau hanya disebut atau dikritik. Catatan kaki pentahqiq (teks | modified |
| 2026-11-20 09:34:44 +07:00 | `docs/ai-book-policy.md` | 28–29 | — | Nama tetap cocok walau hanya disebut atau dikritik. Catatan kaki pentahqiq (teks | modified |
| 2026-11-20 09:34:44 +07:00 | `docs/ai-book-policy.md` | 52–52 | 51–51 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-20 09:34:44 +07:00 | `docs/ai-book-policy.md` | 55–55 | 54–54 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-20 09:34:33 +07:00 | `server/ai-book-policy.js` | 6–6 | 6–6 | import {sourceText} from './ai-source.js'; | modified |
| 2026-11-20 09:34:33 +07:00 | `server/ai-book-policy.js` | — | 8–8 | export const AI_BOOK_POLICY_VERSION = 'whole-book-exclusions-v5'; | modified |
| 2026-11-20 09:34:33 +07:00 | `server/ai-book-policy.js` | 14–14 | 15–16 | const patterns = [ | modified |
| 2026-11-20 09:34:33 +07:00 | `server/ai-book-policy.js` | — | 86–92 | function workerScan(sources, ids, signal) { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/ai-book-policy.test.js` | 29–29 | 29–29 | test('all three names match despite harakat, tatweel, HTML entities, line breaks | modified |
| 2026-11-20 09:34:33 +07:00 | `server/ask-ai.test.js` | 340–340 | 340–340 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-20 09:34:33 +07:00 | `server/index.js` | 342–344 | 342–346 | try { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/index.js` | 346–347 | 348–348 | try { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/index.js` | — | 350–354 | try { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 1–1 | 1–1 | ensureSearchPolicySchema, POLICY_UPSERT, metadataReason, reconcileSearchPolicyBatch, schemas, stale, rows, reasons | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 27–27 | 27–27 | const POLICY_UPSERT = 'INSERT OR REPLACE INTO search_book_policy (bkid, excluded | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 38–42 | — | function excludedReason(db, schemas, bkid) { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 47–47 | 42–42 | function excludedReason(db, schemas, bkid) { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 50–50 | 45–46 | function excludedReason(db, schemas, bkid) { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 52–52 | 48–48 | function excludedReason(db, schemas, bkid) { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 61–61 | 57–61 | export function reconcileSearchPolicyBatch(db, stateDb, { hasTambahan = false, l | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.js` | 63–63 | 63–63 | export function reconcileSearchPolicyBatch(db, stateDb, { hasTambahan = false, l | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.test.js` | — | 4–6 | import Database from 'better-sqlite3'; | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.test.js` | 153–153 | 156–156 | test('ابن تيمية is no longer a blocked search query', () => { | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.test.js` | 168–170 | 171–173 | test('books excluded under an older policy version are re-checked and released w | modified |
| 2026-11-20 09:34:33 +07:00 | `server/search-policy.test.js` | 178–178 | 181–200 | test('books excluded under an older policy version are re-checked and released w | modified |

## [2026-11-20 21:01:44 +07:00] — Buka blokir kata sifat البازية dan الألبانية (kebijakan v7)

Waktu pencatatan: **2026-11-20 21:01:44 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b6426dc`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 272/272 lulus (tes baru: البازية/البازيه/الألبانية/الالبانيه beserta awalan tidak diblokir; الألباني, ابن باز, العثيمين tetap diblokir); node --check OK

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-21-01-44-21f2cf.json](docs/change-audit/2026-11-20-21-01-44-21f2cf.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 21:01:17 +07:00 | `docs/ai-book-policy.md` | 3–3 | 3–3 | module/file | modified |
| 2026-11-20 21:01:17 +07:00 | `docs/ai-book-policy.md` | 11–11 | 11–11 | Sebuah kitab dikecualikan seluruhnya bila satu atau lebih halaman `pages.nass` m | modified |
| 2026-11-20 21:01:17 +07:00 | `docs/ai-book-policy.md` | 13–13 | 13–13 | Sebuah kitab dikecualikan seluruhnya bila satu atau lebih halaman `pages.nass` m | modified |
| 2026-11-20 21:01:17 +07:00 | `docs/ai-book-policy.md` | — | 26–26 | Nama tetap cocok walau hanya disebut atau dikritik. Catatan kaki pentahqiq (teks | modified |
| 2026-11-20 21:01:16 +07:00 | `server/ai-book-policy.js` | 6–6 | 6–6 | import {sourceText} from './ai-source.js'; | modified |
| 2026-11-20 21:01:16 +07:00 | `server/ai-book-policy.js` | — | 9–9 | export const AI_BOOK_POLICY_VERSION = 'whole-book-exclusions-v6'; | modified |
| 2026-11-20 21:01:16 +07:00 | `server/ai-book-policy.js` | 15–16 | — | const patterns = [ | modified |
| 2026-11-20 21:01:16 +07:00 | `server/ai-book-policy.js` | 18–18 | 17–17 | const patterns = [ | modified |
| 2026-11-20 21:01:17 +07:00 | `server/ai-book-policy.test.js` | 21–21 | 21–21 | test('all three names match despite harakat, tatweel, HTML entities, line breaks | modified |
| 2026-11-20 21:01:17 +07:00 | `server/ai-book-policy.test.js` | 24–24 | 24–24 | test('all three names match despite harakat, tatweel, HTML entities, line breaks | modified |
| 2026-11-20 21:01:17 +07:00 | `server/ai-book-policy.test.js` | 29–29 | 29–29 | test('all three names match despite harakat, tatweel, HTML entities, line breaks | modified |
| 2026-11-20 21:01:17 +07:00 | `server/ask-ai.test.js` | 340–340 | 340–340 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-20 21:01:17 +07:00 | `server/search-policy.test.js` | 135–135 | 135–135 | test('search query for excluded name returns empty in basic mode and allows in a | modified |

## [2026-11-20 21:05:04 +07:00] — Catat verifikasi online kebijakan blokir v7

Waktu pencatatan: **2026-11-20 21:05:04 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `0846a91`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: api/ai/status v7; pencarian teks dan judul online sesuai daftar blokir baru

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-21-05-04-969d1c.json](docs/change-audit/2026-11-20-21-05-04-969d1c.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 21:05:04 +07:00 | `docs/deployment-log.md` | — | 211–222 | Waktu ini adalah pencatatan verifikasi online, bukan waktu pull di server. | modified |

## [2026-11-20 21:11:28 +07:00] — Blokir frasa شيخ الإسلام ابن تيمية (kebijakan v8)

Waktu pencatatan: **2026-11-20 21:11:28 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `713f4a6`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 272/272 lulus (tes baru: frasa شيخ الإسلام/الاسلام ابن تيمية beserta varian diblokir; ابن تيمية, الشيخ ابن تيمية, الإمام ابن تيمية tetap lolos); node --check OK; cek hanya-baca D:/db/maktabah.db: 5564, 6812, 346 diblokir, 225 dan 2620 lolos

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-21-11-28-3b020f.json](docs/change-audit/2026-11-20-21-11-28-3b020f.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 21:11:27 +07:00 | `docs/ai-book-policy.md` | 3–3 | 3–3 | module/file | modified |
| 2026-11-20 21:11:27 +07:00 | `docs/ai-book-policy.md` | — | 14–14 | Sebuah kitab dikecualikan seluruhnya bila satu atau lebih halaman `pages.nass` m | modified |
| 2026-11-20 21:11:27 +07:00 | `docs/ai-book-policy.md` | — | 28–31 | Nama tetap cocok walau hanya disebut atau dikritik. Catatan kaki pentahqiq (teks | modified |
| 2026-11-20 21:08:18 +07:00 | `server/ai-book-policy.js` | 6–6 | 6–6 | import {sourceText} from './ai-source.js'; | modified |
| 2026-11-20 21:08:18 +07:00 | `server/ai-book-policy.js` | 10–10 | 10–12 | export const AI_BOOK_POLICY_VERSION = 'whole-book-exclusions-v7'; | modified |
| 2026-11-20 21:08:18 +07:00 | `server/ai-book-policy.js` | — | 20–20 | const patterns = [ | modified |
| 2026-11-20 21:10:40 +07:00 | `server/ai-book-policy.test.js` | 19–19 | 19–19 | function fixture(t, filename=':memory:') { | modified |
| 2026-11-20 21:10:40 +07:00 | `server/ai-book-policy.test.js` | — | 25–25 | test('all three names match despite harakat, tatweel, HTML entities, line breaks | modified |
| 2026-11-20 21:10:40 +07:00 | `server/ai-book-policy.test.js` | 26–27 | 27–29 | test('all three names match despite harakat, tatweel, HTML entities, line breaks | modified |
| 2026-11-20 21:09:16 +07:00 | `server/ask-ai.test.js` | 340–340 | 340–340 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-20 21:08:24 +07:00 | `server/search-policy.js` | 185–185 | 185–185 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 21:08:46 +07:00 | `server/search-policy.test.js` | 150–151 | 150–152 | test('search query for excluded name returns empty in basic mode and allows in a | modified |
| 2026-11-20 21:08:46 +07:00 | `server/search-policy.test.js` | 193–193 | 194–194 | test('re-check of a file-backed library scans pages in the worker and releases f | modified |

## [2026-11-20 21:33:19 +07:00] — Pemindaian penuh search policy di worker latar belakang (semua kitab, bukan 200 per istilah)

Waktu pencatatan: **2026-11-20 21:33:19 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b73e039`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 271/271 lulus (tes baru: worker memutuskan semua kitab di database utama+tambahan, hanya memindai ulang kitab baru/berubah/diedit, versi baru memindai ulang semua, antrean pemindaian); node --check OK; oxlint tanpa error baru; uji hanya-baca D:/db/maktabah.db: 317 kitab dalam 45,7 dtk dengan jeda 50%, jeda event loop maks 117 ms, 5564/6812/346 diblokir, 225 lolos; saringan cepat 0 beda dari 93.702 halaman sampel

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-21-33-19-9b306c.json](docs/change-audit/2026-11-20-21-33-19-9b306c.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 21:32:02 +07:00 | `docs/ai-book-policy.md` | 52–60 | 52–72 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-20 21:32:02 +07:00 | `docs/ai-book-policy.md` | 73–74 | 85–86 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-20 21:18:26 +07:00 | `server/ai-book-policy.js` | — | 28–34 | export const policyBody = text => sourceText(text).split(/_{4,}/u)[0]; | modified |
| 2026-11-20 21:18:26 +07:00 | `server/ai-book-policy.js` | — | 36–36 | export const containsExcludedAiName = text => { | modified |
| 2026-11-20 21:18:26 +07:00 | `server/ai-book-policy.js` | 88–93 | 96–97 | function workerScan(sources, ids, signal) { | modified |
| 2026-11-20 21:30:22 +07:00 | `server/index.js` | 32–32 | 32–32 | import { searchPagesOffThread, SEARCH_COUNT_CAP } from './text-search.js'; | modified |
| 2026-11-20 21:30:22 +07:00 | `server/index.js` | 199–199 | 199–215 | let invalidateHadithIndex=()=>{}; | modified |
| 2026-11-20 21:30:22 +07:00 | `server/index.js` | 342–358 | 358–358 | try { | modified |
| 2026-11-20 21:30:22 +07:00 | `server/index.js` | 803–803 | 803–803 | app.put('/api/admin/page/:bookId/:pageId', requireAdmin, (req, res) => { | modified |
| 2026-11-20 21:30:22 +07:00 | `server/index.js` | 815–815 | 815–815 | app.delete('/api/admin/page/:bookId/:pageId', requireAdmin, (req, res) => { | modified |
| 2026-11-20 21:30:22 +07:00 | `server/index.js` | — | 971–978 | app.delete('/api/admin/book-submission/:id', requireAdmin, (req, res) => { | modified |
| 2026-11-20 21:29:37 +07:00 | `server/search-policy-worker.js` | — | 1–60 | pause, dbs, db, meta, hasAuthors, sql, fingerprints, decided | added |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 1–1 | 1–2 | ensureSearchPolicySchema, POLICY_UPSERT, ensureTempExcludedTable, ins, getExcludedBookIds, rows, invalidateSearchPolicyCache, syncMetadataExclusions | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 20–21 | 21–22 | export function ensureSearchPolicySchema(stateDb) { | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | — | 24–24 | export function ensureSearchPolicySchema(stateDb) { | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 27–67 | — | const POLICY_UPSERT = 'INSERT OR REPLACE INTO search_book_policy (bkid, excluded | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | — | 95–96 | export function syncMetadataExclusions(db, stateDb, { hasTambahan = false } = {} | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 135–135 | 98–103 | export function syncMetadataExclusions(db, stateDb, { hasTambahan = false } = {} | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 137–137 | 105–106 | export function syncMetadataExclusions(db, stateDb, { hasTambahan = false } = {} | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 139–166 | 108–132 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 168–182 | 134–147 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 185–210 | 150–151 | export function scanUncheckedBooks(db, stateDb, { hasTambahan = false, limit = 5 | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 212–232 | 153–154 | export function scanFtsCandidateBooks(db, stateDb, { hasTambahan = false, limitP | modified |
| 2026-11-20 21:30:02 +07:00 | `server/search-policy.js` | 234–235 | 156–158 | export function scanFtsCandidateBooks(db, stateDb, { hasTambahan = false, limitP | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 10–10 | — | import { | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 14–15 | 13–15 | import { | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 17–17 | 17–17 | import { | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 53–75 | — | test('search policy syncs title and author exclusions accurately', t => { | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 89–111 | — | test('ensureTempExcludedTable creates and populates temporary table for subqueri | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 157–185 | 111–112 | test('ابن تيمية is no longer a blocked search query, but the phrase شي | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | — | 114–117 | test('re-check of a file-backed library scans pages in the worker and releases f | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | — | 119–119 | test('re-check of a file-backed library scans pages in the worker and releases f | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 189–196 | 121–122 | test('re-check of a file-backed library scans pages in the worker and releases f | modified |
| 2026-11-20 21:31:48 +07:00 | `server/search-policy.test.js` | 198–201 | 124–177 | test('re-check of a file-backed library scans pages in the worker and releases f | modified |

## [2026-11-20 21:41:11 +07:00] — Catat verifikasi online pemindaian penuh search policy

Waktu pencatatan: **2026-11-20 21:41:11 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `afc99d0`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: policy-status v8 berjalan 1.625/36.159; endpoint responsif selama pemindaian

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-21-41-11-719f25.json](docs/change-audit/2026-11-20-21-41-11-719f25.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 21:41:10 +07:00 | `docs/deployment-log.md` | — | 223–243 | Waktu ini adalah pencatatan verifikasi online, bukan waktu pull di server. | modified |

## [2026-11-20 22:05:26 +07:00] — Fitur pencarian di beberapa kitab yang dicentang (book_ids)

Waktu pencatatan: **2026-11-20 22:05:26 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `8335994`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --test server/*.test.js 273/273 lulus (tes baru: kitab terpilih, urutan, halaman, dua sumber, rowid selang-seling, batas hitungan); npm run build (tsc -b + vite) sukses; oxlint tanpa error baru; uji server lokal + browser 375px: 2 kitab = 22 hasil dan ?books=315,300, Matikan = 74 hasil, kembali memulihkan filter, book_ids salah/101 kitab = 400; benchmark D:/db/maktabah.db: الله di 5 kitab 27 dtk -> 0,4 dtk

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-22-05-26-733ea4.json](docs/change-audit/2026-11-20-22-05-26-733ea4.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BhI0iUzC.css` | 1–2 | — | module/file | deleted |
| 2026-11-20 22:04:57 +07:00 | `dist/assets/index-DAEY34w_.css` | — | 1–2 | module/file | added |
| 2026-11-20 22:04:57 +07:00 | `dist/assets/index.dev-BjqyAfGW.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-CSAmZmvI.js` | 1–22 | — | module/file | deleted |
| 2026-11-20 22:04:57 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-20 22:05:24 +07:00 | `docs/search-books.md` | — | 1–45 | module/file | added |
| 2026-11-20 22:00:09 +07:00 | `server/index.js` | 31–31 | 31–31 | import { searchRowa } from './rowa-search.js'; | modified |
| 2026-11-20 22:00:09 +07:00 | `server/index.js` | 998–998 | 998–1012 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-20 22:00:09 +07:00 | `server/index.js` | 1006–1006 | 1020–1020 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | — | 6–7 | export const SEARCH_COUNT_CAP = 10000; | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 8–8 | 10–11 | export const SEARCH_COUNT_CAP = 10000; | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 11–11 | 14–14 | export const SEARCH_COUNT_CAP = 10000; | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | — | 18–18 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 20–21 | 24–24 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 27–29 | 30–37 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 31–32 | 39–40 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 34–38 | 42–46 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 40–40 | 48–50 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | — | 52–52 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 44–44 | 55–62 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 46–47 | 64–64 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 52–52 | 69–69 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 54–54 | 71–71 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:39 +07:00 | `server/text-search.js` | 57–57 | 74–74 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-20 21:59:51 +07:00 | `server/text-search.test.js` | — | 89–117 | test('excludedBookIds filters out excluded books in standard search while advanc | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | — | 22–23 | import { SearchSuggestions } from './components/SearchSuggestions'; | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | — | 119–125 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 119–119 | 128–128 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 263–263 | 272–272 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 273–273 | 282–284 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 278–278 | 289–289 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 281–281 | 292–292 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 288–288 | 299–299 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 330–332 | 341–352 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 367–367 | 387–387 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 373–373 | 393–393 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 532–532 | 552–552 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | — | 588–597 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 763–763 | 793–793 | function App() { | modified |
| 2026-11-20 22:02:40 +07:00 | `src/App.tsx` | 868–868 | 898–898 | function App() { | modified |
| 2026-11-20 22:01:25 +07:00 | `src/api.ts` | 212–212 | 212–212 | export const webAPI = { | modified |
| 2026-11-20 22:01:25 +07:00 | `src/api.ts` | 214–214 | 214–216 | export const webAPI = { | modified |
| 2026-11-20 22:03:43 +07:00 | `src/components/BookPicker.tsx` | — | 1–100 | BookPicker, query, timer, picked, full, toggle | added |
| 2026-11-20 22:01:00 +07:00 | `src/lib/search-books.ts` | — | 1–34 | MAX_PICKED_BOOKS, LIST_KEY, ACTIVE_KEY, valid, loadPickedBooks, value, savePickedBooks, loadPickedActive | added |

## [2026-11-20 22:08:48 +07:00] — Catat verifikasi online pencarian beberapa kitab

Waktu pencatatan: **2026-11-20 22:08:48 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `34cacba`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: aset online cocok hash build lokal; book_ids online berfungsi; pemindaian policy melanjutkan setelah restart

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-22-08-48-510f04.json](docs/change-audit/2026-11-20-22-08-48-510f04.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 22:08:47 +07:00 | `docs/deployment-log.md` | — | 244–263 | Waktu ini adalah pencatatan verifikasi online, bukan waktu pull di server. | modified |

## [2026-11-20 23:24:55 +07:00] — Verifikasi hasil akhir pemindaian search policy v8

Waktu pencatatan: **2026-11-20 23:24:55 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `0c47faa`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: policy-status selesai (16.459 diperiksa, 6.529 terblokir); nama terblokir = 0; ditemukan 504 untuk ابن تيمية/ابن القيم pencarian biasa

Audit terstruktur beserta hash isi staged dan diff: [2026-11-20-23-24-55-13e828.json](docs/change-audit/2026-11-20-23-24-55-13e828.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-20 23:24:55 +07:00 | `docs/deployment-log.md` | — | 264–286 | Waktu ini adalah pencatatan verifikasi online, bukan waktu pull di server. | modified |

## [2026-11-21 18:57:00 +07:00] — Gabungkan pemilihan kategori dan kitab dalam tempat pencarian

Waktu pencatatan: **2026-11-21 18:57:00 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `5aa839b`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 281/281 pengujian server; npm run build (TypeScript dan Vite); node --check untuk empat modul server; oxlint komponen/helper baru dan SearchSuggestions tanpa temuan; git diff --check; Playwright kategori 125 kitab, union/pengecualian, lazy-load, filter/collapse, URL reload/back, tautan lama, teks/judul, tiga tema, desktop 1440 dan ponsel 390 tanpa overflow/pageerror. Build hanya peringatan Vite __dirname dan ukuran chunk yang sudah ada. SSH deployment ditolak publickey,password; pull/HEAD/endpoint server belum terverifikasi.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-21-18-57-00-7e09ae.json](docs/change-audit/2026-11-21-18-57-00-7e09ae.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-21 18:56:13 +07:00 | `dist/assets/index-BQ6Hekp_.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DAEY34w_.css` | 1–2 | — | module/file | deleted |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-BjqyAfGW.js` | 1–22 | — | module/file | deleted |
| 2026-11-21 18:56:13 +07:00 | `dist/assets/index.dev-DzMf9j9g.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-21 18:56:13 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-21 18:55:32 +07:00 | `docs/search-scope.md` | — | 1–32 | module/file | added |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | — | 1–1 | __filename, __dirname, logPath, stripHarakat, generateWordVariations, chars, alefs, ya | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | — | 983–983 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1000–1000 | 1002–1002 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1012–1012 | 1014–1014 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1020–1020 | 1022–1022 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1035–1035 | 1037–1037 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | — | 1411–1412 | app.get('/api/category/:id/books', (req,res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | — | 1416–1416 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1436–1436 | 1441–1441 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | — | 1446–1446 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1454–1455 | 1460–1462 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1460–1460 | 1467–1467 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/index.js` | 1476–1476 | 1483–1483 | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-21 16:18:37 +07:00 | `server/search-scope.js` | — | 1–57 | scopedBooksSql, MAX_SCOPE_IDS, fail, readSearchScope, read, value, values, searchScopeSql | added |
| 2026-11-21 18:52:17 +07:00 | `server/search-scope.test.js` | — | 1–94 | fixture, db, b, textOptions, result, category, scope, server | added |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | — | 2–2 | import {generateGemini, readAiConfig} from './ask-ai.js'; | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | 40–40 | 41–41 | export const FEW_RESULTS = 20, AI_RESULTS = 5; | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | 45–45 | 46–47 | export function countSuggestionResults(db, additional, query, mode, categories, | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | 49–49 | 51–51 | export function countSuggestionResults(db, additional, query, mode, categories, | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | 54–54 | 56–56 | export function countSuggestionResults(db, additional, query, mode, categories, | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | — | 78–78 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | 80–80 | 83–83 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | 90–90 | 93–93 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-21 16:16:09 +07:00 | `server/search-suggestions.js` | 109–109 | 112–112 | export function registerSearchSuggestions(app, {getDb, hasAdditional, likeMatch, | modified |
| 2026-11-21 16:11:30 +07:00 | `server/text-search.js` | — | 2–2 | import { Worker } from 'node:worker_threads'; | modified |
| 2026-11-21 16:11:30 +07:00 | `server/text-search.js` | 14–14 | 15–15 | export const MAX_SEARCH_BOOKS = 100; | modified |
| 2026-11-21 16:11:30 +07:00 | `server/text-search.js` | 18–18 | 19–21 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-21 16:11:30 +07:00 | `server/text-search.js` | 24–24 | 27–27 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-21 16:11:30 +07:00 | `server/text-search.js` | 36–36 | 39–39 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-21 16:11:30 +07:00 | `server/text-search.js` | 39–40 | 42–43 | export function searchPages(db, { exactPhrase, andMatch = '', page = 1, limit = | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 22–24 | 22–24 | import { SearchSuggestions } from './components/SearchSuggestions'; | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 93–93 | 93–93 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 116–125 | 116–119 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 128–128 | 122–122 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 250–254 | — | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 272–272 | 261–261 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 282–284 | 271–272 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 289–289 | 277–277 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 292–292 | 280–280 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 299–299 | 287–287 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 302–302 | 290–290 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 340–352 | 328–337 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 387–387 | 372–372 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 393–393 | 378–378 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 552–599 | 537–550 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 632–632 | 583–583 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 793–795 | 744–746 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 847–847 | 798–798 | function App() { | modified |
| 2026-11-21 16:21:22 +07:00 | `src/App.tsx` | 898–899 | 849–850 | function App() { | modified |
| 2026-11-21 18:54:31 +07:00 | `src/api.ts` | — | 4–4 | const API_BASE = '/api'; // Use relative path for production (served by Express) | modified |
| 2026-11-21 18:54:31 +07:00 | `src/api.ts` | 58–59 | 59–62 | export const webAPI = { | modified |
| 2026-11-21 18:54:31 +07:00 | `src/api.ts` | 212–212 | 215–215 | export const webAPI = { | modified |
| 2026-11-21 18:54:31 +07:00 | `src/api.ts` | 215–215 | 218–219 | export const webAPI = { | modified |
| 2026-11-21 18:54:31 +07:00 | `src/api.ts` | 221–221 | 225–225 | export const webAPI = { | modified |
| 2026-11-21 18:54:31 +07:00 | `src/api.ts` | — | 228–228 | export const webAPI = { | modified |
| 2026-11-21 16:20:39 +07:00 | `src/components/SearchScopePicker.tsx` | — | 1–95 | MixedCheckbox, ref, CategoryBooks, timer, controller, SearchScopePicker, knownBooks, valueKey | added |
| 2026-11-21 18:55:44 +07:00 | `src/components/SearchSuggestions.tsx` | — | 3–3 | import {webAPI} from '../api'; | modified |
| 2026-11-21 18:55:44 +07:00 | `src/components/SearchSuggestions.tsx` | 6–7 | 7–8 | import {webAPI} from '../api'; | modified |
| 2026-11-21 18:55:44 +07:00 | `src/components/SearchSuggestions.tsx` | — | 13–13 | export function SearchSuggestions({query, mode, categories, onSearch, withResult | modified |
| 2026-11-21 18:55:44 +07:00 | `src/components/SearchSuggestions.tsx` | 15–15 | 17–17 | export function SearchSuggestions({query, mode, categories, onSearch, withResult | modified |
| 2026-11-21 18:55:44 +07:00 | `src/components/SearchSuggestions.tsx` | 20–20 | 22–22 | export function SearchSuggestions({query, mode, categories, onSearch, withResult | modified |
| 2026-11-21 16:16:35 +07:00 | `src/lib/search-scope.ts` | — | 1–67 | MAX_SCOPE_ADJUSTMENTS, emptySearchScope, ids, books, seen, normalizeSearchScope, value, scopeParams | added |

## [2026-11-21 22:46:39 +07:00] — Tampilkan label kategori di dekat judul hasil pencarian

Waktu pencatatan: **2026-11-21 22:46:39 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1cddcef`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 16/16 pengujian metadata kategori, text-search dan search-scope; npm run build termasuk TypeScript; node --check server/index.js dan search-result-categories.js; oxlint komponen/helper/test baru; git diff --check; Playwright pencarian biasa/lanjutan, teks/judul, desktop1440/ponsel390 memverifikasi label pada setiap hasil, tanpa overflow/pageerror; screenshot ponsel diperiksa. SSH deployment ditolak publickey,password; pull dan HEAD server belum terverifikasi.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-21-22-46-39-112ea9.json](docs/change-audit/2026-11-21-22-46-39-112ea9.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-21 22:45:38 +07:00 | `dist/assets/index.dev-BYr-kCtq.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-21 22:45:38 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-21 19:23:28 +07:00 | `server/index.js` | — | 2–2 | import {readSearchScope,searchScopeSql,registerSearchScope,scopedBooksSql} from | modified |
| 2026-11-21 19:23:28 +07:00 | `server/index.js` | 1027–1027 | 1028–1029 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-21 19:23:28 +07:00 | `server/search-result-categories.js` | — | 1–13 | addSearchResultCategories, ids, books, metadata, category | added |
| 2026-11-21 19:23:47 +07:00 | `server/search-result-categories.test.js` | — | 1–26 | db, rows, enriched | added |
| 2026-11-21 19:23:28 +07:00 | `src/App.tsx` | — | 23–23 | import {SearchScopePicker} from './components/SearchScopePicker'; | modified |
| 2026-11-21 19:23:28 +07:00 | `src/App.tsx` | 771–773 | 772–774 | function App() { | modified |
| 2026-11-21 19:23:28 +07:00 | `src/App.tsx` | — | 776–776 | function App() { | modified |
| 2026-11-21 19:23:28 +07:00 | `src/App.tsx` | 793–793 | 795–798 | function App() { | modified |
| 2026-11-21 19:23:28 +07:00 | `src/App.tsx` | 795–796 | 800–800 | function App() { | modified |
| 2026-11-21 19:23:28 +07:00 | `src/components/SearchCategoryLabel.tsx` | — | 1–6 | SearchCategoryLabel, category | added |

## [2026-11-22 05:24:52 +07:00] — Pisahkan gangguan sinkronisasi dan error pengiriman pesan admin

Waktu pencatatan: **2026-11-22 05:24:52 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `a89b557`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: 22/22 tes messages/messages-client/message-attachments; npm run build (TypeScript dan Vite); oxlint modul pesan dan komponen status tanpa temuan; git diff --check. Playwright server/database sementara: simulasi stream502 dengan pemulihan otomatis, polling502 dan pemulihan, panel ringkas dan halaman admin penuh, draf tetap ada, POST gagal hanya sekali, error kirim tidak dihapus oleh GET sukses; screenshot ponsel diperiksa. Peringatan build Vite __dirname dan ukuran chunk sudah ada. SSH deployment ditolak publickey,password; pull dan HEAD server belum terverifikasi.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-22-05-24-52-3e62af.json](docs/change-audit/2026-11-22-05-24-52-3e62af.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-22 05:21:52 +07:00 | `dist/assets/index.dev-Awv03bAd.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-22 05:21:52 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-22 05:24:15 +07:00 | `docs/messages.md` | 60–60 | 60–70 | Di bawah setiap pesan milik sendiri ada tanda di samping jam: | modified |
| 2026-11-22 05:22:06 +07:00 | `server/messages-client.test.js` | 5–5 | 5–6 | import {linkifyText,safeHref} from '../src/lib/linkify.ts'; | modified |
| 2026-11-22 05:22:06 +07:00 | `server/messages-client.test.js` | — | 67–93 | test('the token-authenticated admin stream parses server-sent event blocks like | modified |
| 2026-11-22 05:20:13 +07:00 | `src/components/AdminInboxMini.tsx` | — | 2–2 | import { useEffect, useRef, useState } from 'react'; | modified |
| 2026-11-22 05:20:13 +07:00 | `src/components/AdminInboxMini.tsx` | — | 25–25 | export function AdminInboxMini({ inbox, token, onOpenFull }: { inbox: Inbox; tok | modified |
| 2026-11-22 05:20:13 +07:00 | `src/components/AdminInboxMini.tsx` | — | 70–70 | export function AdminInboxMini({ inbox, token, onOpenFull }: { inbox: Inbox; tok | modified |
| 2026-11-22 05:20:13 +07:00 | `src/components/AdminMessages.tsx` | — | 2–2 | import { useEffect, useRef, useState } from 'react'; | modified |
| 2026-11-22 05:20:13 +07:00 | `src/components/AdminMessages.tsx` | — | 40–40 | export function AdminMessages({ token, onLogout, onUnreadChange }: { token: stri | modified |
| 2026-11-22 05:20:13 +07:00 | `src/components/MessageSyncStatus.tsx` | — | 1–7 | MessageSyncStatus | added |
| 2026-11-22 05:18:58 +07:00 | `src/lib/auth-event-source.ts` | — | 62–62 | export class AuthEventSource extends EventTarget { | modified |
| 2026-11-22 05:18:58 +07:00 | `src/lib/messages.ts` | 52–52 | 52–52 | async function request(path:string, init:RequestInit = {}) { | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 18–19 | 18–18 | type Options = { | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 32–33 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 36–36 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 45–45 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 48–48 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 50–50 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 50–50 | 55–59 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 63–63 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 67–67 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 69–69 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 60–60 | 72–72 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 63–63 | 75–90 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 68–69 | 95–96 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 75–75 | 102–106 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 117–117 | 148–152 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 120–120 | 155–155 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | 133–134 | 168–174 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |
| 2026-11-22 05:21:34 +07:00 | `src/lib/use-admin-inbox.ts` | — | 199–200 | export function useAdminInbox({ token, enabled = true, isViewing = () => true, o | modified |

## [2026-11-23 15:46:30 +07:00] — Balasan otomatis tanpa salam pada pesan pengunjung

Waktu pencatatan: **2026-11-23 15:46:30 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `9b7d56c`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Sintaks Node.js, TypeScript dan build produksi lulus. 285 tes server lulus, termasuk 19 tes perpesanan/klien yang memeriksa teks balasan, SSE, pencegahan duplikasi, status pesan dibaca, migrasi, dan rollback. Diff staged lulus git diff --check. Balasan dikirim sekali saat mulai menunggu admin dan tampil dengan label Balasan otomatis.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-23-15-46-30-48eee7.json](docs/change-audit/2026-11-23-15-46-30-48eee7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-23 15:45:31 +07:00 | `dist/assets/index.dev-CduF99x2.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-23 15:45:31 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | — | 10–10 | export const MESSAGE_LIMITS = {body:2000, name:80, perMinute:5, perHour:30, ipPe | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 25–26 | 26–27 | export function publicMessage(row) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | — | 49–49 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 71–71 | 73–73 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 75–75 | 77–77 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 78–81 | 80–83 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | — | 88–97 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 99–99 | 111–111 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 115–116 | 127–128 | export function createMessageStore(getStateDb) { | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 229–229 | 241–241 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | — | 243–243 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-23 15:43:51 +07:00 | `server/messages.js` | 232–233 | 245–250 | export function registerMessages(app, {getStateDb, requireAdmin, isBusy = () => | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | — | 8–8 | import path from 'node:path'; | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | — | 13–13 | const NO_ATTACHMENTS = {allowFiles:false, allowImages:false, maxImageBytes:8 * 1 | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 52–52 | 54–59 | test('a visitor conversation with an admin reply stays isolated per browser and | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 64–65 | 71–72 | test('a visitor conversation with an admin reply stays isolated per browser and | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 73–73 | 80–92 | test('a visitor conversation with an admin reply stays isolated per browser and | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 86–86 | 105–108 | test('validation, duplicates, honeypot, rate limits and admin activity are rejec | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 119–119 | 141–141 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 121–122 | 143–146 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 129–129 | 153–153 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 131–131 | 155–155 | test('streams deliver admin replies to the visitor and visitor messages to the a | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 147–148 | 171–172 | test('read receipts move forward per side and are exposed to the right party onl | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 150–152 | 174–176 | test('read receipts move forward per side and are exposed to the right party onl | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | 156–156 | 180–180 | test('read receipts move forward per side and are exposed to the right party onl | modified |
| 2026-11-23 15:45:10 +07:00 | `server/messages.test.js` | — | 271–271 | test('an existing message table gains the attachment columns without losing mess | modified |
| 2026-11-23 15:44:21 +07:00 | `src/components/MessageParts.tsx` | — | 84–84 | export function MessageBody({ message, mine, token }: { message: ChatMessage; mi | modified |
| 2026-11-23 15:44:21 +07:00 | `src/components/MessageParts.tsx` | 106–106 | 107–107 | export function MessageMeta({ message, mine, read, full = false, className = '' | modified |
| 2026-11-23 15:44:21 +07:00 | `src/components/MessageWidget.tsx` | 97–97 | 97–97 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:44:21 +07:00 | `src/components/MessageWidget.tsx` | 185–185 | 185–185 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:44:21 +07:00 | `src/components/MessageWidget.tsx` | 228–228 | 228–228 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:44:21 +07:00 | `src/lib/messages.ts` | 3–3 | 3–3 | export type ChatAttachment = {kind:'image'\|'file'; name:string; mime:string; siz | modified |
| 2026-11-23 15:44:21 +07:00 | `src/lib/messages.ts` | 63–63 | 63–63 | export const messagesAPI = { | modified |

## [2026-11-23 17:35:43 +07:00] — Suara pesan masuk dan animasi jeda balasan otomatis

Waktu pencatatan: **2026-11-23 17:35:43 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `797e129`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Sintaks Node.js, TypeScript, build produksi, 285 tes server, dan diff staged lulus. Uji Chrome dengan database sementara memverifikasi suara pada halaman kategori admin, suara balasan manual saat chat terbuka, jeda 1,5 detik dengan indikator animasi, satu suara untuk balasan otomatis yang sampai lewat HTTP dan SSE, serta riwayat yang tampil senyap setelah muat ulang.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-23-17-35-43-66d547.json](docs/change-audit/2026-11-23-17-35-43-66d547.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BQ6Hekp_.css` | 1–2 | — | module/file | deleted |
| 2026-11-23 15:53:47 +07:00 | `dist/assets/index-BrIgRAGJ.css` | — | 1–2 | module/file | added |
| 2026-11-23 15:53:47 +07:00 | `dist/assets/index.dev-CtdlN1td.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-23 15:53:47 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/Admin.tsx` | — | 13–13 | import { AdminMessages } from './AdminMessages'; | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/Admin.tsx` | — | 1523–1530 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/Admin.tsx` | 1593–1593 | 1602–1602 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/AdminMessages.tsx` | 5–5 | 5–6 | import { DEFAULT_MESSAGE_SETTINGS, MESSAGE_MAX, messageTime, notificationPermiss | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/AdminMessages.tsx` | 9–10 | 10–10 | import { AttachmentButtons, MessageBody, MessageMeta, PendingAttachmentChip, Thr | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | — | 15–15 | const readAdminToken = () => { try { return localStorage.getItem('adminToken') \| | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | — | 25–26 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | — | 43–44 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 53–56 | 58–85 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | — | 87–87 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 81–81 | 111–111 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 95–96 | 125–125 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 100–100 | — | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 105–105 | 133–136 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 107–107 | 138–138 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 133–133 | 164–164 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | — | 184–184 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 154–154 | 186–186 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 172–172 | 204–205 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 185–185 | 218–218 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | 225–226 | 258–259 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:53:22 +07:00 | `src/components/MessageWidget.tsx` | — | 267–276 | export function MessageWidget({ reading, adminPanel }: { reading: boolean; admin | modified |
| 2026-11-23 15:52:43 +07:00 | `src/index.css` | — | 53–57 | b { | modified |
| 2026-11-23 15:53:22 +07:00 | `src/lib/messages.ts` | 102–102 | 102–102 | export function unlockMessageSound() { | modified |

## [2026-11-24 19:25:42 +07:00] — Pratinjau lokal card dan halaman Dukung Maktabah tanpa deskripsi card

Waktu pencatatan: **2026-11-24 19:25:42 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1c481bd`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: TypeScript dan build produksi lulus; 7 tes navigasi/back lulus; pemeriksaan langsung route donasi dan fallback beranda lulus; oxlint tanpa error (3 peringatan catch lama di App.tsx); git diff --check lulus. Rekening/QRIS belum diberikan sehingga kanal donasi ditandai sedang disiapkan. Perubahan lokal saja, tanpa commit/push/deployment.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-24-19-25-42-5ac639.json](docs/change-audit/2026-11-24-19-25-42-5ac639.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-24 19:25:07 +07:00 | `dist/assets/index-DcIixM9u.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-CtdlN1td.js` | 1–22 | — | module/file | deleted |
| 2026-11-24 19:25:07 +07:00 | `dist/assets/index.dev-JT4Ck0dh.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-24 19:25:07 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 5–5 | 5–5 | import { useState } from 'react'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 13–13 | import About from './components/About'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 38–38 | 39–39 | import { useEffect, useRef } from 'react'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 483–484 | function App() { | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 710–711 | 713–714 | function App() { | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 736–742 | function App() { | modified |
| 2026-11-24 19:24:40 +07:00 | `src/components/Donation.tsx` | — | 1–42 | purposes, Donation | added |
| 2026-11-24 19:24:40 +07:00 | `src/lib/navigation.ts` | 1–2 | 1–2 | parseNavigation, params, found, navigationHash, routePage, routeCategories | modified |

## [2026-11-24 19:30:23 +07:00] — Card dan halaman donasi lokal dengan QRIS pengguna

Waktu pencatatan: **2026-11-24 19:30:23 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1c481bd`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: TypeScript dan build produksi lulus; oxlint Donation.tsx tanpa error/peringatan; QRIS asli identik SHA256 dengan aset lokal dan respons HTTP 200; pemeriksaan browser halaman donasi, gambar utuh, penerima dan tautan unduh lulus; git diff --check lulus. Perubahan lokal saja; tanpa commit/push/deployment. Tidak melakukan transaksi pembayaran.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-24-19-30-23-c8e0fe.json](docs/change-audit/2026-11-24-19-30-23-c8e0fe.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BrIgRAGJ.css` | 1–2 | — | module/file | deleted |
| 2026-11-24 19:29:29 +07:00 | `dist/assets/index-DTnWHJcV.css` | — | 1–2 | module/file | added |
| 2026-11-24 19:29:29 +07:00 | `dist/assets/index.dev-BHVvtjtE.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-CtdlN1td.js` | 1–22 | — | module/file | deleted |
| 2026-11-24 19:28:26 +07:00 | `dist/donations/qris-maktabah.jpg` | — | — | aset/biner | added |
| 2026-11-24 19:29:29 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-24 19:28:26 +07:00 | `public/donations/qris-maktabah.jpg` | — | — | aset/biner | added |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 5–5 | 5–5 | import { useState } from 'react'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 13–13 | import About from './components/About'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 38–38 | 39–39 | import { useEffect, useRef } from 'react'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 483–484 | function App() { | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 710–711 | 713–714 | function App() { | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 736–742 | function App() { | modified |
| 2026-11-24 19:29:04 +07:00 | `src/components/Donation.tsx` | — | 1–64 | purposes, qrisUrl, Donation | added |
| 2026-11-24 19:24:40 +07:00 | `src/lib/navigation.ts` | 1–2 | 1–2 | parseNavigation, params, found, navigationHash, routePage, routeCategories | modified |

## [2026-11-24 19:32:41 +07:00] — Rilis card Dukung Maktabah dan halaman donasi QRIS

Waktu pencatatan: **2026-11-24 19:32:41 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `1c481bd`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: TypeScript lulus; build produksi dan uji browser lokal lulus pada pratinjau sebelumnya tanpa perubahan kode sesudahnya; 7 tes navigasi/back ulang lulus; oxlint komponen donasi/navigasi lulus; git diff --cached --check lulus; QRIS HTTP 200 dan SHA256 sesuai sumber pengguna. Push diotorisasi pengguna; SSH ubuntu@VPS ditolak autentikasi sehingga pull server belum terlaksana.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-24-19-32-41-43c61a.json](docs/change-audit/2026-11-24-19-32-41-43c61a.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-BrIgRAGJ.css` | 1–2 | — | module/file | deleted |
| 2026-11-24 19:29:29 +07:00 | `dist/assets/index-DTnWHJcV.css` | — | 1–2 | module/file | added |
| 2026-11-24 19:29:29 +07:00 | `dist/assets/index.dev-BHVvtjtE.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-CtdlN1td.js` | 1–22 | — | module/file | deleted |
| 2026-11-24 19:28:26 +07:00 | `dist/donations/qris-maktabah.jpg` | — | — | aset/biner | added |
| 2026-11-24 19:29:29 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-24 19:28:26 +07:00 | `public/donations/qris-maktabah.jpg` | — | — | aset/biner | added |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 5–5 | 5–5 | import { useState } from 'react'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 13–13 | import About from './components/About'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 38–38 | 39–39 | import { useEffect, useRef } from 'react'; | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 483–484 | function App() { | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | 710–711 | 713–714 | function App() { | modified |
| 2026-11-24 19:24:40 +07:00 | `src/App.tsx` | — | 736–742 | function App() { | modified |
| 2026-11-24 19:29:04 +07:00 | `src/components/Donation.tsx` | — | 1–64 | purposes, qrisUrl, Donation | added |
| 2026-11-24 19:24:40 +07:00 | `src/lib/navigation.ts` | 1–2 | 1–2 | parseNavigation, params, found, navigationHash, routePage, routeCategories | modified |

## [2026-11-24 19:35:20 +07:00] — Card Beri Dukungan pada halaman Tentang

Waktu pencatatan: **2026-11-24 19:35:20 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b9093bf`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: TypeScript/build produksi lulus; 7 tes navigasi/back lulus; oxlint About.tsx lulus; uji browser card Tentang ke donasi QRIS dan kembali ke Tentang lulus; diff whitespace lulus. Card tanpa deskripsi sebelum Kontak dan Akses. SSH ubuntu@VPS masih ditolak autentikasi; pull/deployment server belum terlaksana.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-24-19-35-20-6e4b81.json](docs/change-audit/2026-11-24-19-35-20-6e4b81.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-24 19:34:38 +07:00 | `dist/assets/index.dev-Bpdht2Sb.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-24 19:34:38 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-24 19:34:01 +07:00 | `src/App.tsx` | 476–476 | 476–476 | function App() { | modified |
| 2026-11-24 19:34:01 +07:00 | `src/components/About.tsx` | — | 2–3 | import React from 'react'; | modified |
| 2026-11-24 19:34:01 +07:00 | `src/components/About.tsx` | 3–3 | 5–5 | import React from 'react'; | modified |
| 2026-11-24 19:34:01 +07:00 | `src/components/About.tsx` | — | 30–46 | const About: React.FC = () => { | modified |

## [2026-11-24 19:37:41 +07:00] — Koreksi domain halaman Tentang menjadi maktab.my.id

Waktu pencatatan: **2026-11-24 19:37:41 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b3b2179`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Teks dan href pada Kontak dan Akses diperiksa: https://maktab.my.id; TypeScript dan build produksi lulus; git diff --check lulus. SSH VPS ditolak autentikasi sehingga pull server belum dapat dilakukan.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-24-19-37-41-6ee894.json](docs/change-audit/2026-11-24-19-37-41-6ee894.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-24 19:37:28 +07:00 | `dist/assets/index.dev-DnXg22N1.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-24 19:37:28 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-24 19:37:07 +07:00 | `src/components/About.tsx` | 48–48 | 48–48 | const About: React.FC<{ onDonate: () => void }> = ({ onDonate }) => { | modified |

## [2026-11-24 20:34:37 +07:00] — Lengkapi log rute halaman, privasi mandiri, pembaca dan aktivitas QRIS

Waktu pencatatan: **2026-11-24 20:34:37 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `e247343`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 294 tes regresi server lulus; 11 tes terkait diulang setelah pelengkapan parameter rute dan cache lulus; TypeScript/build produksi lulus; pemeriksaan sintaks backend/tracker/build script dan oxlint modul baru lulus; browser database QA terisolasi memverifikasi 8 kunjungan (donasi, privasi, beranda, katalog, kategori, metadata kitab, 2 halaman pembaca) serta 2 klik QRIS terpisah; admin menampilkan catatan dan mengecualikan aktivitas admin; API stats QA HTTP 200 total=10, kunjungan=8, aktivitas situs=2; tracker no-cache dan privasi terbaru diverifikasi. Audit mencatat waktu modifikasi akhir/hunk, bukan merekonstruksi setiap keystroke. SSH VPS ditolak autentikasi; pull/deployment server belum berhasil.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-24-20-34-37-8a0b70.json](docs/change-audit/2026-11-24-20-34-37-8a0b70.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-24 20:28:46 +07:00 | `dist/assets/index-C1A8IBZ5.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DTnWHJcV.css` | 1–2 | — | module/file | deleted |
| 2026-11-24 20:28:46 +07:00 | `dist/assets/index.dev-BjniO3Ae.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-DnXg22N1.js` | 1–22 | — | module/file | deleted |
| 2026-11-24 20:28:46 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-24 20:28:48 +07:00 | `dist/privacy-policy.html` | 18–19 | 18–19 | a{color:#047857;overflow-wrap:anywhere} | modified |
| 2026-11-24 20:28:48 +07:00 | `dist/privacy-policy/index.html` | 18–19 | 18–19 | a{color:#047857;overflow-wrap:anywhere} | modified |
| 2026-11-24 20:28:09 +07:00 | `dist/visit-tracker.js` | — | 1–111 | routes, parameters, prefix, lifetime, visitPath, url, path, params | added |
| 2026-11-24 20:25:55 +07:00 | `docs/visit-tracking.md` | — | 1–30 | module/file | added |
| 2026-11-24 20:15:01 +07:00 | `scripts/build_privacy.js` | — | 18–18 | const { default: Privacy } = await import(pathToFileURL(modulePath).href); | modified |
| 2026-11-24 20:15:01 +07:00 | `scripts/build_privacy.js` | 36–36 | 37–37 | a{color:#047857;overflow-wrap:anywhere} | modified |
| 2026-11-24 20:15:01 +07:00 | `server/admin-logs.js` | 1–1 | 1–1 | tables, TODAY_WIB_START, fail, column, definitions, table, query, page | modified |
| 2026-11-24 20:15:01 +07:00 | `server/admin-logs.js` | 11–11 | 11–11 | function definitions(db,type) { | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | — | 1–1 | __filename, __dirname, logPath, stripHarakat, generateWordVariations, chars, alefs, ya | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | 156–156 | 157–157 | app.use((req, res, next) => { | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | 164–164 | 165–165 | app.use((req, res, next) => { | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | — | 352–352 | try { | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | — | 386–386 | app.use(adminActivityIdentity(()=>stateDb)); | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | 588–600 | — | app.post('/api/log/download', (req, res) => { | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | — | 602–602 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | 628–628 | 619–620 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-24 20:25:46 +07:00 | `server/index.js` | 647–647 | 639–639 | app.get('/api/admin/stats', requireAdmin, (req, res) => { | modified |
| 2026-11-24 20:18:30 +07:00 | `server/static-cache.js` | 7–7 | 7–7 | export function staticCacheControl(filename) { | modified |
| 2026-11-24 20:26:39 +07:00 | `server/static-cache.test.js` | 9–9 | 9–9 | test('versioned assets can be reused while HTML and unversioned files stay refre | modified |
| 2026-11-24 20:18:30 +07:00 | `server/visit-tracking.js` | — | 1–32 | ensureVisitTrackingSchema, registerVisitTracking, record, db, result | added |
| 2026-11-24 20:28:09 +07:00 | `server/visit-tracking.test.js` | — | 1–149 | id, fixture, db, app, server, post, memoryStorage, values | added |
| 2026-11-24 20:18:30 +07:00 | `src/App.tsx` | — | 1–1 | App, navigationHandler, loadedSearch, lastTabLocations, pendingSearch, searchRequest, openAiQuestion, cancelAiRedirect | modified |
| 2026-11-24 20:18:30 +07:00 | `src/App.tsx` | 61–65 | — | function App() { | modified |
| 2026-11-24 20:18:30 +07:00 | `src/App.tsx` | — | 320–320 | function App() { | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/Admin.tsx` | 1234–1234 | 1234–1234 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/Admin.tsx` | 1310–1310 | 1310–1310 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/Admin.tsx` | — | 1377–1377 | const LogsView = ({ token, onLogout, type, title }: { token: string, onLogout: ( | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/Admin.tsx` | — | 1609–1609 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/AdminDailyChart.tsx` | — | 15–15 | interface DailyItem { | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/AdminDailyChart.tsx` | — | 28–28 | interface TodayStats { | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/AdminDailyChart.tsx` | — | 47–47 | const LOG_META = [ | modified |
| 2026-11-24 20:25:46 +07:00 | `src/components/AdminDailyChart.tsx` | — | 64–64 | export function AdminDailyChart({ stats }: Props) { | modified |
| 2026-11-24 20:15:01 +07:00 | `src/components/Donation.tsx` | — | 1–1 | purposes, qrisUrl, Donation | modified |
| 2026-11-24 20:15:01 +07:00 | `src/components/Donation.tsx` | 38–38 | 39–39 | export default function Donation() { | modified |
| 2026-11-24 20:15:01 +07:00 | `src/components/Donation.tsx` | 52–52 | 53–53 | export default function Donation() { | modified |
| 2026-11-24 20:23:36 +07:00 | `src/components/Privacy.tsx` | 4–4 | 4–4 | const Privacy: React.FC = () => { | modified |
| 2026-11-24 20:23:36 +07:00 | `src/components/Privacy.tsx` | — | 27–28 | const Privacy: React.FC = () => { | modified |
| 2026-11-24 20:18:30 +07:00 | `src/components/QuranReader.tsx` | 295–295 | 295–295 | const QuranReader: React.FC = () => { | modified |
| 2026-11-24 20:15:01 +07:00 | `src/components/ReaderModal.tsx` | — | 5–5 | import React, { useState, useEffect, useRef, useCallback } from 'react'; | modified |
| 2026-11-24 20:15:01 +07:00 | `src/components/ReaderModal.tsx` | — | 177–177 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-24 20:19:59 +07:00 | `src/components/RowaCards.tsx` | — | 7–7 | import {useModalFocus} from '../lib/use-modal-focus'; | modified |
| 2026-11-24 20:19:59 +07:00 | `src/components/RowaCards.tsx` | 15–17 | 16–18 | export function RowaCardsProvider({children}:{children:ReactNode}) { | modified |
| 2026-11-24 20:19:59 +07:00 | `src/components/RowaCards.tsx` | — | 20–20 | export function RowaCardsProvider({children}:{children:ReactNode}) { | modified |
| 2026-11-24 20:15:01 +07:00 | `src/lib/admin-navigation.ts` | 1–1 | 1–1 | adminParent, adminTitle, adminGroup, adminLocation, p, raw, id, v | modified |
| 2026-11-24 20:15:01 +07:00 | `src/lib/admin-navigation.ts` | 8–8 | 8–8 | const parents: Record<AdminView, AdminView> = { | modified |
| 2026-11-24 20:15:01 +07:00 | `src/lib/admin-navigation.ts` | 15–15 | 15–15 | const titles: Record<AdminView,string> = { | modified |
| 2026-11-24 20:15:01 +07:00 | `src/lib/admin-navigation.ts` | 21–21 | 21–21 | export const adminGroups: {label:string;views:AdminView[]}[] = [ | modified |
| 2026-11-24 20:15:01 +07:00 | `src/lib/back-navigation.ts` | — | 17–17 | export function pushLocation(hash:string,state:Record<string,unknown>\|null=null) | modified |
| 2026-11-24 20:14:20 +07:00 | `src/lib/visit-tracker.d.ts` | — | 1–4 | visitPath, recordVisit, recordSiteAction, startVisitTracking | added |
| 2026-11-24 20:28:09 +07:00 | `src/lib/visit-tracker.js` | — | 1–111 | routes, parameters, prefix, lifetime, visitPath, url, path, params | added |
| 2026-11-24 20:15:00 +07:00 | `src/main.tsx` | — | 6–6 | import App from './App.tsx' | modified |
| 2026-11-24 20:15:00 +07:00 | `src/main.tsx` | — | 10–10 | installAdminRequestIdentity(); | modified |

## [2026-11-25 07:56:44 +07:00] — feat(search): dropdown usulan pencarian cepat saat mengetik (autocomplete)

Waktu pencatatan: **2026-11-25 07:56:44 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `8cf4cbe`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: tsc -b lulus 0 error; oxlint 0 error; node --check server/index.js lulus; 60 unit tests lulus; build produksi index.dev-YYfi_zxC.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-25-07-56-44-fb7f43.json](docs/change-audit/2026-11-25-07-56-44-fb7f43.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-C1A8IBZ5.css` | 1–2 | — | module/file | deleted |
| 2026-11-25 07:56:13 +07:00 | `dist/assets/index-S7TqulSu.css` | — | 1–2 | module/file | added |
| 2026-11-25 07:56:13 +07:00 | `dist/assets/index.dev-YYfi_zxC.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-25 07:56:13 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-25 07:53:18 +07:00 | `server/index.js` | — | 26–26 | import { registerSearchSuggestions } from './search-suggestions.js'; | modified |
| 2026-11-25 07:53:18 +07:00 | `server/index.js` | — | 1381–1389 | registerSearchSuggestions(app, {getDb:()=>db, hasAdditional:()=>hasTambahan, lik | modified |
| 2026-11-25 07:52:10 +07:00 | `server/search-autocomplete.js` | — | 1–145 | queryAutocomplete, q, likeQuery, containsPattern, prefixPattern, books, seenBooks, excluded | added |
| 2026-11-25 07:52:46 +07:00 | `server/search-autocomplete.test.js` | — | 1–135 | createFixture, db, stateDb, excluded, arRes, exclRes, idRes, app | added |
| 2026-11-25 07:54:31 +07:00 | `src/App.tsx` | — | 24–24 | import { SearchSuggestions } from './components/SearchSuggestions'; | modified |
| 2026-11-25 07:54:31 +07:00 | `src/App.tsx` | — | 262–262 | function App() { | modified |
| 2026-11-25 07:54:31 +07:00 | `src/App.tsx` | 553–564 | 555–570 | function App() { | modified |
| 2026-11-25 07:53:37 +07:00 | `src/api.ts` | — | 284–286 | export const webAPI = { | modified |
| 2026-11-25 07:54:00 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 1–356 | LOCAL_HISTORY_KEY, clientCache, CACHE_TTL, getLocalSearches, raw, parsed, saveLocalSearch, clean | added |

## [2026-11-25 08:07:51 +07:00] — fix(search): batasi pemblokiran 4 nama hanya untuk Tanya AI, buka pencarian standar

Waktu pencatatan: **2026-11-25 08:07:51 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `536dc39`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/index.js lulus; 81 unit tests lulus

Audit terstruktur beserta hash isi staged dan diff: [2026-11-25-08-07-51-5bfbf7.json](docs/change-audit/2026-11-25-08-07-51-5bfbf7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-25 08:06:57 +07:00 | `server/index.js` | 28–28 | 28–28 | import {createLibraryActivity,registerLibraryActivity} from './library-activity. | modified |
| 2026-11-25 08:06:57 +07:00 | `server/index.js` | 36–36 | 36–36 | import { searchPagesOffThread, SEARCH_COUNT_CAP, MAX_SEARCH_BOOKS } from './text | modified |
| 2026-11-25 08:06:57 +07:00 | `server/index.js` | 990–993 | — | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-25 08:06:57 +07:00 | `server/index.js` | 1002–1008 | 998–998 | app.get('/api/search', async (req, res) => { | modified |
| 2026-11-25 08:06:57 +07:00 | `server/index.js` | 1386–1386 | — | registerSearchAutocomplete(app, { | modified |
| 2026-11-25 08:06:57 +07:00 | `server/index.js` | 1436–1440 | — | app.get('/api/search_titles', (req, res) => { | modified |
| 2026-11-25 08:06:57 +07:00 | `server/index.js` | 1456–1463 | — | app.get('/api/search_titles', (req, res) => { | modified |

## [2026-11-27 03:56:31 +07:00] — feat(admin): fitur tambah kitab manual dan tambah halaman manual

Waktu pencatatan: **2026-11-27 03:56:31 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `abcfcbc`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check lulus; oxlint 0 error; tsc -b lulus; 27 unit tests lulus; build produksi index.dev-X7sVcBNb.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-03-56-31-95fa6a.json](docs/change-audit/2026-11-27-03-56-31-95fa6a.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 03:56:08 +07:00 | `dist/assets/index-DEt_Mz9e.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-S7TqulSu.css` | 1–2 | — | module/file | deleted |
| 2026-11-27 03:56:08 +07:00 | `dist/assets/index.dev-X7sVcBNb.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-YYfi_zxC.js` | 1–22 | — | module/file | deleted |
| 2026-11-27 03:56:08 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-27 03:53:50 +07:00 | `server/index.js` | — | 22–22 | import { registerBookTransfer, categoryCatalogueSql } from './book-transfer.js'; | modified |
| 2026-11-27 03:53:50 +07:00 | `server/index.js` | — | 733–740 | registerBookTransfer(app, { | modified |
| 2026-11-27 03:53:25 +07:00 | `server/manual-book.js` | — | 1–109 | fail, resolveCategory, id, mainCat, extraCat, resolveAuthor, name, existing | added |
| 2026-11-27 03:53:27 +07:00 | `server/manual-book.test.js` | — | 1–121 | createFixture, db, b1, pageRow, b2, p1, p2, app | added |
| 2026-11-27 03:53:43 +07:00 | `src/api.ts` | — | 135–145 | export const webAPI = { | modified |
| 2026-11-27 03:53:43 +07:00 | `src/api.ts` | — | 190–200 | export const webAPI = { | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | — | 465–473 | const BooksView = ({ token, onLogout, category, onSelectBook, onChanged }: { tok | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | — | 515–539 | const BooksView = ({ token, onLogout, category, onSelectBook, onChanged }: { tok | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | 515–518 | 549–561 | const BooksView = ({ token, onLogout, category, onSelectBook, onChanged }: { tok | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | — | 563–614 | const BooksView = ({ token, onLogout, category, onSelectBook, onChanged }: { tok | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | — | 725–730 | const PagesView = ({ token, onLogout, book, onEditPage }: { token: string, onLog | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | — | 756–776 | const PagesView = ({ token, onLogout, book, onEditPage }: { token: string, onLog | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | 658–658 | 780–780 | const PagesView = ({ token, onLogout, book, onEditPage }: { token: string, onLog | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | — | 786–792 | const PagesView = ({ token, onLogout, book, onEditPage }: { token: string, onLog | modified |
| 2026-11-27 03:54:26 +07:00 | `src/components/Admin.tsx` | — | 794–824 | const PagesView = ({ token, onLogout, book, onEditPage }: { token: string, onLog | modified |

## [2026-11-27 04:19:22 +07:00] — feat(admin): menu import artikel Bahtsul Masail dari NU Online (indexing, preview, dan import)

Waktu pencatatan: **2026-11-27 04:19:22 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `f7277bb`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check lulus; oxlint 0 error; tsc -b lulus; 17 unit tests lulus; build produksi index.dev-BRlZUAm6.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-04-19-22-dc4726.json](docs/change-audit/2026-11-27-04-19-22-dc4726.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 04:18:12 +07:00 | `dist/assets/index-DE3pi38d.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DEt_Mz9e.css` | 1–2 | — | module/file | deleted |
| 2026-11-27 04:18:12 +07:00 | `dist/assets/index.dev-BRlZUAm6.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-X7sVcBNb.js` | 1–22 | — | module/file | deleted |
| 2026-11-27 04:18:12 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-27 04:16:06 +07:00 | `server/index.js` | — | 23–23 | import { registerManualBook } from './manual-book.js'; | modified |
| 2026-11-27 04:16:06 +07:00 | `server/index.js` | — | 742–748 | registerManualBook(app, { | modified |
| 2026-11-27 04:18:38 +07:00 | `server/nu-online.js` | — | 1–394 | fail, ALLOWED_HOSTS, validateNuOnlineUrl, decodeHtmlEntities, code, stripTags, normalizeKeywordMatch, parseNuOnlineListHtml | added |
| 2026-11-27 04:15:32 +07:00 | `server/nu-online.test.js` | — | 1–162 | SAMPLE_LIST_HTML, SAMPLE_ARTICLE_HTML, posts, article, longText, pages, db, stateDb | added |
| 2026-11-27 04:16:28 +07:00 | `src/components/Admin.tsx` | — | 5–5 | import { BookTransfer } from './BookTransfer'; | modified |
| 2026-11-27 04:16:28 +07:00 | `src/components/Admin.tsx` | — | 1749–1749 | const AdminDashboard = ({ token, onLogout, onClose }: { token: string, onLogout: | modified |
| 2026-11-27 04:16:10 +07:00 | `src/components/NuOnlineImport.tsx` | — | 1–456 | NuOnlineImport, apiCall, res, data, loadPosts, params, preferred, handleIndex | added |
| 2026-11-27 04:16:08 +07:00 | `src/lib/admin-navigation.ts` | 1–1 | 1–1 | adminParent, adminTitle, adminGroup, adminLocation, p, raw, id, v | modified |
| 2026-11-27 04:16:08 +07:00 | `src/lib/admin-navigation.ts` | 6–6 | 6–6 | const parents: Record<AdminView, AdminView> = { | modified |
| 2026-11-27 04:16:08 +07:00 | `src/lib/admin-navigation.ts` | 14–14 | 14–14 | const titles: Record<AdminView,string> = { | modified |
| 2026-11-27 04:16:08 +07:00 | `src/lib/admin-navigation.ts` | 20–20 | 20–20 | export const adminGroups: {label:string;views:AdminView[]}[] = [ | modified |

## [2026-11-27 04:33:42 +07:00] — fix(nu-online): potong bagian Tags dan daftar Terpopuler ke bawah dari isi postingan

Waktu pencatatan: **2026-11-27 04:33:42 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `061a271`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/nu-online.js lulus; 4 unit tests nu-online lulus; verifikasi live artikel tanpa Tags/Terpopuler

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-04-33-42-ab807c.json](docs/change-audit/2026-11-27-04-33-42-ab807c.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 04:33:17 +07:00 | `server/nu-online.js` | 121–122 | 121–122 | export function parseNuOnlineArticleHtml(html, url = '') { | modified |
| 2026-11-27 04:33:17 +07:00 | `server/nu-online.js` | — | 140–140 | export function parseNuOnlineArticleHtml(html, url = '') { | modified |
| 2026-11-27 04:33:20 +07:00 | `server/nu-online.test.js` | — | 40–40 | const SAMPLE_ARTICLE_HTML = ` | modified |
| 2026-11-27 04:33:20 +07:00 | `server/nu-online.test.js` | — | 42–46 | const SAMPLE_ARTICLE_HTML = ` | modified |
| 2026-11-27 04:33:20 +07:00 | `server/nu-online.test.js` | — | 69–69 | test('parseNuOnlineListHtml and parseNuOnlineArticleHtml extract clean metadata | modified |
| 2026-11-27 04:33:20 +07:00 | `server/nu-online.test.js` | — | 71–73 | test('parseNuOnlineListHtml and parseNuOnlineArticleHtml extract clean metadata | modified |

## [2026-11-27 04:42:25 +07:00] — feat(admin): fitur tambah kategori secara manual

Waktu pencatatan: **2026-11-27 04:42:25 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4765056`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check lulus; oxlint 0 error; tsc -b lulus; 18 unit tests lulus; build produksi index.dev-D-w0k8b9.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-04-42-25-c68672.json](docs/change-audit/2026-11-27-04-42-25-c68672.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 04:42:01 +07:00 | `dist/assets/index-C-2w8A1f.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-DE3pi38d.css` | 1–2 | — | module/file | deleted |
| 2026-11-27 04:42:01 +07:00 | `dist/assets/index.dev-D-w0k8b9.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 04:42:01 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-27 04:40:54 +07:00 | `server/manual-book.js` | — | 84–100 | export function createManualPage(db, rawBookId, input = {}) { | modified |
| 2026-11-27 04:40:54 +07:00 | `server/manual-book.js` | — | 102–113 | export function registerManualBook(app, { getDb, getStateDb, requireAdmin, hasAd | modified |
| 2026-11-27 04:40:57 +07:00 | `server/manual-book.test.js` | 5–5 | 5–5 | import express from 'express'; | modified |
| 2026-11-27 04:40:57 +07:00 | `server/manual-book.test.js` | — | 121–146 | test('registerManualBook exposes protected POST endpoints and invalidates cache' | modified |
| 2026-11-27 04:40:59 +07:00 | `src/api.ts` | — | 87–97 | export const webAPI = { | modified |
| 2026-11-27 04:41:23 +07:00 | `src/components/Admin.tsx` | — | 244–246 | const CategoriesView = ({ token, onLogout, onSelectCategory, onChanged }: { toke | modified |
| 2026-11-27 04:41:23 +07:00 | `src/components/Admin.tsx` | — | 293–307 | const CategoriesView = ({ token, onLogout, onSelectCategory, onChanged }: { toke | modified |
| 2026-11-27 04:41:23 +07:00 | `src/components/Admin.tsx` | 294–294 | 312–312 | const CategoriesView = ({ token, onLogout, onSelectCategory, onChanged }: { toke | modified |
| 2026-11-27 04:41:23 +07:00 | `src/components/Admin.tsx` | — | 314–316 | const CategoriesView = ({ token, onLogout, onSelectCategory, onChanged }: { toke | modified |
| 2026-11-27 04:41:23 +07:00 | `src/components/Admin.tsx` | — | 326–347 | const CategoriesView = ({ token, onLogout, onSelectCategory, onChanged }: { toke | modified |

## [2026-11-27 04:50:10 +07:00] — fix(nu-online): tutup modal pratinjau otomatis setelah import berhasil

Waktu pencatatan: **2026-11-27 04:50:10 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `3ff0657`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: oxlint 0 error; tsc -b lulus; build produksi index.dev-B5l5jV9d.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-04-50-10-c83220.json](docs/change-audit/2026-11-27-04-50-10-c83220.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 04:49:50 +07:00 | `dist/assets/index.dev-B5l5jV9d.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 04:49:50 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-27 04:49:21 +07:00 | `src/components/NuOnlineImport.tsx` | 175–176 | 175–176 | export function NuOnlineImport({ | modified |

## [2026-11-27 05:11:42 +07:00] — feat(home): tambah bagian Postingan Terakhir (point ke-7) di beranda

Waktu pencatatan: **2026-11-27 05:11:42 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4b37808`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/index.js lulus; oxlint 0 error; tsc -b lulus; build produksi index.dev-Bw1vYMMK.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-05-11-42-8980a2.json](docs/change-audit/2026-11-27-05-11-42-8980a2.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index.dev-B5l5jV9d.js` | 1–22 | — | module/file | deleted |
| 2026-11-27 05:11:27 +07:00 | `dist/assets/index.dev-Bw1vYMMK.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 05:11:27 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-27 05:10:57 +07:00 | `server/index.js` | — | 513–529 | app.get('/api/popular-books', (req, res) => { | modified |
| 2026-11-27 05:10:28 +07:00 | `src/App.tsx` | — | 96–96 | function App() { | modified |
| 2026-11-27 05:10:28 +07:00 | `src/App.tsx` | — | 258–258 | function App() { | modified |
| 2026-11-27 05:10:28 +07:00 | `src/App.tsx` | — | 718–750 | function App() { | modified |
| 2026-11-27 05:10:23 +07:00 | `src/api.ts` | — | 317–319 | export const webAPI = { | modified |

## [2026-11-27 06:15:53 +07:00] — feat(authors): tautkan penulis dan karya otomatis saat admin menambah atau mengimport kitab

Waktu pencatatan: **2026-11-27 06:15:53 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `f5c11c7`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check lulus; 36 unit tests (authors, manual-book, nu-online, book-transfer) lulus 100%

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-06-15-53-47abb7.json](docs/change-audit/2026-11-27-06-15-53-47abb7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 06:14:14 +07:00 | `server/authors.js` | 111–111 | 111–148 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-27 06:15:11 +07:00 | `server/authors.test.js` | — | 134–153 | test('HTTP admin auth, upload preview, activation and public routes work across | modified |
| 2026-11-27 06:14:31 +07:00 | `server/book-transfer.js` | 227–227 | 227–227 | export function importBooks(db, payload, existsInAdditional = () => false) { | modified |
| 2026-11-27 06:14:31 +07:00 | `server/book-transfer.js` | — | 311–311 | export function registerBookTransfer(app, { getDb, getDbPath, requireAdmin, hasA | modified |
| 2026-11-27 06:14:36 +07:00 | `server/index.js` | 749–749 | 749–751 | registerBookTransfer(app, { | modified |
| 2026-11-27 06:14:36 +07:00 | `server/index.js` | — | 760–760 | registerManualBook(app, { | modified |
| 2026-11-27 06:14:36 +07:00 | `server/index.js` | — | 768–768 | registerNuOnline(app, { | modified |
| 2026-11-27 06:14:17 +07:00 | `server/manual-book.js` | 101–101 | 101–101 | export function createManualCategory(db, input = {}, { hasAdditional = false } = | modified |
| 2026-11-27 06:14:17 +07:00 | `server/manual-book.js` | — | 119–119 | export function registerManualBook(app, { getDb, getStateDb, requireAdmin, hasAd | modified |
| 2026-11-27 06:14:25 +07:00 | `server/nu-online.js` | 322–322 | 322–322 | export function importNuOnlineArticle(db, stateDb, { url, title, author, catId, | modified |
| 2026-11-27 06:14:25 +07:00 | `server/nu-online.js` | — | 389–389 | export function registerNuOnline(app, { getDb, getStateDb, requireAdmin, hasAddi | modified |

## [2026-11-27 08:01:32 +07:00] — feat(reader,export): bedakan warna bagian Pertanyaan dan Jawaban Bahtsul Masail di view kitab, Word, dan PDF

Waktu pencatatan: **2026-11-27 08:01:32 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `61f4018`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check lulus; oxlint 0 error; tsc -b lulus; 3 unit tests bahtsul-masail-format lulus; build produksi index.dev-DR6tZzLP.js sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-08-01-32-e544d7.json](docs/change-audit/2026-11-27-08-01-32-e544d7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index.dev-Bw1vYMMK.js` | 1–22 | — | module/file | deleted |
| 2026-11-27 08:01:16 +07:00 | `dist/assets/index.dev-DR6tZzLP.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 08:01:16 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-27 07:59:20 +07:00 | `server/bahtsul-masail-format.js` | — | 1–38 | QUESTION_HEADING, QUESTION_PREFIX, ANSWER_HEADING, ANSWER_PREFIX, NEUTRAL_PREFIX, classifyBahtsulMasailLine, clean | added |
| 2026-11-27 08:00:32 +07:00 | `server/bahtsul-masail-format.test.js` | — | 1–52 | samplePages, pdfHtml, docxBuffer | added |
| 2026-11-27 07:59:56 +07:00 | `server/pdf-export.js` | — | 2–2 | import { isArabicText } from './word-export.js'; | modified |
| 2026-11-27 07:59:56 +07:00 | `server/pdf-export.js` | — | 23–23 | export function generateBookHtmlPdf({ title = 'Kitab', author = '', higriYear = | modified |
| 2026-11-27 07:59:56 +07:00 | `server/pdf-export.js` | 33–33 | 35–42 | export function generateBookHtmlPdf({ title = 'Kitab', author = '', higriYear = | modified |
| 2026-11-27 07:59:56 +07:00 | `server/pdf-export.js` | — | 249–272 | export function generateBookHtmlPdf({ title = 'Kitab', author = '', higriYear = | modified |
| 2026-11-27 07:59:49 +07:00 | `server/word-export.js` | — | 2–2 | import { createRequire } from 'module'; | modified |
| 2026-11-27 07:59:49 +07:00 | `server/word-export.js` | — | 100–100 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 07:59:49 +07:00 | `server/word-export.js` | — | 139–148 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 07:59:49 +07:00 | `server/word-export.js` | — | 155–156 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 07:59:49 +07:00 | `server/word-export.js` | — | 162–167 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 08:00:16 +07:00 | `src/components/ReaderModal.tsx` | — | 2–2 | import {RowaLinkedText} from './RowaLinkedText'; | modified |
| 2026-11-27 08:00:16 +07:00 | `src/components/ReaderModal.tsx` | 506–506 | 507–519 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-27 07:59:24 +07:00 | `src/lib/bahtsul-masail-format.ts` | — | 1–39 | QUESTION_HEADING, QUESTION_PREFIX, ANSWER_HEADING, ANSWER_PREFIX, NEUTRAL_PREFIX, classifyBahtsulMasailLine, clean | added |

## [2026-11-27 08:07:13 +07:00] — Format referensi Bahtsul Masail bergaya WhatsApp di View Kitab, Word, dan PDF

Waktu pencatatan: **2026-11-27 08:07:13 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `62a477c`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: Syntax check (node --check), oxlint 0 errors, unit test 3/3 pass, tsc -b & vite build sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-08-07-13-9453d2.json](docs/change-audit/2026-11-27-08-07-13-9453d2.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index.dev-DR6tZzLP.js` | 1–22 | — | module/file | deleted |
| 2026-11-27 08:07:03 +07:00 | `dist/assets/index.dev-jD926rpQ.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 08:07:03 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 7–7 | 7–17 | const ANSWER_PREFIX = /^(?:Jawaban\|Jawab\|Rumusan(?:\s+Jawaban)?\|Keputusan\|الج | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 11–11 | 21–21 | const NEUTRAL_PREFIX = /^(?:Editor\|Kontributor\|Penulis\|Sumber\|Referensi\|Daftar\s | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 16–16 | 26–26 | export function classifyBahtsulMasailLine(line, currentSection = null) { | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 20–20 | 30–30 | export function classifyBahtsulMasailLine(line, currentSection = null) { | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 23–23 | 33–33 | export function classifyBahtsulMasailLine(line, currentSection = null) { | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 27–27 | 37–37 | export function classifyBahtsulMasailLine(line, currentSection = null) { | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 30–30 | 40–47 | export function classifyBahtsulMasailLine(line, currentSection = null) { | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 34–34 | 51–59 | export function classifyBahtsulMasailLine(line, currentSection = null) { | modified |
| 2026-11-27 08:05:39 +07:00 | `server/bahtsul-masail-format.js` | 37–37 | 62–62 | export function classifyBahtsulMasailLine(line, currentSection = null) { | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | 7–7 | 7–7 | import { generateBookDocx } from './word-export.js'; | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | — | 13–13 | test('classifyBahtsulMasailLine detects Question and Answer sections and resets | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | 22–22 | 23–23 | test('classifyBahtsulMasailLine detects Question and Answer sections and resets | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | 29–29 | 30–31 | test('classifyBahtsulMasailLine detects Question and Answer sections and resets | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | — | 34–52 | test('classifyBahtsulMasailLine detects Question and Answer sections and resets | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | — | 57–57 | test('classifyBahtsulMasailLine detects Question and Answer sections and resets | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | 39–41 | 61–63 | test('classifyBahtsulMasailLine handles inline prefixes and Arabic markers', () | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | 44–45 | 66–71 | test('classifyBahtsulMasailLine handles inline prefixes and Arabic markers', () | modified |
| 2026-11-27 08:05:42 +07:00 | `server/bahtsul-masail-format.test.js` | — | 75–75 | test('PDF and Word exports apply distinct question and answer styling without br | modified |
| 2026-11-27 08:06:38 +07:00 | `server/pdf-export.js` | 37–41 | 37–43 | export function generateBookHtmlPdf({ title = 'Kitab', author = '', higriYear = | modified |
| 2026-11-27 08:06:38 +07:00 | `server/pdf-export.js` | — | 275–292 | export function generateBookHtmlPdf({ title = 'Kitab', author = '', higriYear = | modified |
| 2026-11-27 08:06:20 +07:00 | `server/word-export.js` | 141–146 | 141–154 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 08:06:20 +07:00 | `server/word-export.js` | — | 156–169 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 08:06:20 +07:00 | `server/word-export.js` | 153–154 | 175–176 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 08:06:20 +07:00 | `server/word-export.js` | 163–167 | 185–185 | export async function generateBookDocx({ title = 'Kitab', author = '', higriYear | modified |
| 2026-11-27 08:06:26 +07:00 | `src/components/ReaderModal.tsx` | 512–516 | 512–519 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 1–1 | 1–1 | QUESTION_HEADING, QUESTION_PREFIX, ANSWER_HEADING, ANSWER_PREFIX, REFERENCE_HEADING, REFERENCE_PREFIX, NEUTRAL_PREFIX, HAS_ARABIC | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 9–9 | 9–19 | const ANSWER_PREFIX = /^(?:Jawaban\|Jawab\|Rumusan(?:\s+Jawaban)?\|Keputusan\|الج | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 14–14 | 24–24 | export function classifyBahtsulMasailLine( | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 17–17 | 27–27 | export function classifyBahtsulMasailLine( | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 21–21 | 31–31 | export function classifyBahtsulMasailLine( | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 24–24 | 34–34 | export function classifyBahtsulMasailLine( | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 28–28 | 38–38 | export function classifyBahtsulMasailLine( | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 31–31 | 41–48 | export function classifyBahtsulMasailLine( | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 35–35 | 52–60 | export function classifyBahtsulMasailLine( | modified |
| 2026-11-27 08:05:41 +07:00 | `src/lib/bahtsul-masail-format.ts` | 38–38 | 63–63 | export function classifyBahtsulMasailLine( | modified |

## [2026-11-27 19:28:05 +07:00] — Perbaikan dropdown rekomendasi pencarian

Waktu pencatatan: **2026-11-27 19:28:05 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `891e57c`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: node --check server/search-autocomplete.js & server/index.js; 11/11 tes node --test server/search-autocomplete.test.js & server/search-policy.test.js; oxlint 0 error (4 warning bawaan); tsc -b, vite build, dan build_privacy.js lokal berhasil.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-19-28-05-b5684f.json](docs/change-audit/2026-11-27-19-28-05-b5684f.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 19:27:43 +07:00 | `dist/assets/index.dev-CHUbzdzF.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 19:27:43 +07:00 | `dist/index.dev.html` | 10–10 | 10–10 | module/file | modified |
| 2026-11-27 19:26:21 +07:00 | `server/index.js` | 38–38 | 38–38 | import { searchPagesOffThread, SEARCH_COUNT_CAP, MAX_SEARCH_BOOKS } from './text | modified |
| 2026-11-27 19:26:21 +07:00 | `server/index.js` | — | 1414–1414 | registerSearchAutocomplete(app, { | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | — | 1–62 | likePatternToRegExp, escaped, loadPopularQueries, filterPopularQueries, qLower, likeRegex, matches, seenQueries | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | — | 69–69 | export function queryAutocomplete({ | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | 57–59 | 120–129 | export function queryAutocomplete({ | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | 65–65 | 135–135 | export function queryAutocomplete({ | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | 67–68 | 137–138 | export function queryAutocomplete({ | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | 71–71 | 141–144 | export function queryAutocomplete({ | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | — | 148–148 | export function queryAutocomplete({ | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | 79–79 | — | export function queryAutocomplete({ | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | — | 177–177 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | — | 198–198 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | 126–126 | 201–201 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | — | 205–212 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | — | 219–219 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 19:26:18 +07:00 | `server/search-autocomplete.js` | 142–142 | 226–226 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | — | 32–32 | function createFixture(t) { | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | — | 34–34 | function createFixture(t) { | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | — | 36–37 | function createFixture(t) { | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | 78–78 | 82–82 | test('queryAutocomplete returns matching books and popular queries while respect | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | 80–82 | 84–89 | test('queryAutocomplete returns matching books and popular queries while respect | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | — | 91–92 | test('queryAutocomplete returns matching books and popular queries while respect | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | 116–116 | 125–125 | test('registerSearchAutocomplete caches responses and handles maintenance mode', | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | 118–118 | 127–127 | test('registerSearchAutocomplete caches responses and handles maintenance mode', | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | 122–122 | 131–131 | test('registerSearchAutocomplete caches responses and handles maintenance mode', | modified |
| 2026-11-27 19:27:02 +07:00 | `server/search-autocomplete.test.js` | 128–128 | 137–137 | test('registerSearchAutocomplete caches responses and handles maintenance mode', | modified |
| 2026-11-27 19:26:26 +07:00 | `src/App.tsx` | 264–264 | — | function App() { | modified |
| 2026-11-27 19:26:26 +07:00 | `src/App.tsx` | — | 308–308 | function App() { | modified |
| 2026-11-27 19:26:26 +07:00 | `src/App.tsx` | 566–566 | 566–566 | function App() { | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 1–1 | 1–1 | LOCAL_HISTORY_KEY, clientCache, CACHE_TTL, getLocalSearches, raw, parsed, saveLocalSearch, clean | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 21–21 | 21–21 | interface AutocompleteResult { | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 73–74 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 104–104 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 163–168 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 194–200 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 262–268 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 274–275 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 283–283 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 296–296 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 301–302 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 328–329 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 361–362 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 19:26:58 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 346–346 | 379–381 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |

## [2026-11-27 20:17:56 +07:00] — Poles UX dropdown rekomendasi pencarian (Tahap 5)

Waktu pencatatan: **2026-11-27 20:17:56 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `0625ddd`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: oxlint 0 error (3 warning react/only-export-components); 3/3 unit test search-autocomplete; tsc -b, vite build, dan build_privacy.js lokal berhasil.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-20-17-56-0c6419.json](docs/change-audit/2026-11-27-20-17-56-0c6419.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-C-2w8A1f.css` | 1–2 | — | module/file | deleted |
| 2026-11-27 20:17:40 +07:00 | `dist/assets/index-Dc7owPHM.css` | — | 1–2 | module/file | added |
| 2026-11-27 20:17:40 +07:00 | `dist/assets/index.dev-CNtiPnXE.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 20:17:40 +07:00 | `dist/index.dev.html` | 10–11 | 10–11 | module/file | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 47–74 | export function saveLocalSearch(query: string) { | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 100–100 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 78–78 | 107–107 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 109–111 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 82–82 | 114–114 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 85–85 | 117–117 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 224–224 | 256–260 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 235–235 | 271–271 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 238–238 | 274–274 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 247–247 | 283–283 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 255–256 | 291–293 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 260–260 | 297–299 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 277–277 | 316–316 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 285–285 | 324–324 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 288–288 | 327–327 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 336–353 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 299–320 | 356–395 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 401–437 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 327–327 | — | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 339–339 | 450–450 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 342–352 | 453–455 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | — | 457–459 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |
| 2026-11-27 20:17:14 +07:00 | `src/components/SearchAutocompleteInput.tsx` | 355–382 | 461–461 | export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ( | modified |

## [2026-11-27 20:27:33 +07:00] — Rekomendasi kitab Arab dari ketikan transliterasi Latin

Waktu pencatatan: **2026-11-27 20:27:33 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4e544f3`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: node --check server/arabic-transliteration.js & server/search-autocomplete.js; 5/5 tes node --test server/arabic-transliteration.test.js & server/search-autocomplete.test.js; oxlint 0 error 0 warning.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-20-27-33-ba54af.json](docs/change-audit/2026-11-27-20-27-33-ba54af.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 20:27:10 +07:00 | `server/arabic-transliteration.js` | — | 1–226 | ARABIC_DIACRITICS_RE, NON_ARABIC_WORD_RE, LATIN_LETTER_RE, ARABIC_CONSONANT_MAP, POPULAR_BOOK_ALIASES, collapseRepeats, arabicWordToSkeleton, arabicTextToTokens | added |
| 2026-11-27 20:26:29 +07:00 | `server/arabic-transliteration.test.js` | — | 1–69 | db, index, excluded, bukhari, fathul, riyadh, ihya, jalalain | added |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 1–2 | likePatternToRegExp, escaped, loadPopularQueries, filterPopularQueries, qLower, likeRegex, matches, seenQueries | modified |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 72–72 | export function queryAutocomplete({ | modified |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 123–140 | export function queryAutocomplete({ | modified |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 199–199 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 201–201 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 219–219 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 237–244 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 20:26:29 +07:00 | `server/search-autocomplete.js` | — | 252–252 | export function registerSearchAutocomplete(app, { | modified |
| 2026-11-27 20:26:30 +07:00 | `server/search-autocomplete.test.js` | — | 93–101 | test('queryAutocomplete returns matching books and popular queries while respect | modified |

## [2026-11-27 20:36:14 +07:00] — Perbaikan pencocokan transliterasi Latin agar tidak memunculkan kata pendek

Waktu pencatatan: **2026-11-27 20:36:14 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `c562d34`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: LULUS: node --check server/arabic-transliteration.js; 5/5 tes node --test server/arabic-transliteration.test.js & server/search-autocomplete.test.js; oxlint 0 error 0 warning.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-20-36-14-e81985.json](docs/change-audit/2026-11-27-20-36-14-e81985.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 20:35:42 +07:00 | `server/arabic-transliteration.js` | — | 15–15 | const ARABIC_CONSONANT_MAP = { | modified |
| 2026-11-27 20:35:42 +07:00 | `server/arabic-transliteration.js` | 198–198 | 199–199 | export function matchTranslitBooks( | modified |
| 2026-11-27 20:35:45 +07:00 | `server/arabic-transliteration.test.js` | — | 18–19 | test('arabicWordToSkeleton and latinWordToSkeleton converge on common book terms | modified |
| 2026-11-27 20:35:45 +07:00 | `server/arabic-transliteration.test.js` | — | 39–41 | test('matchTranslitBooks finds Arabic books from Latin transliteration and alias | modified |
| 2026-11-27 20:35:45 +07:00 | `server/arabic-transliteration.test.js` | — | 71–79 | test('matchTranslitBooks finds Arabic books from Latin transliteration and alias | modified |

## [2026-11-27 21:09:45 +07:00] — Fondasi HTTP SEO Tahap 1: robots.txt, sitemap.xml, redirect canonical, 404, dan metadata beranda

Waktu pencatatan: **2026-11-27 21:09:45 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `16530b6`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/index.js & server/seo-foundation.js lulus; 14/14 tes seo-foundation/static-cache/visit-tracking lulus; oxlint 0 error/warning; npm run build (tsc -b, vite build, build_privacy.js) lulus.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-21-09-45-fb7768.json](docs/change-audit/2026-11-27-21-09-45-fb7768.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 21:09:16 +07:00 | `dist/assets/index.dev-CSnqIGwM.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 21:09:16 +07:00 | `dist/index.dev.html` | — | 7–35 | module/file | modified |
| 2026-11-27 21:09:16 +07:00 | `dist/index.dev.html` | 9–10 | 38–38 | module/file | modified |
| 2026-11-27 21:09:16 +07:00 | `dist/index.dev.html` | 14–14 | 42–58 | module/file | modified |
| 2026-11-27 21:08:27 +07:00 | `index.dev.html` | — | 7–35 | module/file | modified |
| 2026-11-27 21:08:27 +07:00 | `index.dev.html` | 9–9 | — | module/file | modified |
| 2026-11-27 21:08:27 +07:00 | `index.dev.html` | 12–12 | 40–56 | module/file | modified |
| 2026-11-27 21:08:31 +07:00 | `server/index.js` | — | 36–36 | import { staticCacheControl } from './static-cache.js'; | modified |
| 2026-11-27 21:08:31 +07:00 | `server/index.js` | 1608–1608 | 1609–1609 | app.get('/api/search_archive', async (req, res) => { | modified |
| 2026-11-27 21:08:31 +07:00 | `server/index.js` | 1610–1616 | 1611–1611 | const distPath = path.join(__dirname, '../dist'); | modified |
| 2026-11-27 21:08:26 +07:00 | `server/seo-foundation.js` | — | 1–204 | DEFAULT_SITE_URL, normalizeSiteUrl, value, escapeXml, escapeHtml, buildRobotsTxt, base, buildSitemapXml | added |
| 2026-11-27 21:08:48 +07:00 | `server/seo-foundation.test.js` | — | 1–111 | setupServer, distPath, app, server, base, robots, robotsText, sitemap | added |
| 2026-11-27 21:08:28 +07:00 | `src/components/MoreMenu.tsx` | 12–12 | 12–12 | const items: {tab?:AppTab;href?:string;label:string;icon:typeof Menu}[]=[ | modified |

## [2026-11-27 21:27:44 +07:00] — SEO Tahap 2: layanan baca-saja dan halaman publik kitab (/kitab/:id-:slug)

Waktu pencatatan: **2026-11-27 21:27:44 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `5717eac`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/index.js & server/seo-books.js lulus; oxlint 0 error/warning; 18/18 tes seo-books/seo-foundation/static-cache/visit-tracking lulus; git diff --check bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-21-27-44-9b2d24.json](docs/change-audit/2026-11-27-21-27-44-9b2d24.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 21:26:49 +07:00 | `server/index.js` | — | 37–37 | import { registerSeoFoundation } from './seo-foundation.js'; | modified |
| 2026-11-27 21:26:49 +07:00 | `server/index.js` | 206–206 | 207–208 | let invalidateHadithIndex=()=>{}; | modified |
| 2026-11-27 21:26:49 +07:00 | `server/index.js` | 1609–1609 | 1611–1623 | app.get('/api/search_archive', async (req, res) => { | modified |
| 2026-11-27 21:26:43 +07:00 | `server/seo-books.js` | — | 1–383 | ARABIC_DIACRITICS_RE, ARABIC_SLUG_MAP, slugifyTitle, stripped, slug, escapeHtml, cleanText, text | added |
| 2026-11-27 21:27:14 +07:00 | `server/seo-books.test.js` | — | 1–128 | createBookFixture, distPath, service, app, server, base, fixture, get | added |

## [2026-11-27 21:37:41 +07:00] — SEO Tahap 3: halaman publik penulis, perawi, kategori, katalog, kutub hadis, tautan katalog, dan X-Robots-Tag unduhan

Waktu pencatatan: **2026-11-27 21:37:41 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `7c398b2`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check & oxlint (0 error/warning pada modul baru) lulus; 19/19 tes seo-books/seo-directory/seo-foundation/static-cache/visit-tracking lulus; npm run build (tsc -b, vite build, build_privacy.js) lulus.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-21-37-41-c587e5.json](docs/change-audit/2026-11-27-21-37-41-c587e5.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| waktu penghapusan tidak direkam | `dist/assets/index-Dc7owPHM.css` | 1–2 | — | module/file | deleted |
| 2026-11-27 21:37:10 +07:00 | `dist/assets/index-DdSW0cXV.css` | — | 1–2 | module/file | added |
| 2026-11-27 21:37:10 +07:00 | `dist/assets/index.dev-BBFfci2Z.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 21:37:10 +07:00 | `dist/index.dev.html` | 38–39 | 38–39 | module/file | modified |
| 2026-11-27 21:37:10 +07:00 | `dist/index.dev.html` | 49–52 | 49–52 | module/file | modified |
| 2026-11-27 21:36:06 +07:00 | `index.dev.html` | 47–50 | 47–50 | module/file | modified |
| 2026-11-27 21:36:15 +07:00 | `server/index.js` | — | 38–38 | import { createBookSeoService, registerBookSeoRoutes } from './seo-books.js'; | modified |
| 2026-11-27 21:36:15 +07:00 | `server/index.js` | 208–208 | 209–210 | let invalidateBookSeo=()=>{}; | modified |
| 2026-11-27 21:36:15 +07:00 | `server/index.js` | — | 1113–1113 | app.get('/api/download/:id', async (req, res) => { | modified |
| 2026-11-27 21:36:15 +07:00 | `server/index.js` | — | 1161–1161 | const handlePdfExport = async (req, res) => { | modified |
| 2026-11-27 21:36:15 +07:00 | `server/index.js` | — | 1627–1634 | registerBookSeoRoutes(app, { service: bookSeoService }); | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 1–63 | 1–11 | createBookSeoService, cache, invalidate, getBookDetail, bookId, err, db, countRow | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 189–189 | 137–143 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 207–207 | 161–161 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 220–221 | 174–176 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 243–301 | 198–206 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 304–304 | 209–210 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 310–311 | 216–217 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 317–317 | 223–223 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:35:38 +07:00 | `server/seo-books.js` | 321–346 | 227–237 | export function renderBookHtml(book, { siteUrl = DEFAULT_SITE_URL } = {}) { | modified |
| 2026-11-27 21:37:30 +07:00 | `server/seo-directory.js` | — | 1–464 | parsePositiveIdSlug, match, parsePage, n, unavailable, renderPagination, prev, next | added |
| 2026-11-27 21:35:40 +07:00 | `server/seo-directory.test.js` | — | 1–114 | setupFixture, distPath, db, rowaDb, mockAuthorService, e, app, server | added |
| 2026-11-27 21:35:37 +07:00 | `server/seo-utils.js` | — | 1–182 | DEFAULT_SITE_URL, normalizeSiteUrl, value, ARABIC_DIACRITICS_RE, ARABIC_SLUG_MAP, slugifyTitle, stripped, slug | added |
| 2026-11-27 21:36:04 +07:00 | `src/components/Catalog.tsx` | 367–369 | 367–369 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-27 21:36:04 +07:00 | `src/components/Catalog.tsx` | 375–375 | 375–375 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-27 21:36:04 +07:00 | `src/components/Catalog.tsx` | 388–389 | 388–390 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |
| 2026-11-27 21:36:04 +07:00 | `src/components/Catalog.tsx` | 393–393 | 394–394 | export default function Catalog({ openBook, readBook }: { openBook: (id: number) | modified |

## [2026-11-27 21:41:06 +07:00] — Perbaikan kolom tabel rowa pada direktori SEO /perawi

Waktu pencatatan: **2026-11-27 21:41:06 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `75c7454`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check & oxlint 0 error/warning lulus; 8/8 tes seo-directory/seo-books/seo-foundation lulus.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-21-41-06-0589fa.json](docs/change-audit/2026-11-27-21-41-06-0589fa.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 21:40:43 +07:00 | `server/seo-directory.js` | 204–204 | 204–204 | export function registerDirectorySeoRoutes(app, { | modified |
| 2026-11-27 21:40:43 +07:00 | `server/seo-directory.js` | 209–209 | 209–209 | export function registerDirectorySeoRoutes(app, { | modified |
| 2026-11-27 21:40:43 +07:00 | `server/seo-directory.js` | 211–211 | 211–211 | export function registerDirectorySeoRoutes(app, { | modified |
| 2026-11-27 21:40:43 +07:00 | `server/seo-directory.js` | 257–257 | 257–257 | export function registerDirectorySeoRoutes(app, { | modified |
| 2026-11-27 21:40:43 +07:00 | `server/seo-directory.js` | 297–297 | 297–297 | export function registerDirectorySeoRoutes(app, { | modified |
| 2026-11-27 21:40:43 +07:00 | `server/seo-directory.js` | 299–300 | 299–300 | export function registerDirectorySeoRoutes(app, { | modified |
| 2026-11-27 21:40:47 +07:00 | `server/seo-directory.test.js` | 27–27 | 27–27 | function setupFixture(t) { | modified |
| 2026-11-27 21:40:47 +07:00 | `server/seo-directory.test.js` | 29–29 | 29–29 | function setupFixture(t) { | modified |
| 2026-11-27 21:40:47 +07:00 | `server/seo-directory.test.js` | — | 91–94 | test('author, rowa, category, katalog, and kutub-hadis SEO pages return 200/301/ | modified |

## [2026-11-27 21:47:25 +07:00] — SEO Tahap 4: sitemap index dinamis terkurasi dan sinkronisasi meta React

Waktu pencatatan: **2026-11-27 21:47:25 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `2f05282`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check & oxlint (0 error/warning) lulus; 21/21 tes seo-sitemap/seo-books/seo-directory/seo-foundation/static-cache/visit-tracking lulus; npm run build (tsc -b, vite build, build_privacy.js) lulus; git diff --check bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-21-47-25-e19414.json](docs/change-audit/2026-11-27-21-47-25-e19414.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 21:47:04 +07:00 | `dist/assets/index.dev-BlpOxYW7.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-27 21:47:04 +07:00 | `dist/index.dev.html` | 38–38 | 38–38 | module/file | modified |
| 2026-11-27 21:46:22 +07:00 | `server/index.js` | — | 39–39 | import { registerDirectorySeoRoutes } from './seo-directory.js'; | modified |
| 2026-11-27 21:46:22 +07:00 | `server/index.js` | 210–210 | 211–212 | let invalidateDirectorySeo=()=>{}; | modified |
| 2026-11-27 21:46:22 +07:00 | `server/index.js` | — | 1637–1644 | invalidateDirectorySeo = directorySeo.invalidate; | modified |
| 2026-11-27 21:46:22 +07:00 | `server/index.js` | 1637–1637 | 1647–1647 | const distPath = path.join(__dirname, '../dist'); | modified |
| 2026-11-27 21:46:18 +07:00 | `server/seo-foundation.js` | 138–138 | 138–138 | function redirectWithQuery(req, res, targetPath) { | modified |
| 2026-11-27 21:46:18 +07:00 | `server/seo-foundation.js` | 150–155 | 150–157 | export function registerSeoFoundation(app, { express, distPath, siteUrl, staticC | modified |
| 2026-11-27 21:46:13 +07:00 | `server/seo-sitemap.js` | — | 1–221 | escapeXml, buildSitemapIndexXml, base, body, registerSitemapRoutes, cache, assertReady, err | added |
| 2026-11-27 21:46:15 +07:00 | `server/seo-sitemap.test.js` | — | 1–86 | createSitemapFixture, db, rowaDb, authorService, app, ctrl, server, base | added |
| 2026-11-27 21:46:25 +07:00 | `src/App.tsx` | — | 30–30 | import type { AppTab } from './lib/navigation'; | modified |
| 2026-11-27 21:46:25 +07:00 | `src/App.tsx` | — | 68–71 | function App() { | modified |
| 2026-11-27 21:46:16 +07:00 | `src/lib/seo-client.ts` | — | 1–56 | SITE_URL, DEFAULT_TITLE, NOINDEX_TABS, upsertMeta, syncDocumentSeo, description, canonicalPath | added |

## [2026-11-27 22:03:57 +07:00] — Kurasi kitab populer Indonesia pada /sitemap-books.xml

Waktu pencatatan: **2026-11-27 22:03:57 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `4982ecd`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check & oxlint (0 error/warning) lulus; seluruh 322/322 tes server (node --test server/*.test.js) lulus; git diff --check bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-22-03-57-f44f82.json](docs/change-audit/2026-11-27-22-03-57-f44f82.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 22:02:42 +07:00 | `server/seo-sitemap.js` | — | 35–61 | export function buildSitemapIndexXml(siteUrl = DEFAULT_SITE_URL, paths = []) { | modified |
| 2026-11-27 22:02:42 +07:00 | `server/seo-sitemap.js` | — | 139–152 | export function registerSitemapRoutes(app, { | modified |
| 2026-11-27 22:02:42 +07:00 | `server/seo-sitemap.js` | 118–118 | 159–159 | export function registerSitemapRoutes(app, { | modified |
| 2026-11-27 22:02:42 +07:00 | `server/seo-sitemap.js` | 120–120 | 161–161 | export function registerSitemapRoutes(app, { | modified |
| 2026-11-27 22:02:48 +07:00 | `server/seo-sitemap.test.js` | 13–13 | 13–13 | function createSitemapFixture(t, { maintenance = false } = {}) { | modified |
| 2026-11-27 22:02:48 +07:00 | `server/seo-sitemap.test.js` | — | 73–75 | test('sitemap index and all 5 curated pilot sub-sitemaps return valid XML and in | modified |

## [2026-11-27 22:22:31 +07:00] — Izinkan fitur Jelaskan dan Terjemah pada halaman kitab yang sedang dibuka

Waktu pencatatan: **2026-11-27 22:22:31 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b156c06`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: node --check server/ask-ai.js & oxlint (0 error/warning) lulus; 54/54 tes ask-ai & ai-book-policy lulus; git diff --check bersih.

Audit terstruktur beserta hash isi staged dan diff: [2026-11-27-22-22-31-84e5ff.json](docs/change-audit/2026-11-27-22-22-31-84e5ff.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-27 22:19:49 +07:00 | `docs/ai-book-policy.md` | 43–43 | 43–43 | Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanya | modified |
| 2026-11-27 22:22:03 +07:00 | `server/ask-ai.js` | — | 115–115 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-27 22:22:03 +07:00 | `server/ask-ai.js` | 116–116 | 117–117 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-27 22:22:03 +07:00 | `server/ask-ai.js` | 131–131 | 132–132 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-27 22:22:03 +07:00 | `server/ask-ai.js` | 207–207 | 208–208 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-27 22:22:03 +07:00 | `server/ask-ai.js` | 229–230 | 230–233 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-27 22:22:03 +07:00 | `server/ask-ai.js` | 275–275 | 278–278 | export function registerAskAi(app, { getDb, getStateDb, hasAdditional, requireAd | modified |
| 2026-11-27 22:20:44 +07:00 | `server/ask-ai.test.js` | 286–286 | 286–286 | test('whole-book exclusion removes clean-looking hits and catalogue metadata wit | modified |
| 2026-11-27 22:20:44 +07:00 | `server/ask-ai.test.js` | 288–288 | 288–288 | test('selected-page explanation and translation reject the entire excluded book | modified |
| 2026-11-27 22:20:44 +07:00 | `server/ask-ai.test.js` | 291–291 | 291–291 | test('selected-page explanation and translation reject the entire excluded book | modified |
| 2026-11-27 22:20:44 +07:00 | `server/ask-ai.test.js` | 293–293 | 293–293 | test('selected-page explanation and translation reject the entire excluded book | modified |
| 2026-11-27 22:20:44 +07:00 | `server/ask-ai.test.js` | 338–338 | 338–338 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |
| 2026-11-27 22:20:44 +07:00 | `server/ask-ai.test.js` | 342–342 | 342–342 | test('HTTP requests enforce whole-book policy through the real file-backed worke | modified |

## [2026-11-28 03:53:11 +07:00] — Antrean ceklis tinjauan relasi penulis dengan usulan metadata dan cuplikan halaman pertama

Waktu pencatatan: **2026-11-28 03:53:11 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `b5426fb`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 16/16 test lulus (authors.test.js & admin-navigation.test.js), npx tsc --noEmit lulus, npm run build sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-28-03-53-11-730776.json](docs/change-audit/2026-11-28-03-53-11-730776.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-28 03:52:53 +07:00 | `dist/assets/index-BnJ4xNUX.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-BlpOxYW7.js` | 1–22 | — | module/file | deleted |
| 2026-11-28 03:52:53 +07:00 | `dist/assets/index.dev-v7YudqI1.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-28 03:52:53 +07:00 | `dist/index.dev.html` | 38–39 | 38–39 | module/file | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | 7–7 | 7–10 | const paging=(q,size=24)=>{const limit=Math.min(100,Math.max(1,parseInt(q.limit) | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | 9–9 | 12–59 | const findText=s=>normalizeIdentity(s).replace(/[أإآٱ]/gu,'ا').replace(/ى/ | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | — | 124–124 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | — | 128–128 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | 78–78 | 130–132 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | 85–85 | 139–139 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | 87–87 | 141–141 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | 92–92 | 146–152 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | 148–148 | 208–223 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0) { | modified |
| 2026-11-28 03:51:26 +07:00 | `server/authors.js` | — | 240–240 | export function registerAuthors(app,{service,requireAdmin,onActivity=()=>{}}) { | modified |
| 2026-11-28 03:52:05 +07:00 | `server/authors.test.js` | — | 154–192 | test('linkBookToAuthor automatically links existing or new authors when admin ad | modified |
| 2026-11-28 03:51:01 +07:00 | `server/index.js` | 784–784 | 784–784 | registerHadithBooks(app,()=>{if(!db)throw Error('Database unavailable');return d | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | 3–3 | 3–6 | interface Link {id:number;name:string;status:string;basis:string;evidence:string | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | — | 8–8 | const date=(s:string)=>new Date(s).toLocaleString('id-ID',{timeZone:'Asia/Jakart | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | — | 11–11 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | 8–8 | 13–15 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | 13–13 | 20–35 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | — | 40–40 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | — | 44–44 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | 25–26 | 49–84 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | 30–31 | 88–157 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | 34–34 | 160–163 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |
| 2026-11-28 03:51:56 +07:00 | `src/components/AuthorReview.tsx` | — | 165–165 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |

## [2026-11-28 04:08:51 +07:00] — Ekstraksi usulan penulis dari 4 sumber data (metadata, authno, betaka/inf, halaman pertama)

Waktu pencatatan: **2026-11-28 04:08:51 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `bd18697`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 17/17 test lulus (authors.test.js & admin-navigation.test.js), npx tsc --noEmit lulus, npm run build sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-28-04-08-51-fdd127.json](docs/change-audit/2026-11-28-04-08-51-fdd127.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-28 04:08:38 +07:00 | `dist/assets/index.dev-3aQeET1G.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-28 04:08:38 +07:00 | `dist/index.dev.html` | 38–38 | 38–38 | module/file | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 12–20 | 12–28 | const extractYear=s=>String(s\|\|'').match(/(?:^\|\D)(\d{3,4})(?:\D\|$)/)?.[1]\|\|null | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 22–25 | 30–33 | export function suggestAuthors(metadataAuthor,authorsMap,limit=3){ | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 27–32 | 35–39 | export function suggestAuthors(metadataAuthor,authorsMap,limit=3){ | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 34–37 | 41–44 | export function suggestAuthors(metadataAuthor,authorsMap,limit=3){ | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 41–44 | 48–51 | export function suggestAuthors(metadataAuthor,authorsMap,limit=3){ | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 46–46 | 53–54 | export function suggestAuthors(metadataAuthor,authorsMap,limit=3){ | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 48–49 | 56–87 | export function suggestAuthors(metadataAuthor,authorsMap,limit=3){ | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 59–59 | 97–97 | const formatPageSnippet=(row,maxLen=320)=>{ | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 124–124 | 162–175 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0,ge | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 129–129 | 180–181 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0,ge | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 131–132 | 183–184 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0,ge | modified |
| 2026-11-28 04:08:03 +07:00 | `server/authors.js` | 146–151 | 198–207 | export function createAuthorService(store,getLibrary,getLibraryRevision=()=>0,ge | modified |
| 2026-11-28 04:08:14 +07:00 | `server/authors.test.js` | — | 193–217 | test('review queue returns metadata author suggestions, first-page snippets, and | modified |
| 2026-11-28 04:07:46 +07:00 | `server/index.js` | 784–784 | 784–794 | registerHadithBooks(app,()=>{if(!db)throw Error('Database unavailable');return d | modified |
| 2026-11-28 04:08:05 +07:00 | `src/components/AuthorReview.tsx` | 3–3 | 3–3 | interface Link {id:number;name:string;status:string;basis:string;evidence:string | modified |
| 2026-11-28 04:08:05 +07:00 | `src/components/AuthorReview.tsx` | 70–70 | 70–71 | export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) | modified |

## [2026-11-28 04:28:12 +07:00] — Fitur login Google untuk admin dan pengunjung (desktop-only) serta penyimpanan aktivitas user

Waktu pencatatan: **2026-11-28 04:28:12 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `2df6d31`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: 20/20 test lulus (google-auth.test.js, authors.test.js, admin-navigation.test.js), npx tsc --noEmit lulus, npm run build sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-28-04-28-12-c7205a.json](docs/change-audit/2026-11-28-04-28-12-c7205a.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-28 04:27:57 +07:00 | `dist/assets/index-BgESlTGm.css` | — | 1–2 | module/file | added |
| waktu penghapusan tidak direkam | `dist/assets/index-BnJ4xNUX.css` | 1–2 | — | module/file | deleted |
| waktu penghapusan tidak direkam | `dist/assets/index.dev-3aQeET1G.js` | 1–22 | — | module/file | deleted |
| 2026-11-28 04:27:57 +07:00 | `dist/assets/index.dev-B4TRb7sS.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-28 04:27:57 +07:00 | `dist/index.dev.html` | 38–39 | 38–39 | module/file | modified |
| 2026-11-28 04:25:14 +07:00 | `server/google-auth.js` | — | 1–267 | DEFAULT_ADMIN_EMAILS, parseAdminEmails, list, ensureGoogleAuthSchema, verifyGoogleCredential, err, url, res | added |
| 2026-11-28 04:27:22 +07:00 | `server/google-auth.test.js` | — | 1–137 | createFixture, stateDb, activeTokens, app, idToken, payload, user, server | added |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | — | 47–47 | import {createAuthorService,registerAuthors} from './authors.js'; | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | 164–164 | 165–165 | app.use((req, res, next) => { | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | — | 362–362 | try { | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | — | 589–594 | app.post('/api/admin/logout', requireAdmin, (req, res) => { | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | 907–909 | 915–918 | app.post('/api/book-submit', (req, res) => { | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | — | 931–931 | app.post('/api/feedback', (req, res) => { | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | 923–923 | 933–933 | app.post('/api/feedback', (req, res) => { | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | — | 942–942 | app.post('/api/book-request', (req, res) => { | modified |
| 2026-11-28 04:25:36 +07:00 | `server/index.js` | 933–933 | 944–944 | app.post('/api/book-request', (req, res) => { | modified |
| 2026-11-28 04:26:35 +07:00 | `src/App.tsx` | — | 36–37 | import { MessageWidget } from './components/MessageWidget'; | modified |
| 2026-11-28 04:26:35 +07:00 | `src/App.tsx` | — | 121–144 | function App() { | modified |
| 2026-11-28 04:26:35 +07:00 | `src/App.tsx` | — | 484–484 | function App() { | modified |
| 2026-11-28 04:27:08 +07:00 | `src/components/Admin.tsx` | — | 26–26 | import { AdminDailyChart } from './AdminDailyChart'; | modified |
| 2026-11-28 04:27:08 +07:00 | `src/components/Admin.tsx` | — | 155–158 | const LoginForm = ({ onLogin, onClose }: { onLogin: (t: string) => void, onClose | modified |
| 2026-11-28 04:27:08 +07:00 | `src/components/Admin.tsx` | — | 1839–1848 | export const Admin = ({ onClose }: { onClose: () => void }) => { | modified |
| 2026-11-28 04:26:56 +07:00 | `src/components/BookRequest.tsx` | — | 3–3 | import { BookPlus, Send } from 'lucide-react'; | modified |
| 2026-11-28 04:26:56 +07:00 | `src/components/BookRequest.tsx` | 7–7 | 8–9 | export default function BookRequest() { | modified |
| 2026-11-28 04:26:56 +07:00 | `src/components/BookRequest.tsx` | — | 22–30 | export default function BookRequest() { | modified |
| 2026-11-28 04:26:56 +07:00 | `src/components/BookRequest.tsx` | 27–27 | 38–38 | export default function BookRequest() { | modified |
| 2026-11-28 04:26:56 +07:00 | `src/components/BookRequest.tsx` | 31–31 | 42–47 | export default function BookRequest() { | modified |
| 2026-11-28 04:26:58 +07:00 | `src/components/BookSubmit.tsx` | — | 3–3 | import { Upload, Send, FileText, X } from 'lucide-react'; | modified |
| 2026-11-28 04:26:58 +07:00 | `src/components/BookSubmit.tsx` | 7–7 | 8–9 | export default function BookSubmit() { | modified |
| 2026-11-28 04:26:58 +07:00 | `src/components/BookSubmit.tsx` | — | 24–32 | export default function BookSubmit() { | modified |
| 2026-11-28 04:26:58 +07:00 | `src/components/BookSubmit.tsx` | 62–62 | 73–73 | export default function BookSubmit() { | modified |
| 2026-11-28 04:26:58 +07:00 | `src/components/BookSubmit.tsx` | — | 78–79 | export default function BookSubmit() { | modified |
| 2026-11-28 04:26:58 +07:00 | `src/components/BookSubmit.tsx` | 68–68 | 81–81 | export default function BookSubmit() { | modified |
| 2026-11-28 04:26:07 +07:00 | `src/components/DesktopAccountMenu.tsx` | — | 1–255 | DesktopAccountMenu, menuRef, sync, token, onDown, loadActivity, booksData, actData | added |
| 2026-11-28 04:26:55 +07:00 | `src/components/Feedback.tsx` | 1–1 | 1–1 | API_BASE, StarRating, Feedback, savedUser, sync, u, handleSubmit, res | modified |
| 2026-11-28 04:26:55 +07:00 | `src/components/Feedback.tsx` | — | 3–3 | import { MessageSquare, Send } from 'lucide-react'; | modified |
| 2026-11-28 04:26:55 +07:00 | `src/components/Feedback.tsx` | 15–15 | 16–17 | export default function Feedback() { | modified |
| 2026-11-28 04:26:55 +07:00 | `src/components/Feedback.tsx` | — | 22–30 | export default function Feedback() { | modified |
| 2026-11-28 04:26:55 +07:00 | `src/components/Feedback.tsx` | 27–27 | 38–38 | export default function Feedback() { | modified |
| 2026-11-28 04:26:55 +07:00 | `src/components/Feedback.tsx` | 31–32 | 42–47 | export default function Feedback() { | modified |
| 2026-11-28 04:26:06 +07:00 | `src/components/GoogleLoginButton.tsx` | — | 1–122 | GoogleLoginButton, containerRef, handleCredential, res, data, target, renderButton, existing | added |
| 2026-11-28 04:26:40 +07:00 | `src/components/ReaderModal.tsx` | — | 230–239 | const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highli | modified |
| 2026-11-28 04:26:05 +07:00 | `src/lib/user-auth.ts` | — | 1–60 | USER_TOKEN_KEY, USER_PROFILE_KEY, ADMIN_TOKEN_KEY, getUserToken, getSavedUser, raw, userAuthHeaders, token | added |

## [2026-11-28 04:47:17 +07:00] — Render modal login dan aktivitas akun melalui portal document.body agar tidak terpotong header

Waktu pencatatan: **2026-11-28 04:47:17 +07:00**. Waktu pada tabel adalah modifikasi terakhir file, bukan rekonstruksi setiap edit. Baris sebelum mengacu pada commit `c9186f4`; baris sesudah mengacu pada isi staged commit ini.

Verifikasi: npx tsc --noEmit lulus, npm run build sukses

Audit terstruktur beserta hash isi staged dan diff: [2026-11-28-04-47-17-6deef7.json](docs/change-audit/2026-11-28-04-47-17-6deef7.json).

| Modifikasi terakhir (WIB) | File | Baris sebelum | Baris sesudah | Bagian / simbol | Perubahan |
|---|---|---|---|---|---|
| 2026-11-28 04:47:13 +07:00 | `dist/assets/index.dev-9RAsQHMn.js` | — | 1–22 | t, n, m, v, which, y, b, C | added |
| 2026-11-28 04:47:13 +07:00 | `dist/index.dev.html` | 38–38 | 38–38 | module/file | modified |
| 2026-11-28 04:46:27 +07:00 | `src/components/DesktopAccountMenu.tsx` | — | 2–2 | import { useEffect, useRef, useState } from 'react'; | modified |
| 2026-11-28 04:46:27 +07:00 | `src/components/DesktopAccountMenu.tsx` | 153–153 | 154–154 | export function DesktopAccountMenu({ onNavigate, onReadBook }: Props) { | modified |
| 2026-11-28 04:46:27 +07:00 | `src/components/DesktopAccountMenu.tsx` | 167–167 | 168–169 | export function DesktopAccountMenu({ onNavigate, onReadBook }: Props) { | modified |
| 2026-11-28 04:46:27 +07:00 | `src/components/DesktopAccountMenu.tsx` | 170–170 | 172–172 | export function DesktopAccountMenu({ onNavigate, onReadBook }: Props) { | modified |
| 2026-11-28 04:46:27 +07:00 | `src/components/DesktopAccountMenu.tsx` | 251–251 | 253–254 | export function DesktopAccountMenu({ onNavigate, onReadBook }: Props) { | modified |
