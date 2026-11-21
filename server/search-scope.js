export const scopedBooksSql=additional=>additional?'(SELECT bkid,bk,cat,authno,inf,betaka FROM main.books_meta UNION ALL SELECT bkid,bk,cat,authno,inf,betaka FROM tambahan.books_meta t WHERE NOT EXISTS(SELECT 1 FROM main.books_meta m WHERE m.bkid=t.bkid))':'main.books_meta';
export const MAX_SCOPE_IDS=1000;
const fail=message=>Object.assign(new Error(message),{status:400});
export function readSearchScope(query){
  if(query.scope===undefined)return null;
  if(!['all','custom'].includes(query.scope))throw fail('Tempat pencarian tidak valid.');
  const read=(key,zero=false)=>{
    const value=query[key];if(value===undefined||value==='')return [];
    if(typeof value!=='string'||value.length>16000||!/^\d+(,\d+)*$/.test(value))throw fail('Daftar tempat pencarian tidak valid.');
    const values=value.split(',').map(Number);
    if(values.length>MAX_SCOPE_IDS||values.some(id=>!Number.isSafeInteger(id)||id<(zero?0:1)))throw fail(`Maksimal ${MAX_SCOPE_IDS} pilihan satuan; pilih kategori untuk mencakup seluruh kitab.`);
    return [...new Set(values)].sort((a,b)=>a-b);
  };
  return {all:query.scope==='all',categories:read('cats',true),excludedCategories:read('notcats',true),books:read('books'),excluded:read('notbooks')};
}
export function searchScopeSql(scope,cat='COALESCE(b.cat,0)',book='b.bkid'){
  if(!scope)return {sql:'(1)',params:[]};
  const params=[];
  const membership=(column,values,not=false)=>{params.push(JSON.stringify(values));return `${column} ${not?'NOT ':''}IN (SELECT value FROM json_each(?))`;};
  let base=scope.all?(scope.excludedCategories.length?membership(cat,scope.excludedCategories,true):'1'):(scope.categories.length?membership(cat,scope.categories):'0');
  if(scope.books.length)base=`(${base} OR ${membership(book,scope.books)})`;
  if(scope.excluded.length)base=`(${base}) AND ${membership(book,scope.excluded,true)}`;
  return {sql:`(${base})`,params};
}
const normalize=text=>String(text??'').normalize('NFKC').replace(/[\p{M}\u0640]/gu,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();
export function registerSearchScope(app,{getDb,hasAdditional,categoriesSql}){
  let cached;
  const catalogue=()=>{
    const db=getDb();if(!db)throw Object.assign(Error('Database belum tersedia.'),{status:503});
    const additional=hasAdditional(),stamp=JSON.stringify([db.pragma('data_version',{simple:true}),db.pragma('schema_version',{simple:true}),additional?db.pragma('tambahan.data_version',{simple:true}):0,additional]);
    if(cached?.db===db&&cached.stamp===stamp&&Date.now()-cached.at<30000)return cached;
    const raw=db.prepare(`SELECT bkid,bk,COALESCE(cat,0) cat FROM main.books_meta ${additional?'UNION ALL SELECT bkid,bk,COALESCE(cat,0) cat FROM tambahan.books_meta t WHERE NOT EXISTS(SELECT 1 FROM main.books_meta m WHERE m.bkid=t.bkid)':''} ORDER BY bk,bkid`).all();
    const grouped=new Map(),byId=new Map();
    for(const row of raw){const book={...row,bk:row.bk?.trim()||`Kitab #${row.bkid}`};byId.set(row.bkid,book);if(!grouped.has(row.cat))grouped.set(row.cat,[]);grouped.get(row.cat).push({...book,find:normalize(book.bk)});}
    const names=new Map(db.prepare(`SELECT id,name FROM ${categoriesSql(additional)}`).all().map(c=>[c.id,c.name]));
    for(const id of grouped.keys())if(!names.has(id))names.set(id,id===0?'Tanpa kategori':`Kategori #${id}`);
    cached={db,stamp,at:Date.now(),grouped,byId,categories:[...names].map(([id,name])=>({id,name,total:grouped.get(id)?.length||0})).sort((a,b)=>a.name.localeCompare(b.name,'ar'))};
    return cached;
  };
  const send=handler=>(req,res)=>{res.set('Cache-Control','no-store');try{res.json(handler(req));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Tempat pencarian belum dapat dimuat.'});}};
  app.get('/api/search-scope',send(req=>{
    const data=catalogue(),q=normalize(typeof req.query.q==='string'?req.query.q.slice(0,200):'');
    const picked=readSearchScope({scope:'custom',books:req.query.ids,notbooks:req.query.excluded});
    const selected=[...new Set([...picked.books,...picked.excluded])];
    return {categories:data.categories.map(category=>({...category,matched:!q||normalize(category.name).includes(q)?category.total:(data.grouped.get(category.id)||[]).filter(b=>b.find.includes(q)).length})),
      books:selected.map(id=>data.byId.get(id)).filter(Boolean)};
  }));
  app.get('/api/search-scope/books',send(req=>{
    const id=Number(req.query.category);if(!/^\d+$/.test(String(req.query.category))||!Number.isSafeInteger(id))throw fail('Kategori tidak valid.');
    const q=normalize(typeof req.query.q==='string'?req.query.q.slice(0,200):''),filter=normalize(typeof req.query.filter==='string'?req.query.filter.slice(0,200):'');
    const data=catalogue(),category=data.categories.find(c=>c.id===id);
    const filtered=(data.grouped.get(id)||[]).filter(b=>(!q||b.find.includes(q))&&(!filter||normalize(category?.name).includes(filter)||b.find.includes(filter)));
    const page=Math.max(1,Math.min(Math.ceil(filtered.length/30)||1,Number(req.query.page)||1));
    if(!Number.isSafeInteger(page))throw fail('Halaman tidak valid.');
    return {data:filtered.slice((page-1)*30,page*30).map(b=>({bkid:b.bkid,bk:b.bk,cat:b.cat})),total:filtered.length,page,limit:30};
  }));
}
