import React, { useState, useEffect, useRef, useCallback } from 'react';
import { webAPI } from '../api';
import { ChevronRight, ChevronLeft, BookOpen, Loader2, X, BookMarked, Menu, Search } from 'lucide-react';

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

  // === Refs ===
  const mainAreaRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Load Surahs saat mount
  // ============================================================
  useEffect(() => {
    const loadSurahs = async () => {
      setSurahLoading(true);
      try {
        const res = await (webAPI as any).getQuranSurahs();
        if (res.data && res.data.length > 0) {
          setSurahs(res.data);
          setSelectedSurah(res.data[0].id);
        }
      } catch (err) {
        console.error('Gagal memuat daftar surah:', err);
      }
      setSurahLoading(false);
    };
    loadSurahs();
  }, []);

  // ============================================================
  // Load Ayahs + Tafsir Mappings saat Surah berubah
  // ============================================================
  useEffect(() => {
    if (selectedSurah === null) return;

    const loadSurahData = async () => {
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
          (webAPI as any).getTafsirBySurah(selectedSurah).catch(() => ({ data: [] })),
        ]);

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
        console.error('Gagal memuat data surah:', err);
      }

      setAyahLoading(false);
      setTafsirListLoading(false);
    };

    loadSurahData();
  }, [selectedSurah]);

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
  const toggleTafsirBook = useCallback((bookId: number, tafsirName: string) => {
    if (activeTafsirBook?.bookId === bookId) {
      setActiveTafsirBook(null);
    } else {
      setActiveTafsirBook({ bookId, tafsirName });
    }
  }, [activeTafsirBook]);

  useEffect(() => {
    if (!activeTafsirBook) {
      setOpenTafsir(null);
      return;
    }

    const currentAyah = ayahs[currentAyahIndex];
    if (!currentAyah) return;

    const mapping = tafsirMappings.find(
      m => m.book_id === activeTafsirBook.bookId && m.ayah_no === currentAyah.ayah_no
    );

    if (!mapping) {
      setOpenTafsir({ 
        bookId: activeTafsirBook.bookId, 
        pageId: 0, 
        tafsir_name: activeTafsirBook.tafsirName, 
        text: 'لا يوجد تفسير لهذه الآية في هذا الكتاب' 
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
            pageId: mapping.page_id,
            tafsir_name: activeTafsirBook.tafsirName,
            text: stripHtml(res.data.text || ''),
            part: res.data.part,
            page: res.data.page,
          });
        } else {
          setOpenTafsir({ bookId: activeTafsirBook.bookId, pageId: mapping.page_id, tafsir_name: activeTafsirBook.tafsirName, text: 'لم يتم العثور على نص التفسير.' });
        }
      })
      .catch((err: any) => {
        console.error('Gagal memuat tafsir:', err);
        if (isMounted) setOpenTafsir({ bookId: activeTafsirBook.bookId, pageId: mapping.page_id, tafsir_name: activeTafsirBook.tafsirName, text: 'حدث خطأ أثناء تحميل التفسير.' });
      })
      .finally(() => {
        if (isMounted) setTafsirLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeTafsirBook, currentAyahIndex, ayahs, tafsirMappings]);

  const [showMobileSurah, setShowMobileSurah] = useState(false);
  const [showMobileTafsir, setShowMobileTafsir] = useState(false);

  const [surahSearch, setSurahSearch] = useState('');
  const [tafsirSearch, setTafsirSearch] = useState('');

  // ============================================================
  // Derived
  // ============================================================
  const currentAyah = ayahs[currentAyahIndex] ?? null;
  const selectedSurahData = surahs.find(s => s.id === selectedSurah);
  const hasBismillah = selectedSurah !== 9;

  const filteredSurahs = surahs.filter(s => 
    s.name.toLowerCase().includes(surahSearch.toLowerCase()) || 
    s.id.toString().includes(surahSearch)
  );

  const filteredTafsirBooks = tafsirBooks.filter(b => 
    b.tafsir_name.toLowerCase().includes(tafsirSearch.toLowerCase())
  );

  // ============================================================
  // Render
  // ============================================================
  return (
    <div
      className="flex w-full h-screen bg-[#faf6ef] overflow-hidden relative"
      dir="rtl"
      style={{ fontFamily: 'var(--arabic-font, "Amiri", serif)' }}
    >
      {/* ===== KANAN (20%): Sidebar Daftar Surah ===== */}
      <div className={`fixed md:relative z-30 h-full w-[250px] md:w-[20%] md:min-w-[180px] flex flex-col bg-[#3e2723] text-white border-l border-[#5d4037] shadow-xl flex-shrink-0 transition-transform duration-300 ${showMobileSurah ? 'translate-x-0' : 'translate-x-[100%] md:translate-x-0'}`}>
        <div className="bg-[#2e1a17] px-4 py-4 text-center sticky top-0 z-10 shadow-md flex justify-between items-center md:block">
          <div className="text-[#d4a853] font-bold text-lg w-full text-center">القرآن الكريم</div>
          <button className="md:hidden text-[#d4a853] absolute left-4" onClick={() => setShowMobileSurah(false)}>
            <X size={20} />
          </button>
          <div className="text-[#a1887f] text-xs mt-1 md:block hidden" style={{ fontFamily: 'sans-serif' }}>فهرس السور</div>
          <div className="mt-3 relative w-full hidden md:block">
            <input 
              type="text" 
              placeholder="Cari Surah..." 
              value={surahSearch}
              onChange={e => setSurahSearch(e.target.value)}
              className="w-full bg-[#3e2723] border border-[#5d4037] text-sm text-[#efebe9] px-3 py-1.5 rounded outline-none focus:border-[#d4a853] transition-colors placeholder-[#8d6e63]"
              style={{ fontFamily: 'sans-serif' }}
              dir="ltr"
            />
            <Search size={14} className="absolute right-2.5 top-2 text-[#8d6e63]" />
          </div>
        </div>
        
        {/* Mobile Search input */}
        <div className="bg-[#2e1a17] px-4 pb-3 md:hidden sticky top-[60px] z-10 shadow-sm border-b border-[#3e2723]">
          <div className="relative w-full">
            <input 
              type="text" 
              placeholder="Cari Surah..." 
              value={surahSearch}
              onChange={e => setSurahSearch(e.target.value)}
              className="w-full bg-[#3e2723] border border-[#5d4037] text-sm text-[#efebe9] px-3 py-1.5 rounded outline-none focus:border-[#d4a853] transition-colors placeholder-[#8d6e63]"
              style={{ fontFamily: 'sans-serif' }}
              dir="ltr"
            />
            <Search size={14} className="absolute right-2.5 top-2 text-[#8d6e63]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {surahLoading ? (
            <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin text-[#a1887f]" size={24} /></div>
          ) : filteredSurahs.length === 0 ? (
            <div className="text-center text-[#8d6e63] text-xs p-4" style={{ fontFamily: 'sans-serif' }}>Surah tidak ditemukan</div>
          ) : (
            filteredSurahs.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedSurah(s.id); setShowMobileSurah(false); }}
                className={`w-full text-right px-4 py-3 border-b border-[#4e342e]/50 transition-all duration-150 flex items-center justify-between gap-2 ${
                  selectedSurah === s.id
                    ? 'bg-[#d4a853] text-[#2e1a17] font-bold'
                    : 'hover:bg-[#4e342e] text-[#efebe9]'
                }`}
              >
                <span className="text-sm leading-tight" style={{ fontFamily: 'var(--arabic-font, serif)' }}>{s.name}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${selectedSurah === s.id ? 'bg-[#2e1a17] text-[#d4a853]' : 'bg-[#4e342e] text-[#a1887f]'}`}
                  style={{ fontFamily: 'monospace', direction: 'ltr' }}
                >
                  {s.id}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ===== TENGAH (20%): Sidebar Daftar Kitab Tafsir ===== */}
      <div className={`fixed md:relative z-30 h-full w-[250px] md:w-[20%] md:min-w-[160px] flex flex-col bg-[#f0e9d6] border-l border-[#d7ccc8] flex-shrink-0 transition-transform duration-300 right-0 md:right-auto ${showMobileTafsir ? 'translate-x-0' : 'translate-x-[100%] md:translate-x-0'}`}
           style={ { left: showMobileTafsir ? 0 : 'auto', right: showMobileTafsir ? 'auto' : 0 } }>
        <div className="bg-[#5d4037] text-white px-3 py-4 sticky top-0 z-10 shadow-md flex justify-between items-center md:block">
          <div className="font-bold text-sm text-center w-full" style={{ fontFamily: 'sans-serif' }}>
            <BookOpen size={14} className="inline ml-1 mb-0.5" />
            كتب التفسير
          </div>
          <button className="md:hidden text-[#f0e9d6] absolute left-4" onClick={() => setShowMobileTafsir(false)}>
            <X size={20} />
          </button>
          {currentAyah && (
            <div className="text-[#d7ccc8] text-xs text-center mt-1 md:block hidden" style={{ fontFamily: 'sans-serif' }}>
              الآية {currentAyah.ayah_no}
            </div>
          )}
          <div className="mt-3 relative w-full hidden md:block">
            <input 
              type="text" 
              placeholder="Cari Kitab..." 
              value={tafsirSearch}
              onChange={e => setTafsirSearch(e.target.value)}
              className="w-full bg-[#4e342e] border border-[#3e2723] text-sm text-[#efebe9] px-3 py-1.5 rounded outline-none focus:border-[#d4a853] transition-colors placeholder-[#a1887f]"
              style={{ fontFamily: 'sans-serif' }}
              dir="ltr"
            />
            <Search size={14} className="absolute right-2.5 top-2 text-[#a1887f]" />
          </div>
        </div>

        {/* Mobile Search input */}
        <div className="bg-[#5d4037] px-3 pb-3 md:hidden sticky top-[60px] z-10 shadow-sm border-b border-[#4e342e]">
          <div className="relative w-full">
            <input 
              type="text" 
              placeholder="Cari Kitab..." 
              value={tafsirSearch}
              onChange={e => setTafsirSearch(e.target.value)}
              className="w-full bg-[#4e342e] border border-[#3e2723] text-sm text-[#efebe9] px-3 py-1.5 rounded outline-none focus:border-[#d4a853] transition-colors placeholder-[#a1887f]"
              style={{ fontFamily: 'sans-serif' }}
              dir="ltr"
            />
            <Search size={14} className="absolute right-2.5 top-2 text-[#a1887f]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {tafsirListLoading ? (
            <div className="flex justify-center items-center h-24"><Loader2 className="animate-spin text-[#8d6e63]" size={20} /></div>
          ) : tafsirBooks.length === 0 ? (
            <div className="text-center text-[#a1887f] text-xs p-4 leading-relaxed" style={{ fontFamily: 'sans-serif' }}>
              لا توجد كتب تفسير
              <br /><span className="text-[10px]">(يتطلب tafsir_relasi.db)</span>
            </div>
          ) : filteredTafsirBooks.length === 0 ? (
            <div className="text-center text-[#8d6e63] text-xs p-4" style={{ fontFamily: 'sans-serif' }}>Kitab tidak ditemukan</div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredTafsirBooks.map(book => {
                const isActive = activeTafsirBook?.bookId === book.book_id;
                const hasMapping = currentAyah
                  ? tafsirMappings.some(m => m.book_id === book.book_id && m.ayah_no === currentAyah.ayah_no)
                  : false;
                return (
                  <button
                    key={book.book_id}
                    onClick={() => toggleTafsirBook(book.book_id, book.tafsir_name)}
                    className={`w-full text-right px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border ${
                      isActive
                        ? 'bg-[#5d4037] text-white border-[#4e342e] shadow-md'
                        : hasMapping
                        ? 'bg-white text-[#4e342e] border-[#c8b89a] hover:bg-[#fdf5e6]'
                        : 'bg-[#f5f0e8] text-[#a1887f] border-[#e0d8cc] hover:bg-[#ece7d8]'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <BookMarked size={12} className={`flex-shrink-0 mt-0.5 ${isActive ? 'text-[#d4a853]' : hasMapping ? 'text-[#8d6e63]' : 'text-[#c8b8a8]'}`} />
                      <span className="leading-snug break-words" style={{ fontFamily: 'var(--arabic-font, serif)', fontSize: '0.78rem' }}>
                        {book.tafsir_name}
                      </span>
                    </div>
                    {!hasMapping && currentAyah && (
                      <div className="text-[10px] text-[#b0a090] mt-1" style={{ fontFamily: 'sans-serif' }}>لا تفسير لهذه الآية</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== KIRI (60%): Area Baca Utama ===== */}
      <div className="flex-1 flex flex-col bg-[#fffdf7] overflow-hidden">

        {/* Header Navigation */}
        <div className="bg-[#faf6ef] border-b border-[#e8dcc8] px-3 md:px-6 py-3 flex-shrink-0 shadow-sm relative">
          <div className="flex items-center justify-between gap-2 md:gap-4" dir="ltr">
            
            {/* Mobile Toggle Surah List */}
            <button 
              onClick={() => setShowMobileSurah(prev => !prev)}
              className="md:hidden flex items-center justify-center p-2 rounded-lg bg-[#3e2723] text-white hover:bg-[#2e1a17] transition-colors"
            >
              <Menu size={20} />
            </button>

            <button
              onClick={goToPrevAyah}
              disabled={currentAyahIndex === 0 || ayahLoading}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg bg-[#5d4037] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#4e342e] transition-colors text-sm"
              style={{ fontFamily: 'sans-serif' }}
            >
              <ChevronRight size={16} />
              <span className="hidden sm:inline">السابق</span>
            </button>

            <div className="flex flex-col items-center gap-1 flex-1" dir="rtl">
              {selectedSurahData && (
                <div className="text-[#4e342e] font-bold text-base md:text-lg" style={{ fontFamily: 'var(--arabic-font, serif)' }}>
                  سورة {selectedSurahData.name}
                </div>
              )}
              {ayahs.length > 0 && (
                <select
                  value={currentAyahIndex}
                  onChange={e => goToAyah(parseInt(e.target.value))}
                  className="border border-[#d7ccc8] rounded-lg px-2 py-1 md:px-3 md:py-1.5 bg-white text-[#4e342e] text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#8d6e63] w-[100px] md:w-auto"
                  style={{ fontFamily: 'var(--arabic-font, serif)', direction: 'rtl' }}
                >
                  {ayahs.map((a, idx) => (
                    <option key={a.id} value={idx}>
                      الآية {toArabicNumber(a.ayah_no)} ({a.ayah_no})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={goToNextAyah}
              disabled={currentAyahIndex >= ayahs.length - 1 || ayahLoading}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg bg-[#5d4037] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#4e342e] transition-colors text-sm"
              style={{ fontFamily: 'sans-serif' }}
            >
              <span className="hidden sm:inline">التالي</span>
              <ChevronLeft size={16} />
            </button>
            
            {/* Mobile Toggle Tafsir List */}
            <button 
              onClick={() => setShowMobileTafsir(prev => !prev)}
              className="md:hidden flex items-center justify-center p-2 rounded-lg bg-[#f0e9d6] border border-[#d7ccc8] text-[#5d4037] hover:bg-[#e0d8cc] transition-colors"
            >
              <BookOpen size={20} />
            </button>
            
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={mainAreaRef} className="flex-1 overflow-y-auto custom-scrollbar">
          {hasBismillah && !ayahLoading && currentAyah && (
            <div
              className="text-center py-6 text-3xl text-[#3e2723] border-b border-[#e8dcc8] bg-[#fdf5e6]"
              dir="rtl"
              style={{ fontFamily: 'var(--arabic-font, serif)' }}
            >
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
          )}

          <div className="px-8 py-8">
            {ayahLoading ? (
              <div className="flex flex-col justify-center items-center h-48 gap-4 text-[#a1887f]">
                <Loader2 className="animate-spin" size={36} />
                <span style={{ fontFamily: 'sans-serif' }} className="text-sm">جاري التحميل...</span>
              </div>
            ) : currentAyah ? (
              <>
                {/* Teks Ayat */}
                <div
                  className="text-right leading-[2.8] text-[#1a0f0a] mb-6 p-6 bg-white rounded-2xl shadow-lg border border-[#e8dcc8]"
                  dir="rtl"
                  style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontFamily: 'var(--arabic-font, "Amiri", serif)' }}
                >
                  {currentAyah.text}{' '}
                  <span
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#5d4037] text-white mx-2"
                    style={{ fontFamily: 'var(--arabic-font, serif)', fontSize: '0.9rem' }}
                  >
                    ﴿{toArabicNumber(currentAyah.ayah_no)}﴾
                  </span>
                </div>

                {/* Info Ayat */}
                <div className="flex justify-center gap-6 mb-6 text-sm text-[#8d6e63]" style={{ fontFamily: 'sans-serif' }}>
                  <span>السورة: <strong>{selectedSurahData?.name ?? '-'}</strong></span>
                  <span>•</span>
                  <span>الآية: <strong>{currentAyah.ayah_no}</strong> / <strong>{ayahs.length}</strong></span>
                  {currentAyah.page && <><span>•</span><span>الصفحة: <strong>{currentAyah.page}</strong></span></>}
                </div>

                {/* Tafsir Loading */}
                {tafsirLoading && (
                  <div className="flex items-center justify-center gap-3 py-6 text-[#8d6e63]">
                    <Loader2 className="animate-spin" size={20} />
                    <span style={{ fontFamily: 'sans-serif' }} className="text-sm">جاري تحميل التفسير...</span>
                  </div>
                )}

                {/* Inline Tafsir Panel */}
                {!tafsirLoading && openTafsir && (
                  <div className="mt-2 rounded-2xl border border-[#c8b89a] bg-[#fdf9f0] shadow-inner overflow-hidden" dir="rtl">
                    <div className="flex items-center justify-between px-5 py-3 bg-[#5d4037] text-white">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-[#d4a853]" />
                        <span className="font-bold text-base" style={{ fontFamily: 'var(--arabic-font, serif)' }}>{openTafsir.tafsir_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {openTafsir.page && <span className="text-[#a1887f] text-xs" style={{ fontFamily: 'sans-serif' }}>ص. {openTafsir.page}</span>}
                        <button onClick={() => setActiveTafsirBook(null)} className="text-[#d7ccc8] hover:text-white transition-colors"><X size={18} /></button>
                      </div>
                    </div>
                    <div
                      className="px-6 py-5 text-[#2c1810] leading-[2.4] whitespace-pre-wrap"
                      style={{ fontFamily: 'var(--arabic-font, "Amiri", serif)', fontSize: 'clamp(1rem, 1.8vw, 1.25rem)', textAlign: 'justify' }}
                    >
                      {openTafsir.text}
                    </div>
                  </div>
                )}

                {/* Hint */}
                {!tafsirLoading && !activeTafsirBook && tafsirBooks.length > 0 && (
                  <div className="text-center text-[#b0a090] text-sm py-4" style={{ fontFamily: 'sans-serif' }} dir="rtl">
                    <BookMarked size={18} className="inline ml-1 mb-0.5 text-[#c8b8a8]" />
                    اختر كتاباً من قائمة التفسير لعرض تفسير هذه الآية
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-center items-center h-48 text-[#a1887f] text-sm" style={{ fontFamily: 'sans-serif' }}>
                اختر سورة من القائمة
              </div>
            )}
          </div>
        </div>

        {/* Footer Progress Bar */}
        {ayahs.length > 0 && (
          <div className="flex-shrink-0 px-6 py-2 bg-[#f5f0e8] border-t border-[#e8dcc8]" dir="ltr">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#8d6e63] w-16 text-right" style={{ fontFamily: 'sans-serif' }}>{currentAyahIndex + 1} / {ayahs.length}</span>
              <div className="flex-1 h-1.5 bg-[#e0d8cc] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8d6e63] rounded-full transition-all duration-300"
                  style={{ width: `${((currentAyahIndex + 1) / ayahs.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[#8d6e63] w-16" style={{ fontFamily: 'sans-serif' }}>{Math.round(((currentAyahIndex + 1) / ayahs.length) * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuranReader;

