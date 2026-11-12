# Penulis & Karya

Fitur publik tersedia di `#/penulis`. Nama penulis dapat dicari, diurutkan berdasarkan nama/tahun wafat, dan dibuka melalui tautan tetap `#/penulis?id=ID`. Profil berisi biografi sumber, informasi wafat, karya yang tersedia di server, serta dasar setiap relasi. Kartu kitab membuka metadata atau pembaca. Metadata kitab juga menyediakan tautan balik ke profil penulis yang tertaut.

## Tampilan linimasa

Tampilan bawaan memakai satu linimasa horizontal tahun rujukan wafat Hijriah pada desktop maupun ponsel. Nama penulis tersembunyi sampai penanda tahun diklik; semua penulis pada tahun tersebut muncul pada panel di bawah garis. Tombol **Muat kiri** dan **Muat kanan** menambahkan rentang lebih awal/akhir tanpa membuat baris baru. Geser garis atau gunakan keyboard pada area gulir untuk menelusuri tahun yang telah dimuat. Pilihan **Kartu** tetap tersedia untuk penelusuran nama. Filter abad, kata pencarian, tampilan, dan halaman tersimpan dalam URL. Kembali dari profil mengembalikan halaman daftar dan filternya.

Tahun pasti, `بعد` (setelah), `قبل` (sebelum), `نحو` (sekitar), dan keterangan abad seperti `ق 4` dipetakan secara terpisah. Abad tidak diubah menjadi tahun wafat. Teks asli dipertahankan pada keterangan yang tidak pasti. Data tanpa tanggal yang dapat dipetakan dikelompokkan tersendiri. Filter abad mengikuti tahun/abad rujukan, bukan klaim tanggal wafat pasti untuk entri berketerangan relatif. Jarak antarposisi linimasa tidak berskala tahun.

Parser dan urutan dijalankan pada server sebelum pengelompokan. Endpoint `GET /api/authors?timeline=1` mengirim sepuluh kelompok waktu lengkap per rentang, dengan `start`/`end`/`totalGroups`. Rentang awal berada di tengah koleksi terfilter agar kedua arah dapat dimuat. Parameter `start` mengambil rentang berikut/sebelumnya, dengan filter `q` dan `century` yang sama. Nama dengan tahun rujukan sama tidak terpotong oleh pagination. Tahun yang berketerangan relatif mempertahankan keterangan aslinya di kartu. Kelompok abad dan tanggal belum terpetakan tetap berlabel sesuai sumber. Tampilan kartu memakai 24 penulis per halaman. URL lama dengan `sort=name` tanpa parameter tampilan tetap membuka kartu agar pilihan pengurutan lama tidak berubah diam-diam. Tampilan ini tidak memerlukan import ulang database.

## Sumber dan batas data

Paket awal `maktabah-penulis-2026-11-13-final.db` memuat 966 penulis dari `MAKTABAH_CAKZEN_2026/Buka Lewat Sini/Files/Special.mdb`, tabel `Auth`; 770 biografi terisi. Relasi eksplisit diperiksa melalui `Files/main.mdb`, tabel `0bok`. Encoding MDB adalah Windows-1256. Sumber dibuka hanya-baca dan hash sumber diperiksa sebelum/sesudah export.

Katalog MDB tersebut tidak memuat hubungan yang lengkap. Karena itu builder juga membaca metadata kitab dan penulis dari SQLite lokal sebagai sumber relasi terpisah. Paket berisi 36.159 metadata kitab dari pustaka lokal utama/tambahan, tanpa menyalin halaman kitab. Paket awal berukuran 14.315.520 byte dan mempunyai 5.610 kitab tertaut. Sisanya tidak dinyatakan sebagai karya seorang penulis hanya berdasarkan kemiripan nama.

ID penulis tidak disamakan lintas sumber. Kecocokan otomatis membutuhkan nama yang sama setelah normalisasi Unicode/harakat/spasi, nama unik di kedua sumber, serta tidak ada pertentangan tahun wafat jika keduanya tersedia. Nama tidak dicocokkan menggunakan substring atau fuzzy matching. Relasi `0bok.authno → Auth.authid` hanya dipakai dengan kecocokan ID dan judul kitab pada pustaka. Usulan dari sumber berbeda yang bertentangan ditahan untuk tinjauan.

Label **Kecocokan metadata** menjelaskan dasar relasinya; bukan klaim bahwa atribusi karya telah ditahqiq. **Relasi eksplisit sumber** dan **Ditinjau admin** dibedakan. Pada runtime, ID kitab harus tersedia dan judulnya cocok dengan paket. ID yang bertabrakan dengan judul berbeda tidak ditampilkan sebagai karya, sekalipun paket berisi relasi. Profil yang belum memiliki kitab tertaut tetap dapat dibuka.

## Halaman admin

Untuk layanan lokal terbaru tanpa menghentikan proses lama, jalankan `Buka Penulis Lokal.bat`. Launcher memakai port 3082: halaman publik `http://127.0.0.1:3082/#/penulis` dan admin `http://127.0.0.1:3082/#/admin?view=authors_database`. Menjalankan launcher lagi memakai proses yang sudah sesuai. Terminal tetap dibuka selama layanan dipakai. Default launcher lokal lama di port 3080 tidak berubah. Port bisa dipilih lewat `node scripts/start_local.js --port=3082 --authors`.

Menu **Penulis → Database Penulis** menyediakan upload `.db` maksimal 64 MB, pratinjau, aktivasi, unduh, dan pemulihan versi sebelumnya. Transfer memakai format yang sama di lokal dan online. Database kitab dan Database Perawi tidak diganti.

Menu **Penulis → Tinjau Relasi Penulis** menyediakan:

- Statistik kitab tersedia, tertaut, belum tertaut, dan konflik identitas.
- Pencarian judul atau nama penulis pada metadata, filter status, dan pagination.
- Pemeriksaan nama sumber, dasar relasi, serta keputusan sebelumnya.
- Pencarian penulis sumber dan tautan biografinya.
- **Sahkan relasi**, **Tolak relasi**, atau **Kembalikan ke data paket**, dengan catatan rujukan wajib. Satu kitab dapat memiliki beberapa penulis setelah ditinjau.
- Riwayat perubahan dengan tanggal/jam sampai detik (WIB), ID penulis, tindakan, dan catatan. Catatan pengesahan menjadi dasar relasi yang dapat dibaca pengunjung.

Judul yang berubah atau revisi yang sudah diedit admin lain menyebabkan HTTP 409, sehingga keputusan lama tidak diam-diam menimpa data baru. Konflik judul harus diselesaikan di katalog/paket sebelum relasi dapat disahkan.

## Penyimpanan, impor ulang, dan pemulihan

Lokasi default adalah `dev-data/authors-database/`; bisa diatur melalui environment `AUTHOR_DATABASE_DIR`. Gunakan direktori persisten yang dapat ditulis layanan Node, di luar direktori static. Direktori ini diabaikan Git. Jangan hapus saat deployment.

Setiap aktivasi memakai file versi tersendiri dan mengganti pointer `active.json` secara atomik. Proses server lain membaca perubahan pointer pada permintaan berikutnya. Tinjauan menggunakan transaksi SQLite WAL, serta menambahkan event audit baru tanpa mengganti event lama. Perubahan sumber tidak menulis ke MDB atau database kitab.

Saat import ulang, keputusan lokal mengungguli keputusan paket untuk pasangan yang identitas nama penulis dan judul kitabnya masih sama. Riwayat pasangan yang masih cocok ikut dipertahankan, termasuk keputusan yang sudah di-reset. Keputusan yang tidak cocok tidak diterapkan; jumlahnya dilaporkan dan versi lama tetap disimpan. Pemulihan versi sengaja mengikuti isi versi yang dipilih, bukan menggabungkannya.

**Unduh database & hasil tinjauan** membuat snapshot SQLite yang konsisten menggunakan API backup, termasuk tinjauan dan riwayatnya. Snapshot dapat diimpor ke server lain. Upload belum mengaktifkan paket; pratinjau kedaluwarsa setelah 24 jam. Staging lama dibersihkan saat layanan mulai. Cadangan versi tidak dihapus otomatis.

Upload tidak di-ATTACH atau dijalankan skemanya. Manifest, jumlah data, batas ukuran, nilai kolom, identitas keputusan, dan foreign key diperiksa. Tabel/view/trigger yang tidak diizinkan ditolak; nilai yang diizinkan disalin ke skema baru. Database aktif tidak berubah ketika validasi gagal.

## Membuat ulang paket

Butuh Node.js 24, Java 11+, dependensi npm lokal, serta Jackcess dan dependensinya. Pilih output yang belum ada:

```powershell
node scripts/build-author-db.js `
  'D:/MAKTABAH_CAKZEN_2026' `
  'D:/MAKTABAH_CAKZEN_2026/Buka Lewat Sini/.tmp_ucan/lib' `
  'D:/db/maktabah.db' `
  'D:/db/maktabah_tambahan.db' `
  'D:/db/maktabah-penulis-2026-11-13-final.db'
```

Argumen database tambahan boleh `-`. Hash manifest adalah gabungan hash dua MDB sumber, bukan checksum paket hasil tinjauan. File `.db` tidak masuk Git.

## Verifikasi dan deployment

```powershell
node --test server/authors.test.js server/admin-navigation.test.js server/navigation.test.js server/back-navigation.test.js
npm run build
```

Build dijalankan di lokal. Push kode/backend dan hasil `dist`, pull di VPS, lalu restart Node setelah memastikan tidak ada transfer aktif. Import paket melalui admin setelah endpoint baru tersedia. Pembuatan/import/review juga didukung pada `LOCAL_EXPORT_MODE=1`; pengecualian izin tulis hanya menuju endpoint penulis yang memerlukan admin. Pembatasan import kitab dalam mode lokal tetap berlaku.

Pengujian browser memakai server dan database sementara: import paket lengkap, profil, tautan metadata kitab, pembaca, penolakan/reset relasi, riwayat, snapshot unduhan, dan tampilan ponsel. Tidak memasukkan keputusan percobaan ke database produksi.
