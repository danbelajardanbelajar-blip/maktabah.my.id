import {RowaLinkedText,escapeRowaHtml} from './RowaLinkedText';
import {recordLibraryActivity} from '../lib/library-activity';
import {useEffect,useState} from 'react';
import {BookOpen,ArrowLeft,ArrowRight} from 'lucide-react';
interface Result {bookId:number;pageId:number;bookName:string;sourceName:string;part:string|number|null;page:string|number|null;snippet:string;}
interface Reply {results:Result[];page:number;hasMore:boolean;scope:{name:string;editions:number};}
export function HadithTextSearch({q,group,source,edition,matching,page,onPage,readBook}:{q:string;group:string;source:string;edition:string;matching:string;page:string;onPage:(page:number)=>void;readBook:(id:number,pageId?:number,query?:string)=>void}) {
  const [reply,setReply]=useState<{key:string;data:Reply}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0),[preparing,setPreparing]=useState('');
  const query=new URLSearchParams({q,group,matching,page});if(source)query.set('book',source);if(edition)query.set('edition',edition);
  const key=query.toString(),data=reply?.key===key?reply.data:null;
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;setReply(null);setError('');setPreparing('');setLoading(false);
    if(!q.trim())return;
    setLoading(true);
    fetch(`/api/hadith-books/search?${key}`,{signal:controller.signal}).then(async response=>{
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error(['127.0.0.1','localhost'].includes(window.location.hostname)?'Layanan pencarian isi belum diperbarui pada alamat ini. Buka http://127.0.0.1:3085/#/kutub-hadis.':'Layanan pencarian isi belum tersedia. Silakan coba lagi.');
      const result=await response.json();if(result.preparing){if(!controller.signal.aborted){setPreparing(result.message);timer=setTimeout(()=>setRetry(n=>n+1),3000);}return null;}if(!response.ok)throw Error(result.error||'Pencarian belum dapat diselesaikan.');return result;
    }).then(result=>{if(!controller.signal.aborted&&result)setReply({key,data:result});})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>{controller.abort();clearTimeout(timer);};
  },[key,retry]);
  return <section aria-label="Hasil pencarian isi kitab" className="space-y-4 min-w-0">
    {!q.trim()&&<p className="p-7 rounded-2xl border border-dashed text-sm text-center leading-relaxed">Tulis potongan teks untuk mencari isi kitab dalam kelompok ini. Anda juga dapat membatasi pencarian pada satu kitab atau edisi.</p>}
    {preparing&&<p role="status" className="p-7 rounded-2xl border text-sm text-center">{preparing}</p>}
    {loading&&<p role="status" className="p-7 rounded-2xl border text-sm text-center">Mencari teks dalam lingkup pilihan…</p>}
    {error&&<div role="alert" className="p-5 border rounded-2xl bg-[var(--reader-bg)] text-sm"><p>{error}</p><button onClick={()=>setRetry(n=>n+1)} className="mt-3 underline font-semibold">Coba lagi</button></div>}
    {data&&<>
      <p role="status" className="text-xs opacity-70 leading-relaxed">{data.results.length} halaman ditampilkan · {data.scope.name} · {data.scope.editions} edisi ditelusuri. Teks yang sama pada edisi berbeda dapat muncul terpisah.</p>
      {data.results.length===0&&<p className="p-7 rounded-2xl border border-dashed text-center text-sm">Teks tidak ditemukan dalam lingkup ini. Coba kata lain atau perluas pilihan kitab dan edisi.</p>}
      {data.results.map(result=><article key={`${result.bookId}:${result.pageId}`} className="p-5 rounded-2xl border bg-[var(--reader-paper)] min-w-0">
        <div className="flex justify-between items-start gap-3 flex-wrap"><div className="min-w-0"><h3 className="font-bold text-xl break-words text-[var(--app-primary)]" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>{result.bookName}</h3><p className="text-xs opacity-60 mt-2">{result.sourceName} · Jilid {result.part??'—'} · Halaman {result.page??'—'}</p></div></div>
        <RowaLinkedText className="text-xl leading-loose my-4 whitespace-pre-wrap break-words" style={{fontFamily:'var(--arabic-font)'}} html={escapeRowaHtml(result.snippet).replace(/\uE000/g,'<mark class="bg-amber-200 text-amber-950 rounded px-0.5">').replace(/\uE001/g,'</mark>')}/>

        <a href={`#/read/${result.bookId}/${result.pageId}`} onClick={e=>{recordLibraryActivity('hadith',{action:'read_book',query:q,target_id:result.bookId,target_name:result.bookName,context:{mode:'content',group,book:source,edition,matching,page,page_id:result.pageId,part:result.part??undefined,source_page:result.page??undefined}});if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();readBook(result.bookId,result.pageId,q);}}} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--app-primary)] text-white rounded-xl font-semibold text-sm"><BookOpen size={16}/>Baca halaman ini</a>
      </article>)}
      {(data.page>1||data.hasMore)&&<nav aria-label="Halaman hasil pencarian isi" className="flex items-center justify-between gap-2 text-xs sm:text-sm"><button disabled={data.page<=1} onClick={()=>onPage(data.page-1)} className="inline-flex items-center gap-1 border rounded-xl px-3 py-2 disabled:opacity-40"><ArrowLeft size={15}/>Sebelumnya</button><span>Halaman {data.page}</span><button disabled={!data.hasMore||data.page>=100} onClick={()=>onPage(data.page+1)} className="inline-flex items-center gap-1 border rounded-xl px-3 py-2 disabled:opacity-40">Berikutnya<ArrowRight size={15}/></button></nav>}
    </>}
  </section>;
}
