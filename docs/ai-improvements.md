# Perbaikan Tanya AI — 8 November 2026

- [x] 1. Status ketersediaan dan pemulihan otomatis setelah pemeliharaan database.
- [ ] 2. Riwayat pribadi per browser dan akses log admin.
- [ ] 3. Penjelasan/terjemahan dari halaman kitab yang dipilih.
- [ ] 4. Validasi sumber, halaman, nomor rujukan dan kutipan.
- [ ] 5. Tahapan proses nyata serta verifikasi gabungan.

## Tahap 1

Status publik membedakan siap, pemeliharaan, belum dikonfigurasi dan versi lokal. Tidak memuat kunci atau rincian pekerjaan admin. Browser memeriksa status berkala, menonaktifkan Kirim saat tidak siap dan mengaktifkannya kembali otomatis. Penolakan 409 yang terjadi setelah pemeriksaan status juga memperbarui pemberitahuan dan mempertahankan pertanyaan.
