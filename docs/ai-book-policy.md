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
- **Penjelasan dan terjemahan dari pembaca (`explain` & `translate`):** tetap diizinkan saat kitab sedang dibuka oleh pengguna.
- **Cache jawaban:** namespace memakai versi kebijakan. Setiap pemakaian cache memeriksa ulang kelayakan kitab.
- **Penyusunan dan review jawaban:** kelayakan diperiksa ulang sebelum jawaban dikirim dan disimpan. Bila kitab berubah di tengah proses, permintaan gagal tanpa mengirim rujukan.

### Pencarian biasa (`server/search-policy.js`)

- **Kata kunci yang memuat nama terblokir** langsung menghasilkan 0 hasil.
- **Kitab terblokir disembunyikan** dari hasil pencarian teks dan judul.
- **Tetap tersedia:** pencarian lanjutan (*advanced*), pencarian di dalam satu kitab, katalog, dan membaca kitab.
- **Daftar kitab terblokir** disimpan di `search_book_policy` (database state). Isinya per kitab:
  - `excluded` dan `reason` (`title` / `author` / `content`);
  - `policy_version`: versi kebijakan saat kitab diputuskan;
  - `fingerprint`: jumlah halaman dan rowid terbesar per sumber, untuk mendeteksi kitab yang berubah.
- **Pemindaian penuh di latar belakang** (`startSearchPolicyScan` → `server/search-policy-worker.js`):
  - Worker membuka database utama dan tambahan dalam mode hanya-baca.
  - Setiap kitab diperiksa: judul, nama penulis, lalu seluruh halaman (catatan kaki di bawah `____` tidak ikut).
  - Hanya kitab baru, berubah, diedit, atau yang diputuskan oleh versi kebijakan lama yang dipindai.
  - Hasil ditulis per 25 kitab, sehingga filter pencarian langsung membaik selama proses. Baris lama tetap berlaku sampai kitabnya diputuskan ulang.
  - Setelah memeriksa satu kitab, worker berhenti sejenak selama waktu yang sama (beban sekitar 50%), agar CPU dan disk tetap tersedia untuk pengunjung.
- **Kapan berjalan:**
  - 5 detik setelah server start;
  - satu menit setelah import, penghapusan, atau penggabungan kategori (`invalidateLibraryCache`);
  - setelah edit atau hapus halaman (kitab itu ditandai untuk diperiksa ulang);
  - setiap 6 jam sebagai pengaman.
  - Pemindaian ditunda 10 menit bila import, penghapusan, atau compact transfer sedang berjalan. Bila gagal, dicoba lagi 30 menit kemudian.
- **Durasi:** pemindaian pertama atau setelah daftar nama diubah membaca seluruh perpustakaan.
  - Ukuran salinan lokal: 13,7 juta halaman.
  - Kecepatan sekitar 3.700 halaman/detik saat bekerja, ditambah jeda.
  - Pemindaian berikutnya hanya memeriksa kitab yang berubah, jadi selesai dalam hitungan detik.
- **Progres:** `GET /api/search/policy-status` berisi jumlah kitab, sisa, sudah diperiksa, dan terblokir. Endpoint ini tidak memuat ID kitab.

## Pemeriksaan dan invalidasi (Tanya AI)

- **Cara memindai:** sumber berbasis file dipindai lewat worker dengan koneksi SQLite hanya-baca. Batasnya 20 detik per batch dan maksimal dua worker aktif. Bila terjadi timeout, pembatalan, atau sumber berubah, kitab tidak pernah dianggap lolos.
- **Cache:** hasil disimpan di memori per koneksi, maksimal 2.048 ID kitab. Perubahan dari luar terdeteksi lewat `data_version` dan `schema_version`.
- **Invalidasi:**
  - Import dan penghapusan kitab membatalkan cache kebijakan.
  - Edit halaman membatalkan cache kebijakan dan cache jawaban AI.
  - Jalur baru yang mengubah isi kitab harus memanggil `invalidateAiBookPolicy(db)` atau `invalidateLibraryCache()`.

## Mengubah daftar nama

1. Ubah `excludedAiNames` dan `patterns` di `server/ai-book-policy.js`.
2. Tambahkan potongan huruf tetap dari pola baru ke `LETTER_RUNS` (saringan cepat), lalu naikkan `AI_BOOK_POLICY_VERSION`. Kenaikan versi memperbarui cache jawaban AI dan memicu pemindaian penuh ulang untuk pencarian.
3. Perbarui tes di `server/ai-book-policy.test.js`, `server/search-policy.test.js`, dan `server/ask-ai.test.js`.

`GET /api/ai/status` mengembalikan `sourcePolicyVersion`, sehingga versi backend online bisa diperiksa tanpa memanggil provider AI. Perubahan ini hanya di backend: tidak perlu build frontend atau import ulang dataset.
