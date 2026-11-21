# Pilihan tempat pencarian: kategori dan kitab

Panel **Pilih Tempat Pencarian** menggantikan dua pemilih terpisah di Cari Lanjut. Panah membuka/menutup kategori; checkbox kategori memilih seluruh kitabnya, termasuk judul yang belum dimuat. Checkbox menampilkan keadaan sebagian dipilih jika ada pengecualian atau hanya beberapa kitab dipilih. Pilihan dari beberapa kategori digabungkan.

Perubahan dalam panel merupakan draf sampai **Terapkan** ditekan. Pencarian yang sudah berisi kata dijalankan ulang dari halaman pertama. **Reset pilihan** mengembalikan draf ke semua kitab; tombol **Cari di semua kitab** pada ringkasan langsung menerapkannya. Mencari judul, menutup kategori, dan memuat halaman judul berikutnya tidak menghapus pilihan. Memilih kategori saat daftar difilter tetap memilih seluruh isi kategori, sesuai petunjuk panel.

## Representasi dan kompatibilitas

- `scope=all` berarti seluruh kitab, dikurangi `notcats` dan `notbooks`. `books` dapat menambahkan kitab dari kategori yang dikecualikan.
- `scope=custom` berarti gabungan `cats` dan `books`, dikurangi `notbooks`. Pilihan kosong menghasilkan nol hasil, bukan seluruh pustaka.
- ID kategori `0` mencakup kitab tanpa kategori. ID kitab harus positif.
- Setiap daftar ID dibatasi 1.000 entri; satu kategori mencakup seluruh isinya tanpa batas 100 kitab lama. Tidak ada pemotongan daftar diam-diam. Pemilihan seluruh kategori disimpan sebagai ID kategori, bukan ribuan ID kitab.
- URL lama tanpa `scope` tetap diterima; `books` mengungguli `cats` seperti sebelumnya. URL tidak valid pada frontend dipulihkan sebagai pilihan kosong; API baru menolak parameter tidak valid dengan HTTP 400.
- Pilihan perangkat disimpan pada `maktabah:search-scope-v2`. Saat belum tersedia, pilihan kitab lama yang aktif dimigrasikan. URL hasil pencarian menentukan pilihan saat reload dan navigasi kembali.
- Filter berlaku pada pencarian teks, judul, dan pemeriksaan hasil saran kata. Pencarian PDF eksternal memiliki pemberitahuan tersendiri dan tidak memakai filter pustaka lokal.
- Kebijakan pencarian dasar/Cari Lanjut dan kompatibilitas endpoint pencarian lama tetap berlaku. Perubahan ini tidak mengubah aturan redirect ke Tanya AI.

Contoh: `#/cari?q=الصلاة&filters=1&scope=custom&cats=5&books=201&notbooks=101` mencari kategori 5 bersama kitab 201, kecuali kitab 101.

## Pemuatan data

`GET /api/search-scope` menyediakan jumlah kategori dan metadata ID pilihan. `q` memfilter kategori/judul untuk panel, sedangkan `ids` dan `excluded` menghidrasi nama dan kategori kitab yang berasal dari URL/penyimpanan lama.

`GET /api/search-scope/books?category=5&page=1` memuat 30 judul per halaman hanya saat kategori dibuka. `q` mencari judul dalam kategori dan `filter` mengikuti pencarian global panel. Pencarian panel ditunda 300 ms; permintaan lama dibatalkan saat parameter berubah atau panel ditutup. Kegagalan menampilkan tombol coba lagi.

Katalog metadata disimpan dalam memori maksimum 30 detik dan diperiksa melalui SQLite data/schema version serta identitas koneksi. Sumber utama didahulukan ketika ID kitab sama pada pustaka tambahan. Tidak ada perubahan skema atau penulisan database dalam fitur ini.

## Verifikasi

`server/search-scope.test.js` memeriksa kategori 125 kitab tanpa pemotongan, gabungan dan pengecualian, kategori nol, SQL teks/judul/saran, pustaka tambahan, validasi API, pagination judul, keadaan checkbox, URL, serta migrasi penyimpanan.

Uji browser memakai server dan database sementara: pilihan 125 kitab, gabungan sebagian kategori, pengecualian, pemuatan bertahap, pencarian judul panel, reload/back, tautan lama, teks/judul, tiga tema, dan viewport desktop/ponsel. Database produksi tidak dipakai untuk fixture.
