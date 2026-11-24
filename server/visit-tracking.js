export function ensureVisitTrackingSchema(db) {
  // Keep historical records; only new client events carry a deduplication ID.
  if (!db.prepare('PRAGMA table_info(visit_logs)').all().some(column => column.name === 'event_id')) db.exec('ALTER TABLE visit_logs ADD COLUMN event_id TEXT');
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS visit_logs_event_id ON visit_logs(event_id) WHERE event_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS site_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT UNIQUE NOT NULL, action TEXT NOT NULL,
      path TEXT NOT NULL, ip TEXT, user_agent TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);
}

export function registerVisitTracking(app,{getStateDb}) {
  const record = kind => (req,res) => {
    res.set('Cache-Control','no-store');
    if (req.isAdminActivity) return res.json({success:true,skipped:true});
    const {event_id,path,action} = req.body || {};
    if (typeof path !== 'string' || !path.trim() || path.length > 2000 || [...path].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      || event_id !== undefined && (typeof event_id !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(event_id))) return res.status(400).json({error:'Data kunjungan tidak valid.'});
    if (kind === 'action' && (!event_id || !['qris_view','qris_download'].includes(action) || path !== '/donasi/qris')) return res.status(400).json({error:'Aktivitas tidak valid.'});
    // Never include administrator navigation in public visit totals, even before login.
    if (kind === 'visit' && /^(?:#?\/)?admin(?:[/?]|$)/.test(path)) return res.json({success:true,skipped:true});
    try {
      const db = getStateDb();
      if (!db) return res.status(503).json({error:'Pencatatan belum tersedia.'});
      const result = kind === 'action'
        ? db.prepare('INSERT INTO site_action_logs(event_id,action,path,ip,user_agent) VALUES(?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING').run(event_id,action,path,req.ip,req.headers['user-agent'] || '')
        : db.prepare('INSERT INTO visit_logs(event_id,path,ip,user_agent) VALUES(?,?,?,?) ON CONFLICT(event_id) WHERE event_id IS NOT NULL DO NOTHING').run(event_id || null,path,req.ip,req.headers['user-agent'] || '');
      res.json({success:true,duplicate:result.changes === 0});
    } catch { res.status(503).json({error:'Pencatatan belum tersedia. Silakan coba lagi.'}); }
  };
  app.post('/api/log/visit',record('visit'));
  app.post('/api/log/site-action',record('action'));
}
