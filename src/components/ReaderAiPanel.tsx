import {useEffect,useRef,useState} from 'react';
import {X,BookOpen,RefreshCw} from 'lucide-react';
import {webAPI} from '../api';
import type {AiRequest} from '../lib/ai-source';
import {aiFailureMessage} from '../lib/ai-errors';
import {renderMarkdown} from '../lib/ai-markdown';

export function ReaderAiPanel({request,onClose,onBusyChange,onShowSource}:{request:AiRequest;onClose:()=>void;onBusyChange:(busy:boolean)=>void;onShowSource:()=>void}) {
  const [answer,setAnswer]=useState(''),[error,setError]=useState(''),[progress,setProgress]=useState('Menyiapkan halaman sumber…');
  const [busy,setBusy]=useState(true),[retry,setRetry]=useState(0);
  const heading=useRef<HTMLHeadingElement>(null);
  const title=request.intent==='translate'?'Terjemahan halaman':'Penjelasan halaman';
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);onBusyChange(true);setAnswer('');setError('');setProgress('Menyiapkan halaman sumber…');
    heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest'});
    webAPI.askAI(request.intent==='translate'?'Terjemahkan halaman ini':'Jelaskan halaman ini',request,message=>{if(!controller.signal.aborted)setProgress(message);},controller.signal)
      .then(result=>{if(controller.signal.aborted)return;if(result.status!=='success'||typeof result.answer!=='string'||!result.answer.trim())throw Error(result.message||'Jawaban belum diterima. Silakan coba lagi.');setAnswer(result.answer);})
      .catch(e=>{if(!controller.signal.aborted)setError(aiFailureMessage(e));})
      .finally(()=>{if(!controller.signal.aborted){setBusy(false);onBusyChange(false);}});
    return()=>{controller.abort();onBusyChange(false);};
  },[request,retry,onBusyChange]);
  return <section aria-label={title} aria-busy={busy} className="m-4 md:mx-8 rounded-2xl border border-[var(--app-primary)] bg-[var(--reader-bg)] p-4 md:p-5 font-sans text-[var(--app-text)] cursor-auto" dir="ltr" onClick={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
    <div className="flex items-start justify-between gap-3"><div><h3 ref={heading} tabIndex={-1} className="font-bold text-lg outline-none">{title}</h3><p className="text-xs opacity-70 mt-1">{request.source?.text?'Bagian teks yang dipilih':'Seluruh halaman'} · Jilid {request.source?.part??'—'} · Halaman {request.source?.page??'—'}</p></div><button type="button" onClick={onClose} aria-label="Tutup hasil AI" className="p-2 rounded-lg border"><X size={18}/></button></div>
    {request.source?.text&&<details className="mt-3 text-sm"><summary className="cursor-pointer">Teks yang dipilih</summary><p dir="auto" className="whitespace-pre-wrap break-words mt-2 max-h-40 overflow-y-auto" style={{fontFamily:'var(--arabic-font)'}}>{request.source.text}</p></details>}
    {busy&&<p role="status" className="flex items-center gap-2 text-sm mt-5"><RefreshCw size={16} className="animate-spin motion-reduce:animate-none"/>{progress}</p>}
    {error&&<div role="alert" className="mt-4 text-sm"><p>{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)} className="mt-3 px-4 py-2 rounded-lg border font-semibold">Coba lagi</button></div>}
    {answer&&<div className="mt-5 text-sm md:text-base leading-loose break-words" dir="auto" dangerouslySetInnerHTML={{__html:renderMarkdown(answer)}}/>}
    <button type="button" onClick={onShowSource} className="flex items-center gap-2 mt-5 text-xs font-semibold text-[var(--app-primary)]"><BookOpen size={15}/>Lihat teks sumber di halaman ini</button>
  </section>;
}
