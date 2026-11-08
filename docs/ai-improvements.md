# Perbaikan Tanya AI — 8 November 2026

- [x] 1. Status ketersediaan dan pemulihan otomatis setelah pemeliharaan database.
- [x] 2. Riwayat pribadi per browser dan akses log admin.
- [x] 3. Penjelasan/terjemahan dari halaman kitab yang dipilih.
- [ ] 4. Validasi sumber, halaman, nomor rujukan dan kutipan.
- [ ] 5. Tahapan proses nyata serta verifikasi gabungan.

## Tahap 1

Status publik membedakan siap, pemeliharaan, belum dikonfigurasi dan versi lokal. Tidak memuat kunci atau rincian pekerjaan admin. Browser memeriksa status berkala, menonaktifkan Kirim saat tidak siap dan mengaktifkannya kembali otomatis. Penolakan 409 yang terjadi setelah pemeriksaan status juga memperbarui pemberitahuan dan mempertahankan pertanyaan.

## Tahap 2

Riwayat pengunjung dibatasi oleh cookie acak 256 bit (HttpOnly, SameSite=Lax, Secure pada HTTPS). Database menyimpan hash pengenal, bukan token cookie. Log lama tanpa pengenal tetap dapat dikelola admin tetapi tidak muncul di endpoint riwayat publik. Dua browser pada IP yang sama diuji terpisah; jawaban cache juga dicatat untuk browser yang memintanya. Perubahan skema hanya menambah kolom/index tanpa menghapus log. Halaman privasi menjelaskan cookie operasional dan akses admin.

## Tahap 3

Pembaca menyediakan Jelaskan/Terjemahkan halaman ini, termasuk teks pilihan. Server memuat ulang halaman berdasarkan pasangan ID kitab/halaman dan mencocokkan pilihan dengan teks asli; judul dari browser tidak dipercaya. Sumber dan tindakan ikut tersimpan pada riwayat pribadi serta kunci cache. Halaman panjang meminta pilihan maksimal 8.000 karakter. Uji SQLite mencakup sumber tambahan, halaman ID nol, teks palsu dan pembatasan panjang. Alur browser ukuran 390/1280 px menguji kirim otomatis, kartu sumber, kembali ke pembaca dan lebar tampilan.
