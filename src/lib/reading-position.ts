export type ReadingPosition = {bookId:number;pageId:number;page:number|string|null;part:number|string|null;title:string;updatedAt:number};
type StorageLike = {getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
export function readingPositions(storage: StorageLike): ReadingPosition[] {
  try {
    const values: unknown = JSON.parse(storage.getItem('maktabah-reading-positions') || '[]');
    if (!Array.isArray(values)) return [];
    return values.filter((v): v is ReadingPosition => v && Number.isSafeInteger(v.bookId) && v.bookId>0 && Number.isSafeInteger(v.pageId) && v.pageId>=0 && typeof v.title==='string' && Number.isFinite(v.updatedAt)).sort((a,b)=>b.updatedAt-a.updatedAt);
  } catch { return []; }
}
export function rememberReadingPosition(storage: StorageLike, position: ReadingPosition) {
  try { storage.setItem('maktabah-reading-positions',JSON.stringify([position,...readingPositions(storage).filter(p=>p.bookId!==position.bookId)].slice(0,100))); } catch { /* Reading remains available if storage is full/disabled. */ }
}
export function swipeDirection(dx:number,dy:number,loading=false,selectedText=false) {
  return loading || selectedText || Math.abs(dx)<50 || Math.abs(dx)<Math.abs(dy)*1.5 ? null : dx>0?'next':'previous';
}
