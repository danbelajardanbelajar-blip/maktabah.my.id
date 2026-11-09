import {useEffect,useRef,useState} from 'react';
import {Download,Upload,Pause,RotateCcw,CheckCircle2,AlertTriangle} from 'lucide-react';
import {openCompact} from '../lib/compact-transfer';
import type {CompactArchive} from '../lib/compact-transfer';

type Session={id:string;status:string;next:number;total:number;busy?:boolean;pendingBook?:string;manifest:{books:number;pages:number;categories:{name:string}[]};stats:{imported:number;skipped:number;pages:number;booksDone:number}};
type ExportJob={id:string;status:string;error?:string;downloadUrl?:string;progress?:{booksDone:number;totalBooks:number;pagesDone:number};result?:{bytes:number;parts:number}};
const exportKey='maktabah-compact-export';
export function CompactTransfer({token,mode,selection,onLogout,onChanged,onBusyChange}:{token:string;mode:'export'|'import';selection:{bookIds?:number[];categoryIds?:number[]};onLogout:()=>void;onChanged:()=>void;onBusyChange:(busy:boolean)=>void}){
 const [archive,setArchive]=useState<CompactArchive|null>(null),[session,setSession]=useState<Session|null>(null),[job,setJob]=useState<ExportJob|null>(null);
 const [jobId,setJobId]=useState(()=>localStorage.getItem(exportKey)||''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[scan,setScan]=useState(0);
 const stop=useRef(false),controller=useRef<AbortController|null>(null),mounted=useRef(true);
 const fileCompleted=!!archive&&session?.id===archive.id&&session.status==='done';
 const headers={Authorization:'Bearer '+token};
 const request=async(url:string,options:RequestInit={})=>{
  const r=await fetch('/api/admin/compact'+url,{...options,headers:{...headers,...options.headers},cache:'no-store'});
  const data=await r.json().catch(()=>({error:'Respons server terputus. Muat status untuk memeriksa bagian terakhir yang tersimpan.'}));if(r.status===401)onLogout();if(!r.ok)throw new Error(data.error||'Permintaan gagal ('+r.status+').');return data;
 };
 const refresh=async()=>{const s=await request('/current');if(mounted.current)setSession(s);return s as Session|null;};
 useEffect(()=>{mounted.current=true;if(mode==='import')void refresh().catch(e=>setError(e.message));return()=>{mounted.current=false;stop.current=true;controller.current?.abort();};},[token]);
 useEffect(()=>{if(mode==='import')void refresh().catch(e=>setError(e.message));},[mode]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 useEffect(()=>{
  if(!jobId)return;let ended=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const j=await request('/exports/'+jobId);if(ended)return;setJob(j);if(j.status==='running'){setBusy(true);timer=setTimeout(poll,1000);}else setBusy(false);}catch(e){if(!ended){setError(e instanceof Error?e.message:'Status export belum tersedia.');setBusy(false);localStorage.removeItem(exportKey);}}};
  void poll();return()=>{ended=true;clearTimeout(timer);};
 },[jobId,token]);
 const startExport=async()=>{
  setError('');setMessage('');setBusy(true);
  try{const j=await request('/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selection)});setJob(j);setJobId(j.id);localStorage.setItem(exportKey,j.id);}
  catch(e){setError(e instanceof Error?e.message:'Export gagal.');setBusy(false);}
 };
 const choose=async(file?:File)=>{
  if(!file)return;setBusy(true);setError('');setMessage('');setArchive(null);setConfirmed(false);setScan(0);controller.current=new AbortController();
  try{const a=await openCompact(file,setScan,controller.current.signal);if(mounted.current){setArchive(a);await refresh();}}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'File tidak dapat dibaca.');}
  finally{if(mounted.current)setBusy(false);}
 };
 const startImport=async()=>{
  if(!archive||!confirmed)return;
  setBusy(true);setError('');setMessage('');stop.current=false;controller.current=new AbortController();
  try{
   let current=await refresh();
   if(current&&current.id!==archive.id)throw new Error('Akhiri sesi lain yang belum selesai sebelum mengimport paket ini.');
   if(current?.status==='cancelling')throw new Error('Pembersihan kitab belum selesai. Klik Akhiri sesi lagi.');
   if(current?.busy)throw new Error('Bagian aktif masih diproses. Tunggu sebentar, lalu klik Lanjutkan.');
   const send=async(sequence:number,url:string)=>{
    const f=archive.frames[sequence];
    return request(url,{method:'POST',signal:controller.current!.signal,headers:{'Content-Type':'application/octet-stream','X-Part-SHA256':f.hash,'X-Total-Parts':String(archive.frames.length)},body:archive.file.slice(f.offset,f.offset+f.length)});
   };
   // Always validate the manifest on resume, including a previously completed archive.
   current=await send(0,'/start');if(mounted.current)setSession(current);
   while(current!.status!=='done'&&!stop.current){
    current=await send(current!.next,'/import/'+archive.id+'/parts/'+current!.next);
    if(!mounted.current)return;
    setSession(current);
   }
   if(mounted.current){setMessage(current!.status==='done'?'Import selesai. File sementara tidak disimpan di VPS.':'Import dijeda. Pilih file yang sama untuk melanjutkan dari bagian terakhir.');onChanged();}
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Import terputus. Muat status lalu lanjutkan.');await refresh().catch(()=>{});onChanged();}}
  finally{if(mounted.current)setBusy(false);}
 };
 const cancel=async()=>{
  if(!session||!window.confirm('Akhiri sesi? Kitab yang sudah lengkap tetap tersimpan. Halaman kitab yang belum lengkap akan dibersihkan.'))return;
  setBusy(true);setError('');setMessage('Membersihkan kitab yang belum lengkap… Kitab yang selesai tetap tersimpan.');
  try{const s=await request('/import/'+session.id+'/cancel',{method:'POST'});setSession(s);setMessage('Sesi diakhiri. Kitab lengkap tetap tersimpan; kitab yang belum lengkap sudah dibersihkan.');setConfirmed(false);onChanged();}
  catch(e){setError(e instanceof Error?e.message:'Pembersihan belum selesai. Coba lagi.');await refresh().catch(()=>{});}
  finally{setBusy(false);}
 };
 const button='inline-flex items-center justify-center gap-2 min-h-11 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed';
 return <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
  <div><h3 className="font-bold text-gray-900">Transfer hemat ruang</h3><p className="text-sm text-gray-600 mt-1">Satu file .mkt berisi bagian kecil terkompresi. Saat import, hanya satu bagian dikirim dan diproses; file besar tidak disalin ke disk VPS.</p></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 text-red-800 p-3 text-sm flex gap-2"><AlertTriangle size={18} className="shrink-0"/>{error}</p>}
  {message&&<p role="status" className="rounded-lg bg-emerald-100 text-emerald-900 p-3 text-sm">{message}</p>}
  {mode==='export'?<>
   <button className={button+' bg-[var(--app-primary)] text-white'} disabled={busy||!(selection.bookIds?.length||selection.categoryIds?.length)} onClick={startExport}><Download size={17}/>Export pilihan hemat ruang</button>
   {job?.status==='running'&&<p role="status" className="text-sm">Menyiapkan paket… {job.progress?.booksDone||0} / {job.progress?.totalBooks||0} kitab · {job.progress?.pagesDone||0} halaman. Proses berjalan di server lokal meski halaman dimuat ulang.</p>}
   {job?.status==='failed'&&<p role="alert" className="text-red-800 text-sm">{job.error}</p>}
   {job?.status==='ready'&&<div className="space-y-2"><p className="text-sm font-semibold text-emerald-900">Export siap: {job.result?.parts} bagian · {((job.result?.bytes||0)/1024**2).toLocaleString('id-ID',{maximumFractionDigits:1})} MB</p><a className={button+' bg-[var(--app-primary)] text-white'} href={job.downloadUrl||'#'}><Download size={17}/>Unduh paket .mkt</a><p className="text-xs text-gray-500">Unduh dalam 24 jam, lalu buka mode ini di web online untuk import.</p></div>}
  </>:<>
   <label className="block rounded-xl border-2 border-dashed bg-white p-4 text-sm font-semibold">Pilih paket .mkt<input aria-label="Pilih paket hemat ruang" type="file" accept=".mkt" disabled={busy} className="block mt-3 w-full font-normal" onChange={e=>void choose(e.target.files?.[0])}/></label>
   {busy&&!session&&!archive&&<p role="status" className="text-sm">Memeriksa susunan bagian… {scan}%</p>}
   {archive&&<div className="rounded-xl border bg-white p-4 space-y-2 text-sm"><h4 className="font-bold">Pratinjau paket</h4><p>{archive.manifest.categories.length} kategori · {archive.manifest.books} kitab · {archive.manifest.pages.toLocaleString('id-ID')} halaman · {archive.frames.length} bagian</p><p dir="auto">{archive.manifest.categories.map(c=>c.name).join(' · ')}</p><p className="text-xs text-gray-500 break-all">{archive.file.name}</p></div>}
   <div className="rounded-xl border bg-white p-4 text-sm text-gray-600 space-y-2"><p>Hanya menambah data. ID kitab yang sudah ada dilewati. Kitab baru tampil setelah seluruh isinya lengkap.</p><p>Tidak membuat backup penuh baru. Transaksi melindungi bagian aktif; kitab yang sudah selesai tetap tersimpan jika proses terputus. Backup lama tidak dihapus. Simpan cadangan penuh di luar VPS untuk perlindungan tambahan.</p><p className="text-xs">Database dan indeks hasil import tetap memerlukan ruang permanen. Sediakan ruang pengaman minimal 512 MB. Halaman tunggal yang melebihi batas bagian 8 MB perlu memakai mode SQLite.</p></div>
   {session&&<div aria-live="polite" className="rounded-xl bg-white border p-4 space-y-2 text-sm">
    <p className="font-semibold">{session.status==='done'?'Selesai':session.status==='cancelled'?'Sesi diakhiri':session.status==='cancelling'?'Pembersihan belum selesai':'Progres tersimpan'} · {session.next} / {session.total} bagian</p>
    <progress value={session.next} max={session.total} className="w-full"/>
    <p>{session.stats.imported} kitab lengkap ditambahkan · {session.stats.skipped} dilewati · {session.stats.pages.toLocaleString('id-ID')} halaman diterima</p>
    {session.pendingBook&&<p dir="auto">Kitab belum lengkap: {session.pendingBook}</p>}
    {!['done','cancelled'].includes(session.status)&&!archive&&<p>Pilih kembali file .mkt yang sama, lalu klik Lanjutkan. Bagian yang sudah tersimpan tidak dikirim ulang.</p>}
   </div>}
   {archive&&<label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={confirmed} disabled={busy||fileCompleted} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>Saya sudah memeriksa paket dan memahami bahwa kitab yang selesai tetap tersimpan saat proses dijeda.</label>}
   <div className="flex flex-wrap gap-2">
    <button className={button+' bg-[var(--app-primary)] text-white'} disabled={busy||!archive||!confirmed||fileCompleted||session?.status==='cancelling'} onClick={()=>void startImport()}><Upload size={17}/>{fileCompleted?'Import selesai':archive&&session?.id===archive.id&&session?.status!=='cancelled'?'Lanjutkan import':'Mulai import'}</button>
    {busy&&<button className={button+' border bg-white'} onClick={()=>{stop.current=true;setMessage('Menjeda setelah bagian yang sedang diproses selesai…');}}><Pause size={17}/>Jeda</button>}
    <button className={button+' border bg-white'} disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}><RotateCcw size={17}/>Muat status</button>
    {session&&!['done','cancelled'].includes(session.status)&&<button className={button+' border border-red-200 text-red-700 bg-white'} disabled={busy} onClick={()=>void cancel()}>Akhiri sesi</button>}
   </div>
   {session?.status==='done'&&<p className="text-emerald-800 flex gap-2 text-sm"><CheckCircle2 size={18}/>Seluruh paket sudah disimpan dan dapat dibuka dari katalog.</p>}
  </>}
 </div>;
}
