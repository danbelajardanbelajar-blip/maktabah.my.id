import React, { useState, useEffect, useRef } from 'react';
import { webAPI } from '../api';
import { loadReaderData } from '../lib/reader-loader';
import { rememberReadingPosition, swipeDirection } from '../lib/reading-position';
import { useModalFocus } from '../lib/use-modal-focus';
import { BackButton } from './BackButton';
import type {AiRequest} from '../lib/ai-source';
import { ChevronLeft, ChevronRight, BookOpen, Heart, Bookmark, Download , ChevronsLeft, ChevronsRight, SkipBack, SkipForward, Menu, Search, List} from 'lucide-react';

export interface ReaderModalProps {
  bookId: number;
  initialPageId?: number;
  highlightQuery?: string;
  settings?: any;
  favorites?: any[];
  setFavorites?: any;
  bookmarks?: any[];
  setBookmarks?: any;
  onClose: () => void;
  onPageChange?: (bookId:number,pageId:number) => void;
  onAskAI?: (request:AiRequest) => void;
}

const buildArabicRegex = (word: string) => {
  const harakat = '[\\u064B-\\u065F\\u0670\\u0654\\u0655]*';
  let regexStr = '';
  const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let i = 0; i < safeWord.length; i++) {
    let char = safeWord[i];
    if (/[أإآا]/.test(char)) char = '[أإآا]';
    else if (/[ةه]/.test(char)) char = '[ةه]';
    else if (/[يى]/.test(char)) char = '[يى]';
    else if (char === 'ؤ') char = '[ؤو]';
    else if (char === 'ئ') char = '[ئي]';
    regexStr += char + harakat;
  }
  return regexStr;
};

const highlightText = (text: string, query?: string) => {
  if (!query || !text) return text;
  
  // Clean query from its own diacritics and quotes
  let cleanQuery = query.replace(/[\u064B-\u065F\u0670\u0654\u0655]/g, '').trim();
  cleanQuery = cleanQuery.replace(/['"]/g, '');
  if (!cleanQuery) return text;

  const words = cleanQuery.split(/\s+/).filter(w => w.length > 0);
  
  let highlighted = text;
  words.forEach(word => {
    const regexStr = buildArabicRegex(word);
    try {
      // Use word boundaries/lookarounds if needed, but for simple Arabic search, global match is fine.
      const regex = new RegExp(`(${regexStr})`, 'g');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-300 text-black px-1 rounded">$1</mark>');
    } catch (e) {
      // Ignore invalid regex
    }
  });
  
  return highlighted;
};


const ReaderModal: React.FC<ReaderModalProps> = ({ bookId, initialPageId, highlightQuery, settings, favorites = [], setFavorites, bookmarks = [], setBookmarks, onClose, onPageChange, onAskAI }) => {
  const readingTextRef=useRef<HTMLDivElement>(null);
  const askPage=(intent:'explain'|'translate')=>{
    const selection=window.getSelection();
    const text=selection && readingTextRef.current?.contains(selection.anchorNode) && readingTextRef.current?.contains(selection.focusNode)?selection.toString().trim():'';
    onAskAI?.({intent,source:{bookId,pageId:currentPage.id,title:bookInfo.bk,part:currentPage.part,page:currentPage.page,...(text?{text}:{})}});
  };
  const [bookInfo, setBookInfo] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<any>(null);
  const [currentPageId, setCurrentPageId] = useState<number | undefined>(initialPageId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const loadRequest = useRef(0);
  
  // Customization states
  const [fontSize, setFontSize] = useState(settings?.fontSize || 32);
  const [showUi, setShowUi] = useState(true);
  const [slideDir, setSlideDir] = useState<'left'|'right'|''>('');
  const [pageKey, setPageKey] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'toc'|'search'>('toc');
  const dialogRef = useModalFocus(() => { if (showSidebar) setShowSidebar(false); else onClose(); });
  const [toc, setToc] = useState<any[]>([]);
  const [tocLoaded, setTocLoaded] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [localHighlight, setLocalHighlight] = useState(highlightQuery);

  const loadToc = async () => {
    if (tocLoaded) return;
    try {
      const res = await fetch(`/api/toc/${bookId}`).then(r => r.json());
      if (res.data) {
        setToc(res.data);
        setTocLoaded(true);
      }
    } catch(e) {}
  };

  const handleBookSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&book_id=${bookId}`).then(r => r.json());
      if (res.results) {
        setSearchResults(res.results);
      }
    } catch(e) {}
    setSearchLoading(false);
  };


  // Split screen states
  const [relatedPage, setRelatedPage] = useState<any>(null);
  const [relatedBookInfo, setRelatedBookInfo] = useState<any>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const isFavorite = favorites.some((f: any) => f.bkid === bookId);
  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!setFavorites) return;
    if (isFavorite) {
      setFavorites((prev: any[]) => prev.filter(f => f.bkid !== bookId));
    } else if (bookInfo) {
      setFavorites((prev: any[]) => [{ bkid: bookInfo.bkid, bk: bookInfo.bk, author: bookInfo.auth }, ...prev]);
    }
  };

  const isBookmarked = currentPage && bookmarks.some((b: any) => b.bkid === bookId && b.id === currentPage.id);
  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!setBookmarks || !currentPage || !bookInfo) return;
    if (isBookmarked) {
      setBookmarks((prev: any[]) => prev.filter(b => !(b.bkid === bookId && b.id === currentPage.id)));
    } else {
      let snippet = currentPage.text.replace(/<[^>]*>?/gm, '');
      snippet = snippet.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      setBookmarks((prev: any[]) => [{ 
        bkid: bookInfo.bkid, 
        bk: bookInfo.bk, 
        id: currentPage.id, 
        juz: currentPage.part, 
        page: currentPage.page,
        snippet: snippet.substring(0, 100) + '...'
      }, ...prev]);
    }
  };


  useEffect(() => { setCurrentPageId(initialPageId); setLocalHighlight(highlightQuery); }, [bookId, initialPageId, highlightQuery]);
  useEffect(() => { setToc([]); setTocLoaded(false); setSearchResults([]); setShowSidebar(false); }, [bookId]);
  useEffect(() => {
    if (bookInfo?.bkid !== bookId || !currentPage) return;
    onPageChange?.(bookId,currentPage.id);
    rememberReadingPosition(localStorage,{bookId,pageId:currentPage.id,page:currentPage.page,part:currentPage.part,title:bookInfo.bk,updatedAt:Date.now()});
    window.dispatchEvent(new Event('readingPositionsUpdated'));
  },[bookId,bookInfo?.bkid,currentPage?.id]);

  useEffect(() => {
    if (bookInfo?.bkid === bookId && currentPage?.id === currentPageId) return;
    void loadBookAndPage();
    return () => { loadRequest.current++; };
  }, [bookId, currentPageId]);



  
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX=touchStartX.current, startY=touchStartY.current;
    touchStartX.current=null; touchStartY.current=null;
    if (startX===null || startY===null || !e.changedTouches[0]) return;
    const direction=swipeDirection(startX-e.changedTouches[0].clientX,startY-e.changedTouches[0].clientY,loading,Boolean(window.getSelection()?.toString()));
    if(direction==='next'){setSlideDir('left');void nextPage();}
    if(direction==='previous'){setSlideDir('right');void prevPage();}
  };

  const toggleUi = (e: React.MouseEvent) => {
    // Prevent toggling if user is clicking a button or link inside
    if ((e.target as HTMLElement).closest('button, a')) return;
    setShowUi(!showUi);
  };

  const loadBookAndPage = async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await loadReaderData(webAPI, bookId, currentPageId, bookInfo);
      if (request !== loadRequest.current) return;
      if (bookInfo?.bkid !== bookId) {
          setBookInfo(data.book);
          try {
            let recent = JSON.parse(localStorage.getItem('recentBooks') || '[]');
            recent = recent.filter((r:any) => r.bkid !== data.book.bkid);
            recent.unshift({ bkid: data.book.bkid, bk: data.book.bk, author: data.book.auth });
            if (recent.length > 10) recent = recent.slice(0, 10);
            localStorage.setItem('recentBooks', JSON.stringify(recent));
            window.dispatchEvent(new Event('recentBooksUpdated'));
          } catch(e) {}
      }
        setCurrentPage(data.page);
        setPageKey(k => k + 1);
        if (currentPageId !== data.page.id) {
          setCurrentPageId(data.page.id);
        }
        checkRelations(data.page.id);
    } catch (err) {
      if (request === loadRequest.current) setLoadError(err instanceof Error ? err.message : 'Kitab gagal dimuat. Periksa koneksi lalu coba lagi.');
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  };

  const checkRelations = async (pageId: number) => {
    setLoadingRelated(true);
    try {
      // @ts-ignore
      const rels = await webAPI.getMatnSharh(bookId, pageId);
      if (rels.data && rels.data.length > 0) {
        const relation = rels.data[0];
        
        // @ts-ignore
        const rPage = await webAPI.getPage(relation.linked_book_id, relation.linked_page_id);
        // @ts-ignore
        const rBook = await webAPI.getBookInfo(relation.linked_book_id);
        
        if (rPage.data) setRelatedPage(rPage.data);
        if (rBook.data) setRelatedBookInfo(rBook.data);
        setShowSplit(true);
      } else {
        setShowSplit(false);
        setRelatedPage(null);
        setRelatedBookInfo(null);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingRelated(false);
  };

  const nextPage = async () => {
    if (currentPageId === undefined) return;
    setLoading(true);
    try {
      // @ts-ignore
      const res = await webAPI.getNextPage(bookId, currentPageId);
      if (res.data) {
        setCurrentPageId(res.data.id);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const prevPage = async () => {
    if (currentPageId === undefined) return;
    setLoading(true);
    try {
      // @ts-ignore
      const res = await webAPI.getPrevPage(bookId, currentPageId);
      if (res.data) {
        setCurrentPageId(res.data.id);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const firstPage = async () => {
    setLoading(true);
    try {
      const res = await webAPI.getFirstPage(bookId);
      if (res.data) setCurrentPageId(res.data.id);
    } catch (err) { console.error(err); }
    setLoading(false);
  };
  const lastPage = async () => {
    setLoading(true);
    try {
      const res = await webAPI.getLastPage(bookId);
      if (res.data) setCurrentPageId(res.data.id);
    } catch (err) { console.error(err); }
    setLoading(false);
  };
  const nextJuz = async () => {
    if (currentPageId === undefined) return;
    setLoading(true);
    try {
      const res = await webAPI.getNextJuz(bookId, currentPageId);
      if (res.data) setCurrentPageId(res.data.id);
    } catch (err) { console.error(err); }
    setLoading(false);
  };
  const prevJuz = async () => {
    if (currentPageId === undefined) return;
    setLoading(true);
    try {
      const res = await webAPI.getPrevJuz(bookId, currentPageId);
      if (res.data) setCurrentPageId(res.data.id);
    } catch (err) { console.error(err); }
    setLoading(false);
  };


  if (loadError || !bookInfo || !currentPage) {
    return (
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Pembaca kitab" tabIndex={-1} className="fixed inset-0 bg-[#fbf8f1] flex justify-center items-center z-[70]">
        <div className="flex flex-col items-center gap-4 max-w-lg p-6 text-center">
          {!loadError && <div className="w-12 h-12 border-4 border-[#8d6e63] border-t-transparent rounded-full animate-spin" />}
          <div role={loadError ? 'alert' : 'status'} className="text-[#5d4037] text-xl font-bold">{loadError || 'Memuat Kitab…'}</div>
          <div className="flex flex-wrap justify-center gap-3">
            {loadError && <button onClick={() => void loadBookAndPage()} disabled={loading} className="rounded-lg bg-emerald-700 text-white px-4 py-2 disabled:opacity-50">Coba lagi</button>}
            <BackButton onClick={onClose} title="Kembali dari pembaca"/>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Pembaca kitab" tabIndex={-1} className="fixed inset-0 flex flex-col z-[70] shadow-2xl" dir="auto" style={{ backgroundColor: 'var(--reader-bg)', color: 'var(--app-text)', fontFamily: 'var(--latin-font)' }}>
      
      {!showUi && <div className="absolute top-3 right-3 z-50 flex gap-2 rounded-xl bg-white/95 shadow p-2"><BackButton onClick={onClose} title="Kembali dari pembaca"/><button onClick={() => setShowUi(true)} className="px-3 py-2 text-sm font-semibold">Tampilkan kontrol</button></div>}
      {/* Sleek Header */}
      <div className={`bg-white/80 backdrop-blur-md text-[#3e2723] h-auto min-h-16 flex flex-wrap gap-y-2 justify-between items-center px-2 md:px-6 py-2 shadow-sm border-b border-[#d7ccc8] z-30 transition-all duration-300 w-full shrink-0 ${showUi ? "relative" : "-translate-y-full opacity-0 absolute pointer-events-none"}`}>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto">
          <BackButton onClick={onClose} title="Kembali dari pembaca"/>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button 
              onClick={() => setFontSize((f: number) => Math.min(f + 4, 64))}
              className="px-2 md:px-3 py-1 hover:bg-white rounded shadow-sm text-base md:text-lg font-bold"
              title="Perbesar Huruf"
            >
              A+
            </button>
            <button 
              onClick={() => setFontSize((f: number) => Math.max(f - 4, 16))}
              className="px-2 md:px-3 py-1 hover:bg-white rounded shadow-sm text-base md:text-lg font-bold"
              title="Perkecil Huruf"
            >
              A-
            </button>
          </div>
          <div className="flex items-center gap-1 md:gap-2 ml-1">
            <button onClick={toggleFavorite} className="p-1 md:p-2 rounded-full hover:bg-red-50 text-gray-500 transition-colors" title={isFavorite ? "Hapus dari Favorit" : "Tambahkan ke Favorit"}>
              <Heart size={20} className={isFavorite ? "text-red-500" : ""} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button onClick={toggleBookmark} className="p-1 md:p-2 rounded-full hover:bg-yellow-50 text-gray-500 transition-colors" title={isBookmarked ? "Hapus Bookmark Halaman" : "Bookmark Halaman Ini"}>
              <Bookmark size={20} className={isBookmarked ? "text-yellow-500" : ""} fill={isBookmarked ? "currentColor" : "none"} />
            </button>
            <a href={`/api/download/${bookId}`} target="_blank" className="p-1 md:p-2 rounded-full hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors" title="Download Word" onClick={e => e.stopPropagation()}>
              <Download size={20} />
            </a>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowSidebar(!showSidebar); loadToc(); }} 
              className="p-1 md:p-2 rounded-full hover:bg-blue-50 text-gray-500 transition-colors" 
              title="Daftar Isi & Pencarian"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
        
        <button onClick={() => setShowUi(false)} className="px-2 py-1 text-xs border rounded mr-2" title="Sembunyikan kontrol pembaca">Mode fokus</button>
        <h2 className="text-lg md:text-2xl font-bold flex-1 min-w-0 text-center truncate px-2" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>{bookInfo.bk}</h2>
        
        <div className="hidden md:flex w-1/3 justify-end text-sm font-sans text-gray-500 font-medium truncate">
          {bookInfo.author_inf ? bookInfo.auth : 'al Maktabah As Sunniyyah'}
        </div>
      </div>

      {/* Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="absolute inset-0 bg-black/20 z-[35] transition-opacity" 
          onClick={(e) => { e.stopPropagation(); setShowSidebar(false); }}
        />
      )}

      {/* Sidebar for TOC and Search */}
      <div className={`absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-[40] transform transition-transform duration-300 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex bg-gray-100 p-2 gap-2 mt-16 md:mt-20">
          <button onClick={() => setSidebarTab('toc')} className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 ${sidebarTab === 'toc' ? 'bg-white shadow text-[#8d6e63]' : 'text-gray-500 hover:bg-gray-200'}`}><List size={16}/> Daftar Isi</button>
          <button onClick={() => setSidebarTab('search')} className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 ${sidebarTab === 'search' ? 'bg-white shadow text-[#8d6e63]' : 'text-gray-500 hover:bg-gray-200'}`}><Search size={16}/> Cari</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {sidebarTab === 'toc' ? (
            <div className="flex flex-col gap-1">
              {!tocLoaded ? <div className="text-center text-gray-400 p-4">Memuat daftar isi...</div> :
               toc.length === 0 ? <div className="text-center text-gray-400 p-4">Tidak ada daftar isi untuk kitab ini.</div> :
               toc.map(item => (
                 <button 
                   key={item.id} 
                   onClick={() => { setCurrentPageId(item.id); setShowSidebar(false); }}
                   className={`text-right p-2 hover:bg-[#8d6e63]/10 rounded text-sm font-medium ${item.lvl === 1 ? 'font-bold text-[#5d4037]' : item.lvl === 2 ? 'pr-4 text-[#8d6e63]' : 'pr-8 text-gray-600'}`}
                   dir="auto"
                   style={{ fontFamily: 'var(--arabic-font)' }}
                 >
                   {item.tit}
                 </button>
               ))
              }
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <form onSubmit={handleBookSearch} className="flex mb-4">
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="Cari dalam kitab ini..." 
                  className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2 text-sm outline-none focus:border-[#8d6e63]"
                  dir="auto"
                />
                <button type="submit" disabled={searchLoading} className="bg-[#8d6e63] text-white px-3 rounded-r-lg disabled:opacity-50"><Search size={18}/></button>
              </form>
              <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                {searchLoading ? <div className="text-center text-gray-400">Mencari...</div> :
                 searchResults.length === 0 ? (searchQuery ? <div className="text-center text-gray-400">Belum ada hasil pencarian.</div> : null) :
                 searchResults.map((res, i) => (
                   <div 
                     key={i} 
                     onClick={() => { setLocalHighlight(searchQuery); setCurrentPageId(res.page_id); setShowSidebar(false); }}
                     className="bg-gray-50 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100"
                   >
                     <div className="text-xs text-gray-500 mb-1 flex justify-between">
                        <span>Juz {res.part}</span>
                        <span>Hal {res.page}</span>
                     </div>
                     <div className="text-right text-sm text-gray-800 leading-relaxed" dir="rtl" dangerouslySetInnerHTML={{__html: res.snippet}} style={{fontFamily: 'var(--arabic-font)'}}></div>
                   </div>
                 ))
                }
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Content Area - Like physical pages on a desk */}
      <div 
        className={`flex-1 flex ${showSplit ? 'flex-col lg:flex-row' : 'flex-col'} overflow-hidden relative cursor-pointer lg:cursor-auto`}
        onClick={toggleUi}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Main Book Page */}
        <div className={`flex-1 p-0 md:p-4 lg:p-8 overflow-y-auto custom-scrollbar ${showUi ? "pb-24 md:pb-8" : "pb-4"}`}>
          <div className="w-full max-w-4xl mx-auto md:rounded-sm shadow-[0_0_25px_rgba(0,0,0,0.05)] border-0 md:border border-gray-200 flex flex-col min-h-full" style={{ backgroundColor: 'var(--reader-paper)' }}>
            <div className="px-4 md:px-8 py-3 md:py-4 border-b border-gray-200 flex justify-between items-center text-gray-600 font-sans text-xs md:text-sm">
              <span className="font-bold truncate max-w-[50%]" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>{bookInfo?.bk}</span>
              <span>Jilid: {currentPage?.part} • Hal: {currentPage?.page}</span>
            </div>
            
            {onAskAI && <div className="flex flex-wrap gap-2 px-4 md:px-8 py-3 border-b border-gray-200 font-sans" onClick={e=>e.stopPropagation()}>
              <button type="button" disabled={loading} onMouseDown={e=>e.preventDefault()} onClick={()=>askPage('explain')} className="min-h-11 rounded-xl px-4 py-2 bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40">Jelaskan halaman ini</button>
              <button type="button" disabled={loading} onMouseDown={e=>e.preventDefault()} onClick={()=>askPage('translate')} className="min-h-11 rounded-xl px-4 py-2 border border-emerald-700 text-emerald-800 text-sm font-semibold disabled:opacity-40">Terjemahkan halaman ini</button>
              <p className="basis-full text-xs text-gray-500">Pilih teks untuk membahas bagian tertentu, atau gunakan seluruh halaman.</p>
            </div>}
            <div className="p-4 md:p-8 lg:p-12 flex-1">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div ref={readingTextRef} key={pageKey} className={`flex flex-col ${slideDir ? 'animate-slide-' + slideDir : ''}`} style={{ fontSize: `${fontSize}px`, lineHeight: '2.2', fontFamily: 'var(--arabic-font)' }}>
                    {(currentPage?.text || '').split(/\r\n|\n|\r|<br\s*\/?>|<\/br>|\u2028|\u2029/i).map((line: string, i: number) => (
                      <div 
                        key={i} 
                        dir="auto" 
                        className="whitespace-pre-wrap text-justify" 
                        style={{ minHeight: line.trim() === '' ? '1.5em' : 'auto', wordBreak: 'break-word' }}
                        dangerouslySetInnerHTML={{ __html: highlightText(line, localHighlight) }} 
                      />
                    ))}
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Related Book (Split Screen) */}
        {showSplit && relatedPage && relatedBookInfo && (
          <div className={`flex-1 p-0 md:p-4 lg:p-8 overflow-y-auto custom-scrollbar ${showUi ? "pb-24 md:pb-8" : "pb-4"}`} style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <div className="w-full max-w-4xl mx-auto md:rounded-sm shadow-[0_0_25px_rgba(0,0,0,0.05)] border-0 md:border border-gray-300 flex flex-col min-h-full" style={{ backgroundColor: 'var(--reader-paper)' }}>
              <div className="px-4 md:px-8 py-3 md:py-4 border-b border-gray-300 flex justify-between items-center text-gray-600 font-sans text-xs md:text-sm bg-black/5">
                <span className="font-bold flex items-center gap-1 md:gap-2 truncate max-w-[50%]">
                  <BookOpen size={18} /> <span dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>{relatedBookInfo?.bk}</span>
                </span>
                <span>Jilid: {relatedPage?.part} • Hal: {relatedPage?.page}</span>
              </div>
              
              <div className="p-4 md:p-8 lg:p-12 flex-1">
                {loadingRelated ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div key={pageKey} className={`flex flex-col ${slideDir ? 'animate-slide-' + slideDir : ''}`} style={{ fontSize: `${Math.max(fontSize - 4, 16)}px`, lineHeight: '2.2', fontFamily: 'var(--arabic-font)', color: 'var(--app-text)' }}>
                      {(relatedPage?.text || '').split(/\r\n|\n|\r|<br\s*\/?>|<\/br>|\u2028|\u2029/i).map((line: string, i: number) => (
                        <div 
                          key={i} 
                          dir="auto" 
                          className="whitespace-pre-wrap text-justify" 
                          style={{ minHeight: line.trim() === '' ? '1.5em' : 'auto', wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: highlightText(line, localHighlight) }} 
                        />
                      ))}
                    </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {showUi && <details className="sm:hidden absolute bottom-24 right-3 z-30"><summary className="bg-white rounded-xl shadow border px-3 py-2 text-sm cursor-pointer">Navigasi lainnya</summary><div className="absolute bottom-full right-0 mb-2 bg-white shadow-xl rounded-xl border p-2 w-52 flex flex-col text-sm"><button onClick={firstPage} disabled={loading} className="p-2 text-left">Halaman pertama</button><button onClick={prevJuz} disabled={loading} className="p-2 text-left">Jilid sebelumnya</button><button onClick={nextJuz} disabled={loading} className="p-2 text-left">Jilid selanjutnya</button><button onClick={lastPage} disabled={loading} className="p-2 text-left">Halaman terakhir</button></div></details>}
      {/* Floating Bottom Navigation */}
      <div className={`absolute bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 flex items-center bg-white/95 backdrop-blur-lg shadow-2xl rounded-full p-1 md:p-2 border border-[#e0e0e0] z-30 font-sans w-[95%] md:w-auto justify-between md:justify-center transition-all duration-300 ${showUi ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"} `}>
        <div className="flex gap-1 md:gap-2">
          <button onClick={(e) => { e.stopPropagation(); setSlideDir('right'); firstPage(); }} disabled={loading} className="hidden sm:inline-flex bg-black/5 text-[var(--app-primary)] hover:bg-[var(--app-primary)] hover:text-white p-2 md:p-3 rounded-full transition-all disabled:opacity-50" aria-label="Halaman Pertama" title="Halaman Pertama">
            <SkipBack size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSlideDir('right'); prevJuz(); }} disabled={loading} className="hidden sm:inline-flex bg-black/5 text-[var(--app-primary)] hover:bg-[var(--app-primary)] hover:text-white p-2 md:p-3 rounded-full transition-all disabled:opacity-50" aria-label="Juz/Jilid Sebelumnya" title="Juz/Jilid Sebelumnya">
            <ChevronsLeft size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSlideDir('right'); prevPage(); }} disabled={loading} className="bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary-hover)] p-2 md:p-3 rounded-full transition-all disabled:opacity-50 shadow-md" title="Halaman Sebelumnya">
            <ChevronLeft size={24} />
          </button>
        </div>
        
        <div className="px-2 md:px-6 font-bold text-[var(--app-primary)] flex flex-col items-center flex-1">
          <span className="text-[10px] md:text-sm text-gray-500 uppercase tracking-widest truncate max-w-full">Posisi</span>
          <span className="text-sm md:text-base whitespace-nowrap">Hal {currentPage?.page ?? '-'}</span>
        </div>
        
        <div className="flex gap-1 md:gap-2">
          <button onClick={(e) => { e.stopPropagation(); setSlideDir('left'); nextPage(); }} disabled={loading} className="bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary-hover)] p-2 md:p-3 rounded-full transition-all disabled:opacity-50 shadow-md" title="Halaman Selanjutnya">
            <ChevronRight size={24} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSlideDir('left'); nextJuz(); }} disabled={loading} className="hidden sm:inline-flex bg-black/5 text-[var(--app-primary)] hover:bg-[var(--app-primary)] hover:text-white p-2 md:p-3 rounded-full transition-all disabled:opacity-50" aria-label="Juz/Jilid Selanjutnya" title="Juz/Jilid Selanjutnya">
            <ChevronsRight size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSlideDir('left'); lastPage(); }} disabled={loading} className="hidden sm:inline-flex bg-black/5 text-[var(--app-primary)] hover:bg-[var(--app-primary)] hover:text-white p-2 md:p-3 rounded-full transition-all disabled:opacity-50" aria-label="Halaman Terakhir" title="Halaman Terakhir">
            <SkipForward size={20} />
          </button>
        </div>
</div>

    </div>
  );
};

export default ReaderModal;
