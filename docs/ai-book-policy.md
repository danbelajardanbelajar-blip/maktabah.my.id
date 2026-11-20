# Pengecualian seluruh kitab (Tanya AI dan pencarian)

Versi kebijakan: `whole-book-exclusions-v8` (`AI_BOOK_POLICY_VERSION` di `server/ai-book-policy.js`).

## Nama yang diblokir

Sebuah kitab dikecualikan seluruhnya bila satu atau lebih halaman `pages.nass` memuat salah satu nama berikut:

| Nama | Varian yang ikut cocok |
|---|---|
| `ابن باز` | `بن باز`, `عبد العزيز بن باز`, `وابن باز`, `لابن باز`, `ابنباز`. Tidak termasuk `البازي` dan `البازية` (mis. *الدرر البازية*). |
| `ابن عثيمين` | semua kata yang memuat `عثيمين` (mis. `العثيمين`) |
| `الألباني` | `للألباني`, `والألباني`, `بالألباني`; tidak termasuk `الباني` ("pembangun") dan `الألبانية` / `الالبانيه` |
| `شيخ الإسلام ابن تيمية` | hanya frasa utuh: `شيخ الإسلام ابن تيمية`, `شيخ الاسلام ابن تيمية`, `شيخ الإسلام بن تيمية`, `ابن تيميه`, awalan و ف ب ل ك pada `شيخ` (mis. `لشيخ الإسلام ابن تيمية`). `ابن تيمية` saja, `الشيخ ابن تيمية`, atau `الإمام ابن تيمية` tidak diblokir. |

Pencocokan dilakukan setelah teks dinormalkan:
- harakat, tatweel, dan penanda format tak terlihat dihapus;
- variasi alif disamakan (`أإآٱ` → `ا`), juga `ة` → `ه` dan `ى` → `ي`;
- tanda baca diganti spasi;
- HTML dan entitas karakter dibaca sebagai teks.

Nama tetap cocok walau hanya disebut atau dikritik. Catatan kaki pentahqiq (teks di bawah garis `____`) tidak diperiksa. Jadi rujukan seperti "صححه الألباني" di catatan kaki tidak membuat kitab dikecualikan.

**Riwayat daftar:**
- `ابن تيمية` dan semua variannya dikeluarkan dari daftar pada v5 (2026-11-20) atas permintaan pemilik.
- Pola `البازي` / `البازية` dipersempit menjadi `البازية` saja pada v6 (2026-11-20). Kata "البازي" dalam bahasa Arab klasik berarti burung elang ("تقضي البازي"), sehingga ikut memblokir kitab seperti *مجموع الفتاوى* (5564) dan *منهاج السنة النبوية* (225) walau keduanya tidak menyebut Ibnu Baz.
- Pada v7 (2026-11-20), atas permintaan pemilik, kata sifat `البازية` / `البازيه` dan `الألبانية` / `الالبانيه` (beserta awalan و ف ب ل ك) tidak lagi diblokir.
- Pada v8 (2026-11-20), atas permintaan pemilik, frasa utuh `شيخ الإسلام ابن تيمية` / `شيخ الاسلام ابن تيمية` diblokir lagi. Nama `ابن تيمية` tanpa gelar itu tetap tidak diblokir.
  - Menurut FTS pada salinan lokal, frasa ini muncul di sekitar 7.700 kitab (7.248 dengan hamzah, 492 tanpa hamzah).
  - Contoh yang kembali diblokir: *مجموع الفتاوى* (5564), *الفتاوى الكبرى* (6812), dan *المستدرك على مجموع الفتاوى* (346).
  - *منهاج السنة النبوية* (225) tetap lolos.
- `محمد بن عبد الوهاب` dikeluarkan sebelumnya (`aa2b39a`), karena nama itu juga dipakai perawi hadis dalam sanad Muslim dan kitab-kitab Sunan.
- `الألباني` ditambahkan pada `e47b067`.

## Cakupan

Semua halaman kitab diperiksa, termasuk halaman yang tidak cocok dengan pertanyaan. Pemeriksaan berlaku pada database utama dan tambahan. ID kitab dipakai lintas sumber, jadi sebuah ID dikecualikan bila salah satu sumber memuat nama tersebut. Nama yang terpotong di antara dua halaman tidak dianggap muncul.

### Tanya AI

- **Pencarian rujukan:** hanya kitab yang lolos yang dikirim sebagai konteks ke provider. Bila hasil teratas seluruhnya dikecualikan, pencarian diulang tanpa ID tersebut (maksimal delapan putaran).
- **Jawaban katalog:** metadata kitab yang dikecualikan tidak dipakai sebagai rujukan.
- **Penjelasan dan terjemahan dari pembaca:** ditolak dengan `AI_SOURCE_EXCLUDED` (HTTP 403).
- **Cache jawaban:** namespace memakai versi kebijakan. Setiap pemakaian cache memeriksa ulang kelayakan kitab.
- **Penyusunan dan review jawaban:** kelayakan diperiksa ulang sebelum jawaban dikirim dan disimpan. Bila kitab berubah di tengah proses, permintaan gagal tanpa mengirim rujukan.

### Pencarian biasa (`server/search-policy.js`)

- **Kata kunci yang memuat nama terblokir** langsung menghasilkan 0 hasil.
- **Kitab terblokir disembunyikan** dari hasil pencarian teks dan judul.
- **Tetap tersedia:** pencarian lanjutan (*advanced*), pencarian di dalam satu kitab, katalog, dan membaca kitab.
- **Penyimpanan hasil:** status per kitab disimpan di `search_book_policy` (database state):
  - `excluded`, `reason` (`title` / `author` / `content`), dan `policy_version`.
  - Saat start, judul dan penulis disinkronkan.
  - Kitab yang memuat istilah terblokir menurut FTS dipindai isinya.
- **Saat versi kebijakan berubah** (`reconcileSearchPolicyBatch`):
  - Server memeriksa ulang setiap kitab yang tercatat terblokir oleh versi lama, dua kitab per giliran. Isi halaman dipindai di worker hanya-baca (batas 20 detik), sehingga server tetap responsif. *مجموع الفتاوى* (16.874 halaman) butuh sekitar 6 detik.
  - Kitab yang tidak lagi cocok dibuka kembali.
  - Setelah selesai, baris "bersih" dari versi lama dihapus agar nama yang baru ditambahkan ikut dievaluasi oleh pemindaian FTS.
  - Kitab tidak pernah dibuka sebelum pemeriksaannya selesai. Batch yang gagal (mis. kedua worker sedang dipakai Tanya AI) dicoba lagi semenit kemudian, maksimal 10 kali.

## Pemeriksaan dan invalidasi (Tanya AI)

- **Cara memindai:** sumber berbasis file dipindai lewat worker dengan koneksi SQLite hanya-baca. Batasnya 20 detik per batch dan maksimal dua worker aktif. Bila terjadi timeout, pembatalan, atau sumber berubah, kitab tidak pernah dianggap lolos.
- **Cache:** hasil disimpan di memori per koneksi, maksimal 2.048 ID kitab. Perubahan dari luar terdeteksi lewat `data_version` dan `schema_version`.
- **Invalidasi:**
  - Import dan penghapusan kitab membatalkan cache kebijakan.
  - Edit halaman membatalkan cache kebijakan dan cache jawaban AI.
  - Jalur baru yang mengubah isi kitab harus memanggil `invalidateAiBookPolicy(db)` atau `invalidateLibraryCache()`.

## Mengubah daftar nama

1. Ubah `excludedAiNames` dan `patterns` di `server/ai-book-policy.js`. Bila perlu, ubah juga `SEARCH_POLICY_FTS_TERMS` di `server/search-policy.js`.
2. Naikkan `AI_BOOK_POLICY_VERSION`. Langkah ini sekaligus memperbarui cache jawaban AI dan memicu pemeriksaan ulang `search_book_policy`.
3. Perbarui tes di `server/ai-book-policy.test.js`, `server/search-policy.test.js`, dan `server/ask-ai.test.js`.

`GET /api/ai/status` mengembalikan `sourcePolicyVersion`, sehingga versi backend online bisa diperiksa tanpa memanggil provider AI. Perubahan ini hanya di backend: tidak perlu build frontend atau import ulang dataset.
