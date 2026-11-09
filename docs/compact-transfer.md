# Transfer kategori hemat ruang

## Pemakaian

1. Buka Buka Maktabah Lokal.bat. Ketiga sumber D:\db dibuka hanya baca.
2. Admin → Import / Export → Export Kategori. Metode default: Hemat ruang · bertahap (.mkt).
3. Pilih kategori, Export pilihan hemat ruang, lalu Unduh paket .mkt.
4. Di VPS pilih Import Kitab / Kategori dengan metode yang sama, pilih file .mkt, periksa ringkasan dan centang persetujuan, lalu Mulai import.
5. Biarkan browser terbuka. Jeda berhenti setelah bagian aktif disimpan. Setelah refresh/login ulang, pilih file yang sama dan Lanjutkan import.
6. Akhiri sesi mempertahankan kitab yang sudah lengkap, membersihkan kitab baru yang belum lengkap, lalu membuka kembali perubahan admin lain.

Paket .db lama tetap didukung pada metode SQLite lama. Untuk mendapatkan penghematan ruang baru, export ulang dari lokal sebagai .mkt. JSON lama tetap tersedia.

## Ruang dan pemulihan

VPS menerima satu bagian terkompresi di memori, bukan file upload lengkap atau DB hasil ekstraksi. Bagian export ditargetkan sekitar 1 MiB mentah; batas keras bagian mentah 8 MiB. Satu halaman/metadata yang melebihi batas memerlukan metode .db. Total paket tidak dibatasi 50 MB. Framing/checksum memungkinkan file besar dipindai dari header tanpa dimuat penuh di browser.

Tidak ada backup penuh baru untuk mode ini. Mode hanya menambah: ID kitab yang sudah ada, termasuk sumber tambahan, dilewati; data lama tidak ditimpa. SQLite WAL melindungi transaksi bagian aktif. Kitab baru dipublikasikan melalui metadata hanya saat semua halaman dan daftar isi lengkap. Bagian yang sudah commit dicatat bersama checksum dan nomor urut dalam transaksi yang sama. Respons hilang atau restart tidak mengulang bagian yang telah commit.

Data kitab dan indeks tetap membutuhkan ruang permanen. Pemeriksaan ruang pengaman 512 MiB dan checkpoint WAL dilakukan setiap bagian; ruang transaksi bukan angka tetap 100–300 MB dan dapat bertambah sesuai indeks/pembaca aktif. Jika checkpoint tertahan atau disk kurang, transfer berhenti untuk dilanjutkan, bukan mematikan pemeriksaan kapasitas.

Ini bukan pengganti backup penuh untuk kerusakan disk atau pemulihan seluruh database. Backup terakhir yang ada dipertahankan. Backup penuh di luar VPS tetap perlu dikelola pemilik server.

Perubahan database admin lain ditahan selama sesi belum diakhiri untuk mencegah konflik ID. Membaca katalog tetap tersedia. AI dan penulisan lain sementara ditahan ketika bagian sedang ditulis. Pembatalan memakai status cancelling yang durable sebelum pembersihan, sehingga pembersihan terputus dapat dilanjutkan.

## Format dan pengamanan

Magic MAKTABAH-PARTS-1 diikuti frame length uint32 big-endian, SHA-256 32 byte, dan gzip JSON. Manifest pertama memuat ID arsip acak, kategori dan jumlah kitab/halaman/daftar isi. Rekaman kitab, halaman, daftar isi dan penanda akhir diproses berurutan. Gzip memiliki batas keluaran, checksum diperiksa, data divalidasi dan SQL memakai parameter. Bagian asing, urutan salah, pengiriman ulang dengan isi berbeda serta penanda akhir tidak lengkap ditolak.

Export berjalan pada worker dan snapshot sumber hanya baca. Status export serta tiket unduhan acak disimpan di folder compact-transfer; file siap bertahan melewati restart dan kedaluwarsa setelah 24 jam. Folder diabaikan Git. Tidak ada file upload sementara import di folder tersebut.

## Verifikasi

Pengujian mencakup kategori kosong, tabrakan kategori, label halaman teks, sumber baca saja, checksum/dekompresi berlebih, transaksi rollback, pengiriman ulang, resume setelah membuka ulang DB, perlindungan kitab belum terbit, pembatalan terputus, otorisasi, serta alur browser nyata: export/download, pilih file, preview, import, jeda, refresh dan lanjutkan tanpa duplikasi. Semua pengujian import memakai database sementara, bukan data kitab VPS.
