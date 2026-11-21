export function MessageSyncStatus({issue,onRetry}:{issue:boolean;onRetry:()=>void}){
  if(!issue)return null;
  return <div role="status" className="m-3 rounded-lg bg-amber-50 text-amber-900 px-3 py-2 text-xs flex flex-wrap items-center gap-2">
    <span className="flex-1">Sinkronisasi pesan terganggu. Menghubungkan kembali secara otomatis…</span>
    <button type="button" onClick={onRetry} className="underline font-semibold">Coba sekarang</button>
  </div>;
}
