// A date reference is not a lifespan. Preserve qualifiers and original text.
export function authorDeathDate(value) {
  const original=String(value||'').trim();
  const clean=original.normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640\u200e\u200f\u061c]/gu,'')
    .replace(/[٠-٩]/gu,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/gu,c=>String(c.charCodeAt(0)-0x6f0)).trim();
  const unknown={kind:'unknown',year:null,century:null,sortYear:null,label:original?'Tanggal belum terpetakan':'Tahun belum tercatat',original};
  const century=clean.match(/^(?:ق|القرن)\s*(\d{1,2})\s*(?:ه|هجري|هجرية|H)?\.?$/iu);
  if(century){const n=Number(century[1]);return n>0?{kind:'century',year:null,century:n,sortYear:(n-1)*100+1,label:`Abad ke-${n} H`,original}:unknown;}
  const match=clean.match(/^(?:(بعد|قبل|نحو|حوالي|قرابة)\s+)?(\d{1,4})\s*(?:ه|هجري|هجرية|H)?\.?$/iu);
  if(!match||Number(match[2])<1)return unknown;
  const year=Number(match[2]),kind=!match[1]?'exact':match[1]==='بعد'?'after':match[1]==='قبل'?'before':'approx';
  const prefix=kind==='exact'?'Wafat':kind==='after'?'Setelah':kind==='before'?'Sebelum':'Sekitar';
  return{kind,year,century:Math.ceil(year/100),sortYear:year,label:`${prefix} ${year} H`,original};
}
export function compareAuthorDates(a,b) {
  const av=a.deathDate.sortYear??Infinity,bv=b.deathDate.sortYear??Infinity;
  return (av===bv?0:av-bv)||a.name.localeCompare(b.name,'ar')||a.id-b.id;
}
