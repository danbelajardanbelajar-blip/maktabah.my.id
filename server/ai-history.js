import crypto from 'node:crypto';

const COOKIE='maktabah_ai';
const SESSION=Symbol('ai-browser-session');
// Admin-only audit trail: enough of the cited sources to check an answer without re-running the AI.
export function auditMeta(payload={}) {
  return {
    mode:payload.mode||null,
    reviewed:payload.reviewed===true,
    references:(Array.isArray(payload.references)?payload.references:[]).map(r=>({bkid:r?.bkid??null,pageId:r?.pageId??null,title:typeof r?.title==='string'?r.title:'',juz:r?.juz??null,page:r?.page??null,excerpt:typeof r?.excerpt==='string'?r.excerpt:''})),
    quotes:(Array.isArray(payload.evidence?.quotes)?payload.evidence.quotes:[]).map(q=>({source:q?.source??null,text:typeof q?.text==='string'?q.text:''})),
    // Why an answer ended unverified, with the sources that were checked (admin history only).
    ...(payload.rejection?{rejection:{stage:String(payload.rejection.stage||''),reason:String(payload.rejection.reason||'').slice(0,800),
      references:(Array.isArray(payload.rejection.references)?payload.rejection.references:[]).slice(0,8).map(r=>({bkid:r?.bkid??null,pageId:r?.pageId??null,title:typeof r?.title==='string'?r.title:'',juz:r?.juz??null,page:r?.page??null,excerpt:typeof r?.excerpt==='string'?r.excerpt.slice(0,1500):''}))}}:{}),
  };
}
export function registerAiHistory(app,{getStateDb}) {
  const db=getStateDb();
  if(db?.prepare("SELECT 1 FROM sqlite_master WHERE name='ask_logs'").get()) {
    if(!db.prepare('PRAGMA table_info(ask_logs)').all().some(c=>c.name==='session_id'))db.exec('ALTER TABLE ask_logs ADD COLUMN session_id TEXT');
    if(!db.prepare('PRAGMA table_info(ask_logs)').all().some(c=>c.name==='context_json'))db.exec('ALTER TABLE ask_logs ADD COLUMN context_json TEXT');
    if(!db.prepare('PRAGMA table_info(ask_logs)').all().some(c=>c.name==='meta_json'))db.exec('ALTER TABLE ask_logs ADD COLUMN meta_json TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS ask_logs_session ON ask_logs(session_id)');
  }
  const session=(req,res,create=false)=>{
    if(req[SESSION])return req[SESSION];
    const raw=String(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    let token=raw && /^[a-f0-9]{64}$/.test(raw)?raw:null;
    if(!token && create) {
      token=crypto.randomBytes(32).toString('hex');
      res.append('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${req.secure?'; Secure':''}`);
    }
    if(!token)return null;
    req[SESSION]=crypto.createHash('sha256').update(token).digest('hex');return req[SESSION];
  };
  const record=(req,res,question,response,context={},payload)=>{
    try {getStateDb()?.prepare('INSERT INTO ask_logs(question,response,ip,user_agent,session_id,context_json,meta_json) VALUES(?,?,?,?,?,?,?)').run(question,response,req.ip,req.headers['user-agent']||'',session(req,res,true),JSON.stringify(context),payload?JSON.stringify(auditMeta(payload)):null);} catch { /* History cannot discard a successful answer. */ }
  };
  app.get('/api/recent-questions',(req,res)=>{
    res.set('Cache-Control','no-store');
    const id=session(req,res);
    if(!id)return res.json({data:[]});
    try {
      const rows=getStateDb()?.prepare('SELECT question,context_json FROM ask_logs WHERE session_id=? AND length(trim(question))>=2 ORDER BY rowid DESC LIMIT 200').all(id)||[];
      const limit=Math.min(20,Math.max(1,parseInt(req.query.limit)||10)),seen=new Set(),data=[];
      for(const row of rows){let context={};try{context=JSON.parse(row.context_json||'{}');}catch{}const key=JSON.stringify([row.question.trim().toLowerCase(),context]);if(!seen.has(key)){seen.add(key);data.push({query:row.question,...context});if(data.length>=limit)break;}}
      res.json({data});
    } catch {res.status(503).json({data:[],error:'Riwayat belum dapat dimuat. Silakan coba lagi.'});}
  });
  return {session,record};
}
