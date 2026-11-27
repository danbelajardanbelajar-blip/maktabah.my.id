import {useEffect,useRef,useState} from 'react';
interface Link {id:number;name:string;status:string;basis:string;evidence:string;}
interface Suggestion {id:number;name:string;death_text?:string;score:number;reason:string;source?:string;}
interface FirstPage {part:number;page:number;snippet:string;}
interface Case {book_id:number;title:string;metadata_author:string;source_ref:string;conflict:boolean;revision:string;first_page?:FirstPage|null;suggestions?:Suggestion[];links:Link[];decisions:any[];events:any[];}
interface QueueItem {book_id:number;title:string;metadata_author:string;status:string;count:number;revision:string;suggestions?:Suggestion[];first_page?:FirstPage|null;}
const date=(s:string)=>new Date(s).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});

export function AuthorReview({token,onLogout}:{token:string;onLogout:()=>void}) {
  const [q,setQ]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('pending'),[page,setPage]=useState(1),[list,setList]=useState<any>(null),[version,setVersion]=useState(0);
  const [picked,setPicked]=useState<Record<number,{authorId:number;authorName:string}>>({}),[checked,setChecked]=useState<Record<number,boolean>>({}),[batchNote,setBatchNote]=useState('');
  const [selected,setSelected]=useState<Case|null>(null),[authorQuery,setAuthorQuery]=useState(''),[authors,setAuthors]=useState<any[]>([]),[chosen,setChosen]=useState<{id:number;name:string}|null>(null),[note,setNote]=useState('');
  const [busy,setBusy]=useState(false),[loadingCase,setLoadingCase]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const detailId=useRef(0),panel=useRef<HTMLDivElement>(null);

  const request=async(route:string,options:RequestInit={})=>{
    const r=await fetch(route,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});const data=await r.json().catch(()=>({}));
    if(r.status===401){onLogout();throw Error('Sesi admin berakhir.');}if(!r.ok)throw Error(data.error||`Permintaan gagal (${r.status}).`);return data;
  };

  useEffect(()=>{
    let alive=true;
    request(`/api/admin/authors/review?q=${encodeURIComponent(query)}&filter=${filter}&page=${page}`).then(r=>{
      if(!alive)return;
      setList(r);
      const nextPicked:Record<number,{authorId:number;authorName:string}>={};
      for(const b of (r.data||[]) as QueueItem[]){
        if(b.suggestions?.length)nextPicked[b.book_id]={authorId:b.suggestions[0].id,authorName:b.suggestions[0].name};
      }
      setPicked(nextPicked);
      setChecked({});
    }).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[query,filter,page,version,token]);

  const loadCase=async(id:number)=>{
    const sequence=++detailId.current;setError('');setNotice('');setLoadingCase(true);setChosen(null);setSelected(null);setNote('');setAuthors([]);setAuthorQuery('');
    try{const item=await request(`/api/admin/authors/book/${id}`);if(sequence!==detailId.current)return;setSelected(item);setTimeout(()=>panel.current?.scrollIntoView({behavior:'smooth',block:'start'}),50);}catch(e){if(sequence===detailId.current)setError(e instanceof Error?e.message:'Gagal memuat relasi.');}finally{if(sequence===detailId.current)setLoadingCase(false);}
  };

  const searchAuthors=async()=>{
    const sequence=detailId.current;setBusy(true);setError('');try{const r=await request('/api/authors?q='+encodeURIComponent(authorQuery)+'&limit=12');if(sequence===detailId.current)setAuthors(r.data);}catch(e){setError(e instanceof Error?e.message:'Gagal mencari penulis.');}finally{setBusy(false);}
  };

  const save=async(action:string)=>{
    if(!selected||!chosen)return;setBusy(true);setError('');setNotice('');
    try{const r=await request('/api/admin/authors/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:selected.book_id,author_id:chosen.id,expected_author:chosen.name,expected_title:selected.title,revision:selected.revision,action,note})});setSelected(r);setVersion(v=>v+1);setNote('');setNotice('Keputusan tersimpan dan tercatat pada riwayat. Halaman publik mengikuti keputusan terbaru.');}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan keputusan.');}finally{setBusy(false);}
  };

  const choose=(a:{id:number;name:string},defaultNote='')=>{setChosen(a);setNote(defaultNote);setNotice('');};

  const rows:QueueItem[]=list?.data||[];
  const suggestibleRows=rows.filter(b=>b.status!=='conflict'&&picked[b.book_id]);
  const checkedRows=suggestibleRows.filter(b=>checked[b.book_id]);

  const toggleAll=()=>{
    if(checkedRows.length===suggestibleRows.length){setChecked({});return;}
    const next:Record<number,boolean>={};
    for(const b of suggestibleRows)next[b.book_id]=true;
    setChecked(next);
  };

  const saveBatch=async(action:'confirmed'|'rejected')=>{
    if(!checkedRows.length)return;
    setBusy(true);setError('');setNotice('');
    try{
      const customNote=batchNote.trim();
      const items=checkedRows.map(b=>{
        const target=picked[b.book_id];
        const chosenSug=b.suggestions?.find(s=>s.id===target.authorId);
        const fallback=b.metadata_author?`Sesuai metadata kitab (${b.metadata_author})`:chosenSug?.source?`Sesuai usulan dari ${chosenSug.source}`:'Ditinjau melalui antrean ceklis admin';
        return{book_id:b.book_id,author_id:target.authorId,expected_author:target.authorName,expected_title:b.title,revision:b.revision,action,note:customNote.length>=3?customNote:fallback};
      });
      const res=await request('/api/admin/authors/decisions/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
      const savedCount=res.saved?.length||0,failedCount=res.failed?.length||0;
      setVersion(v=>v+1);setChecked({});
      if(failedCount){setError(`${failedCount} relasi gagal disimpan (${res.failed[0]?.error||'konflik data'}).`);}
      if(savedCount){setNotice(`${savedCount} relasi berhasil ${action==='confirmed'?'disahkan':'ditolak'} dan tercatat pada riwayat.`);}
    }catch(e){
      setError(e instanceof Error?e.message:'Gagal menyimpan pilihan massal.');
    }finally{setBusy(false);}
  };

  return <section className="max-w-5xl space-y-5">
    <header><h2 className="font-bold text-2xl">Tinjau Relasi Penulis</h2><p className="text-sm text-gray-600 mt-2">Periksa usulan penulis dari metadata beserta cuplikan halaman pertama kitab. Centang relasi yang sesuai lalu simpan, atau buka detail untuk memilih penulis secara manual.</p></header>
    {error&&<p role="alert" className="rounded-xl p-4 bg-red-50 text-red-800">{error}{selected&&<button onClick={()=>loadCase(selected.book_id)} className="block mt-2 underline">Muat ulang relasi</button>}</p>}
    {notice&&<p role="status" className="rounded-xl p-4 bg-green-50 text-green-800">{notice}</p>}
    {list?.counts&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[[list.counts.available,'Kitab tersedia'],[list.counts.linked,'Sudah tertaut'],[list.counts.pending,'Belum tertaut'],[list.counts.conflicts,'Konflik identitas']].map(([n,label])=><div key={label} className="p-4 bg-white border rounded-xl"><strong className="text-xl block">{Number(n).toLocaleString('id-ID')}</strong><span className="text-xs text-gray-600">{label}</span></div>)}</div>}

    <form onSubmit={e=>{e.preventDefault();setQuery(q.trim());setPage(1);}} className="bg-white border rounded-xl p-4 flex flex-wrap gap-3">
      <label className="flex-1 min-w-0"><span className="text-xs font-bold block mb-2">Cari kitab atau nama metadata</span><input value={q} onChange={e=>setQ(e.target.value)} className="border rounded-lg p-3 w-full" dir="auto"/></label>
      <label><span className="text-xs font-bold block mb-2">Status relasi</span><select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}} className="border rounded-lg p-3"><option value="pending">Belum tertaut</option><option value="with_metadata">Belum tertaut (ada metadata)</option><option value="linked">Sudah tertaut</option><option value="conflict">Konflik identitas</option><option value="all">Semua</option></select></label>
      <button disabled={busy} className="self-end border rounded-lg px-4 py-3">Cari</button>
    </form>

    {!!suggestibleRows.length&&<div className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" checked={checkedRows.length===suggestibleRows.length&&suggestibleRows.length>0} onChange={toggleAll} disabled={busy} className="w-4 h-4"/>
          <span>Pilih semua usulan di halaman ini ({checkedRows.length}/{suggestibleRows.length})</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy||!checkedRows.length} onClick={()=>saveBatch('confirmed')} className="px-4 py-2 rounded-lg bg-[var(--app-primary)] text-white text-sm font-semibold disabled:opacity-40">Sahkan pilihan ({checkedRows.length})</button>
          <button type="button" disabled={busy||!checkedRows.length} onClick={()=>saveBatch('rejected')} className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold disabled:opacity-40">Tolak pilihan ({checkedRows.length})</button>
        </div>
      </div>
      <input value={batchNote} onChange={e=>setBatchNote(e.target.value)} maxLength={10000} placeholder="Catatan rujukan massal (opsional, bawaan: Sesuai metadata kitab)" className="w-full border rounded-lg px-3 py-2 text-sm"/>
    </div>}

    <div className="border rounded-xl bg-white divide-y">
      {!list&&<p role="status" className="p-5">Memuat antrean tinjauan…</p>}
      {rows.map(b=>{
        const chosenSuggestion=picked[b.book_id];
        const canCheck=b.status!=='conflict'&&!!chosenSuggestion;
        return <div key={b.book_id} className={`p-4 space-y-3 ${checked[b.book_id]?'bg-emerald-50/40':''}`}>
          <div className="flex items-start gap-3">
            {canCheck?<input type="checkbox" aria-label={`Pilih kitab ${b.title}`} checked={!!checked[b.book_id]} onChange={e=>setChecked(prev=>({...prev,[b.book_id]:e.target.checked}))} disabled={busy} className="mt-1.5 w-5 h-5 shrink-0 cursor-pointer"/>:<span className="w-5 shrink-0"/>}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-500">ID {b.book_id} · {b.status==='conflict'?'Konflik judul':b.status==='linked'?`${b.count} penulis tertaut`:'Belum tertaut'}</span>
                <button type="button" onClick={()=>loadCase(b.book_id)} disabled={busy} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-50">Detail / Ubah manual</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="border rounded-lg p-3 bg-gray-50/60">
                  <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold block">Nama Kitab</span>
                  <strong className="block mt-1 text-lg leading-snug break-words" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{b.title}</strong>
                  {b.metadata_author&&<span className="block text-xs text-gray-600 mt-2" dir="auto">Metadata penulis: <strong>{b.metadata_author}</strong></span>}
                </div>
                <div className="border rounded-lg p-3 bg-gray-50/60">
                  <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold block">Usulan Penulis (Mesin)</span>
                  {b.suggestions?.length?<div className="mt-1 space-y-2">
                    {b.suggestions.map(s=>{
                      const active=chosenSuggestion?.authorId===s.id;
                      return <label key={s.id} className={`flex items-start justify-between gap-2 p-2 rounded-lg border cursor-pointer ${active?'bg-white border-[var(--app-primary)]':'border-transparent hover:bg-white/70'}`}>
                        <span className="flex items-start gap-2 min-w-0">
                          {b.suggestions!.length>1&&<input type="radio" name={`suggest-${b.book_id}`} checked={active} onChange={()=>setPicked(prev=>({...prev,[b.book_id]:{authorId:s.id,authorName:s.name}}))} className="mt-1 shrink-0"/>}
                          <span className="min-w-0">
                            <strong className="block text-base break-words" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{s.name}</strong>
                            <span className="block text-xs text-gray-600">{s.reason}{s.death_text?` · w. ${s.death_text}`:''}</span>
                          </span>
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 shrink-0">{Math.min(100,s.score)}%</span>
                      </label>;
                    })}
                  </div>:<p className="text-xs text-gray-500 mt-2">{b.metadata_author?'Tidak ada kandidat otomatis yang cukup dekat. Gunakan Detail / Ubah manual.':'Metadata penulis kosong.'}</p>}
                </div>
              </div>
              {b.first_page&&<div className="border rounded-lg p-3 bg-amber-50/40">
                <span className="text-[11px] font-semibold text-gray-500 block mb-1">Cuplikan Halaman Pertama (Juz {b.first_page.part}, Hal. {b.first_page.page})</span>
                <p className="text-sm leading-relaxed text-gray-800 break-words" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{b.first_page.snippet}</p>
              </div>}
            </div>
          </div>
        </div>;
      })}
      {list?.data.length===0&&<p className="p-6 text-center text-gray-500">Tidak ada kitab pada filter ini.</p>}
    </div>

    {list?.totalPages>1&&<div className="flex justify-center items-center gap-3"><button disabled={page<=1||busy} onClick={()=>setPage(page-1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Sebelumnya</button><span className="text-sm">{page} / {list.totalPages}</span><button disabled={page>=list.totalPages||busy} onClick={()=>setPage(page+1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Berikutnya</button></div>}
    {loadingCase&&<p role="status">Memuat detail relasi…</p>}

    {selected&&<div ref={panel} className="bg-white border rounded-2xl p-5 space-y-5 scroll-mt-5">
      <div><h3 className="text-lg font-bold">Pemeriksaan Kitab #{selected.book_id}</h3><p className="text-xl mt-3 leading-relaxed" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{selected.title}</p><p className="text-sm text-gray-600 mt-2" dir="auto">Metadata penulis: {selected.metadata_author||'Belum tersedia'}</p><p className="text-xs text-gray-500 mt-2 break-words">Sumber: {selected.source_ref}</p></div>
      {selected.first_page&&<div className="border rounded-xl p-4 bg-amber-50/40"><h4 className="text-xs font-bold text-gray-600 mb-2">Cuplikan Halaman Pertama (Juz {selected.first_page.part}, Hal. {selected.first_page.page})</h4><p className="text-base leading-relaxed text-gray-800 break-words" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{selected.first_page.snippet}</p></div>}
      {selected.conflict&&<p role="alert" className="bg-amber-50 p-4 rounded-xl">Judul dalam paket tidak cocok atau ID memiliki judul ganda. Perbarui paket atau selesaikan konflik katalog sebelum mengubah relasi.</p>}
      {!!selected.suggestions?.length&&<div className="space-y-2"><h4 className="font-bold text-sm">Usulan penulis dari metadata</h4><div className="flex flex-wrap gap-2">{selected.suggestions.map(s=><button type="button" key={s.id} onClick={()=>choose(s,selected.metadata_author?`Sesuai metadata kitab (${selected.metadata_author})`:'')} className="border px-3 py-2 rounded-lg hover:bg-gray-50 text-left"><span className="block text-base font-semibold" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{s.name}</span><span className="block text-xs text-gray-500">{s.reason} · {Math.min(100,s.score)}%</span></button>)}</div></div>}
      <div className="space-y-3"><h4 className="font-bold">Penulis yang tertaut</h4>{selected.links.length?selected.links.map(a=><div key={a.id} className="border rounded-xl p-3 space-y-2"><div className="flex justify-between gap-3 items-center"><span dir="rtl" className="text-lg" style={{fontFamily:'var(--arabic-font)'}}>{a.name}</span><button disabled={busy} onClick={()=>choose(a)} className="border px-3 py-2 rounded-lg">Pilih untuk ditinjau</button></div><p className="text-xs text-gray-500">{a.status==='confirmed'?'Ditinjau admin':a.basis==='source-explicit'?'Relasi eksplisit sumber':'Kecocokan metadata'}</p><p className="text-sm whitespace-pre-wrap break-words" dir="auto">{a.evidence}</p></div>):<p className="text-sm text-gray-500">Belum ada relasi yang ditampilkan kepada pengunjung.</p>}</div>
      {!!selected.decisions.length&&<details><summary className="cursor-pointer text-sm font-semibold">Keputusan sebelumnya ({selected.decisions.length})</summary>{selected.decisions.map(d=><div key={d.author_id} className="border rounded-lg p-3 mt-2 text-sm"><span dir="rtl">{d.name}</span> · {d.status==='confirmed'?'Disahkan':'Ditolak'}<p className="mt-2 break-words">{d.note}</p><button disabled={busy} onClick={()=>choose({id:d.author_id,name:d.name})} className="underline mt-2">Pilih keputusan ini</button></div>)}</details>}
      <form onSubmit={e=>{e.preventDefault();void searchAuthors();}} className="space-y-3"><label className="block text-sm font-bold">Cari penulis sumber<input value={authorQuery} onChange={e=>setAuthorQuery(e.target.value)} placeholder="Ketik nama atau bagian nama penulis" className="block w-full border rounded-lg p-3 mt-2" dir="auto"/></label><button disabled={busy} className="px-4 py-2 rounded-lg border">Cari penulis sumber</button><div className="flex flex-wrap gap-2">{authors.map(a=><button type="button" key={a.id} onClick={()=>choose(a)} className="border px-3 py-2 rounded-lg hover:bg-gray-50" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{a.name}</button>)}</div></form>
      {chosen&&<div className="bg-gray-50 border p-4 rounded-xl space-y-3"><h4 className="font-bold">Penulis dipilih</h4><p className="text-xl" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{chosen.name}</p><a href={`#/penulis?id=${chosen.id}`} target="_blank" rel="noreferrer" className="text-sm underline">Buka biografi penulis</a><label className="block text-sm font-semibold">Dasar keputusan / rujukan<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={10000} rows={4} className="block border rounded-lg p-3 mt-2 w-full" placeholder="Cantumkan rujukan atau bukti atribusi karya."/></label><div className="flex flex-wrap gap-3"><button disabled={busy||selected.conflict||note.trim().length<3} onClick={()=>save('confirmed')} className="px-4 py-2 rounded-lg bg-[var(--app-primary)] text-white disabled:opacity-40">Sahkan relasi</button><button disabled={busy||selected.conflict||note.trim().length<3} onClick={()=>save('rejected')} className="px-4 py-2 rounded-lg border border-red-300 text-red-700 disabled:opacity-40">Tolak relasi</button><button disabled={busy||selected.conflict||note.trim().length<3} onClick={()=>save('reset')} className="px-4 py-2 rounded-lg border disabled:opacity-40">Kembalikan ke data paket</button></div>{busy&&<p role="status">Menyimpan keputusan…</p>}</div>}
      {!!selected.events.length&&<details><summary className="cursor-pointer font-semibold text-sm">Riwayat perubahan ({selected.events.length} terbaru)</summary><div className="mt-3 space-y-3">{selected.events.map(e=><div key={e.id} className="border-t pt-3 text-sm"><p className="font-semibold">{date(e.created_at)} WIB · {e.action} · Penulis #{e.author_id}</p><p className="mt-1 whitespace-pre-wrap break-words">{e.note}</p></div>)}</div></details>}
    </div>}
  </section>;
}
