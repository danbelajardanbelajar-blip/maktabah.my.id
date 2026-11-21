import {loadPickedActive,loadPickedBooks} from './search-books.ts';

export const MAX_SCOPE_ADJUSTMENTS=1000;
export interface ScopeBook {bkid:number;bk:string;cat?:number;author?:string|null;}
export interface SearchScope {all:boolean;categories:number[];excludedCategories:number[];books:ScopeBook[];excluded:ScopeBook[];}
export interface ScopeCategory {id:number;name:string;total:number;matched?:number;}
export const emptySearchScope=(all=true):SearchScope=>({all,categories:[],excludedCategories:[],books:[],excluded:[]});
const ids=(raw:unknown,zero=false):number[]=>{
  if(!Array.isArray(raw)||raw.length>MAX_SCOPE_ADJUSTMENTS||raw.some(id=>!Number.isSafeInteger(id)||id<(zero?0:1)))throw Error('Daftar tempat pencarian tidak valid.');
  return [...new Set(raw as number[])].sort((a,b)=>a-b);
};
const books=(raw:unknown):ScopeBook[]=>{
  if(!Array.isArray(raw)||raw.length>MAX_SCOPE_ADJUSTMENTS)throw Error('Daftar kitab tidak valid.');
  const seen=new Set<number>();
  return raw.map(book=>{
    if(!book||!Number.isSafeInteger(book.bkid)||book.bkid<1||typeof book.bk!=='string')throw Error('Kitab pilihan tidak valid.');
    return {bkid:book.bkid,bk:book.bk.slice(0,500),...(Number.isSafeInteger(book.cat)&&book.cat>=0?{cat:book.cat}:{}),author:typeof book.author==='string'?book.author.slice(0,300):null};
  }).filter(book=>{if(seen.has(book.bkid))return false;seen.add(book.bkid);return true;});
};
export function normalizeSearchScope(raw:unknown):SearchScope {
  const value=raw as SearchScope;
  if(!value||typeof value.all!=='boolean')throw Error('Tempat pencarian tidak valid.');
  return {all:value.all,categories:ids(value.categories,true),excludedCategories:ids(value.excludedCategories,true),books:books(value.books),excluded:books(value.excluded)};
}
export const scopeParams=(scope:SearchScope)=>({scope:scope.all?'all':'custom',cats:scope.categories.join(','),books:scope.books.map(b=>b.bkid).sort((a,b)=>a-b).join(','),notcats:scope.excludedCategories.join(','),notbooks:scope.excluded.map(b=>b.bkid).sort((a,b)=>a-b).join(',')});
export const scopeKey=(scope:SearchScope)=>JSON.stringify(scopeParams(scope));
export const unrestrictedScope=(scope:SearchScope)=>scope.all&&!scope.excludedCategories.length&&!scope.excluded.length;
export function scopeFromParams(params:URLSearchParams):SearchScope {
  const read=(key:string,zero=false)=>{const text=params.get(key)||'';if(!text)return [];if(!/^\d+(,\d+)*$/.test(text))throw Error('Tautan tempat pencarian tidak valid.');return ids(text.split(',').map(Number),zero);};
  const toBooks=(list:number[])=>list.map(bkid=>({bkid,bk:`Kitab #${bkid}`}));
  try{
    const selected=read('books'),categories=read('cats',true);
    if(!params.has('scope'))return {...emptySearchScope(!selected.length&&!categories.length),categories:selected.length?[]:categories,books:toBooks(selected)};
    if(!['all','custom'].includes(params.get('scope')||''))throw Error('Tempat pencarian tidak valid.');
    return {all:params.get('scope')==='all',categories,excludedCategories:read('notcats',true),books:toBooks(selected),excluded:toBooks(read('notbooks'))};
  }catch{return emptySearchScope(false);}
}
const key='maktabah:search-scope-v2';
export function loadSearchScope():SearchScope {
  try{const value=localStorage.getItem(key);if(value)return normalizeSearchScope(JSON.parse(value));}catch{/* Fall back to the old device selection. */}
  return loadPickedActive()?{...emptySearchScope(false),books:loadPickedBooks()}:emptySearchScope();
}
export function saveSearchScope(scope:SearchScope){try{localStorage.setItem(key,JSON.stringify(scope));}catch{/* Optional device persistence. */}}
export const categoryBaseSelected=(scope:SearchScope,cat:number)=>scope.all?!scope.excludedCategories.includes(cat):scope.categories.includes(cat);
export const scopeBookSelected=(scope:SearchScope,book:ScopeBook)=>(categoryBaseSelected(scope,book.cat??-1)||scope.books.some(b=>b.bkid===book.bkid))&&!scope.excluded.some(b=>b.bkid===book.bkid);
export function categorySelectedCount(scope:SearchScope,category:ScopeCategory){
  return categoryBaseSelected(scope,category.id)?Math.max(0,category.total-scope.excluded.filter(b=>b.cat===category.id).length):scope.books.filter(b=>b.cat===category.id&&!scope.excluded.some(e=>e.bkid===b.bkid)).length;
}
export function selectScopeCategory(scope:SearchScope,cat:number,checked:boolean):SearchScope {
  return {...scope,categories:scope.all?[]:checked?[...new Set([...scope.categories,cat])].sort((a,b)=>a-b):scope.categories.filter(id=>id!==cat),
    excludedCategories:scope.all?(checked?scope.excludedCategories.filter(id=>id!==cat):[...new Set([...scope.excludedCategories,cat])].sort((a,b)=>a-b)):[],
    books:scope.books.filter(b=>b.cat!==cat),excluded:scope.excluded.filter(b=>b.cat!==cat)};
}
export function toggleScopeBook(scope:SearchScope,book:ScopeBook,category?:ScopeCategory):SearchScope {
  const base=categoryBaseSelected(scope,book.cat??-1),selected=scopeBookSelected(scope,book);
  const result={...scope,books:scope.books.filter(b=>b.bkid!==book.bkid),excluded:scope.excluded.filter(b=>b.bkid!==book.bkid)};
  if(selected&&base)result.excluded.push(book);
  if(!selected&&!base)result.books.push(book);
  if(result.books.length>MAX_SCOPE_ADJUSTMENTS||result.excluded.length>MAX_SCOPE_ADJUSTMENTS)throw Error(`Maksimal ${MAX_SCOPE_ADJUSTMENTS} pilihan atau pengecualian satuan. Gunakan centang kategori untuk memilih banyak kitab.`);
  if(category&&category.total>0&&categorySelectedCount(result,category)===category.total)return selectScopeCategory(result,category.id,true);
  return result;
}
export function scopeDescription(scope:SearchScope){
  if(unrestrictedScope(scope))return 'Semua kitab';
  const parts=[scope.all?'Semua kitab':scope.categories.length?`${scope.categories.length} kategori penuh`:'',scope.books.length?`${scope.books.length} kitab satuan`:'',scope.excludedCategories.length?`kecuali ${scope.excludedCategories.length} kategori`:'',scope.excluded.length?`kecuali ${scope.excluded.length} kitab`:''].filter(Boolean);
  return parts.join(' · ')||'Belum ada kitab dipilih';
}
