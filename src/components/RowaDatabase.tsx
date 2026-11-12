import {useEffect,useState,useRef} from 'react';

interface Manifest {source:string;created_at:string;row_count:number;source_sha256:string;}
interface Counts {narrators:number;biographies:number;withBookCodes:number;unknownSymbols:string[];}
interface Snapshot {id:string;manifest:Manifest;bytes:number;}
interface Status {active:(Snapshot & Counts & {activatedAt:string})|null;fallback:boolean;startupError:string|null;backups:Snapshot[];maxBytes:number;}
interface Ticket {id:string;preview:Counts & {manifest:Manifest};}
const size = (bytes:number) => `${(bytes/1024/1024).toFixed(1)} MB`;
export function RowaDatabase({token,onLogout}:{token:string;onLogout:()=>void}) {
  const [status,setStatus]=useState<Status|null>(null),[ticket,setTicket]=useState<Ticket|null>(null);
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const [error,setError]=useState(''),[success,setSuccess]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const request=async(endpoint='',options:RequestInit={})=>{
    const response=await fetch(`/api/admin/rowa-database${endpoint}`,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});
    if(response.status===401){onLogout();throw new Error('Sesi admin berakhir. Silakan login kembali.');}
    if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`Permintaan gagal (${response.status}).`);}
    return response;
  };
  useEffect(()=>{let alive=true;request().then(r=>r.json()).then(s=>{if(alive)setStatus(s);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[token]);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setSuccess('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Proses gagal.');}finally{setBusy(false);setProgress('');}};
  const upload=()=>run(async()=>{
    if(!file)throw new Error('Pilih file database perawi terlebih dahulu.');
    if(!file.name.toLowerCase().endsWith('.db'))throw new Error('Pilih file paket perawi berakhiran .db.');
    if(file.size>(status?.maxBytes||128*1024*1024))throw new Error('Ukuran file maksimal 128 MB.');
    setTicket(null);setProgress('Mengunggah dan memeriksa database…');
    const response=await request('/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
    setTicket(await response.json());
  });
  const activate=()=>run(async()=>{
    if(!ticket)return;
    setProgress('Mengaktifkan database perawi…');
    const response=await request('/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:ticket.id})});
    setStatus(await response.json());setTicket(null);setFile(null);if(input.current)input.current.value='';
    setSuccess('Database perawi aktif. Pencarian dan profil langsung memakai data baru.');
  });
  const restore=(snapshot:Snapshot)=>{
    if(!window.confirm(`Pulihkan database ${snapshot.manifest.row_count.toLocaleString('id-ID')} perawi dari ${new Date(snapshot.manifest.created_at).toLocaleString('id-ID')}? Versi saat ini tetap disimpan.`))return;
    void run(async()=>{const response=await request('/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:snapshot.id})});setStatus(await response.json());setTicket(null);setSuccess('Database perawi berhasil dipulihkan.');});
  };
  const download=()=>run(async()=>{
    const response=await request('/download');const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='maktabah-perawi.db';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return <section className="max-w-4xl space-y-5">
    <div><h2 className="text-xl font-bold">Database Perawi</h2><p className="text-sm text-gray-600 mt-2">Import paket .db berisi biografi, penilaian ulama, guru, murid, dan kode kitab sumber. Tersedia di server lokal maupun online.</p></div>
    {error&&<p role="alert" className="p-4 rounded-xl bg-red-50 text-red-800">{error}</p>}
    {success&&<p role="status" className="p-4 rounded-xl bg-green-50 text-green-800">{success}</p>}
    {status?.startupError&&<p role="alert" className="p-4 bg-amber-50 rounded-xl">Database khusus gagal dibaca: {status.startupError}. Upload paket yang valid untuk memulihkannya.</p>}
    {!status&&!error&&<p role="status">Memuat status database…</p>}
    {status&&<div className="bg-white border rounded-xl p-5 space-y-3">
      <h3 className="font-bold">Database aktif</h3>
      {status.active?<><p>{status.active.narrators.toLocaleString('id-ID')} perawi · {status.active.biographies.toLocaleString('id-ID')} uraian biografi · {size(status.active.bytes)}</p><p className="text-sm text-gray-600 break-words">Sumber: {status.active.manifest.source}</p><p className="text-sm text-gray-600">Dibuat {new Date(status.active.manifest.created_at).toLocaleString('id-ID')}</p><button disabled={busy} onClick={download} className="px-4 py-2 border rounded-lg disabled:opacity-50">Unduh database aktif</button></>:<p className="text-sm text-gray-600">Masih menggunakan data perawi dari database kitab. Import paket baru untuk melengkapi biografi dan kode kitab sumber.</p>}
    </div>}
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <h3 className="font-bold">Import database perawi</h3>
      <p className="text-sm text-gray-600">Pilih paket perawi khusus, maksimal 128 MB. Periksa pratinjau sebelum mengaktifkan. Versi sebelumnya disimpan sebagai cadangan.</p>
      <label className="block text-sm font-semibold">File database perawi<input ref={input} type="file" accept=".db" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);setTicket(null);setSuccess('');}} className="block mt-2 w-full border rounded-lg p-3"/></label>
      {file&&<p className="text-sm text-gray-600 break-all">{file.name} · {size(file.size)}</p>}
      <button onClick={upload} disabled={busy||!file} className="bg-[var(--app-primary)] text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50">Upload & periksa</button>
      {busy&&<p role="status" className="text-sm">{progress||'Memproses…'}</p>}
      {ticket&&<div className="border rounded-lg bg-gray-50 p-4 space-y-3">
        <h4 className="font-bold">Pratinjau import</h4><p>{ticket.preview.narrators.toLocaleString('id-ID')} perawi · {ticket.preview.biographies.toLocaleString('id-ID')} uraian biografi · {ticket.preview.withBookCodes.toLocaleString('id-ID')} entri berkode kitab</p>
        <p className="text-sm break-words">Sumber: {ticket.preview.manifest.source}</p>
        {!!ticket.preview.unknownSymbols.length&&<p className="text-sm">Sebagian kode disertai catatan atau belum dapat dipetakan. Catatan asli tetap tersedia dalam profil; nama kitab tidak ditebak.</p>}
        <p className="text-sm">Aktivasi mengganti seluruh data Kamus Perawi. Database kitab tetap tersimpan terpisah.</p>
        <button onClick={activate} disabled={busy} className="bg-[var(--app-primary)] text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50">Aktifkan database</button>
      </div>}
    </div>
    {!!status?.backups.length&&<div className="bg-white border rounded-xl p-5 space-y-3"><h3 className="font-bold">Versi sebelumnya</h3>{status.backups.map(b=><div key={b.id} className="flex items-center justify-between flex-wrap gap-3 border-t pt-3"><p className="text-sm">{new Date(b.manifest.created_at).toLocaleString('id-ID')} · {b.manifest.row_count.toLocaleString('id-ID')} perawi · {size(b.bytes)}</p><button onClick={()=>restore(b)} disabled={busy} className="border px-4 py-2 rounded-lg disabled:opacity-50">Pulihkan</button></div>)}</div>}
  </section>;
}
