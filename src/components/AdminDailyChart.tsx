import { useState } from 'react';
import { BarChart2, X, Search, Bot, Eye, Download, BookOpen, ScrollText, Users, Feather } from 'lucide-react';

interface DailyItem {
  date: string;
  total: number;
  search: number;
  ask: number;
  visit: number;
  download: number;
  quran: number;
  hadith: number;
  rowa: number;
  authors: number;
}

interface TodayStats {
  total: number;
  search: number;
  ask: number;
  visit: number;
  download: number;
  quran: number;
  hadith: number;
  rowa: number;
  authors: number;
}

interface Props {
  stats?: {
    today?: TodayStats;
    daily?: DailyItem[];
    [key: string]: any;
  };
}

const LOG_META = [
  { key: 'search', label: 'Pencarian', icon: Search, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', bar: '#2563eb' },
  { key: 'ask', label: 'Tanya AI', icon: Bot, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: '#059669' },
  { key: 'visit', label: 'Kunjungan Halaman', icon: Eye, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', bar: '#4f46e5' },
  { key: 'download', label: 'Download Kitab', icon: Download, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: '#d97706' },
  { key: 'quran', label: 'Al-Qur\'an', icon: BookOpen, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', bar: '#0d9488' },
  { key: 'hadith', label: 'Kutub Hadis', icon: ScrollText, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', bar: '#e11d48' },
  { key: 'rowa', label: 'Kamus Perawi', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', bar: '#7c3aed' },
  { key: 'authors', label: 'Penulis & Karya', icon: Feather, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', bar: '#0891b2' },
] as const;

export function AdminDailyChart({ stats }: Props) {
  const [open, setOpen] = useState(false);

  const today: TodayStats = stats?.today || {
    total: 0,
    search: 0,
    ask: 0,
    visit: 0,
    download: 0,
    quran: 0,
    hadith: 0,
    rowa: 0,
    authors: 0,
  };

  const daily: DailyItem[] = Array.isArray(stats?.daily) && stats.daily.length > 0 ? stats.daily : [];
  const maxTotal = Math.max(1, ...daily.map(d => d.total || 0));

  return (
    <>
      {/* Header Widget (antara menu kiri dan view web) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Klik untuk melihat Grafik Harian Seluruh Log"
        aria-label="Grafik Harian Seluruh Log"
        className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 hover:bg-emerald-50/70 border border-gray-200 hover:border-emerald-300 rounded-xl transition-all shadow-xs text-left cursor-pointer group max-w-full"
      >
        <div className="flex items-center gap-1.5 text-gray-700 group-hover:text-emerald-700 font-semibold text-xs shrink-0">
          <BarChart2 size={16} className="text-emerald-600 shrink-0" />
          <span className="hidden sm:inline">Log Hari Ini:</span>
          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold">
            {today.total.toLocaleString('id-ID')}
          </span>
        </div>

        {/* Mini Sparkline 7 Hari */}
        {daily.length > 0 && (
          <div className="hidden md:flex items-end gap-1 h-5 px-1 py-0.5 shrink-0" aria-hidden="true">
            {daily.map((d, i) => {
              const isToday = i === daily.length - 1;
              const heightPct = Math.max(15, Math.round(((d.total || 0) / maxTotal) * 100));
              return (
                <div
                  key={d.date}
                  style={{ height: `${heightPct}%` }}
                  className={`w-1 rounded-t-xs transition-all ${
                    isToday ? 'bg-emerald-600 w-1.5' : 'bg-gray-300 group-hover:bg-emerald-300'
                  }`}
                  title={`${d.date}: ${d.total} log`}
                />
              );
            })}
          </div>
        )}

        {/* Cuplikan Teks Log Teratas Hari Ini (Desktop) */}
        <div className="hidden xl:flex items-center gap-3 text-[11px] text-gray-500 border-l border-gray-200 pl-2.5 shrink-0">
          <span>Pencarian: <strong className="text-gray-800">{today.search}</strong></span>
          <span>Tanya AI: <strong className="text-gray-800">{today.ask}</strong></span>
          <span>Kunjungan: <strong className="text-gray-800">{today.visit}</strong></span>
          <span>Unduh: <strong className="text-gray-800">{today.download}</strong></span>
        </div>
      </button>

      {/* Modal Dialog Grafik Harian Seluruh Log */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-chart-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-gray-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <BarChart2 size={22} />
                </div>
                <div>
                  <h3 id="daily-chart-title" className="font-bold text-base md:text-lg text-gray-900">
                    Grafik Harian Seluruh Log
                  </h3>
                  <p className="text-xs text-gray-500">
                    Aktivitas pengunjung hari ini (WIB) & riwayat tren 7 hari terakhir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Bagian 1: Ringkasan Hari Ini */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Aktivitas Hari Ini (WIB)
                  </h4>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Total: {today.total.toLocaleString('id-ID')} aktivitas
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {LOG_META.map(item => {
                    const Icon = item.icon;
                    const val = today[item.key as keyof TodayStats] || 0;
                    return (
                      <div
                        key={item.key}
                        className={`p-3 rounded-xl border ${item.border} ${item.bg} flex flex-col justify-between`}
                      >
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span className="truncate font-medium">{item.label}</span>
                          <Icon size={14} className={item.color} />
                        </div>
                        <div className="text-lg md:text-xl font-bold text-gray-900">
                          {val.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">hari ini</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bagian 2: Grafik Batang 7 Hari Terakhir */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Tren Aktivitas 7 Hari Terakhir
                  </h4>
                  <span className="text-xs text-gray-500">Puncak: {maxTotal.toLocaleString('id-ID')} log/hari</span>
                </div>

                {daily.length > 0 ? (
                  <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-gray-200">
                    {daily.map((d, idx) => {
                      const isToday = idx === daily.length - 1;
                      const heightPct = Math.max(12, Math.round(((d.total || 0) / maxTotal) * 100));
                      // format date string: YYYY-MM-DD -> DD/MM
                      const parts = (d.date || '').split('-');
                      const displayDate = isToday ? 'Hari Ini' : parts.length >= 3 ? `${parts[2]}/${parts[1]}` : d.date;

                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end group">
                          {/* Angka di atas bar */}
                          <span className="text-[10px] font-semibold text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {d.total}
                          </span>

                          {/* Batang Visual Bar */}
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full max-w-[36px] rounded-t-md transition-all relative ${
                              isToday
                                ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-xs'
                                : 'bg-gradient-to-t from-gray-400 to-gray-300 group-hover:from-emerald-400 group-hover:to-emerald-300'
                            }`}
                          />

                          {/* Label Tanggal */}
                          <span
                            className={`text-[11px] mt-2 whitespace-nowrap ${
                              isToday ? 'font-bold text-emerald-700' : 'text-gray-500 font-medium'
                            }`}
                          >
                            {displayDate}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic text-center py-8">
                    Data riwayat harian belum tersedia.
                  </p>
                )}

                {/* Legenda Kategori */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-[11px] text-gray-600">
                  {LOG_META.map(m => (
                    <div key={m.key} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.bar }} />
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bagian 3: Komposisi Log Hari Ini */}
              {today.total > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Komposisi Log Hari Ini
                  </h4>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                    {LOG_META.map(item => {
                      const val = today[item.key as keyof TodayStats] || 0;
                      if (!val) return null;
                      const pct = ((val / today.total) * 100).toFixed(1);
                      return (
                        <div
                          key={item.key}
                          style={{ width: `${pct}%`, backgroundColor: item.bar }}
                          title={`${item.label}: ${val} (${pct}%)`}
                          className="h-full transition-all"
                        />
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs text-gray-600">
                    {LOG_META.map(item => {
                      const val = today[item.key as keyof TodayStats] || 0;
                      const pct = today.total > 0 ? Math.round((val / today.total) * 100) : 0;
                      return (
                        <div key={item.key} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="truncate">{item.label}:</span>
                          <span className="font-semibold text-gray-800">{val} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
