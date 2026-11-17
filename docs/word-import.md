# Import Word (.docx) menjadi kitab

Lokasi: Admin → Database Kitab → **Import / Export Kitab** → tab **Import Word**. Tab ini disembunyikan di versi lokal (mode baca/export).

## Alur

1. **Pilih atau seret file `.docx`** (maksimal 25 MB). File `.doc` lama ditolak dengan petunjuk agar disimpan ulang sebagai `.docx`.
2. **Pratinjau** (`POST /api/admin/books/word/preview`). Server membaca file tanpa menyimpan apa pun, lalu menampilkan:
   - jumlah halaman, judul daftar isi, catatan kaki, dan karakter;
   - peringatan, jika ada;
   - daftar isi;
   - tiga halaman pertama.
3. **Isi data kitab:**
   - Judul: diisi otomatis dari judul dokumen, style *Title*, atau Heading pertama.
   - Penulis: opsional. Nama yang sama persis memakai data penulis yang sudah ada.
   - Kategori: wajib.
   - Centang konfirmasi.
4. **Import** (`POST /api/admin/books/word/import`):
   - Database dicadangkan dulu ke `book-import-backups/`, sama seperti import JSON.
   - Kitab disimpan lewat `importBooks`, sehingga validasi, indeks pencarian (trigger `pages_fts`), dan pembersihan cache tetap sama.
   - ID kitab baru = ID terbesar + 1.

## Cara dokumen dibaca (`server/docx-import.js`)

- **Pembaca ZIP/XML** hanya memakai `node:zlib`, tanpa dependensi baru di server.
  - Ukuran isi tiap bagian dibatasi 80 MB, untuk melindungi dari *zip bomb*.
  - ZIP64 tidak didukung.
- **Daftar isi:** paragraf dengan style Heading 1–6, *Title*, `outlineLvl` langsung, atau style turunan (`basedOn`) menjadi entri daftar isi.
  - Tabel `titles` menyimpan satu judul per halaman, jadi setiap judul membuka halaman baru.
- **Pembagian halaman.** Page break (`w:br type=page`) dan *page break before* selalu memulai halaman baru. Ada dua mode:
  - *Per judul* (bawaan): halaman baru di setiap judul, lalu dibagi lagi sekitar 4.000 karakter pada batas kalimat.
  - *Ikuti halaman Word*: mengikuti posisi halaman yang disimpan Microsoft Word (`w:lastRenderedPageBreak`).
- **Catatan kaki dan catatan akhir:**
  - Penanda di teks diganti dengan nomor per halaman, misalnya `(1)`.
  - Isinya ditaruh di bawah halaman, setelah garis `__________`.
- **Yang dilewati:**
  - revisi yang dihapus (*track changes*);
  - kode field (mis. nomor halaman);
  - salinan cadangan isi textbox (`mc:Fallback`).
  
  Isi sel tabel dipisahkan tab.
- **Format teks:** baris dipisahkan `\r`, sama seperti kitab lain. Kolom `part` = 1 dan `page` = nomor urut halaman.

## Pengujian

`server/docx-import.test.js` memakai file `.docx` asli yang dibuat dengan pustaka `docx` (sama dengan fitur export Word). Yang diuji:
- judul, catatan kaki, dan page break;
- revisi yang dihapus dan field yang dilewati;
- deteksi level judul;
- pembagian teks panjang;
- mode halaman Word;
- file rusak, file kosong, dan zip bomb;
- endpoint admin: pratinjau tidak menyimpan; import menghasilkan kitab yang bisa dicari, membuat cadangan, dan memakai ulang penulis yang sudah ada.
