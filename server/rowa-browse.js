import {authorDeathDate,compareAuthorDates} from './author-chronology.js';
import {authorInitial,readAuthorInitial,authorInitialCounts} from './author-initials.js';
import {normalizeRowaName} from './rowa-mentions.js';
import {withRowaSources} from './rowa-codes.js';
const fail=message=>{throw Object.assign(Error(message),{status:400});};

export function rowaDeathDate(value){
  const original=String(value||'').trim(),clean=original.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640\u200E\u200F\u061C]/gu,'').replace(/[٠-٩]/gu,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/gu,c=>String(c.charCodeAt(0)-0x6f0)).trim();
  const raw=authorDeathDate(clean);if(raw.kind!=='unknown')return{...raw,original};
  const sameOrAfter=clean.match(/^(\d{1,4})\s*ه?\s*(?:او|أو)\s*بعدها$/u);
  if(sameOrAfter&&Number(sameOrAfter[1])>0){const year=Number(sameOrAfter[1]);return{...authorDeathDate(String(year)),kind:'on-or-after',label:`${year} H atau setelahnya`,original};}
  // Only explicit numeric dates with a clear qualifier/location are mapped.
  // Alternatives, reigns and phrases such as "100 و بضع عشرة" remain unknown.
  const match=clean.match(/^(?:(بعد|قبل|نحو|حوالي)\s+)?(\d{1,4})\s*ه?\s*(تقريبا)?(?:\s+(?:ب|في|فى)\s+[\p{L}\s]+)?$/u);
  if(match&&Number(match[2])>0&&!/(?:أو|او|قيل|بضع|خلافة)/u.test(clean)){
    const date=authorDeathDate(`${match[1]|| (match[3]?'نحو':'')} ${match[2]}`.trim());return{...date,original};
  }
  return{...raw,original};
}

export function createRowaBrowser(getDb){
  let cache=null;
  const rows=()=>{
    const db=getDb();if(!db)throw Object.assign(Error('Database perawi belum tersedia.'),{status:503});
    const version=db.pragma('data_version',{simple:true});if(cache?.db===db&&cache.version===version&&Date.now()-cache.at<15000)return cache.rows;
    const columns=new Set(db.prepare('PRAGMA table_info(rowa)').all().map(c=>c.name));
    const fields=['id','Name','A_esm','IsoName','A_kona','ROTBA','R_ZAHBI','birth','death','WHO'].map(c=>columns.has(c)?`"${c}"`:`NULL AS "${c}"`).join(',');
    const biography=columns.has('AQUAL')?"CASE WHEN length(trim(coalesce(AQUAL,'')))>0 THEN 1 ELSE 0 END":'0';
    const result=db.prepare(`SELECT ${fields},${biography} AS hasBiography FROM rowa`).all().map(row=>{
      const name=[row.A_esm,row.Name,row.IsoName].find(v=>typeof v==='string'&&v.trim())?.trim()||'Nama tidak tersedia';
      return{...withRowaSources(row),name,hasBiography:!!row.hasBiography,deathDate:rowaDeathDate(row.death),searchNames:[row.A_esm,row.Name,row.IsoName,row.A_kona].filter(Boolean).map(normalizeRowaName)};
    });
    cache={db,version,at:Date.now(),rows:result};return result;
  };
  return query=>{
    const everyone=rows(),q=String(query.q||'').trim().slice(0,200),words=normalizeRowaName(q).split(' ').filter(Boolean),initial=readAuthorInitial(query.initial),century=String(query.century||''),year=String(query.year||'');
    if(century&&century!=='unknown'&&!/^[1-9]\d?$/.test(century))fail('Pilihan abad tidak valid.');
    if(year&&!/^(?:year-[1-9]\d{0,3}|century-[1-9]\d?|unknown)$/.test(year))fail('Pilihan waktu tidak valid.');
    const page=Number(query.page||1),limit=Math.min(50,Number(query.limit||24));if(!Number.isSafeInteger(page)||page<1||page>10000||!Number.isSafeInteger(limit)||limit<1)fail('Halaman perawi tidak valid.');
    let all=everyone.filter(row=>!words.length||(q.includes('"')?row.searchNames.some(n=>(' '+n+' ').includes(' '+words.join(' ')+' ')):words.every(word=>row.searchNames.some(n=>(' '+n+' ').includes(' '+word+' ')))));
    const eraRows=initial?all.filter(row=>authorInitial(row.name)===initial):all,eraCounts=new Map();for(const row of eraRows){const c=row.deathDate.century;if(c)eraCounts.set(c,(eraCounts.get(c)||0)+1);}
    const unknownDates=eraRows.filter(r=>r.deathDate.kind==='unknown').length;
    if(century)all=all.filter(row=>century==='unknown'?row.deathDate.kind==='unknown':row.deathDate.century===Number(century));
    const initials=authorInitialCounts(all);if(initial)all=all.filter(row=>authorInitial(row.name)===initial);
    const groups=new Map();
    for(const row of [...all].sort(compareAuthorDates)){
      const date=row.deathDate,key=date.year!==null?`year-${date.year}`:date.kind==='unknown'?'unknown':`century-${date.century}`;
      if(!groups.has(key))groups.set(key,{key,label:date.year!==null?`${date.year} H`:date.kind==='unknown'?'Tahun belum terpetakan':date.label,count:0});groups.get(key).count++;
    }
    const ordered=[...groups.values()];
    if(query.timeline==='1'){
      if(query.start!==undefined&&!/^\d+$/.test(String(query.start)))fail('Rentang linimasa tidak valid.');
      const selected=year?ordered.findIndex(g=>g.key===year):-1;
      const start=Math.min(Math.max(0,ordered.length-10),query.start===undefined?selected>=0?Math.max(0,selected-4):Math.floor(ordered.length/2/10)*10:Number(query.start));
      return{browseVersion:1,groups:ordered.slice(start,start+10),start,end:Math.min(start+10,ordered.length),totalGroups:ordered.length};
    }
    const selectedYear=year?groups.get(year)||{key:year,label:'Waktu pilihan',count:0}:null;
    if(year)all=all.filter(row=>{const d=row.deathDate;return year===(d.year!==null?`year-${d.year}`:d.kind==='unknown'?'unknown':`century-${d.century}`);});
    all.sort(query.sort==='death'?compareAuthorDates:(a,b)=>a.name.localeCompare(b.name,'ar')||a.id-b.id);
    return{browseVersion:1,data:all.slice((page-1)*limit,page*limit).map(({searchNames:_searchNames,...row})=>row),total:all.length,totalPages:Math.ceil(all.length/limit),page,limit,initial,initials,selectedYear,
      eras:[...eraCounts].sort((a,b)=>a[0]-b[0]).map(([century,count])=>({century,count})),unknownDates,
      overview:{narrators:everyone.length,dated:everyone.filter(r=>r.deathDate.kind!=='unknown').length,biographies:everyone.filter(r=>r.hasBiography).length}};
  };
}
export function registerRowaBrowser(app,getDb){
  const browse=createRowaBrowser(getDb);app.get('/api/rowa/browse',(req,res)=>{try{res.set('Cache-Control','no-store').json(browse(req.query));}catch(e){res.status(e.status||503).json({browseVersion:1,error:e.status?e.message:'Kamus perawi belum dapat dimuat.'});}});
}
