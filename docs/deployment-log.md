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
