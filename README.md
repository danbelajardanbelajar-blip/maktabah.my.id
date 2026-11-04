# maktabah.my.id

al Maktabah as Sunniyyah — perpustakaan kitab berbasis React, TypeScript, Vite, Express, dan SQLite.

## Pengembangan lokal

Gunakan Node.js 24 (versi yang dipakai untuk pemeriksaan proyek ini). Pasang dependensi di komputer lokal dengan `npm ci` bila belum tersedia.

Di terminal pertama jalankan `npm run dev:mini`. Di terminal kedua jalankan `npm run dev:ui`, lalu buka http://localhost:5173/index.dev.html (ikuti port Vite jika berbeda).

Database contoh di `dev-data/seed` disertakan: 12 kitab lengkap, 616 halaman, data Al-Qur'an, 100 perawi, dan contoh pemetaan tafsir. Saat pertama dijalankan, `dev:mini` menyalin seed ke database kerja `dev-data/maktabah.db` dan `dev-data/tafsir_relasi.db`. Database kerja dan log tidak masuk Git. Daftar kitab tersedia di `dev-data/seed/mini-db-info.json`.

`.env.mini` hanya berisi path database contoh dan port lokal. `.env`, database besar, unggahan, dan kredensial tidak disertakan dalam Git. Database gabungan produksi tetap berada di luar proyek, di D:/db/new db/maktabah_gabungan.db.

## Build dan hosting

Jalankan `npm run build` di komputer lokal. Hasil frontend tersedia di `dist`; backend berada di `server/index.js`, dengan entry point cPanel/Passenger `app.cjs`.

Untuk produksi, atur `DB_PATH` ke database produksi, bukan database mini, dan gunakan `PORT` sesuai hosting. Backend saat ini mendukung file tambahan melalui `TAMBAHAN_DB_PATH` serta relasi tafsir melalui `TAFSIR_DB_PATH`. Integrasi database gabungan satu file untuk kueri tafsir masih perlu disesuaikan sebelum deployment produksi.

Repository ini adalah tujuan pengembangan baru. Repository books.quizb.my.id dipakai untuk halaman maintenance. Push GitHub tidak otomatis berarti hosting sudah mengambil perubahan; deployment mengikuti konfigurasi hosting yang digunakan.
