import {HadithTextSearch} from './HadithTextSearch';
import {useEffect,useState} from 'react';
import {BookOpen,Library,Search,ArrowUpRight} from 'lucide-react';
import {navigationHash} from '../lib/navigation';
import {pushLocation} from '../lib/back-navigation';

interface Book {key:string;arabic:string;name:string;author:string;editions:{id:number;title:string}[];}
interface Group {key:string;name:string;arabic:string;description:string;books:string[];}
interface Catalogue {books:Book[];groups:Group[];references:{title:string;url:string}[];}
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640\u0300-\u036f]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

export function HadithBooks({openBook,readBook}:{openBook:(id:number)=>void;readBook:(id:number,pageId?:number,query?:string)=>void}) {
  const [data,setData]=useState<Catalogue|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [hash,setHash]=useState(window.location.hash),[selected,setSelected]=useState<Record<string,number>>({});
  const params=new URLSearchParams(hash.split('?')[1]||''),q=params.get('q')||'',groupKey=params.get('group')||'nine',available=params.get('available')==='1';
  const mode=params.get('mode')==='content'?'content':'catalog',source=params.get('book')||'',edition=params.get('edition')||'',matching=params.get('matching')==='phrase'?'phrase':'all',page=params.get('page')||'1';
  const [input,setInput]=useState(q);
  useEffect(()=>{const update=()=>setHash(window.location.hash);for(const event of ['hashchange','popstate','maktabah:navigate'])window.addEventListener(event,update);return()=>{for(const event of ['hashchange','popstate','maktabah:navigate'])window.removeEventListener(event,update);};},[]);
  useEffect(()=>setInput(q),[q]);
  useEffect(()=>{
    const controller=new AbortController();setError('');setData(null);
    fetch('/api/hadith-books',{signal:controller.signal}).then(async response=>{
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error(['127.0.0.1','localhost'].includes(window.location.hostname)?'Layanan lokal ini belum diperbarui. Buka http://127.0.0.1:3083/#/kutub-hadis.':'Katalog Kutub Hadis sedang diperbarui. Silakan coba lagi.');
      const result=await response.json();if(!response.ok)throw Error(result.error||'Katalog belum dapat dimuat.');return result;
    }).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[retry]);
  const group=data?.groups.find(g=>g.key===groupKey)||data?.groups.find(g=>g.key==='nine');
  const chosen=group?.books.map(key=>data!.books.find(book=>book.key===key)!).filter(Boolean)||[];
  const terms=normalize(q).split(' ').filter(Boolean);
  const books=chosen.filter(book=>(!available||book.editions.length>0)&&(mode==='content'||terms.every(t=>normalize(`${book.arabic} ${book.name} ${book.author} ${book.editions.map(e=>e.title).join(' ')}`).includes(t))));
  const go=(values:Record<string,string|number|undefined>)=>{pushLocation(navigationHash('hadith',{group:group?.key||'nine',mode:mode==='content'?'content':undefined,book:source||undefined,edition:edition||undefined,matching:matching==='phrase'?'phrase':undefined,q:q||undefined,available:available?'1':undefined,...values}));window.dispatchEvent(new Event('maktabah:navigate'));};
  return <section className="max-w-6xl mx-auto space-y-6 min-w-0">
    <header className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 text-white p-6 sm:p-9 overflow-hidden relative">
      <div className="flex justify-between gap-5"><div><p className="text-xs uppercase tracking-widest text-emerald-200 flex items-center gap-2"><Library size={15}/>Pustaka hadis</p><h1 className="text-3xl sm:text-4xl font-bold mt-3">Kutub Hadis</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-100">Jelajahi kitab-kitab hadis, kenali susunan kelompoknya, dan baca edisi yang tersedia dalam pustaka.</p></div><span dir="rtl" className="hidden sm:block text-4xl self-center text-amber-200" style={{fontFamily:'var(--arabic-font)'}}>كتب الحديث</span></div>
      {data&&<p className="mt-6 pt-4 border-t border-white/20 text-xs text-emerald-100">{data.books.filter(b=>b.editions.length).length} sumber tersedia · {data.books.reduce((n,b)=>n+b.editions.length,0)} edisi · {data.groups.length-1} kelompok penelusuran</p>}
    </header>
    {error?<div role="alert" className="border rounded-2xl p-5 bg-[var(--reader-bg)]"><p>{error}</p><button className="underline mt-3" onClick={()=>setRetry(n=>n+1)}>Coba lagi</button></div>:!data?<p role="status" className="p-8 text-center">Memuat koleksi Kutub Hadis…</p>:<>
      <div className="rounded-2xl border bg-[var(--reader-bg)] p-4 sm:p-5 space-y-5">
        <div role="group" aria-label="Kelompok kitab hadis" className="flex flex-wrap gap-2">{data.groups.map(item=><button key={item.key} type="button" aria-label={`${item.name} ${item.books.length}`} aria-pressed={group?.key===item.key} onClick={()=>go({group:item.key,book:undefined,edition:undefined,page:undefined})} className={`rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-semibold ${group?.key===item.key?'bg-[var(--app-primary)] text-white border-transparent':'bg-[var(--reader-paper)] hover:border-[var(--app-primary)]'}`}>{item.name}<span className="ml-2 opacity-70">{item.books.length}</span></button>)}</div>
        <label className="block text-xs font-semibold">Cari dalam<select aria-label="Cari dalam" value={mode} onChange={e=>go({mode:e.target.value,book:undefined,edition:undefined})} className="block mt-2 rounded-xl border bg-[var(--reader-paper)] p-2.5 text-sm"><option value="catalog">Judul / penyusun</option><option value="content">Isi kitab</option></select></label>
        <form className="flex gap-2" onSubmit={e=>{e.preventDefault();go({q:input.trim()});}}><input maxLength={300} aria-label={mode==='content'?'Cari teks dalam isi kitab':'Cari kitab atau penyusun'} className="w-full min-w-0 rounded-xl border bg-[var(--reader-paper)] px-4 py-3 text-sm" dir="auto" value={input} onChange={e=>setInput(e.target.value)} placeholder={mode==='content'?'Tulis potongan teks Arab, misalnya إنما الأعمال بالنيات':'Cari kitab atau penyusun, misalnya Bukhari / البخاري'}/><button aria-label="Cari kitab hadis" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--app-primary)] text-white font-semibold text-sm"><Search size={17}/><span className="hidden sm:inline">Cari</span></button></form>
        {mode==='content'&&<div className="flex flex-wrap gap-3">
          <label className="text-xs flex-1 min-w-0 basis-48">Kitab dalam kelompok<select aria-label="Kitab dalam kelompok" value={source} onChange={e=>go({book:e.target.value||undefined,edition:undefined})} className="block w-full mt-2 p-2.5 border rounded-xl bg-[var(--reader-paper)] text-sm"><option value="">Seluruh kitab dalam kelompok</option>{chosen.map(book=><option key={book.key} value={book.key}>{book.name}</option>)}</select></label>
          {source&&<label className="text-xs flex-1 min-w-0 basis-48">Edisi pencarian<select aria-label="Edisi pencarian" value={edition} onChange={e=>go({edition:e.target.value||undefined})} className="block w-full mt-2 p-2.5 border rounded-xl bg-[var(--reader-paper)] text-sm" dir="auto"><option value="">Semua edisi kitab ini</option>{chosen.find(b=>b.key===source)?.editions.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
          <label className="text-xs flex-1 min-w-0 basis-40">Pencocokan<select aria-label="Pencocokan teks" value={matching} onChange={e=>go({matching:e.target.value})} className="block w-full mt-2 p-2.5 border rounded-xl bg-[var(--reader-paper)] text-sm"><option value="all">Semua kata</option><option value="phrase">Frasa berurutan</option></select></label>
        </div>}
        {mode==='catalog'&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={available} onChange={e=>go({available:e.target.checked?'1':undefined})}/>Hanya kitab dengan edisi tersedia</label>}
      </div>
      <div className="flex justify-between gap-4 items-start"><div><h2 className="text-xl font-bold">{group?.name}</h2><p className="text-sm opacity-70 mt-2 leading-relaxed max-w-3xl">{group?.description}</p><p role="status" className="text-xs opacity-60 mt-2">{mode==='content'?`${source?1:chosen.length} sumber dalam lingkup pencarian`:`${books.length} dari ${chosen.length} sumber ditampilkan`}</p></div><span dir="rtl" className="hidden sm:block text-2xl text-[var(--app-primary)] shrink-0" style={{fontFamily:'var(--arabic-font)'}}>{group?.arabic}</span></div>
      {mode==='content'?<HadithTextSearch q={q} group={group?.key||'nine'} source={source} edition={edition} matching={matching} page={page} onPage={page=>go({page})} readBook={readBook}/>:books.length===0?<p className="p-8 text-center rounded-2xl border border-dashed">Tidak ada kitab yang sesuai. Coba kata lain atau ganti kelompok.</p>:<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{books.map((book,index)=>{
        const edition=book.editions.find(e=>e.id===selected[book.key])||book.editions[0];
        return <article key={book.key} className="rounded-2xl border bg-[var(--reader-paper)] p-5 flex flex-col gap-4 min-w-0 shadow-sm">
          <div className="flex justify-between items-center text-xs opacity-60"><span>{String(index+1).padStart(2,'0')}</span><span>{book.editions.length?`${book.editions.length} edisi tersedia`:'Belum tersedia'}</span></div>
          <h3 dir="rtl" className="text-3xl leading-relaxed text-[var(--app-primary)] break-words" style={{fontFamily:'var(--arabic-font)'}}>{book.arabic}</h3><div><p className="font-semibold text-sm">{book.name}</p><p className="text-xs opacity-60 mt-1">{book.author}</p></div>
          {edition?<><label className="mt-auto text-xs block">Pilih edisi<select aria-label={`Edisi ${book.name}`} value={edition.id} onChange={e=>setSelected(previous=>({...previous,[book.key]:Number(e.target.value)}))} className="mt-2 w-full min-w-0 rounded-lg border bg-[var(--reader-bg)] p-2.5 text-sm" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{book.editions.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="flex gap-2"><button onClick={()=>readBook(edition.id)} className="flex-1 flex items-center justify-center gap-2 bg-[var(--app-primary)] text-white rounded-xl p-2.5 text-sm font-semibold"><BookOpen size={16}/>Baca kitab</button><button aria-label={`Detail ${book.name}`} onClick={()=>openBook(edition.id)} className="rounded-xl border p-2.5"><ArrowUpRight size={18}/></button></div></>:<p className="text-xs opacity-60 leading-relaxed mt-auto">Edisi kitab ini belum ada pada katalog server ini.</p>}
        </article>;
      })}</div>}
      <details className="rounded-2xl border bg-[var(--reader-bg)] p-5 text-sm"><summary className="font-semibold cursor-pointer">Tentang pengelompokan dan rujukan</summary><div className="space-y-3 mt-4 text-sm leading-relaxed opacity-80"><p>Kelompok menampilkan judul sumber, bukan jumlah hadis atau penilaian kesahihan seluruh isinya. Jumlah edisi tidak menambah jumlah kitab dalam kelompok.</p><p>Kelompok sepuluh dan sebelas di sini mengikuti sumber Ithaf al-Maharah karya Ibnu Hajar. Nama kelompok dapat memiliki susunan berbeda dalam karya lain. Sunan an-Nasa’i pada Kutub Tis‘ah merujuk al-Mujtaba, bukan as-Sunan al-Kubra.</p><p>Katalog rujukan lokal: koleksi Maktabah Cakzen, kategori متون الحديث. Edisi yang dapat dibuka mengikuti koleksi server saat ini.</p><ul className="space-y-2">{data.references.map(reference=><li key={reference.url}><a href={reference.url} target="_blank" rel="noopener noreferrer" className="underline text-[var(--app-primary)]">{reference.title} ↗</a></li>)}</ul></div></details>
      <div className="flex flex-wrap gap-4 text-sm text-[var(--app-primary)]"><a className="underline" href={navigationHash('rowa')}>Kamus Perawi</a><a className="underline" href={navigationHash('authors')}>Penulis & Karya</a></div>
    </>}
  </section>;
}
