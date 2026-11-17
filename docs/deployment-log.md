## 2026-11-17 08:12:22 WIB — Kata "hukum" tunggal tetap di pencarian biasa

- Commit fungsi `2c75c84` sudah push GitHub. Pull VPS dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; HTML HTTPS menunjuk `index.dev-DQ3QdHMm.js` dan SHA-256 aset online sama dengan build lokal `2c75c84` (`05fcf4fc…eafe0d`).
- Browser online lewat kotak "Cari di sini...": `hukum` → pencarian teks (3.811 hasil), `hukum waris` → pencarian teks (60 hasil); `apa hukum riba` dan `hukum waris?` tetap dialihkan ke Tanya AI dengan pemberitahuan "Tetap cari di katalog buku biasa".
- Perubahan hanya frontend; tidak ada perubahan database atau restart yang diverifikasi dari sisi lokal.

## 2026-11-15 19:25:47 WIB — Fitur Pesan (pengunjung ↔ admin)

- Commit fungsi `e606bf9` sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; aset HTTPS `index.dev-BSHgaGOK.js` dan `index-CPQduW1l.css` sama dengan build `e606bf9`.
- API online: GET /api/messages 200 (kosong tanpa cookie); /api/messages/stream 204 tanpa cookie dan 200 `text/event-stream` lewat nginx dengan `retry: 5000` langsung diterima (tidak dibuffer); endpoint admin dan stream admin 401 tanpa login; pesan kosong 400; 2.001 karakter 400; honeypot 200 tanpa menyimpan dan tanpa cookie. Tidak ada pesan uji yang disimpan di produksi.
- Browser online (375×812): tombol di atas navigasi bawah (tombol 672–728 px, navigasi mulai 742 px); gulir ke bawah menyembunyikan, gulir ke atas memunculkan; panel "Pesan ke Admin" terbuka; di #/read/1/4 tombol tersembunyi (aria-hidden).
- Belum diuji online: alur kirim → balas admin → badge/bunyi/notifikasi (sudah diuji lokal), karena memerlukan login admin produksi dan akan meninggalkan pesan uji di kotak masuk.

## 2026-11-15 13:01:33 WIB — Saran pencarian untuk hasil sedikit

- Commit fungsi `338ee5e`, `faf9b84`, dan `4ce0390` sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; aset HTTPS `index.dev-Cd4wLIyH.js` sama dengan build `faf9b84`, dan perilaku saran sesuai `4ce0390`.
- Browser online: "احياء علوم الدبن" (3 hasil) menampilkan kotak "Hasilnya sedikit. Mungkin maksud Anda" di bawah Total Hasil dan di atas daftar.
- API online sesudah `4ce0390`: "احياء علوم الدبن" menyarankan إحياء علوم الدين tanpa varian hamzah kueri itu sendiri; "tahajut" (1 hasil) menyarankan Tahajjud dan صلاة التهجد; kueri dengan 327 hasil tidak mendapat saran.

## 2026-11-15 11:22:25 WIB — Pencarian teks: total dibatasi dan berjalan di worker

- Commit fungsi `27eedfa` (dan `afa27ba` peringkat log admin) sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; respons API memuat field `capped` dari commit ini.
- Penyebab: COUNT(*) persis untuk kata umum (الله ±7,9 juta halaman) di thread utama memakan waktu bermenit-menit dan menahan seluruh situs. Uji sebelum perbaikan: الله, قال الله, في من masing-masing >120 detik dan /api/health ikut tidak merespons sampai restart.
- Uji online sesudah: kueri pengguna "اتباع غير المستفتي للفتوى" 0,56 detik (24 hasil); الله 0,29 detik (10.000+); قال الله 2,3 detik (10.000+); في من 12,1 detik (10.000+) dan /api/health tetap merespons 1,4 detik selama pencarian itu berjalan.

## 2026-11-15 08:47:43 WIB — Tanya AI: kitab yang disebut, kebijakan pengecualian, dan percobaan ulang istilah kitab

- Commit fungsi `6ba9720`, `8aaaec8`, `e47b067`, `aa2b39a`, dan `1715b3c` sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; perilaku endpoint sesuai `1715b3c` (tahap "Mencoba lagi dengan rujukan dari istilah kitab" muncul).
- Kebijakan pengecualian v4: ابن تيمية، ابن باز، ابن عثيمين، الألباني beserta variannya; nama di catatan kaki tidak memblokir kitab; محمد بن عبد الوهاب dihapus karena juga nama perawi di sanad صحيح مسلم dan Sunan.
- Uji online HTTPS: "apa isi kitab إحياء علوم الدين" grounded 6,8 detik dari hlm. 3 (empat rubu'). "menurut kitab تعليم المتعلم apa saja penyebab faqir" grounded 5,4 detik dari hlm. 63 (sebelumnya kitab terblokir karena catatan kaki). "ما حكم قضاء صلاة الميت" grounded 8,5 detik lewat percobaan ulang istilah kitab (نور الإيضاح hlm. 73, المجموع hlm. 394). "ما حكم صلاة بلا إمام" grounded 4,5 detik tanpa percobaan ulang, tetapi rujukannya (salat khauf dan niat imam/makmum) hanya sebagian sesuai.

## 2026-11-15 07:01:44 WIB — Tanya AI: rujukan kutipan berkelompok

- Commit `0ff85d7` sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; perilaku endpoint sesuai commit ini.
- Uji online: "hukum membeli saham" grounded 6,0 detik, 3 rujukan, penjelasan hanya memakai [1] [2] [3] (tidak ada ID kutipan atau nomor di luar daftar). حكم صلاة الجماعة grounded 4,7 detik dengan [1]. "siapa guru imam syafii?" masih no_context 5,0 detik; alasan reviewer ada di riwayat admin.

## 2026-11-15 07:00:17 WIB — Tanya AI: kutipan per kalimat, arah teks, dan nomor rujukan

- Commit `1b5e648` dan `4fee5da` sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; aset HTTPS `index.dev-Dqs6Krnx.js` sama dengan build `1b5e648`, dan perilaku endpoint sesuai `4fee5da`.
- Uji online `1b5e648`: kutipan sudah utuh per kalimat, satu paragraf, Arab memakai «». Masih ditemukan kutipan diawali «: أما…» dan rujukan [1.10]. [1] di penjelasan; diperbaiki di `4fee5da`.
- Uji online `4fee5da`: حكم صلاة الجماعة grounded 5,3 detik, kutipan diawali huruf dan rujukan [1] rapi. "hukum membeli saham" grounded 3,5 detik (3 rujukan). من هو الشافعي grounded 3,5 detik.
- Masih ditemukan rujukan berkelompok [1.3, 1.4, 4.2] yang tidak dinormalisasi dan tidak ikut penomoran ulang; diperbaiki pada commit berikutnya.

## 2026-11-15 04:43:50 WIB — Tanya AI: biografi imam lewat nama lengkap

- Commit fungsi `40eb699` sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; perubahan hanya di server sehingga aset frontend tetap `index.dev-CdbXY2HS.js`, dan perilaku endpoint berubah sesuai commit ini.
- Lokal: 209 tes server lulus, oxlint bersih. DB asli: من هو الشافعي dan siapa guru imam syafii memunculkan entri محمد بن إدريس الشافعي.
- Online HTTPS: من هو الشافعي sekarang grounded dan direview, 4,8 detik (sebelumnya no_context), dengan rujukan الشمائل المحمدية hlm. 9 yang menyebut beliau secara singkat, bukan biografi lengkap. حكم صلاة الجماعة tetap grounded, 4,2 detik. "siapa guru imam syafii?" masih no_context, 6,3 detik; alasan reviewer tercatat di riwayat admin. Tidak ada timeout.

## 2026-11-15 04:33:25 WIB — Tanya AI: kualitas cuplikan rujukan dan alasan penolakan

- Commit fungsi `1516583` sudah push GitHub. Pull VPS dan restart dilakukan pengguna (SSH lokal ditolak). HEAD server tidak dibaca langsung; aset HTTPS `index.dev-CdbXY2HS.js` sama dengan build commit tersebut.
- Perubahan: halaman daftar isi/indeks diturunkan peringkatnya, halaman OCR rusak dibuang, kata aspek (حكم, biografi, فضل, شروط, كيفية) dicari dengan NEAR lebih dulu, cuplikan berupa potongan ~1.400 karakter dari teks halaman, dan alasan penolakan (tahap, alasan reviewer, sumber) tersimpan di riwayat admin.
- Lokal: 200 tes server, TypeScript dan build lulus.
- Online HTTPS sesudah deploy: حكم صلاة الجماعة selesai 6,0 detik, grounded dan direview (بداية المجتهد juz 1 hlm. 114). من هو الشافعي selesai 2,2 detik dan "siapa guru imam syafii?" 4,8 detik, keduanya masih no_context. Tidak ada timeout.
- Analisis lokal sisa no_context: untuk من هو الشافعي, nisbah الشافعي juga cocok dengan banyak ulama bermazhab Syafii, sehingga hanya 2 dari 8 rujukan yang berupa biografi Imam al-Syafii. Untuk pertanyaan berbahasa Indonesia, kata kunci tidak dicari dalam bahasa Arab, sehingga rujukan hanya arsip PISS-KTB yang tidak membahas guru beliau. Alasan pasti reviewer tercatat di Admin, riwayat Tanya AI.

## 2026-11-14 23:26:45 WIB — Tanya AI: pencarian rujukan cepat di worker

- Commit fungsi `5e8dd22` sudah push GitHub. SSH dari komputer lokal ditolak (publickey), sehingga pull VPS dan restart `maktabah.service` dilakukan pengguna sendiri. HEAD server tidak dibaca langsung dari sesi ini; perilaku endpoint online menunjukkan kode baru aktif.
- Penyebab timeout: snippet() FTS5 dihitung untuk seluruh hasil cocok sebelum LIMIT. Kata umum seperti الشافعي (398.020 halaman) memblokir event loop sekitar 90 detik sehingga tahap Gemini hanya mendapat sisa waktu sekitar 1 ms dan melaporkan "Layanan AI melewati batas waktu".
- Perbaikan: urutkan rowid dulu lalu buat snippet hanya untuk 60 kandidat, satu pool kandidat per pertanyaan, pencarian file-backed di worker read-only, batas pencarian 35 detik dengan pesan AI_SEARCH_TIMEOUT tersendiri, dan workaround bound `rowid=?` FTS5 SQLite 3.53 yang mengembalikan baris lain.
- Lokal: 197 tes server lulus; DB asli untuk الشافعي turun dari 91.217 ms menjadi 2.548 ms tanpa memblokir event loop.
- Online HTTPS sebelum deploy: من هو الشافعي gagal TIMEOUT setelah 96 detik dan semua event baru terkirim di akhir. Sesudah deploy: 6,6 detik, tahap terkirim bertahap, HTTP 200. حكم صلاة الجماعة selesai 4,0 detik dan "siapa guru imam syafii?" selesai 9,6 detik (grounded, 1 rujukan).
- Catatan terpisah: dua pertanyaan Arab pendek di atas kini selesai tanpa timeout, tetapi berakhir `no_context` karena tahap review relevansi menolak bukti. Ini terkait kualitas pemilihan rujukan/review, bukan batas waktu.

## 2026-11-13 08:25:51 WIB — Abjad awal nama pada kartu penulis

- Commit fungsi `d2b602e` sudah push GitHub dan pull VPS; layanan aktif setelah pemeriksaan tidak ada transfer/import/penghapusan aktif dan restart.
- Tampilan kartu Penulis & Karya memiliki 28 huruf Arab, Semua, Lainnya dan jumlah hasil per huruf. Filter bekerja sebelum pagination dan dapat digabung dengan q/abad. Huruf awal mengikuti nama yang ditampilkan; awalan ال/ابن tidak dibuang.
- 151 tes server lulus, TypeScript/build lokal serta staged whitespace lulus. Browser lokal 3088 dan HTTPS online lulus: jumlah global 966, pilih huruf memulai halaman pertama, pagination, profil/kembali/reload mempertahankan filter, gabungan q/abad, konsistensi linimasa, Semua menjaga filter lain, huruf kosong nonaktif, 320/390/768/1440 tanpa overflow/pageerror.
- Uji API online huruf م menghasilkan 98 penulis. Hash aset HTTPS sesuai build lokal. Regresi 36.159 kitab dan AQUAL perawi 5739 = 40.413 karakter tetap sesuai. Tidak mengubah/import ulang database.
- Buka Penulis Lokal.bat memakai port 3088 dengan pemeriksaan authors-initials-v1; backend lama tidak dipakai seolah-olah sudah memfilter.

## 2026-11-13 08:12:14 WIB — Beranda tanpa tombol Kembali

- Commit fungsi `9085849` sudah push GitHub dan pull VPS. Layanan aktif; frontend saja, tidak memerlukan restart atau perubahan database.
- Navigasi Kembali beserta label Beranda disembunyikan pada Beranda, termasuk saat memiliki riwayat internal. Halaman lain, pembaca, dan modal mempertahankan navigasi sebelumnya.
- Tujuh tes navigasi/back-navigation, TypeScript/build lokal, dan staged whitespace lulus.
- Browser lokal 3087 dan HTTPS online lulus: Beranda desktop/ponsel tanpa tombol Kembali, riwayat browser tetap bekerja, halaman lain tetap memiliki tombol, pembaca kembali ke Kutub Hadis, dan Escape pada bithaqah tidak menutup pembaca. Tidak ada pageerror atau overflow ponsel.

## 2026-11-13 07:51:40 WIB — Bithaqah perawi inline pada teks hadis

- Commit fungsi `0340341` sudah push GitHub dan pull VPS. Tidak ada transfer/import/penghapusan aktif sebelum restart; layanan aktif dan endpoint pengenalan nama tersedia.
- Nama yang dikenali pada cuplikan dan pembaca bergaris bawah; modal memakai komponen profil Kamus Perawi yang sama. Nama unik membuka profil, nama ambigu meminta pilihan. Guru/murid dapat ditelusuri dalam kartu tanpa mengganti URL/konteks bacaan. Ada pencarian untuk nama yang dipilih manual.
- Pencocokan berasal dari nama/kunyah sumber, bukan identifikasi sanad. Inspeksi Special.mdb/link dan MenDetail tidak menghasilkan pemetaan offset halaman hadis yang dapat dipastikan. Kandidat tidak dipilih berdasarkan asumsi kitab, umur, atau murid.
- Lokal 3087 memakai paket perawi yang tersedia setelah canonicalisasi, aktivasi tercatat 2026-11-13 07:37:34 WIB: 8.858 perawi, 8.854 biografi, AQUAL 5739 = 40.413 karakter, WHO ت س. Sumber MDB, database kitab dan paket asli tidak diedit. Paket online sudah sesuai dan tidak diimpor ulang.
- 149 tes server lulus, TypeScript/build lokal dan staged whitespace lulus. Browser lokal serta HTTPS online memverifikasi nama unik/ambigu, profil sumber/jarh wa ta‘dil, guru/murid inline, Escape menjaga pembaca tetap terbuka, fokus kembali, URL tetap, ponsel tanpa overflow/pageerror, dan Kamus Perawi lama tetap berfungsi.
- Uji keterlambatan penautan memastikan pilihan teks tetap utuh; penautan ditunda saat memilih teks dan HTML dimemoisasi untuk menghindari reset selection. Format bold/mark dipertahankan, HTML aktif tidak dieksekusi. Regresi AI inline dan pencarian isi pada lokal/online lulus.
- Hash aset HTTPS sesuai build lokal; regresi 36.159 kitab, 966 penulis, serta profil 5739 tetap sesuai. Indeks pencarian isi yang ada tetap digunakan.
- Launcher Kutub Hadis lokal memakai port 3087 dan pemeriksaan rowa-mentions-v1. Proses lokal lama tidak dihentikan.

## 2026-11-13 07:22:53 WIB — Pencarian isi dalam lingkup Kutub Hadis

- Commit fungsi `74cebb2` sudah push GitHub dan pull VPS. Transfer/import/penghapusan diperiksa tidak aktif, layanan direstart dan aktif. Kode/dependensi dibangun lokal; hosting hanya menghasilkan indeks data turunan.
- Pilihan Cari dalam → Isi kitab bekerja pada kelompok aktif, sumber tertentu, atau satu edisi. Semua kata/frasa berurutan mengabaikan harakat/tatweel/varian alif dan ya; hasil menampilkan cuplikan, jilid/halaman asli, serta tautan pembaca dengan sorotan. Filter/pagination tersimpan di URL.
- Indeks terpisah lokal dan online masing-masing selesai pada 757.404 halaman. FTS lama tidak menjamin pencarian berharakat dan database tambahan lokal tanpa FTS, sehingga indeks dinormalisasi khusus sumber Kutub Hadis diperlukan. Generasi baru memakai pointer atomik dan quick_check; sumber dibuka read-only. Indeks tidak masuk Git dan tidak mengganti database kitab/perawi/penulis.
- 146 tes lulus; sintaks server/worker/launcher, TypeScript/build lokal dan staged whitespace lulus. Unit meliputi scope, dua database, deduplikasi book/page, halaman tambahan, teks Arab berharakat, Latin beraksen, pagination, sumber tidak berubah saat build, indeks stale/rebuild/retensi, dan maintenance.
- Browser lokal 3085 serta HTTPS online lulus: menunggu 202/pengulangan otomatis, scope kelompok/kitab/edisi, pagination tanpa duplikasi, buka halaman/sorotan, kembali/reload filter, hasil kosong. Viewport 320/390/768/1440 tanpa overflow/pageerror.
- Uji nyata HTTPS pada semua tujuh pilihan kelompok mengembalikan 200. Kutub Tis‘ah menelusuri 9 sumber/82 edisi; gabungan seluruh sumber 17/123 edisi. Pada pengujian ini respons sekitar 0,8–1,7 detik, bukan jaminan kecepatan setiap kueri.
- Hash SHA256 aset HTTPS sesuai build lokal. Regresi tetap sesuai: 36.159 kitab, 966 penulis, dan AQUAL perawi 5739 sebanyak 40.413 karakter.
- Lokal terbaru: Buka Kutub Hadis Lokal.bat, port 3085, kemampuan hadith-search-v2. Proses layanan lokal lama tidak dihentikan.

## 2026-11-13 06:50:01 WIB — Halaman Kutub Hadis

- Commit fungsi `bbe2d03` sudah push GitHub dan pull VPS; layanan aktif dengan endpoint `/api/hadith-books` dan halaman `/#/kutub-hadis` melalui menu Lainnya.
- 142 tes lulus; sintaks, TypeScript/build lokal dan staged whitespace lulus. Browser lokal 3083 serta HTTPS online memverifikasi kelompok 2/4/6/9/10/11/17, pencarian Arab/Latin, URL/reload, pilih edisi, baca kitab yang dipilih dan kembali ke kelompok. Viewport 320/390/768/1440 tanpa overflow/pageerror.
- Terpetakan 17 sumber dan 123 edisi pada lokal maupun online. Kelompok 10/11 mengikuti Ithaf al-Maharah; susunannya dijelaskan, tidak diklaim sebagai penambahan universal atas Kutub Tis‘ah. Rujukan tersedia pada halaman dan docs/hadith-books.md.
- Inspeksi sumber MDB dilakukan read-only; koleksi aslinya sudah memiliki kategori متون الحديث, tetapi kelompok terpisah tidak ditemukan pada tabel yang diperiksa/kode Android. Kemampuan seluruh UI executable lama tidak diuji langsung. ID MDB tidak dipakai sebagai ID web.
- Sebelum pull, backend lama aktif tetapi tidak merespons HTTP; proses berstatus D menunggu I/O. Pemeriksaan file job dan compact_sessions melalui SQLite read-only memastikan tidak ada transfer/import/penghapusan aktif. Restart layanan berhasil; endpoint dan browser online kembali berfungsi. Tidak mengubah penyimpanan/kernel/database untuk pemulihan.
- Hash aset HTTPS sesuai build lokal; 36.159 kitab, 966 penulis, dan regresi perawi 5739 (AQUAL 40.413 karakter) tetap sesuai. Tidak ada impor ulang/perubahan isi database.
- Lokal terbaru port 3083; launcher Buka Kutub Hadis Lokal.bat memakai pemeriksaan hadith-books-v1.

## 2026-11-13 06:28:59 WIB — Terjemahan dan penjelasan langsung dalam pembaca

- Commit fungsi `1d76c75` sudah push GitHub dan pull VPS; layanan aktif. Perubahan frontend saja, tanpa restart backend, impor database, atau perubahan konfigurasi provider.
- Tombol pembaca sekarang membuka panel inline dengan proses, hasil, sumber, error/coba lagi, dan tutup. Alamat, teks asli, dan pembaca tetap. Pilihan teks tetap didukung; tanpa pilihan memakai seluruh halaman.
- 139 tes lulus, TypeScript/build lokal lulus. Unit cancel request dan escape HTML lulus; renderer Markdown dipakai bersama Tanya AI. Whitespace EOF yang ditemukan saat staged sudah diperbaiki sebelum commit.
- Browser lokal 3082 dan HTTPS online lulus dengan respons terkendali: translate seluruh halaman, explain pilihan teks, rute tetap, teks asli tetap, error 409/retry, close dan ganti halaman membatalkan permintaan, HTML tidak dieksekusi, ponsel tanpa overflow/pageerror.
- Uji provider sungguhan melalui UI online pada kitab 2921: translate dan explain basmalah keduanya success/mode grounded, dengan kutipan sumber dan hasil di pembaca yang sama. Pengamatan respons streaming memakai clone fetch karena CDP response.body tidak tersedia setelah reader streaming selesai; uji UI/provider akhir lulus.
- Hash SHA256 aset HTTPS sesuai build lokal. Audit mencatat waktu WIB sampai detik, file, baris/simbol, serta hash staged.

## 2026-11-13 06:00:47 WIB — Koreksi linimasa tahun horizontal

- Commit fungsi `fd39d9c` sudah push GitHub dan pull VPS; layanan `maktabah.service` aktif. Transfer/import/penghapusan diperiksa tidak aktif sebelum restart.
- Satu jalur horizontal pada desktop dan ponsel; tahun tampil sebagai tombol, nama baru muncul setelah klik. Muat kiri/kanan menambah kelompok waktu lengkap tanpa duplikasi atau memotong penulis pada tahun sama.
- 137 tes server lulus, TypeScript/build lokal lulus, pemeriksaan diff whitespace bersih. Browser lokal 3082 dan HTTPS online lulus pada 320/390/768/1024/1440 piksel: nama tersembunyi sebelum klik, muat dua arah, kembali dari profil, dan kelompok 194 tanggal belum terpetakan. Tidak ada pageerror atau overflow halaman.
- Hash aset online sesuai build lokal. Koleksi 36.159 kitab dan regresi profil perawi 5739 (AQUAL 40.413 karakter) tetap sesuai.
- Kontrol otomatis menolak perintah yang mencakup penghentian proses lokal 3081. Tidak diulang dengan cara lain; versi baru berjalan terpisah di 3082 dan launcher Penulis Lokal diarahkan ke sana. Proses lama tetap berjalan.
- Database tidak diubah; tidak memerlukan impor ulang.

# Catatan deployment

## 2026-11-13 05:40 WIB — Linimasa premium penulis

Waktu sampai detik dan baris perubahan tersedia pada CHANGELOG serta audit terstruktur commit terkait.

- Perubahan aplikasi `d109841` dan perapian whitespace `0a862f2` sudah dipush serta dipull fast-forward ke VPS. Catatan audit awal tentang pemeriksaan whitespace dikoreksi secara eksplisit pada commit tindak lanjut; tidak ada perubahan perilaku dari perapian tersebut.
- Sebelum restart, pekerjaan export/import/penghapusan tidak aktif dan sesi import bertahap `null`. Backend baru lulus pemeriksaan sintaks; `maktabah.service` aktif setelah restart. Tidak ada import ulang database dan tidak ada pengubahan isi dataset.
- Layanan lokal milik proses yang diverifikasi pada port 3081 berhasil dimuat ulang. Proses lama pada port 3080 tidak dihentikan.
- Verifikasi API lokal/online: 966 penulis, 772 rujukan tahun/abad, 194 tanggal belum terpetakan, dan 5.610 kitab tertaut. Pagination dilakukan sesudah pengurutan/filter pada server.
- Linimasa desktop menempatkan kartu bergantian di atas/bawah garis dengan titik sejajar. Tablet/ponsel memakai alur vertikal. Kartu tetap tersedia sebagai pilihan tampilan. Filter abad, pencarian, pengurutan kartu, dan posisi halaman dipertahankan saat kembali dari profil.
- Penanda setelah/sebelum/sekitar/abad dipertahankan; `ق 4` tidak diperlakukan sebagai tahun 4 H. Jarak visual tidak mengklaim skala waktu proporsional.
- Sebelum push: 136 tes lulus, TypeScript/build lulus, dan uji browser mencakup lebar 320/390/768/1024/1440, tema hijau/gelap/krem, filter abad, waktu relatif/abad saja/tanpa tanggal, pagination/profil, tanpa overflow atau error JavaScript. Pemeriksaan whitespace akhir lulus setelah koreksi EOF stylesheet.
- Uji browser akhir pada lokal 3081 dan HTTPS online: linimasa desktop, alur ponsel, navigasi profil/kembali; tanpa error JavaScript. HTML dan hash aset `index.dev-Dq3MmhhG.js` serta `index-BUrTUMsL.css` online cocok dengan build lokal.
- Jumlah kitab VPS tetap 36.159. Regresi profil perawi #5739 tetap memiliki uraian 40.413 karakter. Tidak mengubah paket penulis maupun perawi yang aktif.

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

## 2026-11-17 10:41:44 WIB — Pesan: izin lampiran per percakapan dan tanda terkirim/dibaca

Waktu ini adalah pencatatan verifikasi online, bukan waktu pull di server.

- Commit aplikasi: `211922522deafae1e6ec36a1bbfe909fc03218f6` (memuat juga `207a8e7`, izin lampiran per percakapan).
- Pull dan restart `maktabah.service` dijalankan pengguna di VPS. SSH dari mesin pengembang masih ditolak (kunci publik belum terpasang), jadi HEAD server tidak dibaca langsung. Bukti versi diambil dari aset dan respons API berikut.
- HTML online menunjuk `index.dev-Ctn--hM9.js` dan `index-BVMZo2yL.css`. Hash SHA-256 keduanya cocok dengan build lokal (`1f97de05…80e1`, `071e6c62…cf9c`).
- `GET /api/messages` tanpa percakapan mengembalikan `readUpTo:0` dan `settings` dengan `allowFiles:false` dan `allowImages:false`. Ini menunjukkan kode server commit ini sudah berjalan.
- `PUT /api/admin/messages/1/permissions` tanpa autentikasi menghasilkan 401.
- `GET /api/messages/attachments/999999999` menghasilkan 404 (bukan 503). Artinya query database pesan berjalan setelah migrasi kolom.
- Tidak membuat percakapan uji di produksi, agar inbox admin tidak terisi data uji. Alur ✓/✓✓ diuji di lokal dan dengan tes server.
