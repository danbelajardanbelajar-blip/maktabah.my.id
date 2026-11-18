const tables={search:'search_logs',ask:'ask_logs',visit:'visit_logs',download:'download_logs',quran:'quran_logs',rowa:'rowa_logs',hadith:'hadith_logs',authors:'authors_logs'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const column=(name,columns)=>columns.has(name)?`COALESCE(CAST(${name} AS TEXT),'')`:"''";
function definitions(db,type) {
  if(!Object.hasOwn(tables,type))throw fail('Jenis log tidak valid.');
  const table=tables[type],columns=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name));
  const query=column('query',columns),question=column('question',columns),ip=column('ip',columns);
  const page=type==='visit'?column('path',columns):type==='download'?column('book_title',columns):type==='quran'?"'Surah #' || COALESCE(surah_id,'')":type==='rowa'?"COALESCE(rowa_name,'Perawi') || ' (ID: ' || COALESCE(rowa_id,'') || ')'":['hadith','authors'].includes(type)?
    "CASE WHEN target_id IS NOT NULL AND action IN ('read_book','book_detail','profile') THEN CASE WHEN action='profile' THEN 'Penulis #' ELSE 'Kitab #' END || target_id || CASE WHEN json_valid(context) AND json_extract(CASE WHEN json_valid(context) THEN context ELSE '{}' END,'$.page_id') IS NOT NULL THEN ' · halaman #' || json_extract(CASE WHEN json_valid(context) THEN context ELSE '{}' END,'$.page_id') ELSE '' END ELSE '' END":
    type==='ask'&&columns.has('context_json')?"CASE WHEN json_valid(context_json) AND json_extract(CASE WHEN json_valid(context_json) THEN context_json ELSE '{}' END,'$.source.bookId') IS NOT NULL THEN 'Kitab #' || json_extract(CASE WHEN json_valid(context_json) THEN context_json ELSE '{}' END,'$.source.bookId') || ' · halaman #' || COALESCE(json_extract(CASE WHEN json_valid(context_json) THEN context_json ELSE '{}' END,'$.source.pageId'),'') ELSE '' END":"''";
  // Only groups this log actually records: searches in search logs, questions in Tanya AI logs, pages/books
  // where a page column exists. A group without a source column would always be empty.
  const dimensions={};
  if(columns.has('query'))dimensions.query=`LOWER(TRIM(${query}))`;
  if(columns.has('question'))dimensions.question=`LOWER(TRIM(${question}))`;
  if(page!=="''")dimensions.page=`TRIM(${page})`;
  if(columns.has('ip'))dimensions.ip=`TRIM(${ip})`;
  let answeredCond=null,failedCond=null;
  if(type==='ask'){
    const hasMeta=columns.has('meta_json');
    answeredCond=hasMeta
      ? `((json_valid(meta_json) AND json_extract(meta_json, '$.mode') IN ('grounded', 'catalogue')) OR ((meta_json IS NULL OR NOT json_valid(meta_json)) AND NOT (response LIKE '%belum dapat memastikan%' OR response LIKE '%belum menemukan teks%' OR response LIKE '%tidak menemukan teks%' OR response LIKE '%لم أتمكن من التحقق%' OR response LIKE '%لم أجد نصا%' OR TRIM(COALESCE(response, '')) = '')))`
      : `NOT (response LIKE '%belum dapat memastikan%' OR response LIKE '%belum menemukan teks%' OR response LIKE '%tidak menemukan teks%' OR response LIKE '%لم أتمكن من التحقق%' OR response LIKE '%لم أجد نصا%' OR TRIM(COALESCE(response, '')) = '')`;
    failedCond=hasMeta
      ? `((json_valid(meta_json) AND (json_extract(meta_json, '$.mode') = 'no_context' OR json_extract(meta_json, '$.rejection') IS NOT NULL)) OR ((meta_json IS NULL OR NOT json_valid(meta_json)) AND (response LIKE '%belum dapat memastikan%' OR response LIKE '%belum menemukan teks%' OR response LIKE '%tidak menemukan teks%' OR response LIKE '%لم أتمكن من التحقق%' OR response LIKE '%لم أجد نصا%' OR TRIM(COALESCE(response, '')) = '')))`
      : `(response LIKE '%belum dapat memastikan%' OR response LIKE '%belum menemukan teks%' OR response LIKE '%tidak menemukan teks%' OR response LIKE '%لم أتمكن من التحقق%' OR response LIKE '%لم أجد نصا%' OR TRIM(COALESCE(response, '')) = '')`;
  }
  return {table,columns,dimensions,answeredCond,failedCond};
}
function filtersFor(def,raw={}) {
  const value=(key,max=250)=>{const value=raw[key]??'';if(typeof value!=='string'||value.length>max)throw fail('Filter log tidak valid.');return value.trim();};
  const filters={q:value('q',200),dimension:value('dimension',20),value:value('value',2000),action:value('action',40),outcome:value('outcome',20),status:value('status',20),from:value('from',10),to:value('to',10)};
  const conditions=[],params=[];
  if(filters.q){
    const fields=['query','question','response','path','book_title','rowa_name','target_name','context','ip','user_agent'].filter(c=>def.columns.has(c));
    conditions.push('('+fields.map(c=>`${c} LIKE ? ESCAPE '\\'`).join(' OR ')+')');
    params.push(...fields.map(()=>'%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%'));
  }
  if(filters.dimension){
    if(!Object.hasOwn(def.dimensions,filters.dimension)||!filters.value)throw fail('Kelompok ringkasan tidak valid.');
    conditions.push(`${def.dimensions[filters.dimension]}=?`);params.push(filters.value);
  } else if(filters.value)throw fail('Pilih jenis kelompok ringkasan.');
  if(filters.action){if(!def.columns.has('action'))throw fail('Filter aktivitas tidak tersedia.');conditions.push('action=?');params.push(filters.action);}
  if(filters.outcome){
    if(!['zero','positive','unknown'].includes(filters.outcome)||!def.columns.has('result_count'))throw fail('Filter hasil tidak tersedia.');
    conditions.push(filters.outcome==='zero'?'result_count=0':filters.outcome==='positive'?'result_count>0':'result_count IS NULL');
  }
  if(filters.status){
    if(!def.answeredCond||!['answered','failed'].includes(filters.status))throw fail('Filter status tidak tersedia.');
    conditions.push(filters.status==='answered'?def.answeredCond:def.failedCond);
  }
  for(const key of ['from','to'])if(filters[key]){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(filters[key])||!Number.isFinite(Date.parse(filters[key]))||new Date(filters[key]).toISOString().slice(0,10)!==filters[key])throw fail('Tanggal filter tidak valid.');
    conditions.push(`created_at ${key==='from'?'>=':'<'} datetime(?, '${key==='from'?'-7 hours':'+17 hours'}')`);params.push(filters[key]);
  }
  if(filters.from&&filters.to&&filters.from>filters.to)throw fail('Rentang tanggal tidak valid.');
  return {filters,conditions,params,where:conditions.length?' WHERE '+conditions.join(' AND '):''};
}
const integer=(value,fallback,max)=>{if(value===undefined)return fallback;if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>max)throw fail('Pagination tidak valid.');return Number(value);};

export function readAdminLogs(db,type,raw={}) {
  return db.transaction(()=>{
  const def=definitions(db,type),f=filtersFor(def,raw);
  const limit=integer(raw.limit,20,500),requested=integer(raw.page,1,10000000);
  const stats=db.prepare(`SELECT COUNT(*) total,
    COALESCE(SUM(created_at>=datetime('now','-1 day')),0) today,
    COALESCE(SUM(created_at>=datetime('now','-7 days')),0) weekly,
    COALESCE(SUM(created_at>=datetime('now','-30 days')),0) monthly,
    COUNT(DISTINCT NULLIF(TRIM(ip),'')) unique_ips FROM ${def.table}`).get();
  if(type==='ask'){
    const askStats=db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN ${def.answeredCond} THEN 1 ELSE 0 END),0) answered,
      COALESCE(SUM(CASE WHEN ${def.failedCond} THEN 1 ELSE 0 END),0) failed,
      COALESCE(SUM(CASE WHEN created_at>=datetime('now','-1 day') AND (${def.answeredCond}) THEN 1 ELSE 0 END),0) answered_today,
      COALESCE(SUM(CASE WHEN created_at>=datetime('now','-1 day') AND (${def.failedCond}) THEN 1 ELSE 0 END),0) failed_today
    FROM ${def.table}`).get();
    stats.answered=askStats.answered;
    stats.failed=askStats.failed;
    stats.answered_today=askStats.answered_today;
    stats.failed_today=askStats.failed_today;
  }
  const scope=db.prepare(`SELECT COUNT(*) total,COALESCE(MAX(id),0) snapshot FROM ${def.table}${f.where}`).get(...f.params);
  const page=Math.min(requested,Math.max(1,Math.ceil(scope.total/limit)));
  const data=db.prepare(`SELECT * FROM ${def.table}${f.where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...f.params,limit,(page-1)*limit);
  const top={};
  for(const [kind,expr] of Object.entries(def.dimensions)){
    top[kind]=db.prepare(`SELECT ${expr} value,COUNT(*) count FROM ${def.table}${f.where}${f.where?' AND ':' WHERE '} ${expr}<>'' GROUP BY ${expr} ORDER BY count DESC,value ASC LIMIT 5`).all(...f.params);
  }
  return {data,stats,top,total:scope.total,snapshotId:scope.snapshot,page,limit,filters:f.filters,capabilities:{action:def.columns.has('action'),outcome:def.columns.has('result_count'),status:Boolean(def.answeredCond)}};
  }).deferred();
}

export function deleteAdminLogs(db,type,body={}) {
  const def=definitions(db,type);
  if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Data penghapusan tidak valid.');
  if(Array.isArray(body.ids)){
    if(body.filters||body.ids.length<1||body.ids.length>500||body.ids.some(id=>!Number.isSafeInteger(id)||id<1))throw fail('Pilih 1–500 ID log yang valid.');
    const ids=[...new Set(body.ids)];
    return db.transaction(()=>({deleted:db.prepare(`DELETE FROM ${def.table} WHERE id IN (${ids.map(()=>'?').join(',')})`).run(...ids).changes}))();
  }
  const f=filtersFor(def,body.filters);
  if(!body.filters||!f.conditions.length||body.confirm!=='DELETE_MATCHING_LOGS'||!Number.isSafeInteger(body.throughId)||body.throughId<1||!Number.isSafeInteger(body.expectedCount)||body.expectedCount<1)throw fail('Pratinjau dan konfirmasi filter diperlukan.');
  const where=f.where+' AND id<=?';
  return db.transaction(()=>{
    const count=db.prepare(`SELECT COUNT(*) n FROM ${def.table}${where}`).get(...f.params,body.throughId).n;
    if(count!==body.expectedCount)throw fail('Catatan berubah. Muat ulang pratinjau sebelum menghapus.',409);
    return {deleted:db.prepare(`DELETE FROM ${def.table}${where}`).run(...f.params,body.throughId).changes};
  })();
}

export function registerAdminLogs(app,{getStateDb,requireAdmin,isBusy=()=>false}) {
  app.get('/api/admin/logs/:type',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store');
    try{res.json(readAdminLogs(getStateDb(),req.params.type,req.query));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Riwayat log belum dapat dimuat.'});}
  });
  app.delete('/api/admin/logs/:type',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store');
    if(isBusy())return res.status(409).json({error:'Tunggu pembaruan atau transfer database selesai.'});
    try{res.json(deleteAdminLogs(getStateDb(),req.params.type,req.body));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Log belum dapat dihapus.'});}
  });
}
