import {useEffect,useState} from 'react';
import {BookOpen,Search,Users,ArrowLeft,ArrowRight,GitBranch,LayoutGrid,Library,Feather} from 'lucide-react';
import {pushLocation} from '../lib/back-navigation';
import {navigationHash,routePage} from '../lib/navigation';
import {AuthorTimeline,AuthorCards} from './AuthorTimeline';
import type {AuthorSummary} from './AuthorTimeline';
import './author-journey.css';
interface Author extends AuthorSummary {biography?:string;source_ref:string;}
interface Work {book_id:number;title:string;basis:string;evidence:string;status:string;source_ref:string;}
const basisName=(basis:string)=>basis==='admin-reviewed'?'Ditinjau admin':basis==='source-explicit'?'Relasi eksplisit sumber':'Kecocokan metadata';
const number=(n:number)=>n.toLocaleString('id-ID');
export function Authors({openBook,readBook}:{openBook:(id:number)=>void;readBook:(id:number)=>void}) {
  const [location,setLocation]=useState(window.location.hash),[reply,setReply]=useState<{location:string;data:any}|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  const data=reply?.location===location?reply.data:null;
  const params=new URLSearchParams(location.split('?')[1]||''),id=params.get('id'),page=routePage(params.get('page'));
  const q=params.get('q')||'',century=params.get('century')||'';
  const view=params.get('view')==='cards'||(!params.has('view')&&params.get('sort')==='name')?'cards':'timeline';
  const sort=view==='timeline'?'death':params.get('sort')==='death'?'death':'name';
  const listPage=id?routePage(params.get('listPage')):page;
  const [input,setInput]=useState(q);
  useEffect(()=>{
    const update=()=>setLocation(window.location.hash);
    window.addEventListener('hashchange',update);window.addEventListener('popstate',update);window.addEventListener('maktabah:navigate',update);
    return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update);window.removeEventListener('maktabah:navigate',update);};
  },[]);
  useEffect(()=>setInput(q),[q]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setReply(null);
    if(id&&!/^[1-9]\d*$/.test(id)){setError('Tautan penulis tidak valid.');setLoading(false);return;}
    const query=new URLSearchParams({q,sort,page:String(page),limit:view==='timeline'?'12':'24'});
    if(century)query.set('century',century);
    const endpoint=id?`/api/authors/${id}?page=${page}`:`/api/authors?${query}`;
    fetch(endpoint,{signal:controller.signal}).then(async r=>{
      if(!r.headers.get('content-type')?.includes('application/json'))throw Error(['127.0.0.1','localhost'].includes(window.location.hostname)?'Layanan penulis pada alamat ini belum diperbarui. Untuk versi lokal terbaru, buka http://127.0.0.1:3081/#/penulis.':'Layanan penulis belum memberikan data. Muat ulang beberapa saat lagi.');
      const result=await r.json();if(!r.ok)throw Error(result.error||'Gagal memuat penulis.');return result;
    }).then(data=>{if(!controller.signal.aborted)setReply({location,data});})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[location,retry]);
  const context={q:q||undefined,sort,view,century:century||undefined};
  const go=(values:Record<string,string|number|undefined>)=>{
    pushLocation(navigationHash('authors',values));window.dispatchEvent(new Event('maktabah:navigate'));window.scrollTo(0,0);
  };
  const openAuthor=(authorId:number)=>go({...context,id:authorId,listPage:page});
  const changePage=(n:number)=>go({...context,id:id||undefined,page:n,listPage:id?listPage:undefined});
  const author:Author|undefined=id?data?.data:undefined;
  const overview=data?.overview;
  return <section className="author-journey">
    {!id?<header className="author-journey-hero">
      <div className="author-journey-hero-inner"><div>
        <div className="author-journey-eyebrow"><Feather size={14} aria-hidden="true"/>PUSTAKA PARA PENULIS</div>
        <h1>Penulis & Karya</h1>
        <p>Menelusuri jejak keilmuan dari generasi ke generasi. Temukan para penulis, baca biografinya, dan jelajahi karya mereka dalam koleksi Maktabah Cakzen.</p>
      </div><div className="author-journey-emblem" aria-hidden="true"><Library size={51}/></div></div>
      <div className="author-journey-stats" aria-label="Ringkasan koleksi penulis">
        <div><strong>{overview?number(overview.authors):'—'}</strong><span>penulis sumber</span></div>
        <div><strong>{overview?number(overview.dated):'—'}</strong><span>rujukan waktu</span></div>
        <div><strong>{overview?number(overview.linkedWorks):'—'}</strong><span>kitab tertaut</span></div>
      </div>
    </header>:<header className="rounded-2xl border bg-[var(--reader-bg)] p-5 sm:p-7">
      <div className="flex items-center gap-3"><Users className="text-[var(--app-primary)]"/><h1 className="font-bold text-2xl">Penulis & Karya</h1></div>
      <p className="text-sm opacity-70 mt-3 leading-relaxed">Biografi dari koleksi Maktabah Cakzen dan kitab yang tersedia di pustaka ini. Setiap hubungan karya dilengkapi dasar pencocokan atau catatan tinjauan.</p>
    </header>}
    {id?<button onClick={()=>go({...context,page:listPage})} className="inline-flex self-start items-center gap-2 px-4 py-2 rounded-xl border bg-[var(--reader-bg)]"><ArrowLeft size={17}/>Daftar penulis</button>:<div className="author-browser-tools">
      <form onSubmit={e=>{e.preventDefault();go({...context,q:input.trim()});}} className="author-browser-form">
        <label className="author-search-field"><span>Nama penulis</span><input aria-label="Nama penulis" value={input} onChange={e=>setInput(e.target.value)} placeholder="Cari nama, misalnya السيوطي" dir="auto"/></label>
        <label className="author-era-field"><span>Abad rujukan · Hijriah</span><select aria-label="Abad rujukan Hijriah" value={century} onChange={e=>go({...context,q:input.trim(),century:e.target.value||undefined})}>
          <option value="">Semua abad</option>
          {data?.eras?.map((era:{century:number;count:number})=><option key={era.century} value={era.century}>Abad ke-{era.century} H · {number(era.count)}</option>)}
          {century&&century!=='unknown'&&!data?.eras?.some((e:{century:number})=>String(e.century)===century)&&<option value={century}>Abad ke-{century} H</option>}
          <option value="unknown">Belum terpetakan{data?.unknownDates!==undefined?` · ${number(data.unknownDates)}`:''}</option>
        </select></label>
        {view==='cards'&&<label><span>Urutkan</span><select aria-label="Urutkan" value={sort} onChange={e=>go({...context,q:input.trim(),sort:e.target.value})}><option value="name">Nama</option><option value="death">Tahun wafat</option></select></label>}
        <button className="author-browser-search"><Search size={17} aria-hidden="true"/>Cari</button>
      </form>
      <div className="author-browser-bottom">
        <div className="author-view-switch" role="group" aria-label="Tampilan daftar penulis">
          <button aria-pressed={view==='timeline'} onClick={()=>go({...context,q:input.trim(),view:'timeline',sort:'death'})}><GitBranch size={15} aria-hidden="true"/>Linimasa</button>
          <button aria-pressed={view==='cards'} onClick={()=>go({...context,q:input.trim(),view:'cards',sort:'name'})}><LayoutGrid size={15} aria-hidden="true"/>Kartu</button>
        </div>
        <p className="author-result-count" aria-live="polite">{data?<><strong>{number(data.total)}</strong> penulis{q?` untuk “${q}”`:' dalam koleksi'}</>:loading?'Memuat koleksi…':'Telusuri koleksi penulis'}</p>
      </div>
    </div>}
    {loading&&<p role="status" className="author-journey-loading">Menyiapkan jejak para penulis…</p>}
    {error&&<div role="alert" className="p-5 bg-red-50 text-red-800 rounded-xl border">{error}<button onClick={()=>setRetry(v=>v+1)} className="block underline mt-3">Coba lagi</button></div>}
    {!loading&&!error&&author&&<>
      <article className="bg-[var(--reader-bg)] border rounded-2xl p-5 sm:p-7 space-y-4"><h2 className="text-3xl leading-relaxed font-bold break-words" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{author.name}</h2><div className="flex flex-wrap gap-3 text-sm"><span className="px-3 py-1 rounded-full bg-[var(--app-primary)]/10">{author.workCount} kitab tersedia</span>{author.death_text?.trim()&&<span>Wafat: <span dir="auto">{author.death_text}</span></span>}</div><h3 className="font-bold border-t pt-4">Biografi</h3>{author.biography?.trim()?<div className="whitespace-pre-wrap break-words text-lg leading-loose" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{author.biography}</div>:<p className="opacity-60 text-sm">Biografi belum tersedia dalam sumber ini.</p>}<p className="text-xs opacity-60 border-t pt-3 break-words">Sumber: {author.source_ref}</p></article>
      <div><h3 className="text-xl font-bold mb-2">Kitab di Pustaka Ini</h3><p className="text-sm opacity-70">Daftar ini memuat karya yang sudah tertaut. Metadata yang belum cocok menunggu pemeriksaan admin.</p></div>
      {data.works.length===0&&<p className="p-7 text-center rounded-xl border bg-[var(--reader-bg)]">Belum ada kitab tersedia yang tertaut dengan penulis ini.</p>}
      {data.works.map((w:Work)=><article key={w.book_id} className="p-5 border rounded-2xl bg-[var(--reader-bg)] space-y-3"><button onClick={()=>openBook(w.book_id)} className="block w-full text-right text-xl font-bold hover:text-[var(--app-primary)]" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{w.title}</button><div className="flex gap-2 items-center flex-wrap"><span className="text-xs rounded-full bg-[var(--app-primary)]/10 px-3 py-1">{basisName(w.basis)}</span><button onClick={()=>readBook(w.book_id)} className="ml-auto px-4 py-2 rounded-lg bg-[var(--app-primary)] text-white font-semibold flex items-center gap-2"><BookOpen size={16}/>Baca kitab</button></div><details className="text-sm"><summary className="cursor-pointer opacity-70">Dasar relasi & sumber</summary><p className="mt-2 whitespace-pre-wrap break-words" dir="auto">{w.evidence}</p><p className="text-xs opacity-60 mt-2 break-words">{w.source_ref}</p></details></article>)}
    </>}
    {!loading&&!error&&data&&!id&&<>
      <div className="author-journey-section-heading"><div><h2>{view==='timeline'?'Jejak Penulis Lintas Zaman':'Mengenal Para Penulis'}</h2><p>{view==='timeline'?'Berdasarkan rujukan wafat Hijriah. Urutan tidak menunjukkan jarak waktu berskala; penanda sekitar/setelah/abad dipertahankan.':'Pilih nama untuk membuka biografi dan karya yang tersedia.'}</p></div><span dir="rtl">أعلام ومؤلفات</span></div>
      {data.total===0?<p className="author-journey-empty">Tidak ada nama pada pilihan ini. Coba bagian nama atau abad yang lain.</p>:view==='timeline'?<AuthorTimeline authors={data.data} context={{...context,listPage:page}} onOpen={openAuthor}/>:<AuthorCards authors={data.data} context={{...context,listPage:page}} onOpen={openAuthor}/>}
    </>}
    {!loading&&data?.totalPages>1&&<nav aria-label="Halaman penulis dan karya" className="author-pagination">
      <button disabled={page<=1} onClick={()=>changePage(page-1)}><ArrowLeft size={14} aria-hidden="true"/>Sebelumnya</button>
      <span>Halaman {page} dari {data.totalPages}</span>
      <button disabled={page>=data.totalPages} onClick={()=>changePage(page+1)}>Berikutnya<ArrowRight size={14} aria-hidden="true"/></button>
    </nav>}
  </section>;
}
