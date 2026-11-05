import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function registerLargeTransfer(app, { getDb, getDbPath, getAdditionalPath, requireAdmin, localExportMode, runtime, directory, clearCache }) {
  fs.mkdirSync(directory, { recursive: true });
  const jobs = new Map();
  const idPattern = /^[a-f0-9]{48}$/;
  const jobPath = id => path.join(directory, `${id}.json`);
  for (const filename of fs.readdirSync(directory).filter(n => /^[a-f0-9]{48}\.json$/.test(n))) {
    try {
      const job = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));
      if (!idPattern.test(job.id) || !['export', 'import'].includes(job.kind)) continue;
      if (job.status === 'running' || job.status === 'uploading') { job.status = 'failed'; job.error = 'Server dimulai ulang sebelum proses selesai. Silakan ulangi transfer.'; }
      jobs.set(job.id, job);
    } catch { /* Ignore incomplete job metadata from an interrupted write. */ }
  }
  const persist = job => fs.writeFileSync(jobPath(job.id), JSON.stringify(job));
  const publicJob = job => ({ id: job.id, kind: job.kind, status: job.status, progress: job.progress, result: job.result, error: job.error, downloadUrl: job.kind === 'export' && job.status === 'ready' ? `/api/admin/large-transfer/file/${job.id}` : null });
  const createJob = kind => {
    const job = { id: crypto.randomBytes(24).toString('hex'), kind, status: 'running', createdAt: Date.now(), progress: {} };
    jobs.set(job.id, job); persist(job); return job;
  };
  const packagePath = job => path.join(directory, `${job.id}.db`);
  const launch = (job, action, options) => {
    job.status = 'running'; job.error = null; persist(job);
    let completed = false, lastSave = 0;
    const finish = (status, error) => {
      if (completed) return;
      completed = true; job.status = status;
      if (error) job.error = error;
      if (action === 'import') { runtime.importing = false; getDb()?.pragma('busy_timeout=5000'); clearCache(); }
      persist(job);
    };
    const worker = new Worker(new URL('./large-transfer-worker.js', import.meta.url), { workerData: { action, ...options } });
    worker.on('message', message => {
      if (message.type === 'progress') {
        job.progress = message.data;
        if (Date.now() - lastSave > 1000) { persist(job); lastSave = Date.now(); }
      } else if (message.type === 'done') { job.result = message.result; finish(action === 'import' ? 'done' : 'ready'); }
      else if (message.type === 'failed') finish('failed', message.error);
    });
    worker.on('error', error => finish('failed', error.message));
    worker.on('exit', code => { if (!completed) finish('failed', `Proses transfer berhenti (${code}). Database tidak diubah jika import belum selesai.`); });
  };
  const getJob = (req, res) => {
    const job = idPattern.test(req.params.id || '') ? jobs.get(req.params.id) : null;
    if (!job) { res.status(404).json({ error: 'Proses transfer tidak ditemukan.' }); return null; }
    return job;
  };
  app.post('/api/admin/large-transfer/export', requireAdmin, (req, res) => {
    if ([...jobs.values()].some(j => j.kind === 'export' && j.status === 'running')) return res.status(409).json({ error: 'Export lain sedang berjalan. Tunggu hingga selesai.' });
    const job = createJob('export');
    launch(job, 'export', { dbPath: path.resolve(getDbPath()), additionalPath: getAdditionalPath(), selection: req.body, outputPath: packagePath(job) });
    res.status(202).json(publicJob(job));
  });
  app.get('/api/admin/large-transfer/jobs/:id', requireAdmin, (req, res) => {
    const job = getJob(req, res); if (job) res.json(publicJob(job));
  });
  // A random, expiring download ticket lets the browser stream to disk without a JS Blob.
  app.get('/api/admin/large-transfer/file/:id', (req, res) => {
    const job = getJob(req, res); if (!job) return;
    if (job.kind !== 'export' || job.status !== 'ready' || Date.now() - job.createdAt > 24 * 60 * 60 * 1000) return res.status(410).json({ error: 'Tautan unduhan sudah kedaluwarsa. Export ulang paketnya.' });
    res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer');
    res.download(packagePath(job), `maktabah-paket-${new Date(job.createdAt).toISOString().slice(0, 10)}.db`);
  });
  let uploading = false;
  app.post('/api/admin/large-transfer/upload', requireAdmin, async (req, res) => {
    if (localExportMode) return res.status(403).json({ error: 'Upload/import dilakukan pada web online.' });
    if (uploading || runtime.importing) return res.status(409).json({ error: 'Upload/import lain sedang berjalan.' });
    const length = Number(req.headers['content-length']);
    const disk = fs.statfsSync(directory);
    const budget = Math.floor((disk.bavail * disk.bsize - fs.statSync(getDbPath()).size - 256 * 1024 * 1024) / 5);
    if (!Number.isSafeInteger(length) || length < 1) return res.status(411).json({ error: 'Ukuran upload harus diketahui.' });
    if (length > budget) return res.status(507).json({ error: 'Ruang disk VPS tidak cukup untuk upload, cadangan, dan isi hasil import.' });
    const job = createJob('import'); job.status = 'uploading'; persist(job); uploading = true;
    let received = 0;
    try {
      req.setTimeout(0);
      await pipeline(req, new Transform({ transform(chunk, encoding, callback) {
        received += chunk.length;
        callback(received > length || received > budget ? new Error('Upload melampaui kapasitas disk yang tersedia.') : null, chunk);
      } }), fs.createWriteStream(packagePath(job), { flags: 'wx' }));
      if (received !== length) throw new Error('Upload belum lengkap. Silakan ulangi.');
      launch(job, 'inspect', { inputPath: packagePath(job) });
      res.status(202).json(publicJob(job));
    } catch (error) {
      job.status = 'failed'; job.error = error.message; persist(job);
      fs.rmSync(packagePath(job), { force: true });
      if (!res.destroyed) res.status(400).json({ error: error.message });
    } finally { uploading = false; }
  });
  app.post('/api/admin/large-transfer/jobs/:id/import', requireAdmin, (req, res) => {
    if (localExportMode) return res.status(403).json({ error: 'Import dilakukan pada web online.' });
    const job = getJob(req, res); if (!job) return;
    if (runtime.importing) return res.status(409).json({ error: 'Import lain sedang berjalan.' });
    if (job.kind !== 'import' || job.status !== 'ready') return res.status(409).json({ error: 'File belum siap diimport.' });
    const backups = path.join(path.dirname(path.resolve(getDbPath())), 'book-import-backups');
    fs.mkdirSync(backups, { recursive: true });
    runtime.importing = true; getDb().pragma('busy_timeout=100');
    try {
      launch(job, 'import', { inputPath: packagePath(job), dbPath: path.resolve(getDbPath()), additionalPath: getAdditionalPath(), backupPath: path.join(backups, `before-large-import-${job.id}.db`) });
      res.status(202).json(publicJob(job));
    } catch (error) { runtime.importing = false; getDb().pragma('busy_timeout=5000'); res.status(400).json({ error: error.message }); }
  });
  // Completed/failed temporary packages expire; database backups are retained separately.
  const cleanup = setInterval(() => {
    for (const [id, job] of jobs) if (Date.now() - job.createdAt > 24 * 60 * 60 * 1000 && !['running', 'uploading'].includes(job.status)) {
      fs.rmSync(packagePath(job), { force: true }); fs.rmSync(jobPath(id), { force: true }); jobs.delete(id);
    }
  }, 60 * 60 * 1000);
  cleanup.unref();
  return { close: () => clearInterval(cleanup) };
}
