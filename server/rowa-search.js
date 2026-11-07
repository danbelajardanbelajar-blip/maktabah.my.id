export function searchRowa(db, query, {buildFtsMatch,buildLikeMatch}) {
  const q=String(query.q || '').trim();
  const page=Math.max(1,parseInt(query.page)||1);
  const limit=Math.min(50,Math.max(1,parseInt(query.limit)||20));
  const response={data:[],total:0,page,limit,totalPages:0,error:null};
  if(!q)return response;
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rowa'").get()) {
    throw Object.assign(new Error('Tabel data perawi tidak tersedia di database ini.'),{status:503});
  }
  const columns=db.prepare('PRAGMA table_info(rowa)').all().map(c=>c.name);
  const iso=columns.includes('IsoName');
  const kutub=['kutub','Kutub','books'].find(name=>columns.includes(name));
  const fields=`r.id,r.Name,r.A_esm,${iso?'r.IsoName':'NULL AS IsoName'},r.A_kona,r.ROTBA,r.R_ZAHBI,r.birth,r.death${kutub?`,r.${kutub} AS kutub`:''}`;
  const offset=(page-1)*limit;
  const {exactPhrase,andMatch}=buildFtsMatch(q);
  const ftsExists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rowa_fts'").get();
  let usedFts=false;
  if(ftsExists && (exactPhrase || andMatch)) {
    try {
      // Include exact full-name matches as well as names whose words are separated.
      const match=exactPhrase && andMatch?`(${exactPhrase}) OR (${andMatch})`:exactPhrase || andMatch;
      const from='FROM rowa_fts f JOIN rowa r ON f.rowid=r.id WHERE rowa_fts MATCH ?';
      response.total=db.prepare(`SELECT COUNT(*) AS c ${from}`).get(match).c;
      response.data=db.prepare(`SELECT ${fields} ${from} ORDER BY r.id LIMIT ? OFFSET ?`).all(match,limit,offset);
      usedFts=true;
    } catch { /* Existing databases without a usable FTS index use the LIKE fallback. */ }
  }
  if(!usedFts) {
    const like=`%${buildLikeMatch(q)}%`;
    const where=`r.Name LIKE ? OR r.A_esm LIKE ?${iso?' OR r.IsoName LIKE ?':''}`;
    const params=iso?[like,like,like]:[like,like];
    response.total=db.prepare(`SELECT COUNT(*) AS c FROM rowa r WHERE ${where}`).get(...params).c;
    response.data=db.prepare(`SELECT ${fields} FROM rowa r WHERE ${where} ORDER BY r.id LIMIT ? OFFSET ?`).all(...params,limit,offset);
  }
  response.totalPages=Math.ceil(response.total/limit);
  return response;
}
