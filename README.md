# maktabah.my.id

al Maktabah as Sunniyyah — perpustakaan kitab berbasis React, TypeScript, Vite, Express, dan SQLite.

## Pengembangan lokal

Gunakan Node.js 24 (versi yang dipakai untuk pemeriksaan proyek ini). Pasang dependensi di komputer lokal dengan `npm ci` bila belum tersedia.

Di terminal pertama jalankan `npm run dev:mini`. Di terminal kedua jalankan `npm run dev:ui`, lalu buka http://localhost:5173/index.dev.html (ikuti port Vite jika berbeda).

Database contoh di `dev-data/seed` disertakan: 12 kitab lengkap, 616 halaman, data Al-Qur'an, 100 perawi, dan contoh pemetaan tafsir. Saat pertama dijalankan, `dev:mini` menyalin seed ke database kerja `dev-data/maktabah.db` dan `dev-data/tafsir_relasi.db`. Database kerja dan log tidak masuk Git. Daftar kitab tersedia di `dev-data/seed/mini-db-info.json`.

`.env.mini` hanya berisi path database contoh dan port lokal. `.env`, database besar, unggahan, dan kredensial tidak disertakan dalam Git. Database gabungan produksi tetap berada di luar proyek, di D:/db/new db/maktabah_gabungan.db.

## Import dan export kitab

Di admin, buka **Database Kitab → Import / Export Kitab**. Pilih kitab dari database utama untuk mengunduh JSON `maktabah-books` versi 1. Setiap file memuat metadata kitab, penulis, kategori, semua halaman, dan daftar isi; batasnya 100 kitab dan 50 MB. Format ini bukan file SQLite, CSV, atau Word. Data Al-Qur'an, perawi, relasi tafsir/matan-syarah, log, dan unggahan tidak termasuk dalam paket kitab.

Tab **Export Kategori** membuat JSON `maktabah-categories` versi 1 yang berisi metadata kategori dan seluruh kitab beserta isinya pada kategori pilihan di database utama. Kategori kosong ikut dipertahankan. Batas per paket kategori: 100 kategori, 5.000 kitab, dan 50 MB. Export ditolak jika batas terlampaui, bukan dipotong. Tab **Import Kitab / Kategori** menerima kedua format dan menampilkan pratinjau kategori serta kitab. Nama kategori yang sudah ada digunakan kembali; kategori baru mendapat ID yang tidak bentrok.

Import menerima file JSON hasil export tersebut dan menampilkan pratinjau sebelum dijalankan. ID kitab yang sudah ada di database utama atau tambahan dilewati. ID kategori dan penulis yang bentrok dipetakan ulang tanpa mengubah data lama. Penambahan dilakukan dalam satu transaksi; bila gagal, seluruh penambahan dibatalkan. Indeks pencarian mengikuti trigger halaman pada database Maktabah.

Sebelum import, database utama dicadangkan melalui SQLite backup ke folder `book-import-backups` di sebelah database aktif. File cadangan tidak disajikan melalui web. Import ditolak bila ruang disk tidak cukup. Cadangan disimpan sampai pengelola menghapusnya setelah memastikan hasil import benar.

Pengujian fitur: `node --test server/book-transfer.test.js`.

## Build dan hosting

Jalankan `npm run build` di komputer lokal. Hasil frontend tersedia di `dist`; backend berada di `server/index.js`, dengan entry point cPanel/Passenger `app.cjs`.

Untuk produksi, atur `DB_PATH` ke database produksi, bukan database mini, dan gunakan `PORT` sesuai hosting. Backend saat ini mendukung file tambahan melalui `TAMBAHAN_DB_PATH` serta relasi tafsir melalui `TAFSIR_DB_PATH`. Integrasi database gabungan satu file untuk kueri tafsir masih perlu disesuaikan sebelum deployment produksi.

Repository ini adalah tujuan pengembangan baru. Repository books.quizb.my.id dipakai untuk halaman maintenance. Push GitHub tidak otomatis berarti hosting sudah mengambil perubahan; deployment mengikuti konfigurasi hosting yang digunakan.
