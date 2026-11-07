import { pushLocation } from '../lib/back-navigation';
import {useEffect,useState} from 'react';
import {BookOpen,Heart,Bookmark,Trash2} from 'lucide-react';
import {navigationHash,parseNavigation} from '../lib/navigation';
import type {ReadingPosition} from '../lib/reading-position';
type Section='continue'|'favorites'|'bookmarks';
const currentSection=():Section=>{const value=parseNavigation(window.location.hash).params.get('section');return value==='favorites'||value==='bookmarks'?value:'continue';};
export function Collection({positions,favorites,bookmarks,readBook,removeFavorite,removeBookmark,removePosition}:{
  positions:ReadingPosition[];favorites:any[];bookmarks:any[];readBook:(bookId:number,pageId?:number)=>void;
  removeFavorite:(id:number)=>void;removeBookmark:(bookId:number,pageId:number)=>void;removePosition:(id:number)=>void;
}) {
  const [section,setSection]=useState(currentSection),[query,setQuery]=useState('');
  useEffect(()=>{const sync=()=>{if(parseNavigation(window.location.hash).tab==='collection')setSection(currentSection());};for(const name of ['popstate','hashchange','maktabah:navigate'])window.addEventListener(name,sync);return()=>{for(const name of ['popstate','hashchange','maktabah:navigate'])window.removeEventListener(name,sync);};},[]);
  const choose=(value:Section)=>{pushLocation(navigationHash('collection',{section:value}));window.dispatchEvent(new Event('maktabah:navigate'));};
  const entries=section==='continue'?positions.map(p=>({bookId:p.bookId,pageId:p.pageId,title:p.title,page:p.page,part:p.part})):section==='favorites'?favorites.map(p=>({bookId:p.bkid,pageId:undefined,title:p.bk,page:null,part:null})):bookmarks.map(p=>({bookId:p.bkid,pageId:p.id,title:p.bk,page:p.page,part:p.juz}));
  const filtered=entries.filter(p=>p.title.toLowerCase().includes(query.toLowerCase()));
  return <section className="rounded-2xl border bg-[var(--reader-bg)] p-5 space-y-4">
    <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen/>Koleksi Saya</h2>
    <p className="text-sm text-gray-500">Tersimpan di perangkat dan peramban ini. Koleksi belum disinkronkan ke perangkat lain; membersihkan data situs dapat menghapusnya.</p>
    <nav aria-label="Jenis koleksi" className="flex flex-wrap gap-2">{([{id:'continue',label:'Lanjutkan Membaca',count:positions.length,icon:BookOpen},{id:'favorites',label:'Favorit',count:favorites.length,icon:Heart},{id:'bookmarks',label:'Bookmark',count:bookmarks.length,icon:Bookmark}] as const).map(item=><button key={item.id} onClick={()=>choose(item.id)} aria-current={section===item.id?'page':undefined} className={`border rounded-xl px-4 py-2 flex gap-2 items-center text-sm ${section===item.id?'bg-[var(--app-primary)] text-white':''}`}><item.icon size={16}/>{item.label} ({item.count})</button>)}</nav>
    <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari dalam koleksi…" aria-label="Cari judul dalam koleksi" className="border rounded-xl px-4 py-3 w-full"/>
    {filtered.length?<div className="space-y-3">{filtered.map(item=><article key={`${item.bookId}:${item.pageId??'book'}`} className="flex items-center gap-3 p-4 border rounded-xl bg-[var(--reader-paper)]"><button className="flex-1 min-w-0 text-left" onClick={()=>readBook(item.bookId,item.pageId)}><span dir="auto" className="font-bold block">{item.title}</span><span className="text-sm text-gray-500">{item.pageId===undefined?'Buka kitab':`Juz ${item.part??'—'} · Halaman ${item.page??'—'}`}</span></button><button aria-label={`Hapus ${item.title} dari ${section==='favorites'?'favorit':section==='bookmarks'?'bookmark':'daftar lanjut membaca'}`} className="text-red-600 p-2 rounded hover:bg-red-50" onClick={()=>{if(section==='favorites')removeFavorite(item.bookId);else if(section==='bookmarks')removeBookmark(item.bookId,item.pageId!);else removePosition(item.bookId);}}><Trash2 size={18}/></button></article>)}</div>:<p className="py-8 text-center text-gray-500">{query?'Tidak ada judul yang cocok.':'Belum ada item. Buka kitab, tandai favorit, atau tambahkan bookmark saat membaca.'}</p>}
  </section>;
}
