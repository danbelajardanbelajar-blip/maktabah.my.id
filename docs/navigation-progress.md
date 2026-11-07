# Perbaikan navigasi — 7 November 2026

Pengerjaan berurutan; setiap unit diverifikasi sebelum commit/push, kemudian ditarik ke VPS.

- [x] 1. Pembaca: status gagal/tidak ditemukan, coba lagi, keluar aman dari tautan langsung, Escape.
- [x] 2. Admin: tujuan Kembali setiap halaman dan cakupan pilihan kategori yang jelas.
- [x] 3. Lokasi berbasis URL, Kembali/Maju browser, Beranda terpisah dari Cari, konteks pencarian.
- [x] 4. Pembaca: URL halaman aktif, posisi terakhir, kontrol ponsel dan gestur.
- [x] 5. Tanya AI: pemulihan percakapan dan pertanyaan yang belum dikirim.
- [x] 6. Lainnya: klik/keyboard/fokus, menu konsisten, breakpoint dan modal.
- [ ] 7. Katalog: kategori 0, pemulihan gagal, kategori/filter/pagination di URL.
- [ ] 8. Koleksi Saya: favorit, bookmark, dan lanjut membaca, dengan keterangan penyimpanan perangkat.
- [ ] 9. Admin: pengelompokan Kitab, Transfer, Aktivitas, Masukan, Pengaturan dan breadcrumb konsisten.

## Verifikasi unit 1

`node --test server/reader-loader.test.js` dan `npm run build` lulus. Pengujian mencakup ID tidak valid, kitab/halaman hilang, kegagalan jaringan, pemulihan retry, dan metadata kitab yang berbeda.

Pemeriksaan browser otomatis pada sesi ini terhalang kegagalan runtime alat; tidak mengklaim uji visual atau gestur nyata telah dilakukan.

## Verifikasi unit 2

`node --test server/admin-navigation.test.js` dan `npm run build`. Semua subhalaman admin memiliki tujuan Kembali; checkbox header kategori dibatasi pada halaman terlihat dengan aksi terpisah untuk semua hasil.

## Verifikasi unit 3

URL hash menjaga kompatibilitas build web/Electron dan tautan pembaca lama. Beranda dan Cari dipisah; query, mode, kategori, halaman hasil dan Kembali/Maju dipulihkan dari URL. `server/navigation.test.js` dan build lulus.

## Verifikasi unit 4

Posisi buku dan URL halaman dipulihkan tanpa menambah riwayat setiap lembar. Kontrol pembaca tampil sejak awal; mode fokus tetap punya tombol keluar. Gestur mengabaikan scroll vertikal, seleksi teks dan request aktif. Uji `reading-position.test.js` dan build.

## Verifikasi unit 5

Percakapan tetap terpasang ketika menu berubah, pulih dari sessionStorage sesudah refresh, dan pertanyaan terputus tidak dikirim ulang otomatis. Tersedia indikator proses serta aksi percakapan baru. Uji ai-session dan build.

## Verifikasi unit 6

Menu Lainnya desktop/mobile memakai definisi yang sama; mendukung klik, keyboard, Escape, klik luar, dan fokus. Modal menahan fokus dan berada di atas navigasi bawah. Header desktop mulai xl; tablet memakai lima tab bawah. Build/TypeScript, pemeriksaan SSR menu serta tes navigasi. Pengujian visual perangkat masih membutuhkan runtime browser yang berfungsi.
