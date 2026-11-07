import React, { useState, useEffect, useRef, useCallback } from 'react';
import { webAPI } from '../api';
import { showOpeningBismillah } from '../lib/quran-content';
import { ChevronRight, ChevronLeft, BookOpen, Loader2, X, Search, List, Type } from 'lucide-react';
import {createPortal} from 'react-dom';
import {useModalFocus} from '../lib/use-modal-focus';
import surahMetadata from '../data/quran-surahs.json';
import './QuranReader.css';

// ============================================================
// Type Definitions
// ============================================================
interface Surah {
  id: number;
  name: string;
}

interface Ayah {
  id: number;
  ayah_no: number;
  text: string;
  page?: number;
}

interface TafsirMapping {
  id: number;
  surah_id: number;
  ayah_no: number;
  book_id: number;
  page_id: number;
  tafsir_name: string;
}

interface TafsirContent {
  state?: 'ready'|'empty'|'error';
  bookId: number;
  pageId: number;
  tafsir_name: string;
  text: string;
  part?: number;
  page?: number;
}

// ============================================================
// Helper: Konversi angka latin ke angka Arab
// ============================================================
const toArabicNumber = (num: number): string => {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(n => arabicNums[parseInt(n)] ?? n).join('');
};

// ============================================================
// Helper: strip HTML tags dari teks tafsir
// ============================================================
const stripHtml = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
};

// ============================================================
// Component Utama
// ============================================================
const QuranReader: React.FC = () => {
  // === State: Data ===
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [tafsirMappings, setTafsirMappings] = useState<TafsirMapping[]>([]);

  // === State: Navigasi ===
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState<number>(0);

  // === State: Tafsir ===
  const [tafsirBooks, setTafsirBooks] = useState<{ book_id: number; tafsir_name: string }[]>([]);
  const [openTafsir, setOpenTafsir] = useState<TafsirContent | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);

  // === State: Loading ===
  const [surahLoading, setSurahLoading] = useState(true);
  const [ayahLoading, setAyahLoading] = useState(false);
  const [tafsirListLoading, setTafsirListLoading] = useState(false);

  const [surahError,setSurahError] = useState('');
  const [ayahError,setAyahError] = useState('');
  const [mappingError,setMappingError] = useState('');
  const [retry,setRetry] = useState(0);
  const [loadedSurah,setLoadedSurah] = useState<number|null>(null);

  // === Refs ===
  const mainAreaRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Load Surahs saat mount
  // ============================================================
  useEffect(() => {
    let active=true;
    const loadSurahs = async () => {
      setSurahLoading(true);setSurahError('');
      try {
        const res = await (webAPI as any).getQuranSurahs();
        if (!active) return;
        if (res.data && res.data.length > 0) {
          setSurahs(res.data);
          setSelectedSurah(current => current ?? res.data[0].id);
        }
      } catch (err) {
        if(active)setSurahError('Daftar surah gagal dimuat. Periksa koneksi lalu coba lagi.');
      }
      if(active)setSurahLoading(false);
    };
    loadSurahs();
    return ()=>{active=false;};
  }, [retry]);

  // ============================================================
  // Load Ayahs + Tafsir Mappings saat Surah berubah
  // ============================================================
  useEffect(() => {
    if (selectedSurah === null) return;

    let active=true;
    const loadSurahData = async () => {
      setAyahError('');setMappingError('');setLoadedSurah(null);
      setAyahLoading(true);
      setTafsirListLoading(true);
      setCurrentAyahIndex(0);
      setOpenTafsir(null);
      setAyahs([]);
      setTafsirMappings([]);
      setTafsirBooks([]);

      try {
        const [ayahRes, tafsirRes] = await Promise.all([
          (webAPI as any).getQuranAyahs(selectedSurah),
          (webAPI as any).getTafsirBySurah(selectedSurah).catch(() => ({ data: [],failed:true })),
        ]);

        if (!active) return;
        if(tafsirRes.failed)setMappingError('Daftar tafsir gagal dimuat. Silakan coba lagi.');
        setLoadedSurah(selectedSurah);
        if (ayahRes.data) {
          setAyahs(ayahRes.data);
        }

        if (tafsirRes.data && tafsirRes.data.length > 0) {
          setTafsirMappings(tafsirRes.data);
          const seen = new Set<number>();
          const uniqueBooks: { book_id: number; tafsir_name: string }[] = [];
          for (const m of tafsirRes.data as TafsirMapping[]) {
            if (!seen.has(m.book_id)) {
              seen.add(m.book_id);
              uniqueBooks.push({ book_id: m.book_id, tafsir_name: m.tafsir_name });
            }
          }
          setTafsirBooks(uniqueBooks);
        }
      } catch (err) {
        if(active)setAyahError('Ayat gagal dimuat. Periksa koneksi lalu coba lagi.');
      }

      if(active){setAyahLoading(false);setTafsirListLoading(false);}
    };

    loadSurahData();
    return ()=>{active=false;};
  }, [selectedSurah,retry]);

  // Scroll to top saat ayah berubah
  useEffect(() => {
    if (mainAreaRef.current) mainAreaRef.current.scrollTop = 0;
  }, [currentAyahIndex]);

  const [activeTafsirBook, setActiveTafsirBook] = useState<{ bookId: number; tafsirName: string } | null>(null);

  // ============================================================
  // Navigasi Ayat
  // ============================================================
  const goToPrevAyah = useCallback(() => {
    setCurrentAyahIndex(i => Math.max(0, i - 1));
  }, []);

  const goToNextAyah = useCallback(() => {
    setCurrentAyahIndex(i => Math.min(ayahs.length - 1, i + 1));
  }, [ayahs.length]);

  const goToAyah = useCallback((index: number) => {
    setCurrentAyahIndex(index);
  }, []);

  // ============================================================
  // Load isi tafsir
  // ============================================================
  const selectTafsirBook = (bookId:number,tafsirName:string) => {setActiveTafsirBook({bookId,tafsirName});setView('tafsir');setPanel(null);};

  useEffect(() => {
    if (!activeTafsirBook || loadedSurah !== selectedSurah) {
      setOpenTafsir(null);setTafsirLoading(false);
      return;
    }

    const currentAyah = ayahs[currentAyahIndex];
    if (!currentAyah) {setTafsirLoading(false);return;}

    const mapping = tafsirMappings.find(
      m => m.book_id === activeTafsirBook.bookId && m.ayah_no === currentAyah.ayah_no
    );

    if (!mapping) {
      setTafsirLoading(false);
      setOpenTafsir({
        bookId: activeTafsirBook.bookId,
        pageId: 0,state:'empty',
        tafsir_name: activeTafsirBook.tafsirName,
        text: 'Tafsir untuk ayat ini belum tersedia dalam kitab yang dipilih.'
      });
      return;
    }

    let isMounted = true;
    setTafsirLoading(true);
    setOpenTafsir(null);

    (webAPI as any).getTafsirPage(mapping.book_id, mapping.page_id)
      .then((res: any) => {
        if (!isMounted) return;
        if (res.data) {
          setOpenTafsir({
            bookId: activeTafsirBook.bookId,
            pageId: mapping.page_id,state:'ready',
            tafsir_name: activeTafsirBook.tafsirName,
            text: stripHtml(res.data.text || ''),
            part: res.data.part,
            page: res.data.page,
          });
        } else {
          setOpenTafsir({ bookId: activeTafsirBook.bookId, pageId: mapping.page_id, state:'empty',tafsir_name: activeTafsirBook.tafsirName, text: 'Teks tafsir untuk ayat ini belum tersedia.' });
        }
      })
      .catch((err: any) => {
        console.error('Gagal memuat tafsir:', err);
        if (isMounted) setOpenTafsir({ bookId: activeTafsirBook.bookId, pageId: mapping.page_id, state:'error',tafsir_name: activeTafsirBook.tafsirName, text: 'Teks tafsir gagal dimuat. Silakan coba lagi.' });
      })
      .finally(() => {
        if (isMounted) setTafsirLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeTafsirBook, currentAyahIndex, ayahs, tafsirMappings,loadedSurah,selectedSurah,retry]);

  const [panel,setPanel] = useState<'surah'|'tafsir'|null>(null);
  const [view,setView] = useState<'ayat'|'tafsir'>('ayat');
  const [surahSearch,setSurahSearch] = useState('');
  const [tafsirSearch,setTafsirSearch] = useState('');
  const [fontSize,setFontSize] = useState(28);
  const [focusMode,setFocusMode]=useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const focusRef=useModalFocus(()=>setFocusMode(false),focusMode && panel===null);
  const panelRef = useModalFocus(()=>setPanel(null),panel!==null);
  const currentAyah = loadedSurah === selectedSurah ? ayahs[currentAyahIndex] ?? null : null;
  const selectedSurahData = surahs.find(s=>s.id===selectedSurah);
  const latinName = (id:number) => surahMetadata.find(s=>s.id===id)?.latin || `Surah ${id}`;
  const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670]/g,'').toLowerCase().replace(/[^a-z0-9\u0621-\u064a]/g,'');
  const filteredSurahs = surahs.filter(s=>[s.name,latinName(s.id),surahMetadata.find(m=>m.id===s.id)?.alias||'',String(s.id)].some(v=>normalize(v).includes(normalize(surahSearch))));
  const filteredBooks = tafsirBooks.filter(b=>normalize(b.tafsir_name).includes(normalize(tafsirSearch)));
  const ready = !!currentAyah && !ayahLoading;
  const hasMapping = (bookId:number) => ready && tafsirMappings.some(m=>m.book_id===bookId && m.ayah_no===currentAyah.ayah_no);
  const hasBismillah = showOpeningBismillah(selectedSurah,currentAyah?.ayah_no);
  useEffect(()=>{
    const update=()=>{
      const root=rootRef.current;if(!root)return;
      const bottom=document.querySelector('[data-app-bottom-nav]')?.getBoundingClientRect().height || 0;
      const padding=parseFloat(getComputedStyle(root.parentElement!).paddingBottom)||0;
      const height=window.visualViewport?.height || window.innerHeight;
      root.style.setProperty('--q-height',`${Math.max(240,height-root.getBoundingClientRect().top-bottom-padding)}px`);
    };
    update();const observer=new ResizeObserver(update);if(rootRef.current?.parentElement)observer.observe(rootRef.current.parentElement);
    window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);
    return()=>{observer.disconnect();window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);};
  },[focusMode]);
  useEffect(()=>{
    if(!panel && !focusMode)return;
    const old=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=old;};
  },[panel,focusMode]);
  useEffect(()=>{mainAreaRef.current?.scrollTo({top:0});},[view]);

  const retryButton = <button type="button" className="q-button" onClick={()=>setRetry(v=>v+1)}>Coba lagi</button>;
  const surahList = <>
    <label className="q-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Cari surah" placeholder="Nama Arab, Latin, atau nomor surah" value={surahSearch} onChange={e=>setSurahSearch(e.target.value)}/></label>
    {surahLoading?<p role="status" className="q-status">Memuat daftar surah…</p>:surahError?<div role="alert" className="q-status">{surahError}{retryButton}</div>:<div className="q-choice-list">{filteredSurahs.map(s=><button type="button" key={s.id} aria-current={selectedSurah===s.id?'true':undefined} className={`q-choice ${selectedSurah===s.id?'is-selected':''}`} onClick={()=>{setSelectedSurah(s.id);setPanel(null);setView('ayat');}}><span className="q-number">{s.id}</span><span className="q-choice-label"><strong>{latinName(s.id)}</strong><span lang="ar" dir="rtl" className="q-arabic">{s.name}</span></span></button>)}{!filteredSurahs.length&&<p className="q-status">Surah tidak ditemukan. Coba nama atau nomor lain.</p>}</div>}
  </>;
  const tafsirList = <>
    <p className="q-muted q-small">Pilih rujukan untuk {selectedSurah?latinName(selectedSurah):'surah'} · Ayat {currentAyah?.ayah_no||'—'}.</p>
    {tafsirListLoading?<p role="status" className="q-status">Memuat daftar tafsir…</p>:mappingError?<div role="alert" className="q-status">{mappingError}{retryButton}</div>:!tafsirBooks.length?<p className="q-status">Tafsir untuk surah ini belum tersedia.</p>:<>
      <label className="q-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Cari kitab tafsir" placeholder="Cari nama kitab tafsir" value={tafsirSearch} onChange={e=>setTafsirSearch(e.target.value)}/></label>
      <div className="q-choice-list">{filteredBooks.map(book=><button key={book.book_id} type="button" className={`q-choice ${activeTafsirBook?.bookId===book.book_id?'is-selected':''}`} aria-current={activeTafsirBook?.bookId===book.book_id?'true':undefined} disabled={!hasMapping(book.book_id)} onClick={()=>selectTafsirBook(book.book_id,book.tafsir_name)}><BookOpen size={18} aria-hidden="true"/><span className="q-choice-label"><strong dir="auto" className="q-arabic">{book.tafsir_name}</strong>{!hasMapping(book.book_id)&&<span className="q-small q-muted">Belum tersedia untuk ayat ini</span>}</span></button>)}{!filteredBooks.length&&<p className="q-status">Kitab tidak ditemukan. Coba kata lain.</p>}</div>
    </>}
  </>;
  const ayahControls = <div className="q-ayah-controls">
    <button type="button" className="q-button" onClick={goToPrevAyah} disabled={!ready || currentAyahIndex===0} aria-label="Ayat sebelumnya"><ChevronLeft size={18} aria-hidden="true"/><span>Sebelumnya</span></button>
    <span aria-live="polite" className="q-position">{currentAyah?.ayah_no||'—'} / {ayahs.length||'—'}</span>
    <button type="button" className="q-button" onClick={goToNextAyah} disabled={!ready || currentAyahIndex>=ayahs.length-1} aria-label="Ayat berikutnya"><span>Berikutnya</span><ChevronRight size={18} aria-hidden="true"/></button>
  </div>;
  return <section className={`quran-reader${focusMode?' q-focus-mode':''}`} ref={node=>{rootRef.current=node;focusRef.current=node as HTMLDivElement;}} tabIndex={-1} role={focusMode && panel===null?'dialog':undefined} aria-modal={focusMode && panel===null?true:undefined} aria-label="Pembaca Al-Qur’an">
    <aside className="q-desktop-sidebar" aria-label="Daftar surah"><h2 className="q-side-title">Daftar Surah</h2>{surahList}</aside>
    <div className="q-reader-main">
      <div className="q-toolbar">
        <button type="button" className="q-button q-surah-trigger" aria-label={`Pilih surah, ${selectedSurah?latinName(selectedSurah):'belum dipilih'}`} aria-haspopup="dialog" aria-expanded={panel==='surah'} aria-controls="quran-choice-panel" onClick={()=>setPanel('surah')}><List size={18} aria-hidden="true"/><span><small>Surah</small><strong>{selectedSurah?latinName(selectedSurah):'Pilih surah'}</strong></span></button>
        <label className="q-ayah-select"><span>Ayat</span><select aria-label="Pilih ayat" disabled={!ready} value={currentAyahIndex} onChange={e=>goToAyah(Number(e.target.value))}>{ayahs.length?ayahs.map((a,i)=><option key={a.id} value={i}>{a.ayah_no}</option>):<option value={0}>—</option>}</select></label>

      </div>
      <div className="q-view-controls"><div className="q-tabs" role="tablist" aria-label="Tampilan bacaan">{(['ayat','tafsir'] as const).map(tab=><button key={tab} id={`q-tab-${tab}`} type="button" role="tab" aria-selected={view===tab} aria-controls={`q-panel-${tab}`} tabIndex={view===tab?0:-1} onClick={()=>setView(tab)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'ayat':e.key==='End'?'tafsir':tab==='ayat'?'tafsir':'ayat';setView(next);document.getElementById(`q-tab-${next}`)?.focus();}}}>{tab==='ayat'?'Ayat':'Tafsir'}</button>)}</div><div className="q-font-controls" role="group" aria-label="Ukuran tulisan"><Type size={16} aria-hidden="true"/><button type="button" className="q-icon-button" onClick={()=>setFontSize(v=>Math.max(22,v-2))} disabled={fontSize<=22} aria-label="Perkecil tulisan">A−</button><button type="button" className="q-icon-button" onClick={()=>setFontSize(v=>Math.min(44,v+2))} disabled={fontSize>=44} aria-label="Perbesar tulisan">A+</button><button type="button" className="q-icon-button q-focus-toggle" aria-pressed={focusMode} aria-label={focusMode?'Keluar mode baca layar penuh':'Mode baca layar penuh'} title={focusMode?'Keluar mode baca layar penuh':'Mode baca layar penuh'} onClick={()=>setFocusMode(v=>!v)}>{focusMode?'Keluar':'Fokus'}</button></div></div>
      <div ref={mainAreaRef} className="q-reading-area">
        {surahError || ayahError ? <div role="alert" className="q-state q-error"><p>{surahError||ayahError}</p>{retryButton}</div>:!ready?<div role="status" className="q-state">{(surahLoading||ayahLoading)&&<Loader2 className="animate-spin" size={24}/>}<p>{surahLoading?'Memuat daftar surah…':ayahLoading?'Memuat ayat…':'Ayat untuk surah ini belum tersedia.'}</p></div>:<>
          <div className="q-context"><h2>{latinName(selectedSurah!)} <span className="q-arabic" lang="ar" dir="rtl">{selectedSurahData?.name}</span></h2><p>Surah {selectedSurah} · Ayat {currentAyah.ayah_no}{currentAyah.page?` · Halaman ${currentAyah.page}`:''}</p></div>
          <div id="q-panel-ayat" role="tabpanel" aria-labelledby="q-tab-ayat" hidden={view!=='ayat'} tabIndex={0}>
            {hasBismillah&&<p className="q-basmalah q-arabic" lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>}
            <div className="q-verse q-arabic" lang="ar" dir="rtl" style={{fontSize:`${fontSize}px`}}>{currentAyah.text} <span className="q-verse-number" aria-label={`Ayat ${currentAyah.ayah_no}`}>﴿{toArabicNumber(currentAyah.ayah_no)}﴾</span></div>
            <button type="button" className="q-button q-read-tafsir" onClick={()=>setView('tafsir')}><BookOpen size={18} aria-hidden="true"/>Baca tafsir ayat ini</button>
          </div>
          <div id="q-panel-tafsir" role="tabpanel" aria-labelledby="q-tab-tafsir" hidden={view!=='tafsir'} tabIndex={0}>
            <button type="button" className="q-button q-source-trigger" aria-haspopup="dialog" aria-expanded={panel==='tafsir'} aria-controls="quran-choice-panel" onClick={()=>setPanel('tafsir')}><BookOpen size={18} aria-hidden="true"/><span>{activeTafsirBook?'Ganti kitab tafsir':'Pilih kitab tafsir'}</span></button>
            {tafsirLoading?<div role="status" className="q-state"><Loader2 className="animate-spin" size={22}/><p>Memuat teks tafsir…</p></div>:mappingError?<div role="alert" className="q-state q-error"><p>{mappingError}</p>{retryButton}</div>:!tafsirBooks.length?<p className="q-state">Tafsir untuk surah ini belum tersedia.</p>:!activeTafsirBook?<p className="q-state">Pilih kitab tafsir untuk membaca penjelasan ayat ini.</p>:openTafsir?<article className="q-tafsir"><h3 className="q-arabic" dir="auto">{openTafsir.tafsir_name}</h3>{openTafsir.state==='ready'&&<p className="q-small q-muted">{latinName(selectedSurah!)} · Ayat {currentAyah.ayah_no}{openTafsir.part?` · Jilid ${openTafsir.part}`:''}{openTafsir.page?` · Halaman ${openTafsir.page}`:''}</p>}<p className={openTafsir.state==='ready'?'q-arabic q-tafsir-text':'q-status'} dir="auto" style={openTafsir.state==='ready'?{fontSize:`${Math.max(20,fontSize-4)}px`}:undefined}>{openTafsir.text}</p>{openTafsir.state==='error'&&retryButton}</article>:null}
          </div>
        </>}
      </div>
      {ayahControls}
    </div>
    <aside className="q-desktop-sidebar" aria-label="Daftar kitab tafsir"><h2 className="q-side-title">Kitab Tafsir</h2>{tafsirList}</aside>
    {panel&&createPortal(<div ref={panelRef} className="q-modal" role="dialog" aria-modal="true" aria-labelledby="quran-panel-title" tabIndex={-1} id="quran-choice-panel"><div className="q-modal-backdrop" onClick={()=>setPanel(null)} aria-hidden="true"/><div className="q-modal-sheet"><div className="q-modal-header"><h2 id="quran-panel-title">{panel==='surah'?'Pilih Surah':'Pilih Kitab Tafsir'}</h2><button type="button" className="q-icon-button" aria-label="Tutup panel pilihan" onClick={()=>setPanel(null)}><X size={22}/></button></div><div className="q-modal-content">{panel==='surah'?surahList:tafsirList}</div></div></div>,document.body)}
  </section>;
};
export default QuranReader;
