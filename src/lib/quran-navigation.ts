export type QuranPosition = {surah:number;ayah:number;view:'ayat'|'tafsir';book?:number;fontSize:number};
const number=(value:unknown,min:number,max:number,fallback:number)=>{
  if(typeof value!=='string' && typeof value!=='number')return fallback;
  const text=String(value);if(!/^\d+$/.test(text))return fallback;
  const n=Number(text);return Number.isSafeInteger(n)&&n>=min?Math.min(max,n):fallback;
};
export const QURAN_POSITION_KEY='maktabah-quran-position';
export function readQuranPosition(storage:{getItem:(key:string)=>string|null}):QuranPosition {
  let value:any={};try {value=JSON.parse(storage.getItem(QURAN_POSITION_KEY)||'{}') || {};} catch { /* Default reader remains usable without saved data. */ }
  return {surah:number(value.surah,1,114,1),ayah:number(value.ayah,1,286,1),view:value.view==='tafsir'?'tafsir':'ayat',book:number(value.book,1,Number.MAX_SAFE_INTEGER,0)||undefined,fontSize:number(value.fontSize,22,44,28)};
}
export function quranLocation(hash:string,saved:QuranPosition):QuranPosition {
  const params=new URLSearchParams(hash.split('?')[1]||'');
  if(!['surah','ayat','view','book'].some(key=>params.has(key)))return {...saved};
  return {surah:number(params.get('surah'),1,114,1),ayah:number(params.get('ayat'),1,286,1),view:params.get('view')==='tafsir'?'tafsir':'ayat',book:number(params.get('book'),1,Number.MAX_SAFE_INTEGER,0)||undefined,fontSize:saved.fontSize};
}
export function quranHash(position:QuranPosition) {
  const params=new URLSearchParams({surah:String(position.surah),ayat:String(position.ayah)});
  if(position.view==='tafsir')params.set('view','tafsir');
  if(position.book)params.set('book',String(position.book));
  return '#/quran?'+params;
}
export function saveQuranPosition(storage:{setItem:(key:string,value:string)=>void},position:QuranPosition) {
  try {storage.setItem(QURAN_POSITION_KEY,JSON.stringify(position));} catch { /* Full/disabled storage must not stop navigation. */ }
}
