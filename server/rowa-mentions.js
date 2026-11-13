const invalid=message=>{throw Object.assign(Error(message),{status:400});};
export const normalizeRowaName=text=>String(text||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/gu,'').replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/u).map(w=>w==='ابن'?'بن':['ابي','ابا'].includes(w)?'ابو':w).join(' ');
const stops=new Set(['اخو','والد','مولى','مولي','نزيل','صاحب','ويقال','وقيل','قيل','نسب','يقال']);
const base=text=>{
  const words=normalizeRowaName(String(text||'').split(/[،,:：()（）]/u)[0]).split(' '),end=words.findIndex(w=>stops.has(w));
  return (end<0?words:words.slice(0,end)).filter(Boolean).slice(0,20);
};
export function createRowaNames(rows){
  const people=new Map(),aliases=new Map();
  const add=(words,id,min=3)=>{
    for(let count=min;count<=Math.min(words.length,16);count++){
      if(['بن','ابو','عبد'].includes(words[count-1]))continue;
      const key=words.slice(0,count).join(' ');if(!aliases.has(key))aliases.set(key,new Set());aliases.get(key).add(id);
    }
  };
  for(const row of rows){
    if(!Number.isSafeInteger(row.id)||row.id<1)continue;
    const names=[row.A_esm,row.Name,row.IsoName].filter(s=>typeof s==='string'&&s.trim());if(!names.length)continue;
    const name=names[0].trim();people.set(row.id,{id:row.id,name,ROTBA:row.ROTBA||'',R_ZAHBI:row.R_ZAHBI||'',birth:row.birth||'',death:row.death||'',bases:names.map(n=>base(n).join(' '))});
    for(const value of names){const words=base(value);add(words,row.id,words[0]==='ابو'&&words[1]!=='عبد'?2:3);
      for(const segment of value.split(/[،,:：]/u)){const kunya=base(segment);if(kunya[0]==='ابو')add(kunya,row.id,kunya[1]==='عبد'?3:2);}
    }
    if(row.A_kona){const words=base(row.A_kona);if(words[0]==='ابو')add(words,row.id,words[1]==='عبد'?3:2);}
  }
  function mentions(text){
    const tokens=[...text.matchAll(/[\p{L}\p{N}\u064B-\u065F\u0670\u0640]+/gu)].map(m=>({raw:m[0],word:normalizeRowaName(m[0]),start:m.index,end:m.index+m[0].length})),result=[];
    for(let i=0;i<tokens.length&&result.length<100;i++){
      let found=null;for(let length=Math.min(16,tokens.length-i);length>=2;length--){const slice=tokens.slice(i,i+length);
        if(slice.some((token,j)=>j>0&&!/^\s*$/u.test(text.slice(slice[j-1].end,token.start))))continue;
        const key=slice.map(t=>t.word).join(' '),ids=aliases.get(key);if(ids){found={start:tokens[i].start,end:slice.at(-1).end,label:text.slice(tokens[i].start,slice.at(-1).end),count:ids.size};i+=length-1;break;}}
      if(found)result.push(found);
    }
    return result;
  }
  function candidates(q,page=1){
    const key=base(q).join(' ');if(key.length<2||key.length>250)invalid('Tulis nama perawi yang ingin dicari.');
    if(!Number.isSafeInteger(page)||page<1||page>500)invalid('Halaman kandidat tidak valid.');
    const exact=aliases.get(key),all=exact?[...exact].map(id=>people.get(id)):[...people.values()].filter(p=>p.bases.some(b=>(' '+b+' ').includes(' '+key+' ')));
    all.sort((a,b)=>a.name.localeCompare(b.name,'ar')||a.id-b.id);
    return{data:all.slice((page-1)*20,page*20).map(({bases,...p})=>p),total:all.length,page,totalPages:Math.ceil(all.length/20)};
  }
  return{mentions,candidates};
}
export function registerRowaMentions(app,getDb){
  let cache=null;
  const names=()=>{
    const db=getDb();if(!db)throw Object.assign(Error('Database perawi belum tersedia.'),{status:503});
    const version=db.pragma('data_version',{simple:true});if(cache?.db===db&&cache.version===version&&Date.now()-cache.at<15000)return cache.index;
    const columns=new Set(db.prepare('PRAGMA table_info(rowa)').all().map(c=>c.name));
    const fields=['id','Name','A_esm','IsoName','A_kona','ROTBA','R_ZAHBI','birth','death'].map(c=>columns.has(c)?`"${c}"`:`NULL AS "${c}"`).join(',');
    const index=createRowaNames(db.prepare(`SELECT ${fields} FROM rowa`).all());cache={db,version,at:Date.now(),index};return index;
  };
  app.post('/api/rowa/mentions',(req,res)=>{
    try{const texts=req.body?.texts;if(!Array.isArray(texts)||texts.length>30||texts.some(t=>typeof t!=='string'||t.length>60000)||texts.reduce((n,t)=>n+t.length,0)>60000)invalid('Teks untuk pengenalan nama terlalu panjang.');
      res.set('Cache-Control','no-store').json({data:texts.map(text=>names().mentions(text)),basis:'name-match'});
    }catch(e){res.status(e.status||503).json({error:e.status?e.message:'Kamus perawi belum dapat diperiksa.'});}
  });
  app.get('/api/rowa/name-candidates',(req,res)=>{
    try{res.set('Cache-Control','no-store').json(names().candidates(String(req.query.q||'').slice(0,250),Number(req.query.page||1)));}
    catch(e){res.status(e.status||503).json({error:e.status?e.message:'Profil perawi belum dapat dicari.'});}
  });
}
