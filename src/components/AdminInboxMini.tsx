import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, ExternalLink, Trash2 } from 'lucide-react';
import { MESSAGE_MAX, messageTime } from '../lib/messages';
import { threadName } from '../lib/use-admin-inbox';
import type { useAdminInbox } from '../lib/use-admin-inbox';

type Inbox = ReturnType<typeof useAdminInbox>;

// Compact admin inbox inside the floating message panel: read and reply without opening the admin page.
export function AdminInboxMini({ inbox, onOpenFull }: { inbox: Inbox; onOpenFull: () => void }) {
  const {threads, selected, thread, messages, loading, sending, error, setError, openThread, closeThread, remove} = inbox;
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { listRef.current?.scrollTo({top:listRef.current.scrollHeight}); }, [messages.length, selected, loading]);
  useEffect(() => { if (selected && !loading) inputRef.current?.focus({preventScroll:true}); }, [selected, loading]);
  const reply = async () => { if (await inbox.reply(draft)) setDraft(''); };

  if (!selected) return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--reader-bg)]">
      {error && <p role="alert" className="m-3 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <ul className="flex-1 overflow-y-auto divide-y divide-black/5" aria-label="Percakapan pengunjung">
        {threads.map(t => (
          <li key={t.id}>
            <button type="button" onClick={() => void openThread(t.id)} className="w-full text-left px-4 py-3 hover:bg-black/5">
              <div className="flex items-center gap-2">
                <span className={`flex-1 truncate ${t.admin_unread ? 'font-bold' : 'font-semibold'}`}>{threadName(t)}</span>
                <time className="text-[11px] opacity-60 shrink-0">{messageTime(t.updated_at)}</time>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p dir="auto" className={`flex-1 truncate text-sm ${t.admin_unread ? '' : 'opacity-60'}`}>{t.last_sender === 'admin' ? 'Anda: ' : ''}{t.last_body}</p>
                {t.admin_unread > 0 && <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold grid place-items-center">{t.admin_unread}</span>}
              </div>
            </button>
          </li>
        ))}
        {threads.length === 0 && <li className="p-6 text-center text-sm opacity-70">Belum ada pesan dari pengunjung.</li>}
      </ul>
      <button type="button" onClick={onOpenFull} className="m-3 inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 bg-[var(--reader-paper)] px-3 py-2 text-sm font-semibold">
        <ExternalLink size={15} /> Buka semua di panel admin
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2 bg-[var(--reader-paper)]">
        <button type="button" onClick={closeThread} aria-label="Kembali ke daftar percakapan" className="p-1.5 rounded-lg hover:bg-black/5"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate text-sm">{thread ? threadName(thread) : 'Memuat…'}</div>
          {thread && <div className="text-[11px] opacity-60 truncate">Mulai {messageTime(thread.created_at, true)}</div>}
        </div>
        <button type="button" onClick={() => void remove()} aria-label="Hapus percakapan" title="Hapus percakapan" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-[var(--reader-bg)]" aria-live="polite">
        {loading ? <p className="text-center text-sm opacity-60">Memuat…</p> : messages.map(m => (
          <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm ${m.sender === 'admin' ? 'bg-[var(--app-primary)] text-white rounded-br-md' : 'bg-[var(--reader-paper)] border border-black/5 rounded-bl-md'}`}>
              <p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
              <time dateTime={m.created_at} className={`block text-[10px] mt-1 text-right ${m.sender === 'admin' ? 'text-white/75' : 'opacity-60'}`}>{messageTime(m.created_at)}</time>
            </div>
          </div>
        ))}
      </div>
      <form className="border-t border-black/10 p-3 space-y-2 bg-[var(--reader-paper)]" onSubmit={e => { e.preventDefault(); void reply(); }}>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 flex justify-between gap-2"><span>{error}</span><button type="button" onClick={() => setError('')} className="underline">Tutup</button></p>}
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} rows={1} maxLength={MESSAGE_MAX} dir="auto"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void reply(); } }}
            placeholder="Tulis balasan…" aria-label="Tulis balasan"
            className="flex-1 resize-none field-sizing-content max-h-32 min-h-[42px] rounded-xl border border-black/15 bg-[var(--reader-bg)] px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]" />
          <button type="submit" disabled={sending || !draft.trim()} aria-label="Kirim balasan"
            className="shrink-0 grid place-items-center w-11 h-11 rounded-full bg-[var(--app-primary)] text-white disabled:opacity-50 hover:brightness-110 transition">
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
