import {loadAiPage,exactSourceQuote} from './ai-source.js';
const sourcePages=new WeakMap();
const invalid=()=>Object.assign(new Error('Jawaban belum dapat diverifikasi terhadap teks kitab. Coba kirim kembali atau pilih bagian halaman yang lebih spesifik.'),{status:502,code:'UNVERIFIED_ANSWER'});
export const answerSchema={type:'OBJECT',properties:{answer:{type:'STRING'},quotes:{type:'ARRAY',items:{type:'OBJECT',properties:{source:{type:'INTEGER'},text:{type:'STRING'}},required:['source','text']}}},required:['answer','quotes']};
export function verifiedReferences(db,refs,additional=false) {
 if(!Array.isArray(refs)||!refs.length||refs.length>8)throw invalid();
 return refs.map(r=>{
  if(r.pageId==null){
   for(const schema of additional?['main','tambahan']:['main']){
    const book=db.prepare(`SELECT bkid,bk AS title FROM ${schema}.books_meta WHERE bkid=?`).get(r.bkid);
    if(book)return {...r,...book,excerpt:`Informasi katalog: ${book.title}`};
   }
   throw invalid();
  }
  const row=loadAiPage(db,r.bkid,r.pageId,additional);
  const pieces=String(r.excerpt||'').split(/\s*…\s*/).filter(p=>p.trim());
  if(!pieces.length)throw invalid();
  const excerpt=pieces.map(p=>{const matched=exactSourceQuote(row.text,p);if(!matched)throw invalid();return matched;}).join(' … ');
  const reference={bkid:row.bkid,title:row.title,pageId:row.pageId,juz:row.juz,page:row.page,excerpt};
  sourcePages.set(reference,row.text);return reference;
 });
}
export function verifyAnswer(text,refs){
 let data;try{data=typeof text==='string'?JSON.parse(text.replace(/^```json\s*|\s*```$/g,'')):text;}catch{throw invalid();}
 if(!data||typeof data.answer!=='string'||!data.answer.trim()||data.answer.length>20000||!Array.isArray(data.quotes)||!data.quotes.length||data.quotes.length>12)throw invalid();
 const quotes=data.quotes.map(q=>{
  if(!Number.isInteger(q.source)||q.source<1||q.source>refs.length||refs[q.source-1].pageId==null||typeof q.text!=='string'||q.text.trim().length<12||q.text.length>1000)throw invalid();
  const reference=refs[q.source-1];
  if(!exactSourceQuote(reference.excerpt,q.text))throw invalid();
  const actual=exactSourceQuote(sourcePages.get(reference) || reference.excerpt,q.text);if(!actual)throw invalid();
  return {source:q.source,text:actual};
 });
 const sources=[...new Set(quotes.map(q=>q.source))];
 if(!/\[\d+\]/.test(data.answer)&&sources.length===1&&refs.filter(r=>r.pageId!=null).length===1)data={...data,answer:data.answer.trim()+` [${sources[0]}]`};
 const citations=[...data.answer.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
 if(!citations.length||citations.some(n=>!quotes.some(q=>q.source===n)))throw invalid();
 // Quoted phrases in the prose must also occur in an available source.
 for(const m of data.answer.matchAll(/“([^”]{12,})”|«([^»]{12,})»|"([^"\n]{12,})"/g)){
  if(!refs.some(r=>r.pageId!=null&&exactSourceQuote(r.excerpt,m[1]||m[2]||m[3])&&exactSourceQuote(sourcePages.get(r)||r.excerpt,m[1]||m[2]||m[3])))throw invalid();
 }
 return {answer:data.answer.trim(),quotes};
}
export const evidenceAnswer=verified=>verified.answer+'\n\n**Kutipan sumber**\n\n'+verified.quotes.map(q=>`“${q.text}” [${q.source}]`).join('\n\n');
export function validCachedAnswer(db,payload,additional=false){
 try{
  if(payload.mode==='no_context')return false;
  const refs=verifiedReferences(db,payload.references,additional);
  if(payload.mode==='catalogue')return refs.every(r=>r.pageId==null)&&refs.every((r,i)=>r.title===payload.references[i].title);
  if(!payload.evidence)return false;
  const verified=verifyAnswer(payload.evidence,refs);
  return evidenceAnswer(verified)===payload.answer;
 }catch{return false;}
}
