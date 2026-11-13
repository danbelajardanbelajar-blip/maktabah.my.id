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


## Hasil AI langsung di pembaca

Tombol **Jelaskan halaman ini** dan **Terjemahkan halaman ini** menampilkan hasil pada panel dalam pembaca; tidak menutup kitab atau berpindah ke Tanya AI. Pilihan teks yang masih berada di area teks kitab dikirim sebagai konteks, atau seluruh halaman jika tidak ada pilihan. Server tetap memvalidasi sumber melalui bookId/pageId dan kecocokan teks dengan database.

Panel menampilkan intent, bagian/halaman sumber, teks pilihan, tahap proses, jawaban, kegagalan beserta coba lagi, dan tombol kembali melihat teks sumber. Tombol tindakan dinonaktifkan selama permintaan untuk mencegah pengiriman ganda. Menutup panel/pembaca atau mulai memuat halaman lain membatalkan permintaan klien; hasil terlambat diabaikan dan tidak ditempel ke halaman baru. Perubahan hanya frontend; endpoint AI, penyimpanan riwayat server, dan konfigurasi provider tetap digunakan.

Renderer Markdown dipakai bersama dengan Tanya AI dan melakukan escape HTML sebelum format diterapkan. `webAPI.askAI` mendukung AbortSignal opsional dengan batas waktu 90 detik. Percakapan Tanya AI tidak ditimpa oleh panel pembaca. Uji browser menggunakan respons AI terkendali untuk memeriksa seluruh halaman, pilihan teks, error 409/coba lagi, penutupan saat memuat, navigasi saat memuat, HTML ter-escape, serta tampilan ponsel.

## Relevansi jawaban dan konteks percakapan (kasus witir–tarawih)

Masalah: FTS semula dapat beralih dari AND ke OR dan mengambil kata umum seperti salat/rakaat. Pemeriksaan kutipan membuktikan teks ada di database, tetapi belum membuktikan teks menjawab aspek pertanyaan. Saat JSON/kutipan jawaban gagal, fallback `sources_only` menampilkan kutipan pertama tanpa pemeriksaan makna. Contoh: keterangan kebiasaan witir tiga rakaat atau jumlah tarawih belum membuktikan jumlah witir yang paling utama.

Perbaikan:

- `server/ai-relevance.js` membatasi pencarian topik yang memiliki alias (witir/tarawih/tahajud/dhuha/zakat/wudhu, Latin/Arab). Alias membatasi retrieval sebelum ranking FTS serta menyaring cuplikan/kutipan; tidak berisi keputusan hukum. Pencarian berbahasa Indonesia tetap diperluas ke kata kunci Arab walaupun sudah ada hasil Indonesia, dengan pembagian kandidat kedua bahasa.
- Setelah pemeriksaan sumber/ID/kutipan literal, ada panggilan model terpisah untuk memeriksa relevansi, dukungan SETIAP klaim dan keterjawaban aspek inti pertanyaan. Ketiga nilai boolean harus true. Instruksi membedakan kebiasaan/minimum/maksimum/keutamaan dan menolak penggunaan tarawih untuk menjawab witir. Metadata kitab berasal dari DB; kutipan berasal dari ID immutable yang sama.
- JSON/kutipan salah, hasil pemeriksaan makna negatif/tidak valid, atau kutipan yang tidak sesuai topik tidak menghasilkan jawaban substantif maupun kutipan pengganti. Respons `no_context` menjelaskan keterbatasan, tanpa references/evidence dan tanpa cache. Kegagalan koneksi/kuota pemeriksa mengikuti penanganan error provider; tidak melewati pemeriksaan. Terjemahan/penjelasan halaman juga diperiksa kesetiaan maknanya.
- Hanya referensi yang benar-benar dikutip dipertahankan, maksimal tiga; nomor kutipan disusun ulang dan diperiksa ulang. Cache menggunakan versi relevansi baru, konteks pertanyaan dan sumber/intent; hasil tanpa pemeriksaan tidak dipakai kembali.
- Browser mengirim maksimal empat pertanyaan pengguna terakhir (batas total 6.000 karakter). Server memvalidasi bentuk/panjang dan memakai riwayat hanya untuk pertanyaan lanjutan pendek yang eksplisit. Pergantian topik yang lengkap berdiri sendiri; topik baru yang dikenali tidak mewarisi topik lama. Jawaban AI sebelumnya tidak dikirim sebagai bukti. Konteks pertanyaan lanjutan ikut riwayat pribadi agar klik ulang tidak meminjam topik percakapan lain; Percakapan baru mengosongkan konteks.

Batas verifikasi: pemeriksaan makna tetap menggunakan model, bukan pembuktian formal atau jaminan nol kesalahan. Pengenalan alias/anaphora bersifat terbatas dan riwayat dibatasi. Tambahan satu panggilan pemeriksaan meningkatkan waktu/biaya per jawaban; ekspansi Arab juga dipakai pada hasil Indonesia yang sudah ada. Jika bukti tidak cukup, sistem memilih tidak menyimpulkan. Label Masa Percobaan tetap ada.

Verifikasi: 164 tes otomatis, TypeScript/build produksi, sintaks dan diff; regresi witir/tarawih, kebiasaan vs keutamaan, verdict tidak valid, pemisahan cache/konteks, validasi riwayat, sumber terpilih, pemadatan nomor rujukan dan cache. Fixture model generator/pemeriksa dipisahkan dan kasus penolakan diuji eksplisit. QA browser memakai respons AI terkendali untuk pengiriman hanya pertanyaan pengguna, reload, Percakapan baru dan ponsel; regresi panel AI pembaca diuji terpisah.

### Penyempurnaan setelah uji provider langsung

Build fitur `08e76d8` sudah aktif setelah pull dan restart VPS, didahului pemeriksaan tidak ada transfer/compact import aktif. QA browser publik konteks/reset/reload lulus. Pertanyaan asli pada gambar sempat mencapai tahap verifikasi, tetapi pemeriksa provider melewati batas 25 detik; sistem mengembalikan TIMEOUT, tanpa meneruskan jawaban yang belum diperiksa.

Pemeriksa kini hanya menerima metadata/cuplikannya dari sumber yang benar-benar dikutip (maksimal tiga), bukan seluruh kandidat pencarian. Batas tahap pemeriksa menjadi maksimal 35 detik, dengan anggaran bersama 80 detik untuk seluruh permintaan agar tetap berada di bawah batas klien 90 detik. Pengujian memastikan kandidat yang tidak dikutip tidak ikut dikirim ke pemeriksa. Tidak ada jalur bypass ketika pemeriksa gagal.

Domain `maktabah.quizb.my.id` menyajikan pembungkus iframe dengan src `https://maktab.my.id`; HTML pembungkus memang tidak memiliki hash build aplikasi. Backend yang diperbarui adalah target iframe tersebut.
