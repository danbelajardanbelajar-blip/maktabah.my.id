import { useEffect, useRef, useState } from 'react';
import {MessageSyncStatus} from './MessageSyncStatus';
import { MessageCircle, Send, Trash2, Search, Bell, BellOff, ArrowLeft, RefreshCw } from 'lucide-react';
import { DEFAULT_MESSAGE_SETTINGS, MESSAGE_MAX, messageTime, notificationPermission, requestNotifications, unlockMessageSound } from '../lib/messages';
import { threadName } from '../lib/use-admin-inbox';
import type { useAdminInbox } from '../lib/use-admin-inbox';
import { AttachmentButtons, MessageBody, MessageMeta, PendingAttachmentChip, ThreadPermissions, useAttachmentDraft } from './MessageParts';

// Full admin inbox page for visitor messages (the floating button offers a compact version).
export function AdminMessages({ token, inbox }: { token: string; inbox: ReturnType<typeof useAdminInbox> }) {
  const {threads, total, page, setPage, pages, search, setSearch, selected, thread, messages, loading, sending, error, setError, loadList, openThread, closeThread, remove} = inbox;
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [permission, setPermission] = useState(notificationPermission);
  const attach = useAttachmentDraft(DEFAULT_MESSAGE_SETTINGS, true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({top:listRef.current.scrollHeight}); }, [messages.length, selected, loading]);

  const reply = async () => { if (await inbox.reply(draft, attach.pending?.file)) { setDraft(''); attach.clear(); } };

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
      {(error || attach.error) && <div role="alert" className="m-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex justify-between gap-3"><span>{attach.error || error}</span><button onClick={() => { setError(''); attach.setError(''); }} className="underline">Tutup</button></div>}

      <MessageSyncStatus issue={inbox.syncIssue} onRetry={inbox.retrySync}/>
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
                <button type="button" onClick={closeThread} className="md:hidden p-1.5 rounded-lg border" aria-label="Kembali ke daftar percakapan"><ArrowLeft size={16} /></button>
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
                      <MessageBody message={m} mine={m.sender === 'admin'} token={token} />
                      <MessageMeta message={m} mine={m.sender === 'admin'} read={m.id <= (thread?.visitor_read_id || 0)} full className={m.sender === 'admin' ? 'text-white/75' : 'text-gray-500'} />
                    </div>
                  </div>
                ))}
              </div>
              <form className="border-t p-3 space-y-2" onSubmit={e => { e.preventDefault(); void reply(); }} {...attach.dropProps}>
                <ThreadPermissions thread={thread} saving={inbox.savingPermissions} onChange={value => void inbox.setPermissions(value)} />
                <PendingAttachmentChip draft={attach} />
                <div className="flex items-end gap-2">
                  <AttachmentButtons draft={attach} disabled={sending} />
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} onPaste={attach.onPaste} rows={2} maxLength={MESSAGE_MAX} dir="auto" placeholder="Tulis balasan… (Ctrl+Enter untuk kirim, Ctrl+V untuk menempel gambar)" aria-label="Tulis balasan"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void reply(); } }}
                    className="flex-1 min-w-0 resize-y min-h-[48px] max-h-48 rounded-xl border px-3 py-2 text-[15px]" />
                  <button type="submit" disabled={sending || (!draft.trim() && !attach.pending)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--app-primary)] text-white px-4 py-2.5 font-semibold disabled:opacity-50"><Send size={16} /> {sending ? 'Mengirim…' : 'Kirim'}</button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
