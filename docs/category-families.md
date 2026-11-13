# Rumpun kategori katalog

Halaman `/#/katalog` menampilkan dua rumpun, berurutan:

1. **Hasil Bahsul Masail**: nama kategori dengan aksara Latin/Indonesia.
2. **Kitab Turats**: nama kategori dengan aksara Arab.

Implementasi hanya pada tampilan dan helper `src/lib/category-families.ts`. Tidak ada migrasi, kolom baru, perubahan ID/nama, pemindahan kitab atau penyimpanan rumpun di database. Kategori baru/hasil rename otomatis dikelompokkan ketika daftar kategori dimuat ulang.

Deteksi memakai huruf Unicode pada nama yang dinormalisasi NFKC; angka, tanda baca, harakat tidak dihitung. Nama campuran mengikuti jumlah huruf Arab dibanding Latin; seri dengan huruf Arab masuk Turats. Nama kosong/tanpa huruf dan nama Latin lain masuk rumpun pertama agar tidak ada kategori hilang. Ini pengelompokan aksara berdasarkan permintaan pengguna, bukan verifikasi bahasa atau jenis isi kitab.

Urutan kategori dari API tetap dipertahankan dalam setiap rumpun. Pencarian kategori menyaring kedua rumpun; jumlah menampilkan hasil yang terlihat. Rumpun tanpa kecocokan memiliki pesan kosong. Navigasi kitab tetap menggunakan ID kategori asli, termasuk kategori 0, dan tombol kembali memulihkan katalog/pencarian. Pencarian judul kitab lintas katalog tetap berjalan seperti sebelumnya.

Verifikasi lokal: 157 tes otomatis lulus; TypeScript dan build produksi lulus; oxlint tidak ada error (satu peringatan dependency hook Catalog yang sudah ada sebelumnya). QA browser Edge memakai kategori API asli: total 139, Hasil Bahsul Masail 11, Kitab Turats 128. Semua kategori tampil sekali, respons API sebelum/sesudah sama, navigasi ID 321 dan 0 lulus, kembali memulihkan rumpun, pencarian Latin/Arab serta kondisi kosong lulus. Lebar 320/390/768/1440px tanpa overflow halaman dan tanpa pageerror.

## Verifikasi deployment · 2026-11-13 09:06 WIB

Commit fitur `b6f69d3` telah di-push ke origin/main dan di-pull fast-forward pada VPS. Perubahan aplikasi hanya frontend; layanan tidak perlu di-restart dan tetap aktif. Hosting menyajikan build `index.dev-B0z19LR9.js` / `index-DEcz1-FK.css`, tanpa install/build di server.

QA browser publik https://maktab.my.id lulus untuk kedua rumpun, seluruh kategori tampil sekali, navigasi kategori 321/0, kembali, pencarian Latin/Arab/kosong, dan lebar 320/390/768/1440px tanpa pageerror. Respons daftar kategori sebelum/sesudah pengujian sama.

Data online berjumlah 138 kategori (11 Hasil Bahsul Masail dan 127 Kitab Turats), sedangkan sumber lokal 139 (11 dan 128). Pemeriksaan awal yang menyamakan jumlah online dengan lokal menghasilkan assertion gagal; pemeriksaan diperbaiki untuk memverifikasi data aktual tiap lingkungan. Pengelompokan tidak mensinkronkan atau mengubah isi database.
