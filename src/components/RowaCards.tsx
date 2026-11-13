import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {RowaProfileModal} from './RowaProfileModal';
import type {RowaDetail} from './RowaProfileModal';
import {useModalFocus} from '../lib/use-modal-focus';
import {BackButton} from './BackButton';

const RowaCards=createContext<(name:string,id?:number,returnLabel?:string)=>void>(()=>{});
export const useRowaCards=()=>useContext(RowaCards);
export function RowaCardsProvider({children}:{children:ReactNode}) {
  const [returnLabel,setReturnLabel]=useState('Kembali ke teks kitab');
  const [name,setName]=useState(''),[page,setPage]=useState(1),[reply,setReply]=useState<any>(null),[profile,setProfile]=useState<RowaDetail|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[profileId,setProfileId]=useState<number|null>(null);
  const origin=useRef<HTMLElement|null>(null),active=useRef(false);
  const open=useCallback((value:string,id?:number,label?:string)=>{if(!active.current){origin.current=document.activeElement as HTMLElement;setReturnLabel(label||'Kembali ke teks kitab');}else if(label)setReturnLabel(label);active.current=true;setName(value.trim());setPage(1);setProfileId(id||null);setProfile(null);setReply(null);setError('');setRetry(n=>n+1);},[]);
  const close=useCallback(()=>{active.current=false;setName('');setProfile(null);setReply(null);requestAnimationFrame(()=>{if(!active.current&&origin.current?.isConnected)origin.current.focus({preventScroll:true});});},[]);
  const dialog=useModalFocus(close,!!name&&!profile);
  useEffect(()=>{for(const event of ['hashchange','popstate','maktabah:navigate'])window.addEventListener(event,close);return()=>{for(const event of ['hashchange','popstate','maktabah:navigate'])window.removeEventListener(event,close);};},[close]);
  useEffect(()=>{if(!name)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[name]);
  useEffect(()=>{
    if(!name)return;
    const controller=new AbortController();setLoading(true);setError('');setProfile(null);
    const json=async(url:string)=>{const r=await fetch(url,{signal:controller.signal});const data=await r.json();if(!r.ok||data.error)throw Error(data.error||'Kamus perawi belum dapat dimuat.');return data;};
    const run=async()=>{
      let id=profileId;
      if(!id){const data=await json('/api/rowa/name-candidates?'+new URLSearchParams({q:name,page:String(page)}));if(controller.signal.aborted)return;setReply(data);if(data.total===1)id=data.data[0].id;}
      if(id){const data=await json('/api/rowa/'+id);if(!data.data)throw Error('Profil perawi tidak ditemukan.');if(!controller.signal.aborted)setProfile(data.data);}
    };
    void run().catch(e=>{if(!controller.signal.aborted)setError(e.message||'Profil perawi belum dapat dimuat.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[name,page,retry,profileId]);
  return <RowaCards.Provider value={open}>{children}
    {profile&&<RowaProfileModal rowa={profile} onClose={close} onSearchName={open} contextName={name} keepContextOnSearch closeLabel={returnLabel}/>}
    {name&&!profile&&createPortal(<div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close}><section ref={dialog} role="dialog" aria-modal="true" aria-label="Pilih profil perawi" tabIndex={-1} onClick={e=>e.stopPropagation()} className="bg-white text-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[90dvh] overflow-y-auto p-5 space-y-4">
      <div className="flex justify-between gap-3 items-start"><div><h2 className="font-bold text-xl">Kamus Perawi</h2><p className="text-xs text-gray-500 mt-2">Kecocokan nama dalam kamus. Pilih profil yang dimaksud.</p><p className="text-xl mt-3" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{name}</p></div><BackButton onClick={close} title={returnLabel}/></div>
      {loading?<p role="status" className="text-sm py-5">Memuat bithaqah perawi…</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(n=>n+1)} className="mt-3 underline">Coba lagi</button></div>:<>
        {reply?.total===0&&<p className="text-sm text-gray-500">Belum ditemukan profil yang cocok. Coba nama yang lebih lengkap.</p>}
        {reply?.data?.map((person:any)=><button key={person.id} type="button" onClick={()=>setProfileId(person.id)} className="block w-full text-right border rounded-xl p-4 hover:bg-emerald-50"><span className="block text-xl" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{person.name}</span><span className="block text-xs text-gray-500 mt-2" dir="auto">{person.ROTBA}{person.death?` · Wafat ${person.death}`:''}</span></button>)}
        {reply?.totalPages>1&&<div className="flex justify-between items-center text-xs"><button disabled={page<=1} onClick={()=>setPage(n=>n-1)} className="border rounded-lg p-2 disabled:opacity-40">Sebelumnya</button><span>{page} / {reply.totalPages}</span><button disabled={page>=reply.totalPages} onClick={()=>setPage(n=>n+1)} className="border rounded-lg p-2 disabled:opacity-40">Berikutnya</button></div>}
      </>}
      <form onSubmit={e=>{e.preventDefault();const value=new FormData(e.currentTarget).get('name');if(typeof value==='string'&&value.trim())open(value);}} className="flex gap-2 border-t pt-4"><input key={name} name="name" aria-label="Nama perawi pada kartu" maxLength={250} defaultValue={name} dir="auto" className="min-w-0 flex-1 border rounded-lg p-2"/><button className="border rounded-lg px-3 py-2 text-sm">Cari nama</button></form>
    </section></div>,document.body)}
  </RowaCards.Provider>;
}
