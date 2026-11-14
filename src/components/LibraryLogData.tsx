const actionNames:Record<string,string> = {browse:'Telusur & filter',search:'Pencarian',profile:'Profil penulis',timeline:'Muat linimasa',read_book:'Buka pembaca',book_detail:'Detail kitab',edition:'Pilih edisi',timeline_year:'Pilih tahun linimasa'};
const contextNames:Record<string,string> = {mode:'Cari dalam',group:'Kelompok',group_name:'Nama kelompok',book:'Sumber kitab',edition:'Edisi',matching:'Pencocokan',available:'Hanya tersedia',page:'Halaman daftar',page_id:'ID halaman kitab',part:'Jilid',source_page:'Halaman asli',century:'Abad Hijriah',initial:'Huruf awal',sort:'Urutan',view:'Tampilan',start:'Awal rentang',end:'Akhir rentang',total:'Total hasil',total_pages:'Total halaman daftar',total_groups:'Total kelompok tahun',has_more:'Ada halaman berikutnya',author_id:'ID penulis',author_name:'Nama penulis',year:'Tahun dipilih'};
const values:Record<string,string> = {content:'Isi kitab',catalog:'Katalog',all:'Semua kata',phrase:'Frasa berurutan',cards:'Kartu',timeline:'Linimasa',death:'Tahun wafat',name:'Nama',unknown:'Belum terpetakan',other:'Lainnya'};
export function LibraryLogData({row}:{row:any}) {
  let context:Record<string,unknown> = {};
  try {const parsed = JSON.parse(row.context || '{}');if(parsed && typeof parsed === 'object' && !Array.isArray(parsed))context=parsed;}catch{/* Older or malformed data still displays the activity. */}
  return <div className="space-y-2 min-w-[200px] max-w-lg break-words">
    <span className="inline-flex text-[10px] font-bold px-2 py-1 rounded-md bg-blue-100 text-blue-800">{actionNames[row.action] || row.action}</span>
    {row.query && <p dir="auto">Pencarian: {row.query}</p>}
    {(row.target_name || row.target_id) && <p dir="auto">{row.target_name || 'ID'}{row.target_id ? ` (ID: ${row.target_id})` : ''}</p>}
    {row.result_count !== null && row.result_count !== undefined && <p className="text-xs text-gray-500">Ditampilkan: {row.result_count} {row.action === 'profile' ? 'karya' : row.action === 'timeline' ? 'penulis dalam rentang ini' : 'hasil'}</p>}
    {Object.entries(context).some(([key,value])=>contextNames[key] && value !== '') && <details className="text-xs text-gray-600">
      <summary className="cursor-pointer text-blue-600 font-semibold py-1">Filter & konteks aktivitas</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {Object.entries(context).filter(([key,value])=>contextNames[key] && value !== '').map(([key,value])=><div key={key} className="contents"><dt>{contextNames[key]}</dt><dd dir="auto">{typeof value === 'boolean' ? value ? 'Ya' : 'Tidak' : values[String(value)] || String(value)}</dd></div>)}
      </dl>
    </details>}
  </div>;
}
