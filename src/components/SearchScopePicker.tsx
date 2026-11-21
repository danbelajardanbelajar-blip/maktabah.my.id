import {useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronRight,FolderSearch,Search} from 'lucide-react';
import {webAPI} from '../api';
import {categorySelectedCount,emptySearchScope,scopeBookSelected,scopeDescription,scopeKey,selectScopeCategory,toggleScopeBook,type SearchScope,type ScopeBook,type ScopeCategory} from '../lib/search-scope';

function MixedCheckbox({checked,mixed,label,onChange,disabled=false}:{checked:boolean;mixed:boolean;label:string;onChange:(checked:boolean)=>void;disabled?:boolean}){
  const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(ref.current)ref.current.indeterminate=mixed;},[mixed]);
  return <input ref={ref} type="checkbox" checked={checked} aria-checked={mixed?'mixed':checked} aria-label={label} disabled={disabled}
    onChange={event=>onChange(event.target.checked)} className="w-5 h-5 shrink-0 accent-[var(--app-primary)] cursor-pointer disabled:opacity-40" />;
}
function CategoryBooks({category,filter,scope,onBook}:{category:ScopeCategory;filter:string;scope:SearchScope;onBook:(book:ScopeBook)=>void}){
  const [term,setTerm]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[retry,setRetry]=useState(0);
  const [rows,setRows]=useState<ScopeBook[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{if(term.trim()===query)return;const timer=setTimeout(()=>{setQuery(term.trim());setPage(1);setRows([]);},300);return()=>clearTimeout(timer);},[term,query]);
  useEffect(()=>{setPage(1);setRows([]);},[filter]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    webAPI.scopeBooks(category.id,query,filter,page,controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      setRows(previous=>page===1?result.data:[...previous,...result.data.filter((b:ScopeBook)=>!previous.some(p=>p.bkid===b.bkid))]);setTotal(result.total);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message||'Daftar kitab belum dapat dimuat.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[category.id,query,filter,page,retry]);
  return <div className="border-t p-3 sm:pl-12 space-y-3" id={`scope-category-${category.id}`}>
    <input aria-label={`Cari judul dalam ${category.name}`} value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari judul dalam kategori ini…" dir="auto" className="w-full rounded-xl border border-black/15 bg-[var(--reader-paper)] px-3 py-2 text-sm" />
    <div className="max-h-80 overflow-y-auto space-y-1">
      {rows.map(book=><label key={book.bkid} className="flex items-start gap-3 rounded-lg p-2 hover:bg-black/5 cursor-pointer min-h-11">
        <input type="checkbox" aria-label={`Pilih kitab ${book.bk}`} checked={scopeBookSelected(scope,book)} onChange={()=>onBook(book)} className="mt-1 w-5 h-5 shrink-0 accent-[var(--app-primary)]" />
        <span className="min-w-0 break-words text-lg leading-relaxed" dir="auto" style={{fontFamily:'var(--arabic-font)'}}>{book.bk}</span>
      </label>)}
    </div>
    {loading&&<p role="status" className="text-xs opacity-60">Memuat kitab…</p>}
    {error&&<div role="alert" className="text-sm text-red-600">{error} <button onClick={()=>setRetry(n=>n+1)} className="underline">Coba lagi</button></div>}
    {!loading&&!error&&!rows.length&&<p className="text-sm opacity-60">Tidak ada judul yang cocok dalam kategori ini.</p>}
    {!!rows.length&&<p className="text-xs opacity-60">{rows.length} dari {total.toLocaleString('id-ID')} judul sesuai pencarian. Centang kategori memilih seluruh isinya.</p>}
    {!error&&rows.length<total&&<button disabled={loading} onClick={()=>setPage(n=>n+1)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Muat kitab berikutnya</button>}
  </div>;
}
export function SearchScopePicker({value,onApply,disabled=false}:{value:SearchScope;onApply:(scope:SearchScope)=>void;disabled?:boolean}){
  const [draft,setDraft]=useState<SearchScope>(value),[expanded,setExpanded]=useState<Set<number>>(new Set());
  const [term,setTerm]=useState(''),[query,setQuery]=useState(''),[categories,setCategories]=useState<ScopeCategory[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const knownBooks=useRef(new Map<number,ScopeBook>());
  const valueKey=scopeKey(value),idsKey=draft.books.map(b=>b.bkid).join(','),excludedKey=draft.excluded.map(b=>b.bkid).join(',');
  useEffect(()=>setDraft({...value,books:value.books.map(b=>knownBooks.current.get(b.bkid)||b),excluded:value.excluded.map(b=>knownBooks.current.get(b.bkid)||b)}),[valueKey,value]);
  useEffect(()=>{const timer=setTimeout(()=>setQuery(term.trim()),300);return()=>clearTimeout(timer);},[term]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    webAPI.scopeCatalogue(query,idsKey,excludedKey,controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      setCategories(result.categories);
      const known=new Map<number,ScopeBook>(result.books.map((b:ScopeBook)=>[b.bkid,b]));
      for(const [id,book] of known)knownBooks.current.set(id,book);
      setDraft(previous=>({...previous,books:previous.books.map(b=>known.get(b.bkid)||b),excluded:previous.excluded.map(b=>known.get(b.bkid)||b)}));
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message||'Tempat pencarian belum dapat dimuat.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[query,idsKey,excludedKey,retry]);
  const selected=categories.reduce((n,c)=>n+categorySelectedCount(draft,c),0),total=categories.reduce((n,c)=>n+c.total,0);
  const visible=categories.filter(c=>!query||c.matched||c.name.toLowerCase().includes(query.toLowerCase()));
  const bookChanged=(book:ScopeBook,category:ScopeCategory)=>{try{setDraft(toggleScopeBook(draft,book,category));setError('');}catch(e){setError((e as Error).message);}};
  return <section aria-label="Pilih Tempat Pencarian" className="mb-6 rounded-2xl border border-[var(--app-primary)]/25 bg-[var(--reader-bg)] shadow-sm overflow-hidden">
    <header className="p-4 sm:p-5 border-b space-y-3">
      <h2 className="font-bold flex items-center gap-2 text-[var(--app-primary)]"><FolderSearch size={20}/>Pilih Tempat Pencarian</h2>
      <p className="text-xs opacity-70 leading-relaxed">Buka kategori untuk memilih kitab satu per satu, atau centang kategori untuk memilih seluruh isinya, termasuk judul yang belum dimuat. Berlaku untuk pencarian teks dan judul kitab.</p>
      <div className="relative"><Search size={17} className="absolute left-3 top-3 opacity-50"/><input value={term} onChange={e=>setTerm(e.target.value)} aria-label="Cari kategori atau judul kitab" placeholder="Cari kategori atau judul kitab…" dir="auto" className="w-full rounded-xl border bg-[var(--reader-paper)] py-2.5 pl-10 pr-3 text-sm"/></div>
      <label className="flex items-center gap-3 min-h-11 cursor-pointer"><MixedCheckbox label="Semua kitab" checked={total>0&&selected===total} mixed={selected>0&&selected<total} onChange={checked=>setDraft(emptySearchScope(checked))}/><span className="font-semibold text-sm">Semua kitab <span className="font-normal opacity-60">({total.toLocaleString('id-ID')})</span></span></label>
    </header>
    <div className="max-h-[55vh] overflow-y-auto p-2 sm:p-3 space-y-2">
      {loading&&!categories.length&&<p role="status" className="p-4 text-sm opacity-60">Memuat kategori…</p>}
      {visible.map(category=>{
        const count=categorySelectedCount(draft,category),open=expanded.has(category.id);
        return <section key={category.id} className="rounded-xl border border-black/10 bg-[var(--reader-paper)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2">
            <MixedCheckbox label={`Pilih seluruh kitab ${category.name}`} disabled={!category.total} checked={category.total>0&&count===category.total} mixed={count>0&&count<category.total} onChange={checked=>setDraft(selectScopeCategory(draft,category.id,checked))}/>
            <button type="button" aria-expanded={open} aria-controls={`scope-category-${category.id}`} aria-label={`${open?'Tutup':'Buka'} kategori ${category.name}`} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(next.has(category.id))next.delete(category.id);else next.add(category.id);return next;})} className="min-w-0 flex-1 flex items-center gap-2 min-h-11 text-left">
              {open?<ChevronDown size={18} className="shrink-0"/>:<ChevronRight size={18} className="shrink-0"/>}
              <span className="flex-1 min-w-0 break-words text-lg" dir="auto" style={{fontFamily:'var(--arabic-font)'}}>{category.name}</span>
              <span className="shrink-0 text-[11px] opacity-60 text-right">{count.toLocaleString('id-ID')}/{category.total.toLocaleString('id-ID')}<br/>kitab</span>
            </button>
          </div>
          {open&&<CategoryBooks category={category} filter={query} scope={draft} onBook={book=>bookChanged(book,category)}/>}
        </section>;
      })}
      {!loading&&!visible.length&&<p className="p-4 text-sm opacity-60">Kategori atau judul tidak ditemukan.</p>}
    </div>
    <footer className="border-t bg-[var(--reader-paper)] p-4 space-y-3">
      {error&&<div role="alert" className="text-sm text-red-600 break-words">{error} <button className="underline" onClick={()=>setRetry(n=>n+1)}>Coba lagi</button></div>}
      <p className="text-sm" aria-live="polite"><strong>Pilihan: </strong>{scopeDescription(draft)} · {selected.toLocaleString('id-ID')} kitab</p>
      {scopeKey(draft)!==valueKey&&<p className="text-xs opacity-60">Perubahan belum diterapkan.</p>}
      {!selected&&!loading&&<p className="text-xs text-amber-700">Pilih kitab atau centang Semua kitab sebelum menerapkan.</p>}
      <div className="flex justify-between gap-3"><button type="button" onClick={()=>{setDraft(emptySearchScope());setError('');}} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Reset pilihan</button><button type="button" disabled={disabled||loading||!selected} onClick={()=>onApply(draft)} className="rounded-xl bg-[var(--app-primary)] text-white px-5 py-2.5 text-sm font-bold disabled:opacity-40">Terapkan</button></div>
    </footer>
  </section>;
}
