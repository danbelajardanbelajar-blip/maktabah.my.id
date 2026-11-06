import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const backupName = /^before-(?:import-\d+|large-import-[a-f0-9]{48})\.db$/;
const jobId = /^[a-f0-9]{48}$/;
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
const regularFile = filename => {
  try { const stat = fs.lstatSync(filename); return stat.isFile() && !stat.isSymbolicLink() ? stat : null; }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
};

export function planStorageCleanup({ dbPath, directory, jobs, protectedIds = new Set(), now = Date.now() }) {
  const base = path.dirname(path.resolve(dbPath));
  const transfers = path.resolve(directory), backups = path.join(base, 'book-import-backups');
  // Only direct regular files inside these two application directories are eligible.
  for (const folder of [base, transfers, backups]) {
    if (fs.existsSync(folder) && fs.realpathSync(folder) !== folder) throw fail('Folder penyimpanan berupa tautan. Pembersihan dibatalkan.');
  }
  if (path.dirname(transfers) !== base) throw fail('Lokasi folder transfer tidak valid.');
  const list = fs.existsSync(backups) ? fs.readdirSync(backups).filter(name => backupName.test(name))
    .map(name => ({ filename: path.join(backups, name), stat: regularFile(path.join(backups, name)) })).filter(f => f.stat) : [];
  list.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs || a.filename.localeCompare(b.filename));
  const retained = list[0] || null;
  const candidates = [];
  const add = (filename, kind, id) => {
    const stat = regularFile(filename);
    if (stat) candidates.push({ filename, kind, id, bytes: stat.size, mtime: stat.mtimeMs, inode: stat.ino });
  };
  for (const item of list.slice(1)) add(item.filename, 'backup');
  let preservedTransfers = 0;
  for (const [id, job] of jobs) {
    if (!jobId.test(id)) continue;
    const expiredReady = job.status === 'ready' && Number.isFinite(job.createdAt) && now - job.createdAt > 86400000;
    if (protectedIds.has(id) || (!['done', 'failed'].includes(job.status) && !expiredReady)) { preservedTransfers++; continue; }
    add(path.join(transfers, `${id}.db`), 'transfer', id);
    add(path.join(transfers, `${id}.json`), 'metadata', id);
  }
  const planId = crypto.createHash('sha256').update(JSON.stringify({ retained: retained?.filename, candidates })).digest('hex');
  const disk = fs.statfsSync(base);
  return { planId, candidates, retainedBackup: retained ? path.basename(retained.filename) : null,
    retainedBackupBytes: retained?.stat.size || 0, preservedTransfers,
    backupFiles: candidates.filter(c => c.kind === 'backup').length,
    transferFiles: candidates.filter(c => c.kind === 'transfer').length,
    reclaimableBytes: candidates.reduce((n, c) => n + c.bytes, 0), freeBytes: disk.bavail * disk.bsize };
}

const publicPlan = ({ candidates, ...plan }) => ({ ...plan, removableFiles: candidates.length });

export function registerStorageCleanup(app, { getDbPath, directory, jobs, requireAdmin, localExportMode, isBusy, protectedIds }) {
  const options = () => ({ dbPath: getDbPath(), directory, jobs, protectedIds });
  const guard = (req, res, next) => {
    if (localExportMode) return res.status(403).json({ error: 'Pembersihan penyimpanan hanya tersedia pada web online.' });
    next();
  };
  app.get('/api/admin/storage/cleanup', requireAdmin, guard, (req, res) => {
    try { res.set('Cache-Control', 'no-store').json({ ...publicPlan(planStorageCleanup(options())), busy: isBusy() }); }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.post('/api/admin/storage/cleanup', requireAdmin, guard, (req, res) => {
    if (isBusy()) return res.status(409).json({ error: 'Upload, import, export, atau penghapusan sedang berjalan. Tunggu selesai sebelum membersihkan penyimpanan.' });
    try {
      const plan = planStorageCleanup(options());
      if (req.body?.planId !== plan.planId) throw fail('Daftar file berubah. Muat ulang perkiraan dan konfirmasi kembali.');
      let deletedFiles = 0, freedBytes = 0;
      const warnings = [];
      for (const file of plan.candidates) {
        // Retain metadata when a package could not be removed, allowing a later retry.
        if (file.kind === 'metadata' && fs.existsSync(path.join(directory, `${file.id}.db`))) continue;
        try {
          const stat = regularFile(file.filename);
          if (!stat) continue;
          if (stat.ino !== file.inode || stat.size !== file.bytes || stat.mtimeMs !== file.mtime) throw new Error('File berubah saat pembersihan.');
          fs.unlinkSync(file.filename); deletedFiles++; freedBytes += file.bytes;
        } catch (e) { warnings.push(`${path.basename(file.filename)}: ${e.message}`); }
      }
      const removedJobIds = [];
      for (const file of plan.candidates) if (file.id && jobs.has(file.id) && !fs.existsSync(path.join(directory, `${file.id}.db`)) && !fs.existsSync(path.join(directory, `${file.id}.json`))) { jobs.delete(file.id); removedJobIds.push(file.id); }
      res.json({ success: true, deletedFiles, freedBytes, warnings, removedJobIds, ...publicPlan(planStorageCleanup(options())) });
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
}
