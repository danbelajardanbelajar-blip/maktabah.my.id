# Pesan pengunjung ↔ admin

Tombol pesan mengambang (`src/components/MessageWidget.tsx`) dan kotak masuk admin (`AdminMessages.tsx`, `AdminInboxMini.tsx`) memakai API di `server/messages.js`.

## Link dapat diklik

Teks pesan tetap disimpan dan ditampilkan sebagai teks biasa, bukan HTML. `src/lib/linkify.ts` hanya mengubah alamat `http://`, `https://`, dan `www.` menjadi elemen `<a>` dengan `target="_blank" rel="noopener noreferrer nofollow ugc"`.

- Tanda baca di akhir kalimat tidak ikut menjadi bagian link, termasuk tanda baca Arab (، ؛ ؟).
- Kurung tutup yang memang bagian alamat tetap dipertahankan, misalnya `.../Foo_(bar)`.
- `javascript:`, `data:`, alamat yang memuat user:password, dan teks yang menempel di depan alamat tidak dijadikan link.

## Lampiran file dan gambar

- Pengunjung bisa melampirkan satu file per pesan melalui tombol 🖼️ (gambar) atau 📎 (file), dengan **Ctrl+V** (gambar dari clipboard), atau dengan menyeret file ke formulir. Jika clipboard juga berisi teks, yang ditempel adalah teksnya.
- **Izin admin:** di Admin → Masukan → Pesan Pengunjung ada centang *Izinkan kirim file* dan *Izinkan kirim gambar*. Keduanya **nonaktif secara bawaan**.
  - Pengaturan disimpan di tabel `visitor_message_settings`.
  - Perubahan dikirim langsung ke pengunjung yang sedang terhubung (event SSE `settings`), dan dimuat ulang setiap kali panel pesan dibuka.
  - Balasan admin selalu boleh membawa lampiran.
- **Format:**
  - Gambar: JPG, PNG, GIF, WEBP, maksimal 8 MB.
  - File: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, ZIP, maksimal 10 MB.
  - Jenis file ditentukan dari isi byte file (`server/message-attachments.js`), bukan dari nama atau MIME kiriman peramban. SVG/HTML/exe ditolak, dan file `.png` yang isinya HTML juga ditolak.
- **Batas laju:** 10 lampiran per jam per peramban dan 20 per jam per IP, di samping batas pesan yang sudah ada.
- **Penyimpanan:**
  - File disimpan di `uploads/messages/` dengan nama UUID acak. Folder ini diabaikan Git, jadi ikut dicadangkan bersama folder `uploads/` server.
  - Metadata disimpan di kolom `attachment_*` pada tabel `visitor_messages`. Kolom ini ditambahkan otomatis ke database lama tanpa mengubah pesan yang sudah ada.
  - Menghapus percakapan juga menghapus file-filenya.
- **Akses:** `GET /api/messages/attachments/:id` hanya untuk peramban pemilik percakapan atau admin. Pihak lain menerima 404.
  - Gambar ditampilkan inline. File lain selalu dikirim sebagai unduhan (`?download=1` memaksa unduhan).
  - Header respons: `X-Content-Type-Options: nosniff`, CSP `sandbox`, `Cross-Origin-Resource-Policy: same-origin`.
  - Admin memuat lampiran dengan token Bearer (sebagai blob), karena sesi admin belum tentu memiliki cookie admin.

## API admin

- `GET /api/admin/messages/settings` → `{allowFiles, allowImages, maxImageBytes, maxFileBytes}`
- `PUT /api/admin/messages/settings` dengan body `{allowFiles:boolean, allowImages:boolean}`
