# Database khusus Kamus Perawi

Paket `maktabah-perawi-2026-11-12.db` berasal dari `Special.mdb` pada koleksi lokal MAKTABAH_CAKZEN_2026. Sumber dibuka hanya-baca dengan encoding Windows-1256. Paket berisi 8.858 perawi dan 8.854 uraian `AQUAL`; data kitab utama tidak disalin.

## Membuat ulang paket

Butuh Node.js 24, Java 11 atau lebih baru, dependensi npm proyek, serta Jackcess dan dependensinya. Pada mesin ini:

```powershell
node scripts/build-rowa-db.js `
  'D:/MAKTABAH_CAKZEN_2026/Buka Lewat Sini/Files/Special.mdb' `
  'D:/MAKTABAH_CAKZEN_2026/Buka Lewat Sini/.tmp_ucan/lib' `
  'D:/db/maktabah-perawi-2026-11-12.db'
```

Output harus memakai nama yang belum ada. Builder membandingkan SHA-256 sumber sebelum/sesudah export, mempertahankan ID perawi asli, dan memeriksa integritas SQLite. Output `.db` tidak masuk Git; pindahkan melalui menu import.

## Isi paket versi 1

- `rowa_manifest`: format `maktabah-rowa`, versi, tanggal pembuatan, sumber, SHA-256 sumber, jumlah perawi.
- `rowa`: nama sumber (`Name`), nama indeks (`IsoName`), `CODE`, `WHO`, `TABAQA`, `AQUAL`, `ROTBA`, `R_ZAHBI`, `sheok`, `telmez`, kelahiran/wafat, dan nama dari `men`. Kolom kompatibilitas nama lama tetap tersedia.
- `men_detail`: referensi sumber asli `SpID`, `ManId`, `Bk`, `Id`, `Talween`. `Bk=0` tidak ditafsirkan sebagai relasi ke kitab aplikasi.
- `rowa_fts`: indeks pencarian nama. Indeks dibangun ulang saat import; indeks dari upload tidak dipercaya.

## Import pada lokal dan online

1. Login admin, pilih **Transfer → Database Perawi**.
2. Pilih paket `.db` khusus perawi, lalu **Upload & periksa** (maksimal 128 MB).
3. Periksa jumlah perawi, biografi, sumber, dan catatan pada pratinjau.
4. Klik **Aktifkan database**. Penggantian berlaku untuk seluruh dataset perawi, tanpa mengubah database kitab. ID mengikuti paket; bukan merge per baris.

Halaman yang sama bekerja dalam `LOCAL_EXPORT_MODE=1`. Pengecualian izin tulis hanya berlaku untuk endpoint database perawi yang sudah membutuhkan autentikasi admin. Fitur import kitab tetap mengikuti pembatasan mode lokal yang sudah ada.

Data aktif dan versi sebelumnya berada di `dev-data/rowa-database/`. Untuk hosting, direktori ini harus persisten dan dapat ditulis proses Node. Lokasinya bisa diatur dengan environment `ROWA_DATABASE_DIR` (path absolut disarankan). Jangan masukkan direktori ini ke direktori static/public atau menghapusnya saat deploy.

Upload belum mengaktifkan paket. Pratinjau berlaku 24 jam dan dapat diupload ulang setelah refresh. File staging yang lebih dari 24 jam dibersihkan saat server mulai. Setelah aktivasi, pointer `active.json` diganti secara atomik; koneksi membaca versi baru pada permintaan berikutnya, termasuk proses Node lain. Versi lama tetap tersedia pada **Versi sebelumnya → Pulihkan**. **Unduh database aktif** menghasilkan paket `.db` yang bisa diimpor ke server lain. Simpan cadangan di luar server juga; versi sebelumnya tidak dihapus otomatis.

Server yang belum mengimpor paket tetap membaca `rowa` dari database kitab, tetapi tidak lagi menebak kitab dari daftar murid. Jika pointer aktif rusak saat startup, status admin menjelaskan kesalahan dan data lama dipakai sementara.

Deployment online memerlukan kode `server/`, frontend hasil `npm run build`, restart Node, dan import file `.db` melalui admin. Push Git tidak otomatis mengaktifkan database online.

## Makna kitab dan catatan sumber

Label kitab berasal hanya dari simbol `WHO`, mengikuti [mukadimah Taqrib al-Tahdhib](https://ar.wikisource.org/wiki/تقريب_التهذيب/المقدمة). Kitab lain dari penulis yang sama dibedakan: `بخ` bukan Shahih Bukhari, `مق` bukan bagian utama Shahih Muslim, `فق` bukan Sunan Ibn Majah, dan `كد`/`كن` bukan Muwaththa' Malik. `ع` dan `4`/`٤` diekspansi sesuai kelompoknya. Variasi huruf `ى`/`ي` pada kode dikenali.

Simbol yang belum dikenal atau kode disertai uraian naratif tidak dipaksakan menjadi label kitab. Teks kode tetap ditampilkan utuh. `TABAQA` disimpan sebagai kode sumber tanpa mengarang arti kode hurufnya. Teks `AQUAL` ditampilkan sebagai teks biasa, bukan HTML. Data sumber tetap dapat memuat perbedaan pendapat; pemetaan kode tidak menyatakan bahwa seluruh riwayatnya telah ditahqiq.

Regresi Imam Bukhari, ID 5739: `WHO = ت س`, `CODE = 5727`, `AQUAL` 40.413 karakter. Label Muwaththa', Shahih Bukhari, dan Shahih Muslim tidak boleh dihasilkan dari daftar muridnya.

## Validasi

```powershell
node --test server/rowa-database.test.js server/rowa-codes.test.js server/rowa-search.test.js server/admin-navigation.test.js
npm run build
```

Import membutuhkan admin, memeriksa manifest, jumlah, tipe nilai, integritas SQLite, dan ruang disk. Database upload tidak di-ATTACH atau dijalankan skemanya: hanya nilai kolom yang diizinkan disalin ke database baru. Trigger/view/tabel asing ditolak. Kegagalan validasi tidak mengubah database aktif.
