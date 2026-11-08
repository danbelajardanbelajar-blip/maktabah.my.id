# Perbaikan Tanya AI — 8 November 2026

- [x] 1. Status ketersediaan dan pemulihan otomatis setelah pemeliharaan database.
- [x] 2. Riwayat pribadi per browser dan akses log admin.
- [x] 3. Penjelasan/terjemahan dari halaman kitab yang dipilih.
- [x] 4. Validasi sumber, halaman, nomor rujukan dan kutipan.
- [x] 5. Tahapan proses nyata serta verifikasi gabungan.

## Tahap 1

Status publik membedakan siap, pemeliharaan, belum dikonfigurasi dan versi lokal. Tidak memuat kunci atau rincian pekerjaan admin. Browser memeriksa status berkala, menonaktifkan Kirim saat tidak siap dan mengaktifkannya kembali otomatis. Penolakan 409 yang terjadi setelah pemeriksaan status juga memperbarui pemberitahuan dan mempertahankan pertanyaan.

## Tahap 2

Riwayat pengunjung dibatasi oleh cookie acak 256 bit (HttpOnly, SameSite=Lax, Secure pada HTTPS). Database menyimpan hash pengenal, bukan token cookie. Log lama tanpa pengenal tetap dapat dikelola admin tetapi tidak muncul di endpoint riwayat publik. Dua browser pada IP yang sama diuji terpisah; jawaban cache juga dicatat untuk browser yang memintanya. Perubahan skema hanya menambah kolom/index tanpa menghapus log. Halaman privasi menjelaskan cookie operasional dan akses admin.

## Tahap 3

Pembaca menyediakan Jelaskan/Terjemahkan halaman ini, termasuk teks pilihan. Server memuat ulang halaman berdasarkan pasangan ID kitab/halaman dan mencocokkan pilihan dengan teks asli; judul dari browser tidak dipercaya. Sumber dan tindakan ikut tersimpan pada riwayat pribadi serta kunci cache. Halaman panjang meminta pilihan maksimal 8.000 karakter. Uji SQLite mencakup sumber tambahan, halaman ID nol, teks palsu dan pembatasan panjang. Alur browser ukuran 390/1280 px menguji kirim otomatis, kartu sumber, kembali ke pembaca dan lebar tampilan.

## Tahap 4

Jawaban terstruktur memisahkan penjelasan dan kutipan. Server memeriksa pasangan ID kitab/halaman, metadata asli, nomor [n] dan kecocokan kutipan dengan sumber yang dikirim ke model; kutipan ditampilkan kembali dari teks asli, termasuk harakat. Jawaban gagal verifikasi tidak disimpan ke cache/log. Cache diperiksa ulang terhadap database, sedangkan fakta katalog disusun langsung tanpa generasi model. Pengujian mencakup nomor palsu, kutipan karangan, halaman hilang/berubah dan metadata palsu. Pemeriksaan ini memastikan hubungan teknis ke teks, bukan jaminan kebenaran penafsiran agama.

Format JSON mengikuti dokumentasi generateContent: https://ai.google.dev/api/generate-content

## Tahap 5

Browser menerima peristiwa NDJSON saat pencarian, penyiapan teks, penyusunan jawaban dan verifikasi benar-benar dijalankan. Jalur cache memakai tahap tersendiri, tanpa mengaku menjalankan generasi ulang. API JSON lama tetap didukung. Koneksi terputus membatalkan permintaan provider; pembaruan database di tengah proses menghentikan jawaban dengan pesan 409 yang jelas. UI mempertahankan draft dan menawarkan Coba lagi/Ubah pertanyaan tanpa pengiriman ulang otomatis. Pengujian stream mencakup UTF-8 terpotong, akhir respons hilang, error, cache, pemeliharaan saat generasi dan pembatalan koneksi.

Uji browser desktop dan ponsel memakai stream HTTP yang ditahan per tahap untuk memastikan status muncul sebelum hasil, Kirim tetap terkunci dan Coba lagi bekerja. Pengujian tidak menggunakan perangkat ponsel fisik. Gemini yang melewatkan nomor rujukan pada jawaban satu sumber ditangani dengan penanda deterministik setelah kutipannya terverifikasi; jawaban banyak sumber tetap harus menunjukkan nomor pendukung yang valid.

### Verifikasi layanan langsung

Percobaan Gemini menemukan kutipan yang menggabungkan baris tanpa spasi. Pencocokan kini menoleransi perubahan spasi/baris, lalu selalu mengembalikan rentang teks asli dari halaman. Selain kecocokan terhadap cuplikan yang dikirim, kutipan harus cocok dengan halaman lengkap; elipsis buatan cuplikan FTS tidak boleh dianggap kutipan harfiah.

### Kutipan bernomor dan penjelasan terpisah

Kasus frasa «سافر تجد عوضا» mengungkap bahwa tanda kutip untuk transliterasi dalam penjelasan keliru dianggap kutipan harfiah. Sekarang respons model memilih quoteId dari katalog rentang teks asli yang dibuat server, tanpa menyalin ulang bahasa Arab. Pemeriksaan mencocokkan sumber, ID, nomor [n] dan teks database, termasuk pemeriksaan ulang cache. Bagian Penjelasan AI dibedakan dari Kutipan sumber; penjelasan/transliterasi bukan bukti harfiah. Jika respons model gagal diperiksa, teks model dibuang dan pengguna mendapat kutipan database dengan keterangan bahwa penjelasannya belum terverifikasi. Hasil terbatas ini tidak masuk cache agar percobaan berikutnya tetap bisa menghasilkan penjelasan. Gangguan jaringan/provider tetap dilaporkan sebagai gangguan layanan.
