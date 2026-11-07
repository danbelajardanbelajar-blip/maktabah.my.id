# Perbaikan navigasi — 7 November 2026

Pengerjaan berurutan; setiap unit diverifikasi sebelum commit/push, kemudian ditarik ke VPS.

- [x] 1. Pembaca: status gagal/tidak ditemukan, coba lagi, keluar aman dari tautan langsung, Escape.
- [ ] 2. Admin: tujuan Kembali setiap halaman dan cakupan pilihan kategori yang jelas.
- [ ] 3. Lokasi berbasis URL, Kembali/Maju browser, Beranda terpisah dari Cari, konteks pencarian.
- [ ] 4. Pembaca: URL halaman aktif, posisi terakhir, kontrol ponsel dan gestur.
- [ ] 5. Tanya AI: pemulihan percakapan dan pertanyaan yang belum dikirim.
- [ ] 6. Lainnya: klik/keyboard/fokus, menu konsisten, breakpoint dan modal.
- [ ] 7. Katalog: kategori 0, pemulihan gagal, kategori/filter/pagination di URL.
- [ ] 8. Koleksi Saya: favorit, bookmark, dan lanjut membaca, dengan keterangan penyimpanan perangkat.
- [ ] 9. Admin: pengelompokan Kitab, Transfer, Aktivitas, Masukan, Pengaturan dan breadcrumb konsisten.

## Verifikasi unit 1

`node --test server/reader-loader.test.js` dan `npm run build` lulus. Pengujian mencakup ID tidak valid, kitab/halaman hilang, kegagalan jaringan, pemulihan retry, dan metadata kitab yang berbeda.

Pemeriksaan browser otomatis pada sesi ini terhalang kegagalan runtime alat; tidak mengklaim uji visual atau gestur nyata telah dilakukan.
