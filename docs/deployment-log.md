# Catatan deployment

## 2026-11-12 19:43:22 WIB — Database Perawi

Waktu ini adalah pencatatan verifikasi akhir, bukan waktu setiap command dijalankan.

- Commit aplikasi: `31808cc33a5e961648b3a9e6c37f790c4878c91b`.
- GitHub `origin/main` sudah menerima commit tersebut; checkout VPS `/home/ubuntu/maktabah-baru` berhasil `git pull --ff-only origin main` dari `2d9f3dc` ke `31808cc`.
- Sebelum restart, metadata pekerjaan export/import/penghapusan tidak menunjukkan proses berjalan; endpoint import bertahap mengembalikan `null` (tidak ada sesi aktif).
- Pemeriksaan sintaks `server/index.js`, `server/rowa-database.js`, `server/rowa-package.js`, dan `server/rowa-codes.js` di VPS lulus. Tidak menjalankan npm install atau build di VPS.
- `maktabah.service` berhasil direstart dan statusnya `active`. API statistik kembali HTTP 200; jumlah kitab tetap 36.159.
- Paket `maktabah-perawi-2026-11-12.db` (44.097.536 byte) diupload melalui endpoint admin HTTPS, divalidasi, lalu diaktifkan. Sebelumnya belum ada database perawi khusus yang aktif; database kitab tidak diganti.
- SHA-256 paket: `71d23ac191913f949a29a8056f823640b451f884b149579a294828f5fa57de5c`.
- Database aktif: 8.858 perawi, 8.854 uraian biografi. Profil ID 5739 memiliki `WHO = ت س` dan `AQUAL` sepanjang 40.413 karakter. Endpoint profil dan pencarian online menghasilkan Tirmidzi dan Nasa'i, tanpa label Muwaththa', Shahih Bukhari, atau Shahih Muslim yang sebelumnya berasal dari tebakan nama murid.
- HTML online HTTP 200 menunjuk aset `index.dev-BtzLlrud.js` dan `index-DBN47W4M.css`; hash SHA-256 kedua aset cocok dengan build lokal.
- Sebelum push: 123 tes server lulus, TypeScript/build produksi lulus, dan pemeriksaan whitespace diff lulus. Uji paket lengkap melalui browser desktop/ponsel serta mode lokal juga telah lulus.
- Restart layanan lokal port 3080 pada giliran sebelumnya ditolak pemeriksaan persetujuan otomatis (`blocked by policy`). Tidak dilakukan percobaan untuk melewati penolakan itu; penerapan pada layanan lokal yang sedang berjalan belum diklaim selesai.

Kredensial SSH tidak dicatat di file ini, repositori, atau perintah deployment yang disimpan.
