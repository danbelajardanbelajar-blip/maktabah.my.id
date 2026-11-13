import {BookOpen,Users,GraduationCap,ExternalLink} from 'lucide-react';
import {createPortal} from 'react-dom';
import {useModalFocus} from '../lib/use-modal-focus';
import {BackButton} from './BackButton';
import {rowaFullName} from '../lib/rowa-name';
export interface RowaResult {
  id: number;
  Name: string;
  A_esm?: string;
  IsoName?: string;
  A_kona?: string;
  kutub?: string;
  ROTBA?: string;
  R_ZAHBI?: string;
  birth?: string | number;
  death?: string | number;
  WHO?: string;
  unknown_book_symbols?: string[];
  distinction_only?: boolean;
  book_code_reference?: string;
}

export interface RowaDetail extends RowaResult {
  AQUAL?: string;
  CODE?: string;
  A_nasab?: string;
  sheok?: string;
  telmez?: string;
  [key: string]: any;
}

const parseList = (text: string | undefined): string[] => {
  if (!text || text.trim() === '' || text.trim() === '-') return [];
  return text
    .split('#')
    .map(t => t.trim())
    .filter(t => t.length > 0 && t !== 'A' && t !== 'B' && t !== '-');
};

// Parse kutub (books) field — biasanya dipisah dengan # atau koma
export const parseKutub = (text: string | undefined): string[] => {
  if (!text || text.trim() === '' || text.trim() === '-') return [];
  const sep = text.includes('#') ? '#' : ',';
  return text
    .split(sep)
    .map(t => t.trim())
    .filter(t => t.length > 0 && t !== '-');
};

export const formatYear = (y: string | number | undefined): string => {
  if (!y || y === 0 || y === '0') return '?';
  return String(y);
};

// Warna badge per nama kitab terkenal
const KITAB_COLORS: Record<string, string> = {
  'بخاري': 'bg-amber-100 text-amber-800 border-amber-200',
  'مسلم': 'bg-green-100 text-green-800 border-green-200',
  'أبو داود': 'bg-blue-100 text-blue-800 border-blue-200',
  'ترمذي': 'bg-purple-100 text-purple-800 border-purple-200',
  'نسائي': 'bg-pink-100 text-pink-800 border-pink-200',
  'ابن ماجه': 'bg-orange-100 text-orange-800 border-orange-200',
  'أحمد': 'bg-teal-100 text-teal-800 border-teal-200',
  'مالك': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'دارمي': 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

export const getKitabColor = (name: string): string => {
  for (const [key, color] of Object.entries(KITAB_COLORS)) {
    if (name.includes(key)) return color;
  }
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

export const RowaProfileModal = ({
  rowa,
  onClose,
  onSearchName,contextName,keepContextOnSearch=false,closeLabel='Kembali ke daftar perawi',
}: {
  rowa: RowaDetail;
  onClose: () => void;
  onSearchName: (name: string) => void;
  contextName?:string;keepContextOnSearch?:boolean;closeLabel?:string;
}) => {
  const dialogRef=useModalFocus(onClose);
  const guruList = parseList(rowa.sheok);
  const muridList = parseList(rowa.telmez);
  const kutubList = parseKutub(rowa.kutub);

  const handleNameClick = (name: string) => {
    if(!keepContextOnSearch)onClose();
    onSearchName(name);
  };

  const NameLink = ({ name }: { name: string }) => (
    <button
      onClick={() => handleNameClick(name)}
      className="w-full text-right flex items-center justify-between group gap-2 py-1.5 border-b border-gray-100 last:border-0 hover:text-[var(--app-primary)] transition-colors"
      title={`Cari "${name}"`}
    >
      <span
        className="text-sm text-gray-700 group-hover:text-[var(--app-primary)] leading-snug"
        dir="rtl"
        style={{ fontFamily: 'var(--arabic-font)' }}
      >
        {name}
      </span>
      <ExternalLink size={12} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity text-[var(--app-primary)]" />
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex justify-center items-end sm:items-center p-0 sm:p-4 z-[100]"
      onClick={onClose}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Bithaqah perawi" tabIndex={-1}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--app-primary)] text-white p-5 flex justify-between items-start gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              className="text-2xl sm:text-3xl font-bold leading-relaxed break-words whitespace-normal"
              dir="rtl"
              style={{ fontFamily: 'var(--arabic-font)' }}
            >
              {rowaFullName(rowa)}
            </h2>
            {rowa.Name?.trim() && rowa.Name.trim() !== rowaFullName(rowa) && (
              <p className="text-sm mt-1 text-white/80 leading-snug" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                {rowa.Name}
              </p>
            )}
            {rowa.A_kona && (
              <p className="text-xs mt-1 text-white/70" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                كنيته: {rowa.A_kona}
              </p>
            )}
          </div>
          <BackButton onClick={onClose} light title={closeLabel}/>
        </div>

        {contextName&&<p className="text-xs text-gray-500 px-5 py-2 border-b">Kecocokan nama dalam Kamus Perawi: <span dir="auto" style={{fontFamily:'var(--arabic-font)'}}>{contextName}</span></p>}
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Info Dasar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Nasab', val: rowa.A_nasab },
              { label: 'Kunyah', val: rowa.A_kona },
              { label: 'Tahun Lahir', val: formatYear(rowa.birth) !== '?' ? `${formatYear(rowa.birth)} H` : null },
              { label: 'Tahun Wafat', val: formatYear(rowa.death) !== '?' ? `${formatYear(rowa.death)} H` : null },
            ].filter(item => item.val).map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <span className="block text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">{item.label}</span>
                <div className="text-sm font-bold text-gray-800 leading-snug" dir="auto" style={{ fontFamily: 'var(--arabic-font)' }}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>

          {/* Symbols come from the source record, never students' names. */}
          {kutubList.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <BookOpen size={15} className="text-[var(--app-primary)]" /> Kitab menurut Kode Sumber
              </h3>
              <div className="flex flex-wrap gap-2">
                {kutubList.map((k, i) => (
                  <span
                    key={i}
                    className={`text-xs px-3 py-1 rounded-full border font-medium ${getKitabColor(k)}`}
                    dir="rtl"
                    style={{ fontFamily: 'var(--arabic-font)' }}
                  >
                    {k}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Baca uraian biografi untuk catatan dan perbedaan identifikasi riwayat.</p>
            </div>
          )}
          {rowa.WHO?.trim() && <div className="bg-gray-50 border rounded-xl p-3 text-sm"><p className="font-semibold text-gray-700">Kode dan catatan kitab dari sumber</p><p dir="rtl" className="mt-2 leading-relaxed" style={{fontFamily:'var(--arabic-font)'}}>{rowa.WHO}</p>{!!rowa.unknown_book_symbols?.length&&<p className="text-xs text-gray-500 mt-2">Catatan ini dipertahankan utuh; nama kitab tidak disimpulkan otomatis.</p>}</div>}
          {rowa.distinction_only && <p className="text-sm text-gray-600">Sumber menandai perawi ini sebagai تمييز, untuk membedakannya dari perawi lain.</p>}

          {/* Derajat */}
          {(rowa.ROTBA || rowa.R_ZAHBI) && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <span className="w-5 h-5 bg-[var(--app-primary)] text-white rounded-full flex items-center justify-center text-xs">★</span>
                Penilaian Ulama
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rowa.ROTBA && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                    <span className="block text-xs text-green-600 font-bold mb-2 uppercase">Ibnu Hajar (Taqrib)</span>
                    <p className="text-base text-green-900 leading-relaxed" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                      {rowa.ROTBA}
                    </p>
                  </div>
                )}
                {rowa.R_ZAHBI && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <span className="block text-xs text-blue-600 font-bold mb-2 uppercase">Adh-Dhahabi</span>
                    <p className="text-base text-blue-900 leading-relaxed" dir="rtl" style={{ fontFamily: 'var(--arabic-font)' }}>
                      {rowa.R_ZAHBI}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {rowa.AQUAL?.trim() && <details className="rounded-xl border border-gray-200 p-4">
            <summary className="font-bold text-gray-700 cursor-pointer">Biografi & Jarh wa Ta‘dil — Teks Sumber</summary>
            <p className="text-xs text-gray-500 my-3">Nomor rujukan: {rowa.CODE || rowa.id}. Teks dipertahankan dari sumber, termasuk catatan perbedaan pendapat.</p>
            <div className="space-y-3 text-lg leading-loose break-words" dir="rtl" style={{fontFamily:'var(--arabic-font)'}}>
              {rowa.AQUAL.split('#').map((text:string,i:number)=>text.trim()&&<p key={i}>{text.trim()}</p>)}
            </div>
          </details>}

          {/* Guru & Murid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Guru */}
            <div>
              <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <GraduationCap size={15} className="text-[var(--app-primary)]" />
                Guru-guru (Syuyukh)
                {guruList.length > 0 && (
                  <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{guruList.length}</span>
                )}
              </h4>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 max-h-64 overflow-y-auto">
                {guruList.length > 0 ? (
                  <div className="space-y-0">
                    {guruList.map((g, idx) => (
                      <NameLink key={idx} name={g} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Tidak ada data</p>
                )}
              </div>
              {guruList.length > 0 && (
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Klik nama untuk mencari profil guru
                </p>
              )}
            </div>

            {/* Murid */}
            <div>
              <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Users size={15} className="text-[var(--app-primary)]" />
                Murid-murid (Talamidz)
                {muridList.length > 0 && (
                  <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{muridList.length}</span>
                )}
              </h4>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 max-h-64 overflow-y-auto">
                {muridList.length > 0 ? (
                  <div className="space-y-0">
                    {muridList.map((m, idx) => (
                      <NameLink key={idx} name={m} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Tidak ada data</p>
                )}
              </div>
              {muridList.length > 0 && (
                <p className="text-xs text-gray-400 mt-1 text-center">
                  Klik nama untuk mencari profil murid
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex justify-end shrink-0">
          <BackButton onClick={onClose} title={closeLabel}/>
        </div>
      </div>
    </div>,document.body
  );
};
