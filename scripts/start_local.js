import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
dotenv.config({ path: path.join(root, '.env.local'), override: true, quiet: true });
const portArgument=process.argv.find(argument=>argument.startsWith('--port='));
if(portArgument){const value=portArgument.slice(7);if(!/^\d+$/.test(value))throw new Error('Argumen --port harus berupa nomor port.');process.env.PORT=value;}
if (process.env.LOCAL_EXPORT_MODE !== '1' || process.env.HOST !== '127.0.0.1') {
  throw new Error('Konfigurasi .env.local harus menggunakan LOCAL_EXPORT_MODE=1 dan HOST=127.0.0.1.');
}
for (const key of ['DB_PATH', 'TAMBAHAN_DB_PATH', 'TAFSIR_DB_PATH']) {
  if (!process.env[key] || !fs.existsSync(process.env[key])) throw new Error(`File database tidak ditemukan: ${key}=${process.env[key] || ''}`);
}
if (!fs.existsSync(path.join(root, 'dist', 'index.dev.html'))) throw new Error('Build lokal belum tersedia. Jalankan npm run build terlebih dahulu.');
const port = Number(process.env.PORT || 3080);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT pada .env.local tidak valid.');
const base = `http://127.0.0.1:${port}`;
const authorMode=process.argv.includes('--authors');
const adminUrl=authorMode?`${base}/#/admin?view=authors_database`:`${base}/?admin=1`;
const url = authorMode?`${base}/#/penulis`:adminUrl;
const status = async () => {
  try {
    const r = await fetch(`${base}/api/local/status`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return null;
    const data = await r.json();
    return data.app === 'maktabah-local-export' && data.readOnly
      && ['DB_PATH', 'TAMBAHAN_DB_PATH', 'TAFSIR_DB_PATH'].every((key, i) => path.resolve(data.sources[i]) === path.resolve(process.env[key])) ? data : null;
  } catch { return null; }
};
const openWeb = () => {
  console.log(`\nWeb lokal: ${base}/\nAdmin / export: ${adminUrl}\n${authorMode?`Penulis & Karya: ${url}\n`:''}Sumber dibuka hanya-baca. Tidak ada perubahan pada VPS.\n`);
  if (process.argv.includes('--no-open')) return;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', `Start-Process '${url}'`], { windowsHide: true }, error => {
    if (error) console.log('Buka link admin di atas melalui browser.');
  });
};
const running=await status();
if(running&&authorMode&&!running.features?.includes('authors-v1'))throw new Error(`Server port ${port} belum mendukung Penulis & Karya. Pilih port lain dengan --port=PORT.`);
if(running && !running.transferFormats?.includes('parts-v1'))throw new Error('Server lokal versi lama masih berjalan. Tutup jendela terminal Maktabah Lokal yang lama, lalu buka BAT ini kembali.');
if (running) {
  console.log('Server lokal sudah berjalan.');
  openWeb();
} else {
  await import('../server/index.js');
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const running=await status();
if(running && !running.transferFormats?.includes('parts-v1'))throw new Error('Server lokal versi lama masih berjalan. Tutup jendela terminal Maktabah Lokal yang lama, lalu buka BAT ini kembali.');
if (running) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) { console.error('Server lokal gagal siap. Periksa port dan ketiga database sumber.'); process.exit(1); }
  console.log('Biarkan jendela ini terbuka selama memakai web lokal. Tekan Ctrl+C untuk menghentikan.');
  openWeb();
}
