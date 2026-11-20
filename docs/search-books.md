# Pencarian di kitab yang dicentang

Lokasi: halaman pencarian → **Filter kategori & kitab / Cari lanjut** → bagian **Cari di Kitab Tertentu**.

## Cara pakai

1. Ketik minimal 2 huruf judul kitab. Daftar judul muncul (maksimal 30) dengan kotak centang.
2. Centang kitab yang diinginkan, maksimal **100 kitab**. Kitab terpilih tampil sebagai label yang bisa dihapus satu per satu atau sekaligus (**Kosongkan**).
3. Saklar **Cari hanya di N kitab terpilih** otomatis aktif saat kitab pertama dicentang.
4. Cari seperti biasa dengan mode **Teks**.

Saat saklar aktif, muncul pita *Pencarian teks hanya di N kitab terpilih* di atas kotak pencarian, dengan tombol **Ubah** dan **Matikan**. Tombol **Matikan** langsung mengulang pencarian di semua kitab.

## Aturan

- **Hanya mode Teks.** Pencarian judul dan PDF tidak dibatasi.
- **Pilihan kitab menggantikan filter kategori.** Selama saklar aktif, `cat_id` tidak dikirim.
- **Daftar kitab terpilih disimpan di perangkat** (`localStorage`: `maktabah:search-books`, `maktabah:search-books-active`).
  - Batasan yang sedang dipakai ikut tercatat di alamat halaman (`?books=1,2,3`), sehingga tombol kembali dan tautan yang dibagikan menampilkan hasil yang sama.
  - Alamat pencarian tanpa `books` mematikan saklar, tapi daftar kitab tidak dihapus.
  - Tautan dengan ID kitab yang belum dikenal menambahkannya ke daftar dengan judul sementara `Kitab #ID`.
- **Kebijakan blokir tetap berlaku.** Di pencarian biasa, kitab terpilih yang diblokir dibuang dari daftar (lihat `docs/ai-book-policy.md`). Di **Cari lanjut**, sama seperti filter lain di sana, kebijakan blokir tidak dipakai.

## Server

- **Endpoint:** `GET /api/search?q=…&book_ids=1,2,3`. Parameter ini menerima 1–100 ID unik; selain itu dijawab 400 dengan pesan `Pilih 1 sampai 100 kitab untuk dicari.`
- **Cara mencari:** `searchPages` (`server/text-search.js`) membaca indeks FTS hanya di rentang rowid halaman tiap kitab terpilih (`pages_fts.rowid BETWEEN …`), lalu memastikan `p.book_id` cocok.
  - Rowid halaman setiap kitab bersambung: 30.712 dari 30.712 kitab di salinan lokal.
  - Cara lama, menyaring `book_id` setelah `MATCH`, harus menelusuri semua halaman yang memuat kata itu. Untuk kata "الله" di 5 kitab butuh 27 dtk hanya untuk 50 hasil pertama. Dengan rentang rowid, 0,4 dtk.
  - Pencarian di dalam satu kitab (`book_id`, dari pembaca kitab) ikut memakai cara ini.
- **Urutan hasil:** frasa persis lebih dulu, lalu semua kata. Dalam tiap kelompok, database utama lalu tambahan, dan tiap kitab sesuai urutan pilihan.
- **Penghitungan total:** berhenti setelah batas 10.000 hasil, seperti pencarian biasa.

## Pengujian

- `server/text-search.test.js` mencakup:
  - hasil hanya dari kitab terpilih, dengan rowid dua kitab yang saling selang-seling;
  - urutan pilihan dan perpindahan halaman antarkitab;
  - dua sumber database;
  - kitab yang tidak dikenal, filter kategori, dan gabungan `bookId` + `bookIds`;
  - batas hitungan.
- Uji manual di browser selebar 375 px dengan database contoh:
  - centang 2 kitab menghasilkan 22 hasil dan `?books=315,300`;
  - **Matikan** menghasilkan 74 hasil, dan daftar kitab tetap tersimpan;
  - tombol kembali mengembalikan pencarian dengan batasan kitab.
