const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const booksDir = "D:\\Maktabah Syamilah Golden\\Books";
const dbPath = "D:\\database_maktabah_golden\\maktabah.db";
const progressFile = "D:\\database_maktabah_golden\\migration_progress.json";

// Read all mdb/bok files
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.mdb') || file.endsWith('.bok')) {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    }
  });

  return arrayOfFiles;
}

console.log("Mencari seluruh file kitab...");
const allFiles = getAllFiles(booksDir);
console.log(`Ditemukan ${allFiles.length} file kitab.`);

let progress = { processed: [] };
if (fs.existsSync(progressFile)) {
  progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  console.log(`${progress.processed.length} kitab sudah diproses sebelumnya. Melanjutkan...`);
}

let count = 0;
for (const file of allFiles) {
  const bookId = path.basename(file, path.extname(file));
  
  if (progress.processed.includes(bookId)) {
    continue; // Skip if already done
  }

  console.log(`\n[${progress.processed.length + 1}/${allFiles.length}] Memproses kitab ID: ${bookId}`);
  
  try {
    // Jalankan convert.cjs untuk satu file
    execSync(`node scripts/convert.cjs "${file}" "${dbPath}"`, { stdio: 'inherit' });
    
    // Catat progress
    progress.processed.push(bookId);
    fs.writeFileSync(progressFile, JSON.stringify(progress));
  } catch (err) {
    console.error(`Gagal memproses kitab ${bookId}. Lanjut ke kitab berikutnya...`);
  }
  
  count++;
}

console.log("\nProses migrasi massal SELESAI!");
