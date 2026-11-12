# Alur kerja proyek

Instruksi pengguna untuk proyek ini:

1. Selesaikan satu perubahan logis, periksa diff, jalankan pemeriksaan sintaks/TypeScript, pengujian yang relevan, dan build jika frontend berubah. Jangan push perubahan yang diketahui gagal.
2. Catat perubahan di `CHANGELOG.md` dan audit terstruktur `docs/change-audit/`. Sertakan waktu sampai detik dalam WIB (+07:00), file, rentang baris sebelum/sesudah, bagian/fungsi, ringkasan, serta hasil verifikasi. Jangan mengarang waktu edit masa lalu. Bedakan waktu pencatatan dari waktu modifikasi terakhir file.
3. Setelah staging, gunakan `node scripts/record-changes.js "Judul perubahan" "Hasil verifikasi"`, lalu stage catatan yang dihasilkan. Audit memakai isi staged agar hash/baris sesuai dengan commit yang akan dikirim. Jangan memasukkan rahasia atau file database ke Git.
4. Commit dan push perubahan yang sudah diverifikasi ke remote proyek. Pengguna telah mengotorisasi push dan pull deployment; tidak perlu meminta konfirmasi berulang untuk tindakan tersebut.
5. Pull commit yang sama pada server deployment, periksa apakah ada import/export/penghapusan yang aktif sebelum restart, lalu periksa layanan dan endpoint yang berubah. Jangan menimpa perubahan server atau menghentikan transfer aktif secara diam-diam.
6. Laporkan commit, hasil verifikasi, status push, status pull server, dan penghambat yang benar-benar terjadi. Jangan menyatakan deployment selesai sebelum HEAD server serta fungsi online terverifikasi.
7. Build dan pemasangan dependensi dilakukan di lokal. Jangan menjalankan npm install/build di hosting. Database perawi dipindahkan melalui fitur import `.db`, terpisah dari Git.
8. Jalankan tindakan yang sudah diotorisasi tanpa pertanyaan izin tambahan. Tetap patuhi kontrol izin lingkungan; persetujuan pengguna tidak mengizinkan pemalsuan konfirmasi atau melewati pembatasan platform.

Target remote Git: `https://github.com/danbelajardanbelajar-blip/maktabah.my.id.git`.
Domain aplikasi: `https://maktab.my.id`.
