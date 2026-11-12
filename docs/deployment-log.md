# Catatan deployment

## 2026-11-13 05:06 WIB — Penulis & Karya, Database Penulis, dan Tinjauan Relasi

Jam ini adalah ringkasan verifikasi. Waktu pencatatan sampai detik serta rentang baris setiap file tercantum pada audit terstruktur dan CHANGELOG commit terkait.

- Commit aplikasi `cad86671ee944a42d371516e26d7998b1f067b4f6` dipush ke GitHub dan berhasil dipull fast-forward pada `/home/ubuntu/maktabah-baru`.
- Sebelum restart VPS, metadata export/import/penghapusan tidak menunjukkan pekerjaan aktif dan endpoint import bertahap mengembalikan `null`. Sintaks backend baru lulus; `maktabah.service` berhasil direstart dan berstatus `active`.
- Paket `maktabah-penulis-2026-11-13-final.db` (14.315.520 byte) diimpor melalui pratinjau lalu aktivasi pada lokal dan HTTPS online. SHA-256 paket: `bccf745ac9b50e0870d296b3d8f335e4a6738d48f43edb40b910780b27873a5f`.
- Dataset aktif berisi 966 penulis dari sumber Cakzen, 770 biografi, dan 36.159 metadata kitab. Terdapat 5.610 kitab tertaut berdasarkan aturan identitas; 30.549 kitab lain belum tertaut dan masuk antrean tinjauan. Tidak ada konflik judul pada saat verifikasi.
- Profil penulis #54 (`ابن تيمية`) diuji melalui API lokal/online: 238 kitab tersedia dan biografi 2.739 karakter. Pencarian serta navigasi ke profil `السيوطي` juga diuji pada browser ponsel.
- Jumlah kitab VPS tetap 36.159; database lokal utama/tambahan tetap 36.160 entri metadata termasuk satu judul kosong yang tidak dihitung sebagai kitab tersedia oleh fitur penulis. Tidak menghapus atau menimpa isi database kitab.
- Regresi Kamus Perawi: profil #5739 masih berkode `ت س`, biografi 40.413 karakter, tanpa label Muwaththa' dari inferensi nama murid.
- HTML online menunjuk `index.dev-D2Uj4HUL.js` dan `index-GqfaGxNR.css`; SHA-256 aset online cocok dengan build lokal. Tidak menjalankan npm install/build di VPS.
- Lokal terbaru berjalan pada `http://127.0.0.1:3081`; diagnostik `features` memuat `authors-v1`. Launcher baru `Buka Penulis Lokal.bat` memakai proses ini jika sudah aktif. Layanan lama pada 3080 tidak dihentikan.
- Verifikasi sebelum push: 132 tes lulus, TypeScript/build produksi lulus, pemeriksaan sintaks dan whitespace lulus. Browser database sementara menguji import paket penuh, profil, tautan dari metadata kitab, pembaca, reject/reset keputusan, riwayat, dan snapshot unduhan. Mode lokal terisolasi menguji upload, aktivasi, dan tinjauan, sambil memastikan import kitab tetap diblokir dalam mode lokal.
- Uji browser akhir pada lokal 3081 dan HTTPS online: profil, pencarian, navigasi, viewport 390 piksel tanpa overflow horizontal, serta tanpa error JavaScript. Keputusan tinjauan percobaan hanya dibuat dalam database sementara; tidak dimasukkan ke produksi.

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
