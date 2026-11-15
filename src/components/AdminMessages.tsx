import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2, Search, Bell, BellOff, ArrowLeft, RefreshCw } from 'lucide-react';
import {
  MESSAGE_MAX, adminMessagesAPI, mergeMessages, messageTime, notificationPermission, playMessageSound,
  requestNotifications, showMessageNotification, unlockMessageSound,
} from '../lib/messages';
import type { ChatMessage, MessageThreadRow } from '../lib/messages';

const threadName = (t: {name?: string; id: number}) => t.name || `Pengunjung #${t.id}`;

// Admin inbox for visitor messages: live via the admin SSE stream (HttpOnly admin cookie), with a
// slow poll as a fallback for sessions that logged in before that cookie existed.
export function AdminMessages({ token, onLogout, onUnreadChange }: { token: string; onLogout: () => void; onUnreadChange: () => void }) {
  const [threads, setThreads] = useState<MessageThreadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [thread, setThread] = useState<MessageThreadRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState(notificationPermission);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;

  const handle = useCallback((e: unknown) => {
    const message = e instanceof Error ? e.message : 'Terjadi kesalahan.';
    if (message === '401') onLogout(); else setError(message);
  }, [onLogout]);

  const loadList = useCallback(async () => {
    try {
      const res = await adminMessagesAPI.list(token, page, search);
      setThreads(res.data); setTotal(res.total); setPages(res.pages);
      if (res.page !== page) setPage(res.page);
    } catch (e) { handle(e); }
  }, [token, page, search, handle]);

  const openThread = useCallback(async (id: number) => {
    setSelected(id); setLoading(true); setError('');
    try {
      const res = await adminMessagesAPI.thread(token, id);
      setThread(res.thread); setMessages(res.messages);
      setThreads(list => list.map(t => t.id === id ? {...t, admin_unread:0} : t));
      onUnreadChange();
    } catch (e) { handle(e); setSelected(null); } finally { setLoading(false); }
  }, [token, handle, onUnreadChange]);

  useEffect(() => { void loadList(); }, [loadList]);

  // The stream stays open across renders; it reads the latest callbacks through this ref.
  const latest = useRef({loadList, openThread, onUnreadChange});
  latest.current = {loadList, openThread, onUnreadChange};
  useEffect(() => {
    const source = new EventSource('/api/admin/messages/stream');
    source.addEventListener('message', event => {
      let payload: {threadId?: number; name?: string; message?: ChatMessage};
      try { payload = JSON.parse((event as MessageEvent).data); } catch { return; }
      const {threadId, message} = payload;
      if (!threadId || !message) return;
      if (threadId === selectedRef.current) {
        setMessages(current => mergeMessages(current, [message]));
        if (message.sender === 'visitor' && document.visibilityState === 'visible') void adminMessagesAPI.thread(token, threadId).then(() => latest.current.onUnreadChange()).catch(() => {});
      }
      if (message.sender === 'visitor') {
        playMessageSound();
        if (document.visibilityState !== 'visible' || threadId !== selectedRef.current)
          showMessageNotification(`Pesan baru dari ${threadName({name:payload.name, id:threadId})}`, message.body, () => void latest.current.openThread(threadId));
        latest.current.onUnreadChange();
      }
      void latest.current.loadList();
    });
    source.addEventListener('deleted', () => { void latest.current.loadList(); latest.current.onUnreadChange(); });
    // Fallback poll: covers a missing admin cookie (stream answers 401) and proxies that drop streams.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void latest.current.loadList(); }, 30000);
    const unlock = () => unlockMessageSound();
    window.addEventListener('pointerdown', unlock);
    return () => { source.close(); window.clearInterval(timer); window.removeEventListener('pointerdown', unlock); };
  }, [token]);

  useEffect(() => { listRef.current?.scrollTo({top:listRef.current.scrollHeight}); }, [messages.length, selected, loading]);

  const reply = async () => {
    const body = draft.trim();
    if (!selected || !body || sending) return;
    if (body.length > MESSAGE_MAX) { setError(`Balasan maksimal ${MESSAGE_MAX.toLocaleString('id-ID')} karakter.`); return; }
    setSending(true); setError('');
    try {
      const res = await adminMessagesAPI.reply(token, selected, body);
      setMessages(current => mergeMessages(current, [res.message])); setDraft('');
      void loadList();
    } catch (e) { handle(e); } finally { setSending(false); }
  };

  const remove = async () => {
    if (!selected || !window.confirm('Hapus seluruh percakapan ini? Pesan di peramban pengunjung juga akan hilang. Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await adminMessagesAPI.remove(token, selected);
      setSelected(null); setThread(null); setMessages([]); void loadList(); onUnreadChange();
    } catch (e) { handle(e); }
  };

  const unreadTotal = threads.reduce((n, t) => n + (t.admin_unread || 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center gap-3">
        <h1 className="font-bold flex items-center gap-2 flex-1"><MessageCircle size={18} className="text-gray-500" /> Pesan Pengunjung
          <span className="text-xs font-semibold text-gray-500">({total} percakapan{unreadTotal ? `, ${unreadTotal} belum dibaca di halaman ini` : ''})</span></h1>
        {permission !== 'unsupported' && (
          <button type="button" onClick={async () => { unlockMessageSound(); setPermission(await requestNotifications()); }} disabled={permission !== 'default'}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-70">
            {permission === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
            {permission === 'granted' ? 'Notifikasi aktif' : permission === 'denied' ? 'Notifikasi diblokir' : 'Aktifkan notifikasi'}
          </button>
        )}
        <button type="button" onClick={() => void loadList()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold"><RefreshCw size={16} /> Muat ulang</button>
      </div>
      {error && <div role="alert" className="m-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex justify-between gap-3"><span>{error}</span><button onClick={() => setError('')} className="underline">Tutup</button></div>}

      <div className="grid md:grid-cols-[minmax(240px,320px)_1fr] min-h-[60vh]">
        <aside className={`${selected ? 'hidden md:flex' : 'flex'} flex-col border-r min-h-0`}>
          <form className="p-3 border-b flex gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(query.trim()); }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau isi pesan" aria-label="Cari percakapan" className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" aria-label="Cari" className="rounded-lg border px-3"><Search size={16} /></button>
          </form>
          <ul className="flex-1 overflow-y-auto divide-y max-h-[65vh]">
            {threads.map(t => (
              <li key={t.id}>
                <button type="button" onClick={() => void openThread(t.id)} aria-current={selected === t.id ? 'true' : undefined}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selected === t.id ? 'bg-emerald-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex-1 truncate ${t.admin_unread ? 'font-bold' : 'font-semibold'}`}>{threadName(t)}</span>
                    <time className="text-xs text-gray-500 shrink-0">{messageTime(t.updated_at)}</time>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p dir="auto" className={`flex-1 truncate text-sm ${t.admin_unread ? 'text-gray-900' : 'text-gray-500'}`}>{t.last_sender === 'admin' ? 'Anda: ' : ''}{t.last_body}</p>
                    {t.admin_unread > 0 && <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold grid place-items-center">{t.admin_unread}</span>}
                  </div>
                </button>
              </li>
            ))}
            {threads.length === 0 && <li className="p-8 text-center text-gray-500 text-sm">{search ? 'Tidak ada percakapan yang cocok.' : 'Belum ada pesan dari pengunjung.'}</li>}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded border disabled:opacity-40">‹</button>
              <span>Hal {page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded border disabled:opacity-40">›</button>
            </div>
          )}
        </aside>

        <section className={`${selected ? 'flex' : 'hidden md:flex'} flex-col min-h-0`} aria-label="Isi percakapan">
          {!selected ? (
            <div className="m-auto p-8 text-center text-gray-500 text-sm">Pilih percakapan untuk membaca dan membalas.</div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <button type="button" onClick={() => setSelected(null)} className="md:hidden p-1.5 rounded-lg border" aria-label="Kembali ke daftar percakapan"><ArrowLeft size={16} /></button>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">{thread ? threadName(thread) : 'Memuat…'}</div>
                  {thread && <div className="text-xs text-gray-500 truncate" title={thread.user_agent}>Mulai {messageTime(thread.created_at, true)} · IP {thread.ip || '-'}</div>}
                </div>
                <button type="button" onClick={remove} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Hapus percakapan" aria-label="Hapus percakapan"><Trash2 size={16} /></button>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-2 max-h-[55vh] min-h-[300px]" aria-live="polite">
                {loading ? <p className="text-center text-gray-500 text-sm">Memuat…</p> : messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${m.sender === 'admin' ? 'bg-[var(--app-primary)] text-white rounded-br-md' : 'bg-white border rounded-bl-md'}`}>
                      <p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
                      <time dateTime={m.created_at} className={`block text-[10px] mt-1 text-right ${m.sender === 'admin' ? 'text-white/75' : 'text-gray-500'}`}>{messageTime(m.created_at, true)}</time>
                    </div>
                  </div>
                ))}
              </div>
              <form className="border-t p-3 flex items-end gap-2" onSubmit={e => { e.preventDefault(); void reply(); }}>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} maxLength={MESSAGE_MAX} dir="auto" placeholder="Tulis balasan… (Ctrl+Enter untuk kirim)" aria-label="Tulis balasan"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void reply(); } }}
                  className="flex-1 resize-y min-h-[48px] max-h-48 rounded-xl border px-3 py-2 text-[15px]" />
                <button type="submit" disabled={sending || !draft.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--app-primary)] text-white px-4 py-2.5 font-semibold disabled:opacity-50"><Send size={16} /> Kirim</button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
