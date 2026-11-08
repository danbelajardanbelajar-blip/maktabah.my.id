const fail=(message,status=400)=>Object.assign(new Error(message),{status,code:'INVALID_SOURCE'});
export const sourceText=value=>String(value??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?\s*>|<\/(p|div|li|h[1-6])>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&amp;/g,'&').trim();

function indexed(text,compact=false) {
  let normalized='';const starts=[],ends=[];let offset=0;
  for(const char of text) {
    const start=offset;offset+=char.length;
    if(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/.test(char)){if(ends.length)ends[ends.length-1]=offset;continue;}
    if(/\s/.test(char)) {
      if(compact)continue;
      if(!normalized)continue;
      if(normalized.endsWith(' ')){ends[ends.length-1]=offset;continue;}
      normalized+=' ';starts.push(start);ends.push(offset);continue;
    }
    for(const c of char.normalize('NFKC')){normalized+=c;for(let i=0;i<c.length;i++){starts.push(start);ends.push(offset);}}
  }
  return {normalized,starts,ends};
}
export function exactSourceQuote(original,quote) {
  for(const compact of [false,true]){
    const source=indexed(original,compact),needle=indexed(quote,compact).normalized.trim();
    if(!needle)return null;const at=source.normalized.indexOf(needle);
    if(at>=0)return original.slice(source.starts[at],source.ends[at+needle.length-1]);
  }
  return null;
}
export function loadAiPage(db,bookId,pageId,additional=false) {
  if(!Number.isSafeInteger(bookId)||bookId<1||!Number.isSafeInteger(pageId)||pageId<0)throw fail('Pilih kitab dan halaman yang valid.');
  for(const schema of additional?['main','tambahan']:['main']) {
    const row=db.prepare(`SELECT b.bkid,b.bk AS title,p.id AS pageId,p.part AS juz,p.page,p.nass AS text FROM ${schema}.pages p JOIN ${schema}.books_meta b ON b.bkid=p.book_id WHERE b.bkid=? AND p.id=?`).get(bookId,pageId);
    if(row)return {...row,text:sourceText(row.text)};
  }
  throw fail('Halaman kitab tidak ditemukan atau telah dihapus.',404);
}
export function resolveAiSource(db,source,additional=false) {
  if(!source || typeof source!=='object')throw fail('Sumber halaman tidak valid.');
  const row=loadAiPage(db,source.bookId,source.pageId,additional);
  let text=row.text;
  if(source.text!==undefined) {
    if(typeof source.text!=='string'||source.text.length>8000)throw fail('Pilih teks hingga 8.000 karakter.');
    const matched=exactSourceQuote(row.text,source.text.trim());
    if(!matched)throw fail('Teks pilihan tidak cocok dengan halaman sumber. Pilih kembali teks dari kitab.');
    text=matched;
  }
  if(!text.trim())throw fail('Halaman ini belum memiliki teks yang dapat diproses.');
  if(text.length>8000)throw fail('Halaman ini terlalu panjang. Pilih bagian teks hingga 8.000 karakter lalu coba lagi.',413);
  return {reference:{bkid:row.bkid,title:row.title,pageId:row.pageId,juz:row.juz,page:row.page,excerpt:text},source:{bookId:row.bkid,pageId:row.pageId,title:row.title,part:row.juz,page:row.page,...(source.text!==undefined?{text}: {})}};
}
