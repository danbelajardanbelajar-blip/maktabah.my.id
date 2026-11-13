import {useEffect,useState} from 'react';
import {Search,Users,ArrowLeft,ArrowRight,GitBranch,LayoutGrid,Library} from 'lucide-react';
import {pushLocation} from '../lib/back-navigation';
import {navigationHash,routePage} from '../lib/navigation';
import {useRowaCards} from './RowaCards';
import {RowaTimeline} from './RowaTimeline';
import {parseKutub} from './RowaProfileModal';
import type {RowaResult} from './RowaProfileModal';
import type {AuthorDate} from './AuthorTimeline';
import './author-journey.css';
interface Narrator extends RowaResult {name:string;deathDate:AuthorDate;hasBiography:boolean;}
const number=(n:number)=>n.toLocaleString('id-ID');
export default function RowaDictionary(){
  const openRowa=useRowaCards();
  const [location,setLocation]=useState(window.location.hash),[reply,setReply]=useState<{key:string;data:any}|null>(null),[facets,setFacets]=useState<any>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const params=new URLSearchParams(location.split('?')[1]||''),q=params.get('q')||'',century=params.get('century')||'',initial=params.get('initial')||'',year=params.get('year')||'',page=routePage(params.get('page'));
  const view=params.get('view')==='cards'||(!params.has('view')&&params.get('sort')==='name')?'cards':'timeline',sort=view==='timeline'?'death':params.get('sort')==='death'?'death':'name';
  const [input,setInput]=useState(q);
  const key=new URLSearchParams({q,century,initial,year,sort,page:String(page),limit:'24'}).toString(),data=reply?.key===key?reply.data:null;
  const context={q:q||undefined,century:century||undefined,initial:initial||undefined,year:year||undefined,view,sort};
  const go=(values:Record<string,string|number|undefined>)=>{pushLocation(navigationHash('rowa',values));window.dispatchEvent(new Event('maktabah:navigate'));};
  useEffect(()=>{const update=()=>setLocation(window.location.hash);window.addEventListener('hashchange',update);window.addEventListener('popstate',update);window.addEventListener('maktabah:navigate',update);return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update);window.removeEventListener('maktabah:navigate',update);};},[]);
  useEffect(()=>setInput(q),[q]);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');fetch('/api/rowa/browse?'+key,{signal:controller.signal}).then(async response=>{
    const local=['localhost','127.0.0.1'].includes(window.location.hostname),upgrade=local?'Layanan perawi pada alamat ini belum diperbarui. Buka http://127.0.0.1:3089/#/perawi.':'Layanan perawi sedang diperbarui. Silakan muat ulang.';
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error(upgrade);
    const result=await response.json();if(result.browseVersion!==1)throw Error(upgrade);if(!response.ok)throw Error(result.error||'Gagal memuat perawi.');return result;
  }).then(result=>{if(!controller.signal.aborted){setReply({key,data:result});setFacets(result);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[key,retry]);
  const overview=facets?.overview;
  const cards=<>{loading?<p className="author-journey-empty" role="status">Memuat perawi…</p>:data?.data?.length?<div className="author-card-grid">{data.data.map((row:Narrator)=><article key={row.id} className="author-journey-card">
    <div className="author-journey-date"><span className={`author-date-pill ${row.deathDate.kind==='unknown'?'is-undated':row.deathDate.kind==='exact'?'is-exact':'is-qualified'}`}>{row.deathDate.label}</span></div>
    <h2 dir="rtl"><button className="text-right w-full cursor-pointer" onClick={()=>openRowa(row.name,row.id,'Kembali ke daftar perawi')}>{row.name}</button></h2>
    {row.deathDate.original&&<p className="author-journey-source" dir="auto">Wafat · {row.deathDate.original}</p>}
    {row.ROTBA&&<p dir="rtl" className="text-sm leading-relaxed opacity-80" style={{fontFamily:'var(--arabic-font)'}}>{row.ROTBA}</p>}
    {parseKutub(row.kutub).length>0&&<p dir="rtl" className="text-xs leading-relaxed opacity-70">{parseKutub(row.kutub).join(' · ')}</p>}
    <div className="author-journey-card-footer"><span><Users size={14}/>{row.hasBiography?'Biografi tersedia':'Profil sumber'}</span><span>#{row.id}</span></div>
    <button className="author-journey-card-link cursor-pointer" onClick={()=>openRowa(row.name,row.id,'Kembali ke daftar perawi')}>Lihat Profil <span aria-hidden="true">↗</span></button>
  </article>)}</div>:<p className="author-journey-empty">Tidak ada perawi yang sesuai. Ubah pencarian atau filter.</p>}</>;
  return <section className="author-journey">
    <header className="author-journey-hero"><div className="author-journey-hero-inner"><div><div className="author-journey-eyebrow"><Users size={14}/>JEJAK PARA PERAWI</div><h1>Kamus Perawi</h1><p>Telusuri generasi periwayat hadis, baca biografi dan penilaian ulama, serta jelajahi guru dan murid mereka.</p></div><div className="author-journey-emblem" aria-hidden="true"><Library size={51}/></div></div>
      <div className="author-journey-stats" aria-label="Ringkasan koleksi perawi"><div><strong>{overview?number(overview.narrators):'—'}</strong><span>perawi sumber</span></div><div><strong>{overview?number(overview.dated):'—'}</strong><span>rujukan waktu</span></div><div><strong>{overview?number(overview.biographies):'—'}</strong><span>biografi tersedia</span></div></div>
    </header>
    <div className="author-browser-tools"><form className="author-browser-form" onSubmit={e=>{e.preventDefault();go({...context,q:input.trim(),year:undefined,view:'cards',sort:'name'});}}>
      <label className="author-search-field"><span>Nama perawi</span><input aria-label="Nama perawi" value={input} onChange={e=>setInput(e.target.value)} placeholder="Cari nama, misalnya البخاري" dir="auto"/></label>
      <label className="author-era-field"><span>Abad rujukan · Hijriah</span><select aria-label="Abad rujukan Hijriah" value={century} onChange={e=>go({...context,century:e.target.value||undefined,year:undefined})}><option value="">Semua abad</option>{facets?.eras?.map((era:{century:number;count:number})=><option key={era.century} value={era.century}>Abad ke-{era.century} H · {number(era.count)}</option>)}{century&&century!=='unknown'&&!facets?.eras?.some((e:{century:number})=>String(e.century)===century)&&<option value={century}>Abad ke-{century} H</option>}<option value="unknown">Belum terpetakan{facets?` · ${number(facets.unknownDates)}`:''}</option></select></label>
      {view==='cards'&&<label><span>Urutkan</span><select aria-label="Urutkan" value={sort} onChange={e=>go({...context,sort:e.target.value})}><option value="name">Nama</option><option value="death">Tahun wafat</option></select></label>}<button className="author-browser-search"><Search size={17}/>Cari</button>
    </form>
    {view==='cards'&&facets?.initials&&<div className="author-alphabet-section"><p className="author-alphabet-heading">Pilih huruf awal nama</p><p className="author-alphabet-note">Mengikuti nama yang tertulis; أ، إ، آ dikelompokkan pada ا. Awalan ال dan ابن tetap dihitung.</p><div className="author-alphabet" role="group" aria-label="Abjad nama perawi" dir="rtl" aria-busy={loading}><button disabled={loading} aria-pressed={!initial} onClick={()=>go({...context,initial:undefined,year:undefined})}><span>Semua</span><small>{number(facets.initials.reduce((n:number,item:{count:number})=>n+item.count,0))}</small></button>{facets.initials.map((item:{initial:string;count:number})=><button key={item.initial} data-initial={item.initial} aria-label={item.initial==='other'?'Huruf lainnya':`Huruf ${item.initial}`} aria-pressed={initial===item.initial} disabled={loading||(!item.count&&initial!==item.initial)} onClick={()=>go({...context,initial:item.initial,year:undefined})}><span className={item.initial==='other'?'':'author-alphabet-letter'}>{item.initial==='other'?'Lainnya':item.initial}</span><small>{number(item.count)}</small></button>)}</div></div>}
    <div className="author-browser-bottom"><div className="author-view-switch" role="group" aria-label="Tampilan daftar perawi"><button aria-pressed={view==='timeline'} onClick={()=>go({...context,view:'timeline',sort:'death'})}><GitBranch size={15}/>Linimasa</button><button aria-pressed={view==='cards'} onClick={()=>go({...context,view:'cards',sort:'name'})}><LayoutGrid size={15}/>Kartu</button></div><p className="author-result-count" aria-live="polite">{data?<><strong>{number(data.total)}</strong> perawi{q?` untuk “${q}”`:''}</>:loading?'Memuat koleksi…':''}</p></div>
    <p className="author-alphabet-note">Linimasa memakai rujukan tahun wafat Hijriah. Tahun perkiraan ditandai pada kartu; tanggal yang ambigu ditempatkan di “Tahun belum terpetakan”.</p>
    {(year||(initial&&view==='timeline'))&&<div className="flex gap-3 flex-wrap text-sm">{year&&<button className="underline" onClick={()=>go({...context,year:undefined})}>Hapus filter waktu: {data?.selectedYear?.label||year}</button>}{initial&&view==='timeline'&&<button className="underline" onClick={()=>go({...context,initial:undefined,year:undefined})}>Hapus filter huruf: {initial==='other'?'Lainnya':initial}</button>}</div>}
    </div>
    {error?<div className="author-journey-empty" role="alert">{error}<button className="block underline mt-3 mx-auto" onClick={()=>setRetry(n=>n+1)}>Coba lagi</button></div>:view==='timeline'?<RowaTimeline q={q} century={century} initial={initial} year={year} onYear={value=>go({...context,year:value})}>{data?.selectedYear&&<h2 className="font-semibold mb-4">{data.selectedYear.label} · {number(data.total)} perawi</h2>}{cards}</RowaTimeline>:cards}
    {!error&&data?.totalPages>1&&(view==='cards'||year)&&<nav className="author-pagination" aria-label="Halaman perawi"><button disabled={loading||page<=1} onClick={()=>go({...context,page:page-1})}><ArrowLeft size={16}/>Sebelumnya</button><span>{page} / {data.totalPages}</span><button disabled={loading||page>=data.totalPages} onClick={()=>go({...context,page:page+1})}>Berikutnya<ArrowRight size={16}/></button></nav>}
  </section>;
}
