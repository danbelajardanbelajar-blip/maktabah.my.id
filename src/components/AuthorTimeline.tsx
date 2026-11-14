import {useEffect,useRef,useState} from 'react';
import {recordLibraryActivity} from '../lib/library-activity';
import {ArrowUpRight,ArrowLeft,ArrowRight,BookOpen} from 'lucide-react';
import {navigationHash} from '../lib/navigation';
export interface AuthorDate {kind:string;year:number|null;century:number|null;sortYear:number|null;label:string;original:string;}
export interface AuthorSummary {id:number;name:string;death_text:string;workCount:number;hasBiography?:boolean;deathDate?:AuthorDate;}
interface Props {authors:AuthorSummary[];context:Record<string,string|number|undefined>;onOpen:(id:number)=>void;}
export const dateOf=(author:AuthorSummary):AuthorDate=>author.deathDate||{kind:'unknown',year:null,century:null,sortYear:null,label:'Tahun belum terpetakan',original:author.death_text||''};
function AuthorCard({author,context,onOpen,compact=false}:{author:AuthorSummary;context:Props['context'];onOpen:Props['onOpen'];compact?:boolean}) {
  const date=dateOf(author);
  return <a href={navigationHash('authors',{...context,id:author.id})} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(author.id);}}} className={`author-journey-card${compact?' author-journey-card--compact':''}`}>
    <div className="author-journey-date"><span className={`author-date-pill ${date.kind==='unknown'?'is-undated':date.kind==='exact'?'is-exact':'is-qualified'}`}>{date.label}</span><ArrowUpRight size={15} aria-hidden="true"/></div>
    <h2 dir="rtl">{author.name}</h2>
    {date.kind!=='exact'&&date.original&&<p className="author-journey-source" dir="auto">{date.original}</p>}
    <div className="author-journey-card-footer"><span><BookOpen size={14} aria-hidden="true"/>{author.workCount.toLocaleString('id-ID')} kitab</span><span>{author.hasBiography?'Biografi tersedia':'Profil sumber'}</span></div>
    <span className="author-journey-card-link">Jelajahi profil <span aria-hidden="true">↗</span></span>
  </a>;
}
interface YearGroup {key:string;label:string;authors:AuthorSummary[];}
export function AuthorTimeline({context,onOpen}:Props) {
  const [groups,setGroups]=useState<YearGroup[]>([]),[selected,setSelected]=useState<string|null>(null);
  const [range,setRange]=useState({start:0,end:0,totalGroups:0}),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const rail=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null);
  const q=context.q||'',century=context.century||'',initial=context.initial||'';
  const lastDirection=useRef<'initial'|'left'|'right'>('initial');
  async function load(direction:'initial'|'left'|'right') {
    lastDirection.current=direction;request.current?.abort();const controller=new AbortController();request.current=controller;
    setBusy(true);setError('');
    const query=new URLSearchParams({timeline:'1',q:String(q),century:String(century),initial:String(initial)});
    if(direction!=='initial')query.set('start',String(direction==='left'?Math.max(0,range.start-10):range.end));
    const oldWidth=rail.current?.scrollWidth||0,oldLeft=rail.current?.scrollLeft||0;
    try {
      const response=await fetch(`/api/authors?${query}`,{signal:controller.signal});
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Layanan linimasa belum tersedia. Muat ulang setelah layanan diperbarui.');
      const result=await response.json();if(!response.ok)throw Error(result.error||'Gagal memuat rentang tahun.');
      if(!Array.isArray(result.groups))throw Error(['localhost','127.0.0.1'].includes(window.location.hostname)?'Layanan lokal ini belum mendukung linimasa tahun. Buka http://127.0.0.1:3082/#/penulis.':'Layanan linimasa sedang diperbarui. Muat ulang beberapa saat lagi.');
      if(controller.signal.aborted)return;
      setGroups(previous=>direction==='initial'?result.groups:direction==='left'?[...result.groups.filter((g:YearGroup)=>!previous.some(p=>p.key===g.key)),...previous]:[...previous,...result.groups.filter((g:YearGroup)=>!previous.some(p=>p.key===g.key))]);
      setRange(previous=>({start:direction==='right'?previous.start:result.start,end:direction==='left'?previous.end:result.end,totalGroups:result.totalGroups}));
      requestAnimationFrame(()=>{if(rail.current){rail.current.scrollLeft=direction==='left'?oldLeft+rail.current.scrollWidth-oldWidth:direction==='right'?oldWidth-rail.current.clientWidth+160:0;}});
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Gagal memuat linimasa.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  useEffect(()=>{setGroups([]);setSelected(null);load('initial');return()=>request.current?.abort();},[q,century,initial]);
  const active=groups.find(g=>g.key===selected);
  return <div className="author-year-browser">
    <div className="author-year-controls"><button disabled={busy||range.start===0} onClick={()=>load('left')}><ArrowLeft size={16}/>Muat kiri</button><span aria-live="polite">{busy?'Memuat tahun…':`${groups.length} dari ${range.totalGroups} penanda waktu`}</span><button disabled={busy||range.end>=range.totalGroups} onClick={()=>load('right')}>Muat kanan<ArrowRight size={16}/></button></div>
    <div className="author-year-scroll" ref={rail} tabIndex={0} role="region" aria-label="Linimasa horizontal tahun wafat Hijriah; geser kiri atau kanan">
      <ol className="author-year-rail">{groups.map(group=><li key={group.key}><button aria-pressed={selected===group.key} aria-controls="author-year-detail" onClick={()=>{setSelected(group.key);recordLibraryActivity('authors',{action:'timeline_year',query:String(q),result_count:group.authors.length,context:{view:'timeline',century:String(century),initial:String(initial),year:group.label}});}}><span className="author-year-label">{group.label}</span><span className="author-year-dot" aria-hidden="true"/><span className="author-year-count">{group.authors.length} penulis</span></button></li>)}</ol>
    </div>
    {error&&<div role="alert" className="author-journey-empty">{error}<button onClick={()=>load(lastDirection.current)}>Coba lagi</button></div>}
    <section id="author-year-detail" className="author-year-detail" aria-live="polite">
      {active?<><h3>{active.label} <span>· {active.authors.length} penulis</span></h3><p>Rujukan wafat sesuai sumber. Keterangan sebelum, setelah, atau perkiraan tercantum pada kartu.</p><AuthorCards authors={active.authors} context={context} onOpen={onOpen}/></>:<p className="author-year-prompt">Klik tahun pada linimasa untuk menampilkan nama penulis dan membuka profilnya.</p>}
    </section>
  </div>;
}
export function AuthorCards({authors,context,onOpen}:Props) {
  return <div className="author-card-grid">{authors.map(a=><AuthorCard key={a.id} author={a} context={context} onOpen={onOpen} compact/>)}</div>;
}
