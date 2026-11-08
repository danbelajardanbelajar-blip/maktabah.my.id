import crypto from 'node:crypto';

const COOKIE='maktabah_ai';
const SESSION=Symbol('ai-browser-session');
export function registerAiHistory(app,{getStateDb}) {
  const db=getStateDb();
  if(db?.prepare("SELECT 1 FROM sqlite_master WHERE name='ask_logs'").get()) {
    if(!db.prepare('PRAGMA table_info(ask_logs)').all().some(c=>c.name==='session_id'))db.exec('ALTER TABLE ask_logs ADD COLUMN session_id TEXT');
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
  const record=(req,res,question,response)=>{
    try {getStateDb()?.prepare('INSERT INTO ask_logs(question,response,ip,user_agent,session_id) VALUES(?,?,?,?,?)').run(question,response,req.ip,req.headers['user-agent']||'',session(req,res,true));} catch { /* History cannot discard a successful answer. */ }
  };
  app.get('/api/recent-questions',(req,res)=>{
    res.set('Cache-Control','no-store');
    const id=session(req,res);
    if(!id)return res.json({data:[]});
    try {
      const rows=getStateDb()?.prepare('SELECT question FROM ask_logs WHERE session_id=? AND length(trim(question))>=5 ORDER BY rowid DESC LIMIT 200').all(id)||[];
      const limit=Math.min(20,Math.max(1,parseInt(req.query.limit)||10)),seen=new Set(),data=[];
      for(const row of rows){const key=row.question.trim().toLowerCase();if(!seen.has(key)){seen.add(key);data.push({query:row.question});if(data.length>=limit)break;}}
      res.json({data});
    } catch {res.status(503).json({data:[],error:'Riwayat belum dapat dimuat. Silakan coba lagi.'});}
  });
  return {session,record};
}
