import React, { useState, useEffect } from 'react';
import { webAPI } from '../api';
import { Folder, ChevronLeft, BookOpen, User, Info, Download } from 'lucide-react';

const Catalog: React.FC<{ openBook: (id: number) => void, readBook: (id: number) => void }> = ({ openBook, readBook }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchCat, setSearchCat] = useState('');

  useEffect(() => {
    webAPI.getCategories().then((res: any) => {
      setCategories(res.data || []);
    });
  }, []);

  useEffect(() => {
    if (selectedCat) {
      setLoading(true);
      webAPI.getCategoryBooks(selectedCat).then((res: any) => {
        setBooks(res.data || []);
        setLoading(false);
      });
      window.scrollTo(0, 0);
    } else {
      setBooks([]);
    }
  }, [selectedCat]);

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchCat.toLowerCase())
  );

  return (
    <div className="w-full">
      {!selectedCat ? (
        <div className="bg-[var(--reader-bg)] p-4 md:p-6 rounded-2xl shadow-sm border border-black/5 animate-in fade-in duration-300">
          <h2 className="text-xl md:text-2xl font-bold text-[var(--app-primary)] mb-4 border-b border-black/10 pb-3 flex items-center gap-2">
            <Folder size={24} /> Kategori Kitab
          </h2>
          <input 
            type="text" 
            placeholder="Cari nama kategori..." 
            value={searchCat}
            onChange={(e) => setSearchCat(e.target.value)}
            className="w-full p-3 mb-6 bg-[var(--reader-paper)] border-2 border-black/10 rounded-xl focus:outline-none focus:border-[var(--app-primary)] text-lg transition-colors shadow-inner"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {filteredCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className="flex items-center gap-3 bg-[var(--reader-paper)] p-4 rounded-xl border border-black/10 hover:border-[var(--app-primary)] hover:bg-[var(--app-primary)] hover:text-white transition-all group text-right shadow-sm"
              >
                <Folder className="text-[var(--app-primary)] group-hover:text-white shrink-0" size={24} />
                <span className="font-bold text-lg w-full text-right" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>{cat.name}</span>
              </button>
            ))}
          </div>
          {filteredCategories.length === 0 && (
            <div className="text-center p-8 opacity-60">
              <p className="text-lg">Kategori tidak ditemukan.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--reader-bg)] p-4 md:p-6 rounded-2xl shadow-sm border border-black/5 animate-in slide-in-from-right-4 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-4 mb-6">
            <button 
              onClick={() => setSelectedCat(null)}
              className="flex items-center gap-2 text-[var(--app-primary)] hover:bg-[var(--app-primary)] hover:text-white px-4 py-2 rounded-lg font-bold transition-colors w-fit border border-[var(--app-primary)]"
            >
              <ChevronLeft size={20} /> Kembali
            </button>
            <div className="text-right">
              <h2 className="text-xl md:text-2xl font-bold text-[var(--app-text)]" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>
                {categories.find(c => c.id === selectedCat)?.name}
              </h2>
              <p className="text-sm opacity-70 mt-1">{books.length} Kitab</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-pulse flex flex-col items-center gap-3 text-[var(--app-primary)]">
                <BookOpen size={48} className="opacity-50" />
                <p className="font-bold">Memuat daftar kitab...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {books.map(book => (
                <div 
                  key={book.bkid} 
                  onClick={() => readBook(book.bkid)}
                  className="bg-[var(--reader-paper)] border-2 border-black/5 p-4 md:p-5 rounded-xl shadow-sm hover:shadow-md hover:border-[var(--app-primary)] transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                  title="Klik untuk membaca kitab"
                >
                  <div className="flex-1 w-full text-right">
                    <h3 className="font-bold text-[var(--app-text)] text-xl mb-2 group-hover:text-[var(--app-primary)] transition-colors flex justify-start items-start gap-2" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>
                      <BookOpen className="shrink-0 mt-1 opacity-70" size={20} />
                      <span className="break-words">{book.bk}</span>
                    </h3>
                    {book.author_name && (
                      <p className="text-sm opacity-70 font-sans flex justify-start items-center gap-2" dir="auto">
                        <User size={14} />
                        <span className="break-words mr-1">{book.author_name}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto">
                    <a
                      href={`/api/download/${book.bkid}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      Word <Download size={16} />
                    </a>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openBook(book.bkid);
                      }}
                      className="bg-black/5 text-[var(--app-text)] hover:bg-[var(--app-primary)] hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      Detail <Info size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {books.length === 0 && (
                <div className="text-center p-10 opacity-60">
                  <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-lg">Tidak ada kitab dalam kategori ini.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Catalog;
