export const libraryLogTables = {hadith:'hadith_logs', authors:'authors_logs'};
const actions = new Set(['browse','search','profile','timeline','read_book','book_detail','edition','timeline_year']);
const contextKeys = ['mode','group','group_name','book','edition','matching','available','page','page_id','part','source_page','century','initial','sort','view','start','end','total','total_pages','total_groups','has_more','author_id','author_name','year'];
const text = (value, max) => typeof value === 'string' ? value.replace(/\p{Cc}/gu,char=>'\t\n\r'.includes(char)?char:'').slice(0,max) : '';

export function sanitizeLibraryActivity(event) {
  if (!event || !actions.has(event.action)) throw new Error('Jenis aktivitas tidak valid.');
  const context = {};
  for (const key of contextKeys) {
    const value = event.context?.[key];
    if (typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) context[key] = value;
    else if (typeof value === 'string') context[key] = text(value, key.endsWith('name') ? 300 : 120);
  }
  return {action:event.action, query:text(event.query,500),
    target_id:Number.isSafeInteger(event.target_id) && event.target_id > 0 ? event.target_id : null,
    target_name:text(event.target_name,500),
    result_count:Number.isSafeInteger(event.result_count) && event.result_count >= 0 ? event.result_count : null,
    context:JSON.stringify(context)};
}

export function createLibraryActivity(getStateDb) {
  const changes = new WeakMap();
  let initialized;
  function initialize() {
    const db = getStateDb();
    if (!db) return null;
    if (initialized !== db) {
      for (const table of Object.values(libraryLogTables)) db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
        id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, query TEXT, target_id INTEGER, target_name TEXT,
        result_count INTEGER, context TEXT NOT NULL DEFAULT '{}', ip TEXT, user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
      ); CREATE INDEX IF NOT EXISTS ${table}_created_at ON ${table}(created_at);`);
      initialized = db;
    }
    return db;
  }
  function record(feature, req, event) {
    try {
      const table = Object.hasOwn(libraryLogTables,feature) ? libraryLogTables[feature] : null;
      if (!table) return false;
      const db = initialize(); if (!db) return false;
      const row = sanitizeLibraryActivity(event);
      const inserted = db.prepare(`INSERT INTO ${table}(action,query,target_id,target_name,result_count,context,ip,user_agent) VALUES(?,?,?,?,?,?,?,?)`)
        .run(row.action,row.query,row.target_id,row.target_name,row.result_count,row.context,text(req.ip,100),text(req.headers?.['user-agent'],1000));
      changes.set(db,(changes.get(db)||0)+inserted.changes);
      return true;
    } catch { return false; /* Analytics must not interrupt reading or searching. */ }
  }
  try { initialize(); } catch { /* Retry on the next activity if storage is temporarily unavailable. */ }
  return {record, initialize, changesFor:db=>changes.get(db)||0};
}

export function registerLibraryActivity(app, {activity, getBook, isBusy = () => false, now = Date.now}) {
  const limits = new Map();
  app.post('/api/log/library/:feature', (req,res) => {
    const feature = req.params.feature, event = req.body;
    const allowed = feature === 'hadith' ? ['browse','search','read_book','book_detail','edition'] : feature === 'authors' ? ['read_book','book_detail','timeline_year'] : [];
    if (!allowed.includes(event?.action) || event.action === 'search' && event.context?.mode !== 'catalog') return res.status(400).json({error:'Aktivitas tidak valid.'});
    if (isBusy()) return res.status(409).json({error:'Pencatatan ditunda selama pembaruan database.'});
    const ip = req.ip || 'unknown', previous = limits.get(ip);
    if (previous && now()-previous.at < 60000 && previous.count >= 120) return res.status(429).json({error:'Terlalu banyak aktivitas.'});
    if (!previous || now()-previous.at >= 60000) {
      if (limits.size >= 2000) limits.delete(limits.keys().next().value);
      limits.set(ip,{at:now(),count:1});
    } else previous.count++;
    try {
      const clean = sanitizeLibraryActivity(event);
      let targetName = clean.target_name;
      if (['read_book','book_detail','edition'].includes(clean.action)) {
        if (!clean.target_id) return res.status(400).json({error:'ID kitab tidak valid.'});
        const book = getBook(clean.target_id);
        if (!book) return res.status(404).json({error:'Kitab tidak ditemukan.'});
        targetName = book.bk;
      }
      const success = activity.record(feature,req,{...event,target_name:targetName});
      res.status(success ? 200 : 503).json({success});
    } catch { res.status(400).json({error:'Data aktivitas tidak valid.'}); }
  });
}
