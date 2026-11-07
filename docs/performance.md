# Reload penuh — 7 November 2026

Pengukuran awal: HTML publik sekitar 0,39 detik dari komputer lokal; JavaScript 447.443 byte tanpa Content-Encoding meski klien mendukung gzip, selesai sekitar 2,17 detik. Header aset sebelumnya `max-age=0`. Enam keluarga Google Fonts diminta lewat stylesheet yang menahan render di HTML awal. Waktu ini adalah sampel transfer, bukan pengukuran keseluruhan render browser.

VPS saat pemeriksaan memiliki RAM tersedia sekitar 6,9 GiB, disk kosong 56 GiB dan load rendah. API beranda dari loopback merespons sekitar 1–3 ms. Angka ini tidak menilai pencarian atau AI saat beban tinggi.

Perubahan:

- Muat hanya pasangan font pilihan secara asinkron dengan fallback sistem dan `display=swap`.
- Cache aset JS/CSS dengan hash selama satu tahun/immutable; HTML tetap harus divalidasi ulang, logo satu jam.
- `deployment/nginx-performance.conf` mengaktifkan gzip JS/CSS/SVG. Pasang sebagai `/etc/nginx/snippets/maktabah-performance.conf`, lalu include di blok HTTPS maktab.my.id. Cadangkan konfigurasi aktif, jalankan `nginx -t`, baru reload.

Verifikasi: build/TypeScript, tes kebijakan cache/font dan regresi server; semua kombinasi font pilihan mendapatkan HTTP 200 dari Google Fonts. Sesudah deployment periksa Content-Encoding, Vary, Cache-Control, ukuran transfer dan kesamaan HTML dengan dist. Tidak mengklaim skor Lighthouse atau pengukuran render browser karena runtime browser tidak tersedia.
