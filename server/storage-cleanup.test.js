import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { planStorageCleanup, registerStorageCleanup } from './storage-cleanup.js';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'maktabah-cleanup-'));
  const directory = path.join(base, 'large-transfer'), backups = path.join(base, 'book-import-backups'), dbPath = path.join(base, 'maktabah.db');
  fs.mkdirSync(directory); fs.mkdirSync(backups); fs.writeFileSync(dbPath, 'original database');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const old = path.join(backups, 'before-import-1.db'), latest = path.join(backups, 'before-import-2.db');
  fs.writeFileSync(old, 'old backup'); fs.utimesSync(old, 100, 100);
  fs.writeFileSync(latest, 'newest backup'); fs.utimesSync(latest, 200, 200);
  const jobs = new Map();
  const add = (char, status, createdAt = Date.now()) => {
    const id = char.repeat(48), job = { id, status, kind: 'import', createdAt };
    jobs.set(id, job); fs.writeFileSync(path.join(directory, `${id}.db`), 'package');
    fs.writeFileSync(path.join(directory, `${id}.json`), JSON.stringify(job)); return id;
  };
  const done = add('a', 'done'), failed = add('b', 'failed'), ready = add('c', 'ready'), running = add('d', 'running');
  const expired = add('e', 'ready', Date.now() - 90000000), downloading = add('f', 'ready', Date.now() - 90000000);
  fs.writeFileSync(path.join(backups, 'unrelated.db'), 'keep'); fs.writeFileSync(path.join(directory, 'untracked.db'), 'keep');
  return { base, dbPath, directory, backups, jobs, old, latest, done, failed, ready, running, expired, downloading, protectedIds: new Set([downloading]) };
}

test('cleanup plan retains latest backup, active/ready/downloading packages, unknown files and live database', t => {
  const f = fixture(t), plan = planStorageCleanup(f);
  assert.equal(plan.backupFiles, 1); assert.equal(plan.transferFiles, 3);
  assert.equal(plan.retainedBackup, path.basename(f.latest));
  for (const retained of [f.dbPath, f.latest, path.join(f.backups, 'unrelated.db'), path.join(f.directory, 'untracked.db'), ...[f.ready,f.running,f.downloading].map(id => path.join(f.directory, `${id}.db`))]) {
    assert.ok(!plan.candidates.some(c => c.filename === retained), retained);
  }
  assert.equal(plan.reclaimableBytes, plan.candidates.reduce((n,c) => n + fs.statSync(c.filename).size, 0));
});

test('cleanup refuses a transfer directory outside the database directory', t => {
  const f = fixture(t);
  assert.throws(() => planStorageCleanup({ ...f, directory: path.dirname(f.base) }), /tidak valid|tautan/);
});

test('cleanup skips symbolic links to files outside its folders', t => {
  const f = fixture(t), link = path.join(f.backups, 'before-import-3.db');
  try { fs.symlinkSync(f.dbPath, link); } catch (e) { if (['EPERM','EACCES'].includes(e.code)) return t.skip('OS does not allow creating symlinks'); throw e; }
  assert.ok(!planStorageCleanup(f).candidates.some(c => c.filename === link));
  assert.equal(planStorageCleanup(f).retainedBackup, path.basename(f.latest));
});

test('admin cleanup validates preview, blocks active work, removes eligible files and invalidates deleted jobs', async t => {
  const f = fixture(t), app = express(); app.use(express.json()); let busy = true;
  registerStorageCleanup(app, { ...f, getDbPath: () => f.dbPath, isBusy: () => busy, localExportMode: false,
    requireAdmin: (req,res,next) => req.headers.authorization === 'Bearer test' ? next() : res.sendStatus(401) });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/storage/cleanup`;
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  const post = planId => fetch(url, { method: 'POST', headers, body: JSON.stringify({ planId }) });
  try {
    assert.equal((await fetch(url)).status,401); assert.equal((await fetch(url,{method:'POST'})).status,401);
    let preview = await (await fetch(url, { headers })).json();
    assert.equal(preview.busy,true); assert.equal((await post(preview.planId)).status,409);
    busy = false;
    fs.appendFileSync(f.old,'changed');
    fs.utimesSync(f.old,100,100);
    assert.equal((await post(preview.planId)).status,409); assert.ok(fs.existsSync(f.old));
    preview = await (await fetch(url,{headers})).json();
    const response = await post(preview.planId); assert.equal(response.status,200);
    const result = await response.json();
    assert.equal(result.success,true); assert.equal(result.deletedFiles,7); assert.deepEqual(result.warnings,[]);
    assert.equal(result.freedBytes,preview.reclaimableBytes); assert.equal(result.reclaimableBytes,0);
    assert.ok(fs.existsSync(f.latest)); assert.ok(!fs.existsSync(f.old));
    assert.equal(fs.readFileSync(f.dbPath,'utf8'),'original database');
    for(const id of [f.done,f.failed,f.expired])assert.ok(!f.jobs.has(id));
    for(const id of [f.ready,f.running,f.downloading])assert.ok(fs.existsSync(path.join(f.directory,`${id}.db`)));
  } finally { await new Promise(r => server.close(r)); }
});

test('local source mode cannot preview or execute cleanup', async t => {
  const f = fixture(t), app = express(); app.use(express.json());
  registerStorageCleanup(app,{...f,getDbPath:()=>f.dbPath,isBusy:()=>false,localExportMode:true,requireAdmin:(req,res,next)=>next()});
  const server = app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const url=`http://127.0.0.1:${server.address().port}/api/admin/storage/cleanup`;
    assert.equal((await fetch(url)).status,403);assert.equal((await fetch(url,{method:'POST'})).status,403);
    assert.ok(fs.existsSync(f.old));
  } finally {await new Promise(r=>server.close(r));}
});
