import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import './rowa-browse.css';
interface Year {key:string;label:string;count:number;}
export function RowaTimeline({q,century,initial,year,onYear,children}:{q:string;century:string;initial:string;year:string;onYear:(year:string)=>void;children:ReactNode}) {
  const [groups,setGroups]=useState<Year[]>([]),[range,setRange]=useState({start:0,end:0,totalGroups:0}),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const rail=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null),lastDirection=useRef<'initial'|'left'|'right'>('initial');
  async function load(direction:'initial'|'left'|'right'){
    request.current?.abort();const controller=new AbortController();request.current=controller;lastDirection.current=direction;setBusy(true);setError('');
    const query=new URLSearchParams({timeline:'1',q,century,initial,year});if(direction!=='initial')query.set('start',String(direction==='left'?Math.max(0,range.start-10):range.end));
    const oldWidth=rail.current?.scrollWidth||0,oldLeft=rail.current?.scrollLeft||0;
    try{const response=await fetch('/api/rowa/browse?'+query,{signal:controller.signal});const data=await response.json();if(!response.ok||data.browseVersion!==1)throw Error(data.error||'Linimasa perawi belum tersedia.');if(controller.signal.aborted)return;
      setGroups(previous=>direction==='initial'?data.groups:direction==='left'?[...data.groups.filter((g:Year)=>!previous.some(p=>p.key===g.key)),...previous]:[...previous,...data.groups.filter((g:Year)=>!previous.some(p=>p.key===g.key))]);
      setRange(previous=>({start:direction==='right'?previous.start:data.start,end:direction==='left'?previous.end:data.end,totalGroups:data.totalGroups}));
      requestAnimationFrame(()=>{if(rail.current){const selected=rail.current.querySelector<HTMLButtonElement>('[aria-pressed="true"]');rail.current.scrollLeft=direction==='left'?oldLeft+rail.current.scrollWidth-oldWidth:direction==='right'?oldWidth-rail.current.clientWidth+160:selected?selected.offsetLeft-rail.current.offsetLeft-(rail.current.clientWidth-selected.clientWidth)/2:0;}});
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Linimasa belum dapat dimuat.');}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  // Keep the loaded rail when a year is clicked; only search/era/alphabet reset it.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{setGroups([]);load('initial');return()=>request.current?.abort();},[q,century,initial]);
  return <div className="author-year-browser rowa-timeline">
    <div className="author-year-controls"><button disabled={busy||range.start===0} onClick={()=>load('left')}><ArrowLeft size={16}/>Muat kiri</button><span aria-live="polite">{busy?'Memuat tahun…':`${groups.length} dari ${range.totalGroups} penanda waktu`}</span><button disabled={busy||range.end>=range.totalGroups} onClick={()=>load('right')}>Muat kanan<ArrowRight size={16}/></button></div>
    <div className="author-year-scroll" ref={rail} role="region" tabIndex={0} aria-label="Linimasa horizontal tahun wafat perawi"><ol className="author-year-rail">{groups.map(group=><li key={group.key}><button data-year={group.key} aria-pressed={year===group.key} aria-controls="rowa-year-detail" onClick={()=>onYear(group.key)}><span className="author-year-label">{group.label}</span><span className="author-year-dot" aria-hidden="true"/><span className="author-year-count">{group.count.toLocaleString('id-ID')} perawi</span></button></li>)}</ol></div>
    {error&&<div role="alert" className="author-journey-empty">{error}<button className="block underline mt-2 mx-auto" onClick={()=>load(lastDirection.current)}>Coba lagi</button></div>}
    <section id="rowa-year-detail" className="author-year-detail" aria-label="Perawi pada waktu pilihan">{year?children:<p className="author-year-prompt">Klik tahun untuk menampilkan nama perawi dan membuka bithaqah-nya.</p>}</section>
  </div>;
}
