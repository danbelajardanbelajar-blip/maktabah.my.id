import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['maktabah.db', 'tafsir_relasi.db']) {
  const destination = path.join(root, 'dev-data', name);
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(root, 'dev-data', 'seed', name), destination);
}
await import('../server/index.js');
