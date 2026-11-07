import { useEffect, useState } from 'react';
import { Folder, ChevronLeft, ChevronRight, BookOpen, User, Info, Download, Search } from 'lucide-react';
import { webAPI } from '../api';
import { navigationHash, parseNavigation, routePage } from '../lib/navigation';

const location = () => {
  const {params} = parseNavigation(window.location.hash);
  const raw = params.get('cat');
  return {cat:raw !== null && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null,
    query:params.get('q') || '',filter:params.get('filter') || '',page:routePage(params.get('page'))};
};
export default function Catalog({openBook,readBook}:{openBook:(id:number)=>void;readBook:(id:number)=>void}) {
  const [route,setRoute] = useState(location);
  const [categories,setCategories] = useState<any[]>([]);
  const [books,setBooks] = useState<any[]>([]);
  const [total,setTotal] = useState(0);
  const [pages,setPages] = useState(1);
  const [loading,setLoading] = useState(false);
  const [categoriesLoading,setCategoriesLoading] = useState(true);
  const [categoryError,setCategoryError] = useState('');
  const [bookError,setBookError] = useState('');
  const [draft,setDraft] = useState(route.query);
  const [retry,setRetry] = useState(0);
  const go = (cat:number|null,query='',page=1,filter=route.filter,replace=false) => {
    window.history.replaceState({...window.history.state,scrollY:window.scrollY},'');
    const hash=navigationHash('catalog',{cat:cat===null?undefined:cat,q:query,page:cat===null?undefined:page,filter});
    if(replace)window.history.replaceState(window.history.state,'',hash);else window.history.pushState(null,'',hash);
    window.dispatchEvent(new Event('maktabah:navigate'));
    if(!replace)window.scrollTo(0,0);
  };
  useEffect(()=>{
    const sync=()=>{if(parseNavigation(window.location.hash).tab!=='catalog')return;const next=location();setRoute(next);setDraft(next.query);};
    for(const name of ['popstate','hashchange','maktabah:navigate'])window.addEventListener(name,sync);
    return()=>{for(const name of ['popstate','hashchange','maktabah:navigate'])window.removeEventListener(name,sync);};
  },[]);
  useEffect(()=>{
    let current=true;setCategoriesLoading(true);setCategoryError('');
    webAPI.getCategories().then(res=>{if(current)setCategories(res.data||[]);}).catch(()=>{if(current)setCategoryError('Kategori gagal dimuat. Periksa koneksi dan coba lagi.');}).finally(()=>{if(current)setCategoriesLoading(false);});
    return()=>{current=false;};
  },[retry]);
  useEffect(()=>{
    if(route.cat===null)return;
    let current=true;setLoading(true);setBookError('');
    webAPI.getCategoryBooks(route.cat,route.page,route.query,30).then(res=>{
      if(!current)return;setBooks(res.data||[]);setTotal(res.total||0);setPages(res.totalPages||1);
      if(res.page!==route.page)go(route.cat,route.query,res.page,route.filter,true);
    }).catch(()=>{if(current)setBookError('Daftar kitab gagal dimuat. Periksa koneksi dan coba lagi.');}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[route.cat,route.page,route.query,retry]);
  const filtered=categories.filter(c=>c.name.toLowerCase().includes(route.filter.toLowerCase()));
  const error=categoryError||bookError;
  return <section className="bg-[var(--reader-bg)] rounded-2xl border border-black/5 p-4 md:p-6 shadow-sm">
    <nav aria-label="Lokasi katalog" className="flex items-center gap-2 text-sm mb-4"><button onClick={()=>go(null)} className="text-[var(--app-primary)] font-semibold">Katalog</button>{route.cat!==null&&<><ChevronRight size={14}/><span dir="auto">{categories.find(c=>c.id===route.cat)?.name||`Kategori #${route.cat}`}</span></>}</nav>
    {error&&<div role="alert" className="p-4 bg-red-50 text-red-800 rounded-xl mb-4">{error}<button onClick={()=>setRetry(v=>v+1)} className="ml-3 underline font-bold">Coba lagi</button></div>}
    {route.cat===null ? <>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Folder/>Kategori Kitab</h2>
      <label className="block text-sm mb-2" htmlFor="category-filter">Cari nama kategori</label>
      <input id="category-filter" type="search" value={route.filter} onChange={e=>go(null,'',1,e.target.value,true)} className="w-full border rounded-xl p-3 mb-5 bg-[var(--reader-paper)]"/>
      {categoriesLoading?<p role="status">Memuat kategori…</p>:<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map(cat=><button key={cat.id} onClick={()=>go(cat.id)} className="flex items-center gap-3 text-right bg-[var(--reader-paper)] border rounded-xl p-4 hover:border-[var(--app-primary)]"><Folder className="shrink-0"/><span className="font-bold text-lg flex-1" dir="auto">{cat.name}</span></button>)}</div>}
      {!categoriesLoading&&!error&&!filtered.length&&<p className="py-6 text-gray-500">Kategori tidak ditemukan.</p>}
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><button onClick={()=>go(null)} className="inline-flex items-center gap-2 border rounded-lg p-2"><ChevronLeft size={18}/>Kembali ke kategori</button><span>{total} kitab</span></div>
      <h2 className="text-xl font-bold mb-4" dir="auto">{categories.find(c=>c.id===route.cat)?.name||`Kategori #${route.cat}`}</h2>
      <form onSubmit={e=>{e.preventDefault();go(route.cat,draft,1);}} className="flex gap-2 mb-5"><input type="search" aria-label="Cari judul kitab dalam kategori" value={draft} maxLength={200} onChange={e=>setDraft(e.target.value)} placeholder="Cari judul dalam kategori ini…" className="flex-1 min-w-0 border rounded-lg px-3 py-2"/><button className="bg-[var(--app-primary)] text-white rounded-lg px-4 py-2" aria-label="Cari kitab"><Search size={18}/></button></form>
      {loading?<p role="status" className="py-8 text-center">Memuat daftar kitab…</p>:!bookError&&<div className="space-y-3">{books.map(book=><article key={book.bkid} className="bg-[var(--reader-paper)] border rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="flex-1 min-w-0"><button onClick={()=>readBook(book.bkid)} className="font-bold text-xl text-left flex items-center gap-2 hover:text-[var(--app-primary)]" dir="auto"><BookOpen className="shrink-0" size={20}/>{book.bk}</button>{book.author_name&&<p className="flex items-center gap-2 text-sm mt-2 text-gray-500" dir="auto"><User size={14}/>{book.author_name}</p>}</div>
        <div className="flex gap-2"><button onClick={()=>openBook(book.bkid)} className="border rounded-lg px-3 py-2 flex items-center gap-2 text-sm"><Info size={16}/>Detail</button><a href={`/api/download/${book.bkid}`} target="_blank" rel="noreferrer" className="border rounded-lg px-3 py-2 flex items-center gap-2 text-sm"><Download size={16}/>Word</a></div>
      </article>)}</div>}
      {!loading&&!error&&!books.length&&<p className="py-8 text-center text-gray-500">Tidak ada kitab yang cocok.</p>}
      <nav aria-label="Halaman daftar kitab" className="flex items-center justify-center gap-4 mt-5"><button disabled={loading||route.page<=1} onClick={()=>go(route.cat,route.query,route.page-1)} className="border rounded-lg p-2 disabled:opacity-40" aria-label="Halaman katalog sebelumnya"><ChevronLeft/></button><span>{route.page} / {pages}</span><button disabled={loading||route.page>=pages} onClick={()=>go(route.cat,route.query,route.page+1)} className="border rounded-lg p-2 disabled:opacity-40" aria-label="Halaman katalog selanjutnya"><ChevronRight/></button></nav>
    </>}
  </section>;
}
