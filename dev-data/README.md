# Database mini

Seed di `seed/maktabah.db` berukuran 3.911.680 byte, berisi 12 kitab lengkap dari 12 kategori, 616 halaman, 198 entri daftar isi, seluruh Al-Qur'an, dan 100 perawi. Pendamping tafsir `seed/tafsir_relasi.db` berisi 319 pemetaan dan berukuran 20.480 byte. Indeks pencarian dan trigger pembaruannya disertakan. Pemeriksaan SQLite dan integritas FTS lulus saat pembuatan.

Jalankan `npm run dev:mini` dari root proyek. Launcher menyalin seed ke database kerja jika belum ada. Server menambahkan tabel log/admin ke salinan kerja; seed tetap utuh dan database kerja diabaikan Git. Jalankan `npm run dev:ui` di terminal kedua dan buka http://localhost:5173/index.dev.html.

Untuk membuat sampel lain: `node scripts/create_mini_sample.js "D:/db/new db/maktabah_gabungan.db" "D:/db/sample-lain"`. Builder menolak menimpa output yang sudah ada. Tidak memproses folder lama New folder atau mengubah database sumber.
