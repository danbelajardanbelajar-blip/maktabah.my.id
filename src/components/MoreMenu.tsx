import {useEffect,useId,useRef,useState} from 'react';
import {Menu,BookOpen,UserCircle,Settings,MessageSquare,BookPlus,Upload,Info,Shield} from 'lucide-react';
import {navigationHash} from '../lib/navigation';
import type {AppTab} from '../lib/navigation';
const items: {tab?:AppTab;href?:string;label:string;icon:typeof Menu}[]=[
  {tab:'quran',label:"Al-Qur’an",icon:BookOpen},{tab:'rowa',label:'Kamus Perawi',icon:UserCircle},
  {tab:'authors',label:'Penulis & Karya',icon:UserCircle},
  {tab:'collection',label:'Koleksi Saya',icon:BookOpen},
  {tab:'settings',label:'Pengaturan Tampilan',icon:Settings},{tab:'feedback',label:'Masukan',icon:MessageSquare},
  {tab:'book_request',label:'Permintaan Kitab',icon:BookPlus},{tab:'book_submit',label:'Kirim Kitab',icon:Upload},
  {tab:'about',label:'Tentang Kami',icon:Info},{href:'/privacy-policy/',label:'Kebijakan Privasi',icon:Shield},
];
export function MoreLinks({onNavigate,onSelected}:{onNavigate:(tab:AppTab)=>void;onSelected?:()=>void}) {
  return <nav aria-label="Menu layanan lainnya" className="flex flex-col gap-1">{items.map(item=>{const Icon=item.icon;return <a key={item.label} href={item.href||navigationHash(item.tab!)} onClick={e=>{if(item.tab&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onNavigate(item.tab);}onSelected?.();}} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-primary)]/10 focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"><Icon size={18}/>{item.label}</a>;})}</nav>;
}
export function MoreDropdown({onNavigate}:{onNavigate:(tab:AppTab)=>void}) {
  const [open,setOpen]=useState(false), root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),id=useId();
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);button.current?.focus();}};
    const focus=(event:FocusEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);document.addEventListener('focusin',focus);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);document.removeEventListener('focusin',focus);};
  },[open]);
  return <div ref={root} className="relative flex items-center h-full"><button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setTimeout(()=>root.current?.querySelector<HTMLAnchorElement>('a')?.focus(),0);}}} className="flex items-center gap-2 px-4 py-4 font-semibold focus-visible:outline-2 focus-visible:outline-white"><Menu size={18}/>Lainnya</button>{open&&<div id={id} className="absolute right-0 top-full bg-[var(--reader-bg)] rounded-b-xl shadow-xl border min-w-64 max-h-[75dvh] overflow-auto p-2"><MoreLinks onNavigate={onNavigate} onSelected={()=>setOpen(false)}/></div>}</div>;
}
