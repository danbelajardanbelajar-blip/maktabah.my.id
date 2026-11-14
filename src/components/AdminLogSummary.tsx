export interface LogTopItem {value:string;count:number;}
const labels:Record<string,string>={query:'Pencarian terbanyak',question:'Pertanyaan terbanyak',ip:'IP terbanyak',page:'Halaman / sumber terbanyak'};
export function AdminLogSummary({top,total,onChoose,disabled}:{top:Record<string,LogTopItem[]>;total:number;onChoose:(kind:string,value:string)=>void;disabled:boolean}) {
  return <section className="p-4 border-b space-y-3" aria-label="Ringkasan aktivitas terbanyak">
    <p className="text-xs text-gray-500">Lima teratas dari {total.toLocaleString('id-ID')} catatan sesuai filter. Klik item untuk memeriksa dan mengelola catatannya.</p>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {Object.entries(labels).map(([kind,label])=><section key={kind} className="rounded-xl border bg-gray-50 p-3 min-w-0">
        <h3 className="font-semibold text-sm mb-3">{label}</h3>
        {top[kind]?.length?<ol className="space-y-2">{top[kind].map(item=><li key={item.value}>
          <button type="button" disabled={disabled} onClick={()=>onChoose(kind,item.value)} className="w-full flex items-start justify-between gap-2 text-left text-xs border rounded-lg bg-white p-2 hover:border-blue-500 disabled:opacity-50" title={item.value}>
            <span dir="auto" className="break-words min-w-0 line-clamp-2">{item.value}</span><span className="shrink-0 rounded bg-blue-100 text-blue-800 px-1.5 py-0.5">{item.count.toLocaleString('id-ID')}</span>
          </button>
        </li>)}</ol>:<p className="text-xs text-gray-500">Belum ada data untuk kategori ini.</p>}
      </section>)}
    </div>
  </section>;
}
