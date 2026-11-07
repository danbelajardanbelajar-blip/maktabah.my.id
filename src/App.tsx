import { useState } from 'react';
import { Upload, MessageSquare, Search, FolderSearch, Library, BookOpen, Menu, Info, Download, Shield, ChevronRight, ChevronLeft, BookMarked, Bot, GitPullRequest } from 'lucide-react';
import './App.css';
import { webAPI } from './api';
import ReaderModal from './components/ReaderModal';
import QuranReader from './components/QuranReader';
import RowaDictionary from './components/RowaDictionary';
import About from './components/About';
import Privacy from './components/Privacy';
import { Admin } from './components/Admin';
import Feedback from './components/Feedback';
import BookRequest from './components/BookRequest';
import BookSubmit from './components/BookSubmit';
import Catalog from './components/Catalog';
import AskAI from './components/AskAI';
import { parseNavigation, navigationHash, routePage, routeCategories } from './lib/navigation';
import type { AppTab } from './lib/navigation';
import { readingPositions } from './lib/reading-position';
import { MoreDropdown, MoreLinks } from './components/MoreMenu';
import { useModalFocus } from './lib/use-modal-focus';
import { Collection } from './components/Collection';
import Settings, { THEMES } from './components/Settings';
import { useEffect, useRef } from 'react';


function App() {
  const [activeTab, setActiveTabState] = useState<AppTab>(() => parseNavigation(window.location.hash, window.location.search).tab);
  const [homeQuery, setHomeQuery] = useState('');
  const navigationHandler = useRef<() => void>(() => {});
  const loadedSearch = useRef('');
  const lastTabLocations = useRef<Partial<Record<AppTab,string>>>({});
  const pendingSearch = useRef('');
  const searchRequest = useRef(0);

  // Search States
  const [searchMode, setSearchMode] = useState<'text' | 'title' | 'pdf'>('text');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    try {
      webAPI.logVisit(activeTab).catch(() => {});
    } catch(e) {}
  }, [activeTab]);

  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ total_books?: number, total_categories?: number, total_searches?: number, online_users?: number } | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Failed to load stats:", err));
  }, []);
  const [recentSearches, setRecentSearches] = useState<{query:string}[]>([]);
  const [recentAiQuestions, setRecentAiQuestions] = useState<{query:string}[]>([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiQuestionVersion, setAiQuestionVersion] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const openAiQuestion = (question = '') => { setAiQuestion(question); setAiQuestionVersion(v=>v+1); setActiveTab('ask'); };
  const [popularSearches, setPopularSearches] = useState<{query:string, count:number}[]>([]);
  const [popularBooks, setPopularBooks] = useState<{bkid:number, bk:string, count:number}[]>([]);
  const [positions,setPositions] = useState(() => readingPositions(localStorage));
  useEffect(() => {
    const update = () => setPositions(readingPositions(localStorage));
    window.addEventListener('readingPositionsUpdated',update); window.addEventListener('storage',update);
    return () => {window.removeEventListener('readingPositionsUpdated',update);window.removeEventListener('storage',update);};
  },[]);
  const [recentBooks, setRecentBooks] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('recentBooks') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const handler = () => {
      try { setRecentBooks(JSON.parse(localStorage.getItem('recentBooks') || '[]')); } catch {}
    };
    window.addEventListener('recentBooksUpdated', handler);
    return () => window.removeEventListener('recentBooksUpdated', handler);
  }, []);
  const limit = 50;
  
  // Advanced Search States
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  const setActiveTab = (tab: AppTab) => {
    const hash = tab === 'catalog' && lastTabLocations.current.catalog ? lastTabLocations.current.catalog : navigationHash(tab, tab === 'search' || tab === 'advanced_search' ? {q:query,mode:searchMode,page:currentPage,cats:selectedCategories.join(',')} : {});
    if (hash !== window.location.hash) {
      window.history.replaceState({...window.history.state,scrollY:window.scrollY},'');
      window.history.pushState(null,'',hash);
    }
    if (tab === 'home') setHomeQuery('');
    navigationHandler.current();
    window.scrollTo(0,0);
  };

  // States for Book Modal
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const bookDialogRef = useModalFocus(() => setSelectedBook(null), selectedBook !== null);
  const [bookInfo, setBookInfo] = useState<any>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [loadingBook, setLoadingBook] = useState(false);

  // States for Reader Modal
  const [readingConfig, setReadingConfig] = useState<{ bookId: number, pageId?: number, highlightQuery?: string } | null>(null);

  const [favorites, setFavorites] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('favorites') || '[]'); } catch(e){return []} });
  const [bookmarks, setBookmarks] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('bookmarks') || '[]'); } catch(e){return []} });

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);


  // Settings State
  
  const openReader = (config: any) => {
    const saved = config.pageId === undefined ? readingPositions(localStorage).find(p => p.bookId === config.bookId) : null;
    config = {...config, pageId: config.pageId ?? saved?.pageId};
    setReadingConfig(config);
    window.history.replaceState({...window.history.state, scrollY:window.scrollY},'');
    const hash = `#/read/${config.bookId}${config.pageId !== undefined ? '/' + config.pageId : ''}`;
    window.history.pushState({ ...config, maktabahReader: true }, '', hash);
  };

  const closeReader = () => {
    if (window.history.state?.maktabahReader) window.history.back();
    else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setReadingConfig(null);
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const hash = window.location.hash;
      if (hash.startsWith('#/read/')) {
        const parts = hash.replace('#/read/', '').split('/');
        setReadingConfig({
          bookId: parseInt(parts[0]),
          pageId: parts[1] !== undefined ? Number(parts[1]) : readingPositions(localStorage).find(p => p.bookId === Number(parts[0]))?.pageId,
          highlightQuery: e.state?.highlightQuery || ''
        });
      } else {
        setReadingConfig(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    // Initial load
    if (window.location.hash.startsWith('#/read/')) {
      handlePopState({ state: null } as PopStateEvent);
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  
  const scrollRef = useRef<number>(0);
  useEffect(() => {
    if (readingConfig) {
      scrollRef.current = window.scrollY;
    } else {
      // Small timeout to allow DOM to render before scrolling
      setTimeout(() => window.scrollTo(0, scrollRef.current), 50);
    }
  }, [readingConfig]);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('maktabah_settings');
    return saved ? JSON.parse(saved) : {
      arabicFont: 'Amiri',
      latinFont: 'Inter',
      theme: 'green',
      fontSize: 24
    };
  });

  useEffect(() => {
    localStorage.setItem('maktabah_settings', JSON.stringify(settings));
    const theme = THEMES.find(t => t.id === settings.theme) || THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--app-bg', theme.bg);
    root.style.setProperty('--app-text', theme.text);
    root.style.setProperty('--reader-bg', theme.readerBg);
    root.style.setProperty('--reader-paper', theme.readerPaper);
    // @ts-ignore
    root.style.setProperty('--app-primary', theme.primary || '#0f172a');
    // @ts-ignore
    root.style.setProperty('--app-primary-hover', theme.primaryHover || '#1e293b');
    root.style.setProperty('--arabic-font', `"${settings.arabicFont}", serif`);
    root.style.setProperty('--latin-font', `"${settings.latinFont}", sans-serif`);
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`);
  }, [settings]);

  useEffect(() => {
    // @ts-ignore
    webAPI.getCategories().then(res => {
      if (res.data) setCategories(res.data);
    }).catch(console.error);

    fetch('/api/popular-searches').then(r => r.json()).then(res => {
      if (res && res.data) setPopularSearches(res.data);
    }).catch(()=>{});
    fetch('/api/popular-books').then(r => r.json()).then(res => {
      if (res && res.data) setPopularBooks(res.data);
    }).catch(()=>{});
  }, []);

  const homeHistoryVisible = activeTab === 'home';
  useEffect(() => {
    if (!homeHistoryVisible) return;
    let current = true;
    webAPI.getRecentSearches().then(res => { if (current && res.data) setRecentSearches(res.data); }).catch(() => {});
    webAPI.getRecentQuestions().then(res => { if (current && res.data) setRecentAiQuestions(res.data); }).catch(() => {});
    return () => { current = false; };
  }, [homeHistoryVisible]);

  const executeSearch = async (searchQuery: string, page: number, mode = searchMode, historyMode: 'push'|'none' = 'push', categoryFilter = selectedCategories) => {
    if (!searchQuery.trim()) return;
    const requestId = ++searchRequest.current;
    const key = JSON.stringify([searchQuery, page, mode, categoryFilter]);
    pendingSearch.current = key;
    const targetTab = (historyMode === 'none' ? parseNavigation(window.location.hash).tab : activeTab) === 'advanced_search' ? 'advanced_search' : 'search';
    if (historyMode === 'push') {
      window.history.replaceState({...window.history.state,scrollY:window.scrollY},'');
      const hash = navigationHash(targetTab,{q:searchQuery,mode,page,cats:categoryFilter.join(',')});
      if (hash !== window.location.hash) window.history.pushState(null,'',hash);
    }
    setActiveTabState(targetTab); setQuery(searchQuery); setSearchMode(mode); setSelectedCategories(categoryFilter);
    setLoading(true);
    setError('');
    try {
      let res; let fetchedResults: any[] = []; let fetchedTotal = 0;
      if (mode === 'text') {
        res = await webAPI.search(searchQuery, page, limit, categoryFilter.length > 0 ? categoryFilter.join(',') : undefined);
        fetchedResults = res.results || []; fetchedTotal = res.total || 0;
      } else if (mode === 'title') {
        res = await webAPI.searchTitles(searchQuery, page, limit, categoryFilter.length > 0 ? categoryFilter.join(',') : undefined);
        fetchedResults = res.data || []; fetchedTotal = res.total || 0;
      } else if (mode === 'pdf') {
        const [scholariumRes, archiveRes] = await Promise.all([
          webAPI.searchScholarium(searchQuery, page).catch(() => ({ data: [] })),
          webAPI.searchArchive(searchQuery, page).catch(() => ({ response: { docs: [], numFound: 0 } }))
        ]);
        
        const combinedResults = [
          ...(scholariumRes.data || []).map((r: any) => ({ ...r, _source: 'scholarium' })),
          ...(archiveRes.response?.docs || []).map((r: any) => ({ ...r, _source: 'archive' }))
        ];
        
        fetchedResults = combinedResults;
        fetchedTotal = (scholariumRes.total || (scholariumRes.data?.length || 0)) + (archiveRes.response?.numFound || 0);
      }
      if (requestId !== searchRequest.current) return;
      setResults(fetchedResults); setTotalResults(fetchedTotal); loadedSearch.current = key;
      setCurrentPage(page);
      setHasSearched(true);
    } catch (err: any) {
      if (requestId !== searchRequest.current) return;
      setError(err.message);
      setResults([]);
      setTotalResults(0);
    }
    if (requestId === searchRequest.current) { pendingSearch.current = ''; setLoading(false); }
  };

  navigationHandler.current = () => {
    if (window.location.hash.startsWith('#/read/')) return;
    const route = parseNavigation(window.location.hash,window.location.search);
    lastTabLocations.current[route.tab] = window.location.hash;
    setActiveTabState(route.tab);
    if (route.tab === 'search' || route.tab === 'advanced_search') {
      const q = route.params.get('q') || '';
      const mode = ['text','title','pdf'].includes(route.params.get('mode') || '') ? route.params.get('mode') as 'text'|'title'|'pdf' : 'text';
      const page = routePage(route.params.get('page')), cats = routeCategories(route.params.get('cats'));
      setQuery(q); setSearchMode(mode); setCurrentPage(page); setSelectedCategories(cats);
      const key = JSON.stringify([q,page,mode,cats]);
      if (q && key !== loadedSearch.current && key !== pendingSearch.current) void executeSearch(q,page,mode,'none',cats);
    }
  };
  useEffect(() => {
    const handle = () => { navigationHandler.current(); const y = window.history.state?.scrollY; if (typeof y === 'number') setTimeout(() => window.scrollTo(0,y),80); };
    handle();
    window.addEventListener('popstate',handle); window.addEventListener('hashchange',handle); window.addEventListener('maktabah:navigate',handle);
    return () => { window.removeEventListener('popstate',handle); window.removeEventListener('hashchange',handle); window.removeEventListener('maktabah:navigate',handle); };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    executeSearch(activeTab === 'home' ? homeQuery : query, 1, activeTab === 'home' ? 'text' : searchMode).then(() => {
      if (!['search','advanced_search'].includes(parseNavigation(window.location.hash).tab)) return;
      setTimeout(() => {
        const resultsEl = document.getElementById('search-results');
        if (resultsEl) {
          const y = resultsEl.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);
    });
  };

  const handleNextPage = () => {
    executeSearch(query, currentPage + 1, searchMode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      executeSearch(query, currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openBookInfo = async (bookId: number) => {
    setSelectedBook(bookId);
    setLoadingBook(true);
    try {
      // @ts-ignore
      const infoRes = await webAPI.getBookInfo(bookId);
      // @ts-ignore
      const tocRes = await webAPI.getToc(bookId);
      
      setBookInfo(infoRes.data);
      setToc(tocRes.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoadingBook(false);
  };

  const totalPages = Math.ceil(totalResults / limit);

  return (
    <div className="flex flex-col min-h-screen font-sans pb-[70px] xl:pb-0 transition-colors duration-300" dir="ltr" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)', fontFamily: 'var(--latin-font)' }}>
      {!readingConfig && (
        <>
          <header className="hidden xl:block bg-transparent md:bg-[var(--app-primary)] md:text-white md:shadow-lg relative z-40 md:sticky md:top-0 transition-colors duration-300 md:backdrop-blur-md md:bg-opacity-95" style={{ fontFamily: 'var(--latin-font)' }}>
        <div className="flex justify-center md:justify-between items-center pt-6 pb-2 md:px-8 md:py-0 max-w-7xl mx-auto md:h-[80px]">
                    {/* Logo & Title */}
          <a 
            href="/" 
            onClick={(e) => { 
              e.preventDefault(); 
              setActiveTab('home');
              window.scrollTo(0, 0); 
            }} 
            className="flex items-center gap-3 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img src="/logo.png" alt="Logo Pesantren Assunniyyah" className="w-20 h-20 md:w-12 md:h-12 object-contain" />
            <h1 className="hidden md:block text-xl md:text-2xl font-bold" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>المكتبة السنية</h1>
          </a>

          {/* Navigation Menu (Hidden on mobile, uses bottom tabs instead) */}
          <nav className="hidden xl:flex flex-row gap-4 lg:gap-6 font-sans h-full">
            <button 
              onClick={() => { setActiveTab('home'); }}
              className={`flex items-center gap-2 text-right md:text-center px-4 py-4 md:py-0 transition-all font-semibold text-sm lg:text-base md:h-full border-b-[3px] ${activeTab === 'home' ? 'text-white border-b-white bg-white/10 md:bg-transparent' : 'text-white/70 hover:text-white border-b-transparent hover:bg-white/5 md:hover:bg-transparent'}`}
            >
              <Search size={18} /> Beranda
            </button>
            <button 
              onClick={() => { setActiveTab('search'); }}
              className={`flex items-center gap-2 text-right md:text-center px-4 py-4 md:py-0 transition-all font-semibold text-sm lg:text-base md:h-full border-b-[3px] ${(activeTab === 'search' || activeTab === 'advanced_search') ? 'text-white border-b-white bg-white/10 md:bg-transparent' : 'text-white/70 hover:text-white border-b-transparent hover:bg-white/5 md:hover:bg-transparent'}`}
            >
              <FolderSearch size={18} /> Cari
            </button>
            <button 
              onClick={() => { setActiveTab('catalog'); }}
              className={`flex items-center gap-2 text-right md:text-center px-4 py-4 md:py-0 transition-all font-semibold text-sm lg:text-base md:h-full border-b-[3px] ${activeTab === 'catalog' ? 'text-white border-b-white bg-white/10 md:bg-transparent' : 'text-white/70 hover:text-white border-b-transparent hover:bg-white/5 md:hover:bg-transparent'}`}
            >
              <Library size={18} /> Katalog
            </button>
              <button 
                onClick={() => openAiQuestion()}
                className={`flex items-center gap-2 text-right md:text-center px-4 py-4 md:py-0 transition-all font-semibold text-sm lg:text-base md:h-full border-b-[3px] ${activeTab === 'ask' ? 'text-white border-b-white bg-white/10 md:bg-transparent' : 'text-white/70 hover:text-white border-b-transparent hover:bg-white/5 md:hover:bg-transparent'}`}
              >
                <Bot size={18} /> Tanya AI
              </button>

            <MoreDropdown onNavigate={setActiveTab} />
          </nav>
        </div>
      </header>
      
      <main className="flex-1 w-full mx-auto p-4 md:px-8 md:py-6 max-w-7xl relative">
        <div hidden={activeTab !== 'ask'}><AskAI initialQuestion={aiQuestion} questionVersion={aiQuestionVersion} onBusyChange={setAiBusy} openBook={(bookId,pageId)=>openReader({bookId,pageId})} /></div>
        {activeTab === 'quran' ? (
          <QuranReader />
        ) : activeTab === 'rowa' ? (
          <RowaDictionary />
        ) : activeTab === 'collection' ? (
          <Collection positions={positions} favorites={favorites} bookmarks={bookmarks} readBook={(bookId,pageId)=>openReader({bookId,pageId})}
            removeFavorite={id=>setFavorites((items:any[])=>items.filter(item=>item.bkid!==id))}
            removeBookmark={(id,pageId)=>setBookmarks((items:any[])=>items.filter(item=>item.bkid!==id||item.id!==pageId))}
            removePosition={id=>{const next=positions.filter(item=>item.bookId!==id);try{localStorage.setItem('maktabah-reading-positions',JSON.stringify(next));}catch{}setPositions(next);}} />
        ) : activeTab === 'about' ? (
          <About />
        ) : activeTab === 'admin' ? (
          <Admin onClose={() => { const url = new URL(window.location.href); url.searchParams.delete('admin'); window.history.replaceState(null, '', url.pathname + url.search + url.hash); setActiveTab('home'); }} />
        ) : activeTab === 'privacy' ? (
          <Privacy />
        ) : activeTab === 'settings' ? (
          <Settings settings={settings} setSettings={setSettings} />
        ) : activeTab === 'feedback' ? (
          <Feedback />
        ) : activeTab === 'book_request' ? (
          <BookRequest />
        ) : activeTab === 'book_submit' ? (
          <BookSubmit />
        ) : activeTab === 'catalog' ? (
          <Catalog openBook={openBookInfo} readBook={(bookId) => openReader({ bookId })} />
        ) : activeTab === 'ask' ? (
            null
          ) : activeTab === 'more' ? (
          <section className="bg-[var(--reader-bg)] rounded-2xl border p-5"><h2 className="text-xl font-bold mb-4">Lainnya</h2><MoreLinks onNavigate={setActiveTab}/></section>
        ) : (
          <div className="w-full">
            {activeTab === 'home' && (
                 <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--app-primary)] to-[#0f3d20] text-white shadow-2xl border border-white/10">
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% -20%, rgba(201,162,39,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 100%, rgba(22,101,52,0.4) 0%, transparent 60%)' }}></div>
                    <div className="relative z-10 px-6 py-12 md:py-20 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-amber-300 text-xs font-semibold tracking-widest uppercase mb-6 shadow-sm backdrop-blur-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          Perpustakaan Digital Islam
                        </div>
                        <h2 className="text-5xl md:text-7xl font-bold mb-4 drop-shadow-[0_4px_24px_rgba(201,162,39,0.4)] text-amber-300" style={{ fontFamily: 'var(--arabic-font)' }}>المكتبة السنية</h2>
                        <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto font-light tracking-wide leading-relaxed">
                          Eksplorasi ribuan literatur klasik dan khazanah keilmuan Islam dalam genggaman Anda.
                        </p>
                        
                        {/* Stats Banner */}
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm text-white/90 font-medium">
                          {stats ? (
                            <>
                              <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-lg">
                                <BookOpen size={16} className="text-amber-400" /> {stats.total_books ? stats.total_books.toLocaleString('id-ID') : '...'} Kitab
                              </span>
                              <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-lg">
                                <Library size={16} className="text-amber-400" /> {stats.total_categories ? stats.total_categories.toLocaleString('id-ID') : '...'} Kategori
                              </span>
                              <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-lg">
                                <Search size={16} className="text-amber-400" /> {stats.total_searches ? stats.total_searches.toLocaleString('id-ID') : '...'} Pencarian
                              </span>
                            </>
                          ) : (
                            <span className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-lg animate-pulse">
                              <BookOpen size={16} className="text-amber-400" /> Memuat statistik...
                            </span>
                          )}
                        </div>
                    </div>
                 </div>
              )}
              
              {activeTab === 'home' && <section className="mb-6 rounded-2xl border bg-[var(--reader-bg)] p-5">
                <div className="flex justify-between gap-3 items-center mb-3"><h2 className="font-bold text-lg">Lanjutkan Membaca</h2><button onClick={()=>setActiveTab('collection')} className="text-sm font-semibold text-[var(--app-primary)]">Koleksi Saya →</button></div>
                <p className="text-xs text-gray-500 mb-3">Tersimpan di perangkat ini · {favorites.length} favorit · {bookmarks.length} bookmark</p>
                {positions.length>0?<div className="grid grid-cols-1 md:grid-cols-3 gap-3">{positions.slice(0,3).map(item=><button key={item.bookId} onClick={()=>openReader({bookId:item.bookId,pageId:item.pageId})} className="text-left rounded-xl border p-3 bg-[var(--reader-paper)]"><span className="block font-bold" dir="auto">{item.title}</span><span className="text-xs text-gray-500">Juz {item.part??'—'} · Halaman {item.page??'—'}</span></button>)}</div>:<p className="text-sm text-gray-500">Posisi bacaan akan muncul setelah membuka kitab.</p>}
              </section>}
              {activeTab !== 'home' && <button type="button" onClick={() => setActiveTab(activeTab === 'advanced_search' ? 'search' : 'advanced_search')} aria-expanded={activeTab === 'advanced_search'} className="mb-4 rounded-lg border px-4 py-2 text-sm font-semibold">{activeTab === 'advanced_search' ? 'Tutup filter kategori' : 'Filter kategori / Cari lanjut'}</button>}
              {activeTab === 'advanced_search' && (
              <div className="mb-6 bg-[var(--reader-bg)] p-5 rounded-2xl border border-[var(--app-primary)]/20 shadow-sm">
                <h3 className="font-bold text-[var(--app-primary)] mb-3 flex items-center gap-2">
                  <FolderSearch size={20}/> Cari Lanjut (Berdasarkan Kategori)
                </h3>
                
                <div className="max-h-80 md:max-h-[60vh] overflow-y-auto p-4 bg-white/50 border-2 border-black/5 rounded-xl flex flex-col gap-2 custom-scrollbar">
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-black/5 rounded-lg transition-colors border border-transparent hover:border-black/5">
                    <input 
                      type="checkbox" 
                      checked={selectedCategories.length === 0}
                      onChange={() => setSelectedCategories([])}
                      className="w-5 h-5 accent-[var(--app-primary)] rounded cursor-pointer"
                    />
                    <span className="text-gray-700 font-semibold select-none">-- Semua Kategori --</span>
                  </label>
                  <div className="h-px bg-black/5 my-1"></div>
                  {categories.map(c => (
                    <label key={c.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-black/5 rounded-lg transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedCategories.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories([...selectedCategories, c.id]);
                          } else {
                            setSelectedCategories(selectedCategories.filter(id => id !== c.id));
                          }
                        }}
                        className="w-5 h-5 accent-[var(--app-primary)] rounded cursor-pointer"
                      />
                      <span className="text-gray-700 select-none">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={handleSearch} className="mb-8 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <Search className="text-gray-400" size={20} />
                </div>
                <input 
                  type="text" 
                  value={activeTab === 'home' ? homeQuery : query}
                  onChange={(e) => { if (activeTab === 'home') setHomeQuery(e.target.value); else { setQuery(e.target.value); setHasSearched(false); } }}
                  placeholder="Cari di sini..." 
                  className="w-full pl-4 pr-12 py-4 rounded-xl border-2 border-black/10 text-lg md:text-xl focus:outline-none focus:border-[var(--app-primary)] bg-[var(--reader-paper)] shadow-inner transition-all"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-[var(--app-primary)] text-white px-8 py-4 rounded-xl font-bold text-lg md:text-xl hover:bg-[var(--app-primary-hover)] transition-all disabled:opacity-50 shadow-md flex justify-center items-center gap-2"
              >
                {loading ? 'Mencari...' : 'Cari'}
              </button>
            </form>

              {activeTab !== 'home' && <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { id: 'text', label: 'Teks', icon: <Search size={16}/> },
                  { id: 'title', label: 'Judul Kitab', icon: <BookMarked size={16}/> },
                  { id: 'pdf', label: 'PDF', icon: <FolderSearch size={16}/> }
                ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSearchMode(tab.id as any);
                    if (query.trim()) executeSearch(query, 1, tab.id as any);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border ${
                    searchMode === tab.id 
                    ? 'bg-[var(--app-primary)] text-white border-[var(--app-primary)]' 
                    : 'bg-[var(--reader-bg)] text-gray-600 border-black/10 hover:border-[var(--app-primary)]/50 hover:bg-[var(--app-primary)]/5'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>}


            <div id="search-results">
              {activeTab !== 'home' && error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-xl mb-6 shadow-sm">{error}</div>}

            {activeTab === 'home' && (
              <div className="space-y-6 mb-8">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Pencarian Terakhir */}
                  <div className="p-5 min-w-0 bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm">
                    <h3 className="text-gray-500 font-semibold mb-4 flex items-center gap-2"><Search size={18} /> Pencarian Terakhir</h3>
                    {recentSearches.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.slice(0, 5).map((rs, idx) => (
                          <button 
                            key={idx}
                            onClick={() => { setQuery(rs.query); executeSearch(rs.query, 1); }}
                            className="max-w-full break-words text-left bg-white border border-gray-200 hover:border-[var(--app-primary)] hover:text-[var(--app-primary)] text-gray-600 px-4 py-2 rounded-full text-sm transition-all shadow-sm"
                            dir="auto"
                          >
                            {rs.query}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Belum ada riwayat pencarian.</p>
                    )}
                  </div>

                  <div className="p-5 min-w-0 bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm">
                    <h3 className="text-gray-500 font-semibold mb-4 flex items-center gap-2"><Bot size={18} className="shrink-0" /> Tanya AI Terakhir</h3>
                    {recentAiQuestions.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {recentAiQuestions.slice(0, 5).map((item, idx) => (
                          <button key={idx} type="button" onClick={() => openAiQuestion(item.query)}
                            className="text-left break-words bg-white border border-gray-200 hover:border-[var(--app-primary)] hover:text-[var(--app-primary)] text-gray-600 px-3 py-2 rounded-xl text-sm transition-all shadow-sm" dir="auto">
                            {item.query}
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-400 italic">Belum ada riwayat Tanya AI.</p>}
                  </div>
                  </div>

                  {/* Pencarian Terbanyak */}
                  <div className="p-6 bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm">
                    <h3 className="text-gray-500 font-semibold mb-4 flex items-center gap-2"><Search size={18} /> Pencarian Terbanyak (Global)</h3>
                    {popularSearches.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {popularSearches.slice(0, 5).map((rs, idx) => (
                          <button 
                            key={idx}
                            onClick={() => { setQuery(rs.query); executeSearch(rs.query, 1); }}
                            className="bg-white border border-gray-200 hover:border-[var(--app-primary)] hover:text-[var(--app-primary)] text-gray-600 px-4 py-2 rounded-full text-sm transition-all shadow-sm flex items-center gap-2"
                            dir="auto"
                          >
                            {rs.query} <span className="bg-gray-100 text-xs px-2 py-0.5 rounded-full text-gray-500">{rs.count}x</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Belum ada data pencarian terbanyak.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Baru Saja Dibuka */}
                  <div className="p-6 bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm">
                    <h3 className="text-gray-500 font-semibold mb-4 flex items-center gap-2"><BookOpen size={18} /> Terakhir Dibuka (Personal)</h3>
                    {recentBooks.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {recentBooks.slice(0, 5).map((rb: any, idx: number) => (
                          <div 
                            key={idx}
                            onClick={() => openReader({ bookId: rb.bkid })}
                            className="bg-white border border-gray-200 hover:border-[var(--app-primary)] hover:text-[var(--app-primary)] text-gray-700 px-4 py-3 rounded-xl text-sm transition-all shadow-sm cursor-pointer flex justify-between items-center"
                            dir="auto"
                          >
                            <span className="font-bold truncate" style={{ fontFamily: 'var(--arabic-font)' }}>{rb.bk}</span>
                            <span className="text-xs text-gray-400 ml-2 shrink-0">{rb.author}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Belum ada kitab yang baru saja dibuka.</p>
                    )}
                  </div>

                  {/* Paling Sering Dibuka */}
                  <div className="p-6 bg-[var(--reader-bg)] rounded-2xl border border-black/5 shadow-sm">
                    <h3 className="text-gray-500 font-semibold mb-4 flex items-center gap-2"><BookOpen size={18} /> Sering Dibuka (Global)</h3>
                    {popularBooks.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {popularBooks.slice(0, 5).map((rb, idx) => (
                          <div 
                            key={idx}
                            onClick={() => openReader({ bookId: rb.bkid })}
                            className="bg-white border border-gray-200 hover:border-[var(--app-primary)] hover:text-[var(--app-primary)] text-gray-700 px-4 py-3 rounded-xl text-sm transition-all shadow-sm cursor-pointer flex justify-between items-center"
                            dir="auto"
                          >
                            <span className="font-bold truncate" style={{ fontFamily: 'var(--arabic-font)' }}>{rb.bk}</span>
                            <span className="bg-gray-100 text-xs px-2 py-0.5 rounded-full text-gray-500 ml-2 shrink-0">{rb.count}x</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Belum ada data kitab paling sering dibuka.</p>
                    )}
                  </div>
                </div>

                {/* Submit, Request, Feedback Cards */}
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  <button onClick={() => setActiveTab('book_submit')} className="bg-[var(--reader-bg)] p-3 md:p-5 rounded-2xl border border-black/5 shadow-sm hover:shadow-md hover:border-[var(--app-primary)] transition-all flex flex-col items-center justify-center gap-2 md:gap-3 text-gray-700 hover:text-[var(--app-primary)]">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--app-primary)]/10 flex items-center justify-center text-[var(--app-primary)]">
                        <Upload size={20} className="md:hidden" />
                        <Upload size={24} className="hidden md:block" />
                    </div>
                    <span className="font-bold text-[10px] sm:text-xs md:text-base text-center leading-tight">Submit Kitab</span>
                  </button>
                  <button onClick={() => setActiveTab('book_request')} className="bg-[var(--reader-bg)] p-3 md:p-5 rounded-2xl border border-black/5 shadow-sm hover:shadow-md hover:border-[var(--app-primary)] transition-all flex flex-col items-center justify-center gap-2 md:gap-3 text-gray-700 hover:text-[var(--app-primary)]">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--app-primary)]/10 flex items-center justify-center text-[var(--app-primary)]">
                        <GitPullRequest size={20} className="md:hidden" />
                        <GitPullRequest size={24} className="hidden md:block" />
                    </div>
                    <span className="font-bold text-[10px] sm:text-xs md:text-base text-center leading-tight">Request Kitab</span>
                  </button>
                  <button onClick={() => setActiveTab('feedback')} className="bg-[var(--reader-bg)] p-3 md:p-5 rounded-2xl border border-black/5 shadow-sm hover:shadow-md hover:border-[var(--app-primary)] transition-all flex flex-col items-center justify-center gap-2 md:gap-3 text-gray-700 hover:text-[var(--app-primary)]">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--app-primary)]/10 flex items-center justify-center text-[var(--app-primary)]">
                        <MessageSquare size={20} className="md:hidden" />
                        <MessageSquare size={24} className="hidden md:block" />
                    </div>
                    <span className="font-bold text-[10px] sm:text-xs md:text-base text-center leading-tight">Kirim Feedback</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab !== 'home' && totalResults > 0 && (
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-[var(--reader-bg)] p-4 rounded-xl shadow-sm border border-black/5 gap-2">
                <span className="font-semibold text-sm md:text-base text-[var(--app-text)]">Total Hasil: <span className="font-bold text-[var(--app-primary)]">{totalResults.toLocaleString()}</span></span>
                <span className="text-sm md:text-base text-[var(--app-text)] opacity-80">Halaman {currentPage} dari {totalPages}</span>
              </div>
            )}

            
            <div className="space-y-4 md:space-y-6">
              {activeTab !== 'home' && searchMode === 'text' && results.map((r, i) => (
                <div key={i} className="bg-[var(--reader-bg)] p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md border border-black/5 transition-all">
                  <div className="text-xs md:text-sm text-[var(--app-text)] opacity-70 mb-4 font-sans flex flex-col sm:flex-row sm:justify-between border-b border-black/5 pb-3 gap-3">
                    <div className="flex gap-4">
                      <button onClick={() => openBookInfo(r.book_id)} className="font-semibold hover:text-[var(--app-primary)] transition-colors flex items-center gap-1.5">
                        <Info size={16} /> Detail Kitab
                      </button>
                      <a href={`/api/download/${r.book_id}`} target="_blank" className="font-semibold text-blue-600 hover:opacity-80 transition-colors flex items-center gap-1.5">
                        <Download size={16} /> Word
                      </a>
                      <button onClick={() => openReader({ bookId: r.book_id, pageId: r.page_id, highlightQuery: query })} className="font-semibold text-[var(--app-primary)] hover:opacity-80 transition-colors flex items-center gap-1.5">
                        <BookOpen size={16} /> Baca Kitab
                      </button>
                    </div>
                    <span className="bg-black/5 px-2 py-1 rounded-md">Jilid: {r.part} | Halaman: {r.page}</span>
                  </div>
                  {r.book_name && (
                    <div className="mb-4">
                      <span className="bg-[var(--app-primary)]/10 text-[var(--app-primary)] px-3 py-1.5 rounded-lg text-sm md:text-base font-semibold inline-flex items-center gap-2">
                        <BookMarked size={16} /> <span dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>{r.book_name}</span>
                      </span>
                    </div>
                  )}
                  <div 
                      onClick={() => openReader({ bookId: r.book_id, pageId: r.page_id, highlightQuery: query })}
                      className="text-2xl leading-loose cursor-pointer hover:bg-[var(--app-primary)]/5 active:bg-[var(--app-primary)]/10 p-4 rounded-xl border border-transparent hover:border-[var(--app-primary)]/20 transition-all flex flex-col gap-1"
                      title="Klik teks untuk membaca halaman ini"
                      style={{ fontFamily: 'var(--arabic-font)' }}
                    >
                      {(r.snippet || '').split(/\r\n|\n|\r|<br\s*\/?>|<\/br>|\u2028|\u2029/i).map((line: string, idx: number) => (
                        <div key={idx} dir="auto" className="whitespace-pre-wrap text-justify" style={{ wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: line }} />
                      ))}
                    </div>
                </div>
              ))}

              {activeTab !== 'home' && searchMode === 'title' && results.map((r, i) => (
                <div key={i} onClick={() => openReader({ bookId: r.bkid })} className="bg-[var(--reader-bg)] p-5 md:p-6 rounded-2xl shadow-sm hover:shadow-md border border-black/5 transition-all cursor-pointer group">
                  <div className="flex flex-col gap-3">
                    <h3 dir="auto" style={{ fontFamily: 'var(--arabic-font)' }} className="text-2xl font-bold text-[var(--app-primary)] group-hover:text-[var(--app-primary-hover)]">{r.bk}</h3>
                    <p className="text-sm text-gray-600">
                      <strong>Penulis:</strong> {r.author_name || 'Tidak diketahui'} <br/>
                      <strong>Kategori:</strong> {r.category_name || '-'}
                    </p>
                    <div className="flex gap-4 mt-2">
                      <button onClick={(e) => { e.stopPropagation(); openBookInfo(r.bkid); }} className="bg-black/5 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[var(--app-primary)] hover:text-white transition-colors flex items-center gap-2">
                        <Info size={16} /> Detail
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openReader({ bookId: r.bkid }); }} className="bg-[var(--app-primary)] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[var(--app-primary-hover)] transition-colors flex items-center gap-2">
                        <BookOpen size={16} /> Baca Kitab
                      </button>
                      <a href={`/api/download/${r.bkid}`} onClick={(e) => e.stopPropagation()} target="_blank" className="bg-[#2e7d32] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#1b5e20] transition-colors flex items-center gap-2">
                        <Download size={16} /> Word
                      </a>
                    </div>
                  </div>
                </div>
              ))}

              {activeTab !== 'home' && searchMode === 'pdf' && results.map((r, i) => {
                if (r._source === 'scholarium') {
                  return (
                    <div key={i} onClick={() => { webAPI.logDownload('[PDF Scholarium] ' + r.name).catch(()=>{}); window.open(r.link, '_blank'); }} className="bg-yellow-50 p-5 rounded-2xl shadow-sm hover:shadow-md border border-yellow-200 transition-all relative overflow-hidden cursor-pointer group">
                      <div className="absolute top-0 right-0 bg-yellow-200 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">Scholarium</div>
                      <h3 className="text-lg font-bold text-yellow-900 group-hover:text-yellow-700 break-words pr-16">{r.name}</h3>
                      <a href={r.link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); webAPI.logDownload('[PDF Scholarium] ' + r.name).catch(()=>{}); }} className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-yellow-700 transition-colors inline-flex items-center gap-2">
                         Buka File / Download
                      </a>
                    </div>
                  );
                } else {
                  return (
                    <div key={i} onClick={() => { webAPI.logDownload('[PDF Archive] ' + r.title).catch(()=>{}); window.open(`https://archive.org/details/${r.identifier}`, '_blank'); }} className="bg-blue-50 p-5 rounded-2xl shadow-sm hover:shadow-md border border-blue-200 transition-all relative overflow-hidden cursor-pointer group">
                      <div className="absolute top-0 right-0 bg-blue-200 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">Archive.org</div>
                      <h3 className="text-lg font-bold text-blue-900 group-hover:text-blue-700 break-words pr-16">{r.title}</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        {r.creator && <span>Oleh: <strong>{Array.isArray(r.creator) ? r.creator.join(', ') : r.creator}</strong><br/></span>}
                        {r.date && <span>Tahun: {r.date}</span>}
                      </p>
                      <a href={`https://archive.org/details/${r.identifier}`} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); webAPI.logDownload('[PDF Archive] ' + r.title).catch(()=>{}); }} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                         Buka di Archive.org
                      </a>
                    </div>
                  );
                }
              })}

              {activeTab !== 'home' && hasSearched && !loading && results.length === 0 && query && !error && (
                <div className="text-center py-12 bg-[var(--reader-bg)] rounded-2xl border border-black/5">
                  <Search className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="text-[var(--app-text)] opacity-60 text-lg">Tidak ada hasil ditemukan.</p>
                </div>
              )}
            </div>
            </div>

            {activeTab !== 'home' && totalResults > 0 && (
              <div className="flex justify-center items-center gap-4 mt-8 bg-[var(--reader-bg)] p-2 rounded-2xl shadow-sm border border-black/5 w-fit mx-auto">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || loading}
                  className="bg-[var(--app-primary)] text-white p-3 rounded-xl font-bold hover:bg-[var(--app-primary-hover)] disabled:opacity-50 transition-all"
                  title="Sebelumnya"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="flex items-center font-bold px-4 text-[var(--app-text)] min-w-[100px] justify-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || loading}
                  className="bg-[var(--app-primary)] text-white p-3 rounded-xl font-bold hover:bg-[var(--app-primary-hover)] disabled:opacity-50 transition-all"
                  title="Selanjutnya"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      {aiBusy && activeTab !== 'ask' && <button onClick={() => openAiQuestion()} role="status" className="fixed bottom-20 lg:bottom-4 left-4 z-40 rounded-xl bg-emerald-800 text-white shadow-lg px-4 py-3 text-sm">Tanya AI sedang menyiapkan jawaban… Buka percakapan</button>}

      {/* Footer (Hidden on mobile because it's replaced by Lainnya menu) */}
      <footer className="hidden md:block bg-[var(--app-primary)] text-white py-6 md:py-8 mt-auto shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm md:text-base font-medium opacity-90 flex items-center gap-2">
            &copy; {new Date().getFullYear()} al Maktabah as Sunniyyah.
          </div>
          <div className="flex gap-6 text-sm md:text-base font-bold">
            <button 
              onClick={() => { setActiveTab('about'); window.scrollTo(0,0); }}
              className={`hover:text-white transition-colors pb-1 flex items-center gap-2 ${activeTab === 'about' ? 'text-white border-b-2 border-white' : 'text-white/70 border-b-2 border-transparent'}`}
            >
              <Info size={16} /> Tentang Kami
            </button>
            <a
              href="/privacy-policy"
              className={`hover:text-white transition-colors pb-1 flex items-center gap-2 ${activeTab === 'privacy' ? 'text-white border-b-2 border-white' : 'text-white/70 border-b-2 border-transparent'}`}
            >
              <Shield size={16} /> Kebijakan Privasi
            </a>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <div dir="ltr" className="xl:hidden fixed bottom-0 left-0 w-full bg-[var(--reader-bg)] border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 h-[70px] pb-safe flex justify-around items-center transition-colors duration-300">
        <button 
          onClick={() => { setActiveTab('home'); window.scrollTo(0,0); }}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${activeTab === 'home' ? 'text-[var(--app-primary)] transform -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Search size={24} className="mb-1" />
          <span className="text-[10px] font-bold">Beranda</span>
        </button>
        <button 
          onClick={() => { setActiveTab('search'); window.scrollTo(0,0); }}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${(activeTab === 'search' || activeTab === 'advanced_search') ? 'text-[var(--app-primary)] transform -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <FolderSearch size={24} className="mb-1" />
          <span className="text-[10px] font-bold">Cari</span>
        </button>
        <button 
          onClick={() => { setActiveTab('catalog'); window.scrollTo(0,0); }} 
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${activeTab === 'catalog' ? 'text-[var(--app-primary)] transform -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Library size={24} className="mb-1" />
          <span className="text-[10px] font-bold">Katalog</span>
        </button>
        
        <button 
          onClick={() => { openAiQuestion(); window.scrollTo(0, 0); }}
          className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${activeTab === 'ask' ? 'text-[var(--app-primary)]' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <Bot size={22} className={activeTab === 'ask' ? 'fill-[var(--app-primary)]/20' : ''} />
          <span className="text-[10px] font-medium">Tanya AI</span>
        </button>
        
        <button 
          onClick={() => { setActiveTab('more'); window.scrollTo(0,0); }} 
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${activeTab === 'more' ? 'text-[var(--app-primary)] transform -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Menu size={24} className="mb-1" />
          <span className="text-[10px] font-bold">Lainnya</span>
        </button>
      </div>

      {/* Book Info Modal */}
      {selectedBook && (
        <div ref={bookDialogRef} role="dialog" aria-modal="true" aria-label="Detail kitab" tabIndex={-1} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-[60] transition-opacity">
          <div className="bg-[var(--reader-paper)] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-[var(--app-primary)]/20 animate-in fade-in zoom-in duration-200">
            <div className="bg-[var(--app-primary)] text-white p-5 flex justify-between items-center shadow-md z-10">
              <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={24} /> <span dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>{bookInfo ? bookInfo.bk : 'Memuat...'}</span></h2>
              <button onClick={() => setSelectedBook(null)} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-all"><ChevronRight size={28} /></button>
            </div>
            
            <div className="overflow-y-auto p-6 text-right scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {loadingBook ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="w-12 h-12 border-4 border-[var(--app-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p>Memuat profil kitab...</p>
                </div>
              ) : bookInfo ? (
                <div className="space-y-6">
                  <div className="flex justify-center mb-8">
                    <button 
                      onClick={() => {
                        setSelectedBook(null);
                        openReader({ bookId: selectedBook as number, highlightQuery: activeTab === 'search' ? query : undefined });
                      }}
                      className="bg-[var(--app-primary)] text-white px-8 py-4 rounded-xl font-bold text-xl hover:bg-[var(--app-primary-hover)] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-3"
                    >
                      <BookOpen size={24} /> Mulai Baca Kitab
                    </button>
                  </div>
                  {/* Metadata Kitab & Penulis */}
                  <div className="bg-[var(--reader-bg)] p-6 rounded-2xl border border-black/5 shadow-sm">
                    <h3 className="text-xl font-bold mb-5 text-[var(--app-primary)] border-b border-black/5 pb-3 flex items-center justify-end gap-2">
                      معلومات الكتاب والمؤلف (Metadata) <Info size={20} />
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-lg text-[var(--app-text)]">
                      <div><span className="font-bold text-[#795548]">Kategori:</span> {bookInfo.category || '-'}</div>
                      <div>
                        <span className="font-bold text-[#795548]">Penulis:</span> {bookInfo.auth || '-'}
                        {bookInfo.HigriD ? ` (Wafat: ${bookInfo.HigriD} H / ${bookInfo.AD} M)` : ''}
                      </div>
                      <div className="col-span-2 text-blue-800">
                        <span className="font-bold text-[#795548]">Total Halaman:</span> {bookInfo.total_pages} Halaman
                      </div>
                    </div>
                    {bookInfo.betaka && (
                      <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
                        <span className="font-bold text-[#795548] block mb-2" style={{ fontFamily: 'var(--latin-font)' }}>Penerbit (Betaka):</span>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap" dir="auto" style={{ fontFamily: 'var(--arabic-font)', fontSize: 'var(--app-font-size)' }}>{bookInfo.betaka}</p>
                      </div>
                    )}
                    {bookInfo.book_inf && (
                      <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
                        <span className="font-bold text-[#795548] block mb-2" style={{ fontFamily: 'var(--latin-font)' }}>Info Kitab:</span>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap" dir="auto" style={{ fontFamily: 'var(--arabic-font)', fontSize: 'var(--app-font-size)' }}>{bookInfo.book_inf}</p>
                      </div>
                    )}
                    {bookInfo.author_inf && (
                      <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
                        <span className="font-bold text-[#795548] block mb-2" style={{ fontFamily: 'var(--latin-font)' }}>Biografi Penulis:</span>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap" dir="auto" style={{ fontFamily: 'var(--arabic-font)', fontSize: 'var(--app-font-size)' }}>{bookInfo.author_inf}</p>
                      </div>
                    )}
                  </div>

                  {/* Daftar Isi (TOC) */}
                  <div>
                    <h3 className="text-xl font-bold mb-4 text-[#4e342e] border-b pb-2 flex justify-between"><span dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>الفهرس</span> <span>(Daftar Isi)</span></h3>
                    {toc.length > 0 ? (
                      <div className="bg-white border border-[#e0e0e0] rounded-lg p-4 max-h-64 overflow-y-auto">
                        <ul className="space-y-2">
                          {toc.map(item => (
                            <li key={item.id} style={{ paddingRight: `${(item.lvl - 1) * 1.5}rem` }} className="border-b border-gray-100 py-1 last:border-0 hover:bg-gray-50">
                              <button
                                onClick={() => {
                                  setSelectedBook(null);
                                  openReader({ bookId: selectedBook as number, pageId: item.id, highlightQuery: activeTab === 'search' ? query : undefined });
                                }}
                                className="text-[#5d4037] hover:text-[#3e2723] hover:underline text-right w-full flex text-lg"
                              >
                                {item.tit}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">Daftar isi tidak tersedia untuk kitab ini.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-red-500">Gagal memuat informasi kitab. (Pastikan migrasi telah selesai dan database memiliki ID ini).</div>
              )}
            </div>
          </div>
        </div>
      )}

        </>
      )}

      {/* Reader Modal */}
      {readingConfig && (
        <ReaderModal 
          bookId={readingConfig.bookId} 
          initialPageId={readingConfig.pageId}
          highlightQuery={readingConfig.highlightQuery}
          settings={settings}
          favorites={favorites}
          setFavorites={setFavorites}
          bookmarks={bookmarks}
          setBookmarks={setBookmarks}
          onPageChange={(id, pageId) => { if (window.location.hash.startsWith('#/read/')) window.history.replaceState(window.history.state,'',`#/read/${id}/${pageId}`); }}
          onClose={closeReader}
        />
      )}
    </div>
  );
}

export default App;



