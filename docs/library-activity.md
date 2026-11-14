# Log Kutub Hadis dan Penulis & Karya

Admin → Aktivitas menyediakan **Log Kutub Hadis** dan **Log Penulis & Karya**. Keduanya memakai `LogsView` yang sama dengan riwayat kegiatan lain: statistik keseluruhan/24 jam/7 hari/30 hari, IP unik, tabel waktu/IP/peramban, pagination, pemilihan baris, serta ekspor CSV. Log baru juga menyediakan pencarian teks, pilihan jenis aktivitas, tombol muat ulang, dan detail filter/konteks. Waktu ditampilkan dalam WIB sampai detik; penyimpanan timestamp memakai UTC dengan milidetik. CSV mempertahankan jumlah hasil nol.

Tabel menampilkan maksimal 500 aktivitas terbaru seperti log lama. Pencarian, filter, pagination, dan ekspor pilihan berlaku pada kumpulan tersebut; statistik menghitung seluruh riwayat. Catatan yang lebih lama tetap tersimpan di database. Ini bukan rekonstruksi aktivitas sebelum fitur dipasang.

## Aktivitas yang dicatat

- Kutub Hadis: katalog/filter kelompok, kata pencarian katalog, pilihan hanya edisi tersedia, pencarian isi berhasil (termasuk hasil nol), mode semua kata/frasa, sumber dan edisi, halaman hasil, pilihan edisi, permintaan buka detail kitab, dan permintaan buka pembaca/halaman sumber.
- Penulis & Karya: daftar/pencarian nama, filter huruf/abad/urutan/tampilan, halaman daftar atau karya, profil beserta nama/ID, rentang linimasa yang dimuat, tahun yang dipilih, serta permintaan buka detail/pembaca karya. Jumlah yang dicatat adalah baris/penulis/karya yang dikembalikan pada halaman atau rentang itu; total hasil tersedia terpisah dalam konteks bila API menyediakannya.

Pencarian isi hadis dan hasil API penulis dicatat di server sesudah permintaan berhasil. Permintaan indeks hadis yang masih disiapkan, pembacaan admin, profil gagal, serta pemuatan ringkasan awal sebelum linimasa ditampilkan tidak dihitung sebagai aktivitas sukses tambahan. Katalog hadis difilter di browser; efek pencatatannya menunggu data berhasil dimuat dan perubahan URL diterapkan. Mengetik tanpa mengirim pencarian tidak menambah log katalog. Pengulangan profil setelah kembali dari pembaca adalah kunjungan baru.

## Penyimpanan dan akses

`hadith_logs` dan `authors_logs` dibuat secara idempoten pada database state yang sudah dipakai aplikasi. Mode lokal memakai `local-web-state.db` yang terpisah dari sumber kitab. Kolom menyimpan jenis aktivitas, kueri, nama/ID tujuan, jumlah hasil, konteks JSON dengan daftar kolom yang diizinkan, IP, peramban, dan waktu. Pencatatan tidak mengubah isi kitab atau paket penulis. Hitungan insert log baru dikecualikan dari revisi cache relasi penulis agar setiap log tidak memaksa pembangunan ulang relasi.

Endpoint baca `/api/admin/logs/hadith` dan `/api/admin/logs/authors`, beserta statistik dashboard, tetap memerlukan autentikasi admin. Endpoint tulis `/api/log/library/:feature` menerima hanya jenis aktivitas browser yang diizinkan, membatasi panjang field/konteks dan 120 event per IP per menit, memeriksa ID kitab, serta mengambil judul kitab dari katalog server. Aktivitas dari browser adalah telemetri, bukan bukti identitas seseorang. Tidak ada endpoint baca riwayat publik. Kegagalan log tidak menghalangi pencarian atau pembaca.

## Verifikasi dan deployment

Tes otomatis memakai SQLite sementara untuk migrasi berulang, pemisahan tabel, timestamp, konteks, hasil nol, validasi input/kitab, pembatasan permintaan, kondisi maintenance, dan kegagalan penyimpanan. Tes HTTP worker hadis memverifikasi log hanya untuk hasil sukses. Regresi penulis/admin/navigasi tetap dijalankan. Uji browser memakai server lengkap dengan database/paket penulis sintetis terisolasi untuk perekaman, akses admin, filter, CSV, statistik, serta desktop/ponsel. Paket sintetis hanya untuk QA dan tidak dikirim ke produksi.

Sesudah pull kode dan aset hasil build lokal, backend perlu direstart setelah memastikan tidak ada import/export/penghapusan atau transfer aktif. Restart membuat dua tabel log baru; tidak perlu import ulang dataset. HEAD server, layanan, endpoint log dengan autentikasi, dan aset online harus diverifikasi sebelum deployment dinyatakan selesai. Tidak menjalankan install/build di hosting.
