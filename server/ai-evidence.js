import {loadAiPage,exactSourceQuote} from './ai-source.js';
const sourcePages=new WeakMap();
const invalid=()=>Object.assign(new Error('Jawaban belum dapat diverifikasi terhadap teks kitab. Coba kirim kembali atau pilih bagian halaman yang lebih spesifik.'),{status:502,code:'UNVERIFIED_ANSWER'});
export const answerSchema={type:'OBJECT',properties:{answer:{type:'STRING'},quotes:{type:'ARRAY',items:{type:'OBJECT',properties:{source:{type:'INTEGER'},quoteId:{type:'STRING'}},required:['source','quoteId']}}},required:['answer','quotes']};
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
/**
 * Splits page text into whole sentences. Many pages hard-wrap lines mid-sentence, so line breaks are
 * joined first; very short sentences join the next one and very long ones are cut at a word boundary.
 */
export function quoteUnits(text,{min=60,max=600}={}){
 const flat=String(text||'').replace(/\s+/g,' ').trim();
 // A footnote rule ("______") separates the body from its notes: a quote never spans both.
 const parts=flat.split(/\s*[_ـ]{4,}\s*/u).filter(part=>part.trim());
 if(parts.length>1)return parts.flatMap(part=>quoteUnits(part,{min,max}));
 const sentences=flat.match(/[^.!?؟]+(?:[.!?؟]+["'”’»)\]]*|$)/gu)||[];
 const units=[];let current='';
 // A unit starts at a letter, not at punctuation left over from the previous sentence (": أما…").
 for(const sentence of sentences.map(s=>s.replace(/^[^\p{L}\p{N}«"“([]+/u,'').trim()).filter(Boolean)){
  current=current?current+' '+sentence:sentence;
  while(current.length>max){let end=current.lastIndexOf(' ',max);if(end<max/2)end=max;units.push(current.slice(0,end).trim());current=current.slice(end).trim();}
  if(current.length>=min){units.push(current);current='';}
 }
 if(current){if(units.length&&units[units.length-1].length+current.length<max)units[units.length-1]+=' '+current;else units.push(current);}
 return units;
}
// IDs point to immutable literal spans, never text retyped by the model.
export function quoteCatalog(refs){
 const catalog=new Map();
 refs.forEach((ref,index)=>{
  if(ref.pageId==null)return;
  const original=sourcePages.get(ref)||ref.excerpt;let count=0;
  for(const fragment of ref.excerpt.split(/\s*…\s*/)){
   const matched=exactSourceQuote(original,fragment);if(!matched)continue;
   for(const unit of quoteUnits(matched)){
    if(count>=24)break;
    const actual=exactSourceQuote(original,unit);
    if(actual&&unit.length>=12)catalog.set(`${index+1}.${++count}`,{source:index+1,text:actual});
   }
  }
 });
 return catalog;
}
export function verifyAnswer(text,refs,catalog){
 let data;try{data=typeof text==='string'?JSON.parse(text.replace(/^```json\s*|\s*```$/g,'')):text;}catch{throw invalid();}
 if(!data||typeof data.answer!=='string'||!data.answer.trim()||data.answer.length>20000||!Array.isArray(data.quotes)||!data.quotes.length||data.quotes.length>12)throw invalid();
 const quotes=data.quotes.map(input=>{
  let q=input;
  if(catalog){
   const chosen=typeof input?.quoteId==='string'?catalog.get(input.quoteId):null;
   if(!chosen||chosen.source!==input.source)throw invalid();
   q=chosen;
  }
  if(!q||typeof q!=='object')throw invalid();
  if(!Number.isInteger(q.source)||q.source<1||q.source>refs.length||refs[q.source-1].pageId==null||typeof q.text!=='string'||q.text.trim().length<12||q.text.length>1000)throw invalid();
  const reference=refs[q.source-1];
  if(!exactSourceQuote(reference.excerpt,q.text))throw invalid();
  const actual=exactSourceQuote(sourcePages.get(reference) || reference.excerpt,q.text);if(!actual)throw invalid();
  return {source:q.source,text:actual};
 });
 // The model sometimes cites a quote ID ([1.10]) in prose; readers only know source numbers.
 data={...data,answer:data.answer.replace(/\[\s*(\d+(?:\.\d+)?(?:\s*[,،;]\s*\d+(?:\.\d+)?)*)\s*\]/g,(_,list)=>[...new Set(list.split(/\s*[,،;]\s*/).map(id=>id.split('.')[0]))].map(n=>`[${n}]`).join('')).replace(/(\[\d+\])([.,;:]?)(?:\s*\1)+/g,'$1$2')};
 const sources=[...new Set(quotes.map(q=>q.source))];
 if(!/\[\d+\]/.test(data.answer)&&sources.length===1&&refs.filter(r=>r.pageId!=null).length===1)data={...data,answer:data.answer.trim()+` [${sources[0]}]`};
 const citations=[...data.answer.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
 if(!citations.length||citations.some(n=>!quotes.some(q=>q.source===n)))throw invalid();
 // Prose is an AI explanation/translation; only the dedicated quote field is literal evidence.
 return {answer:data.answer.trim(),quotes};
}
// A quote stays one paragraph (wrapped source lines become spaces); Arabic quotes use «» so they read right-to-left.
const displayQuote=text=>{const flat=text.replace(/\s+/g,' ').trim();return /^[^\p{L}]*[؀-ۿ]/u.test(flat)?`«${flat}»`:`“${flat}”`;};
export const evidenceAnswer=verified=>'**Penjelasan AI**\n\n'+verified.answer+'\n\n**Kutipan sumber**\n\n'+verified.quotes.map(q=>`${displayQuote(q.text)} [${q.source}]`).join('\n\n');
export function validCachedAnswer(db,payload,additional=false){
 try{
  if(['no_context','sources_only'].includes(payload.mode))return false;
  const refs=verifiedReferences(db,payload.references,additional);
  if(payload.mode==='catalogue')return refs.every(r=>r.pageId==null)&&refs.every((r,i)=>r.title===payload.references[i].title);
  if(!payload.evidence)return false;
  const verified=verifyAnswer(payload.evidence,refs);
  return evidenceAnswer(verified)===payload.answer;
 }catch{return false;}
}
