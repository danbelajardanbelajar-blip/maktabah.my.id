import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bell, BellOff } from 'lucide-react';
import { navigationHash } from '../lib/navigation';
import { pushLocation } from '../lib/back-navigation';
import {
  MESSAGE_MAX, mergeMessages, messageTime, messagesAPI, nextScrollHidden, notificationPermission, playMessageSound,
  requestNotifications, setAppBadge, showMessageNotification, unlockMessageSound,
} from '../lib/messages';
import type { ChatMessage } from '../lib/messages';

const isAdminBrowser = () => { try { return Boolean(localStorage.getItem('adminToken')); } catch { return false; } };

// Floating visitor ↔ admin chat. `suppressed` hides it (e.g. while a book is open) but keeps the
// live connection so new replies still raise the badge, sound and notification.
export function MessageWidget({ suppressed }: { suppressed: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasThread, setHasThread] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState(notificationPermission);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef(0);
  const viewing = useRef(false);
  viewing.current = open && !suppressed;

  const apply = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    lastId.current = Math.max(lastId.current, ...incoming.map(m => m.id));
    setMessages(current => mergeMessages(current, incoming));
  }, []);

  // Initial load: the cookie is HttpOnly, so the server tells us whether this browser has a conversation.
  useEffect(() => {
    let active = true;
    messagesAPI.load().then(data => {
      if (!active) return;
      setHasThread(Boolean(data.thread)); if (data.thread?.name) setName(data.thread.name);
      apply(data.messages); setUnread(data.unread);
    }).catch(() => { /* The button still works; sending will report problems. */ });
    return () => { active = false; };
  }, [apply]);

  const markRead = useCallback(() => {
    setUnread(0);
    messagesAPI.markRead().catch(() => {});
  }, []);

  // Live replies over Server-Sent Events. EventSource reconnects by itself; after each (re)connect we
  // fetch anything newer than the last message we have, so nothing is missed while offline.
  useEffect(() => {
    if (!hasThread) return;
    const source = new EventSource('/api/messages/stream');
    source.addEventListener('open', () => {
      messagesAPI.load(lastId.current).then(data => { apply(data.messages); if (!viewing.current) setUnread(data.unread); }).catch(() => {});
    });
    source.addEventListener('message', event => {
      let payload: {message?: ChatMessage; unread?: number};
      try { payload = JSON.parse((event as MessageEvent).data); } catch { return; }
      const message = payload.message;
      if (!message) return;
      apply([message]);
      if (message.sender !== 'admin') return;
      if (viewing.current && document.visibilityState === 'visible') { markRead(); return; }
      setUnread(count => typeof payload.unread === 'number' ? payload.unread : count + 1);
      playMessageSound();
      if (document.visibilityState !== 'visible' || !viewing.current)
        showMessageNotification('Balasan baru dari admin', message.body, () => setOpen(true));
    });
    source.addEventListener('read', () => setUnread(0));
    source.addEventListener('reset', () => { setMessages([]); lastId.current = 0; setHasThread(false); setUnread(0); });
    return () => source.close();
  }, [hasThread, apply, markRead]);

  useEffect(() => { setAppBadge(unread); }, [unread]);

  // Opening the panel (or returning to the tab with it open) reads the conversation.
  useEffect(() => {
    if (!open || suppressed) return;
    if (unread > 0) markRead();
    const onVisible = () => { if (document.visibilityState === 'visible' && unread > 0) markRead(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [open, suppressed, unread, markRead]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({top:listRef.current.scrollHeight});
  }, [open, messages.length]);
  useEffect(() => { if (open) inputRef.current?.focus({preventScroll:true}); }, [open]);

  // Hide on scroll down, show on scroll up; a fresh page load always starts visible.
  useEffect(() => {
    // Scroll events already fire at most once per frame; the work here is a comparison, so no rAF needed.
    let anchor = window.scrollY, hidden = false;
    const onScroll = () => {
      const next = nextScrollHidden(anchor, window.scrollY, hidden);
      anchor = next.anchor;
      if (next.hidden !== hidden) { hidden = next.hidden; setScrollHidden(hidden); }
    };
    window.addEventListener('scroll', onScroll, {passive:true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Browsers allow sound only after the person interacts with the page.
  useEffect(() => {
    const unlock = () => unlockMessageSound();
    window.addEventListener('pointerdown', unlock, {once:true});
    window.addEventListener('keydown', unlock, {once:true});
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { if (suppressed) setOpen(false); }, [suppressed]);

  const enableNotifications = async () => { unlockMessageSound(); setPermission(await requestNotifications()); };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (body.length > MESSAGE_MAX) { setError(`Pesan maksimal ${MESSAGE_MAX.toLocaleString('id-ID')} karakter.`); return; }
    unlockMessageSound();
    // Ask once, in context, right when the visitor starts waiting for a reply.
    if (permission === 'default') void requestNotifications().then(setPermission);
    setSending(true); setError('');
    try {
      const result = await messagesAPI.send(body, name.trim(), website);
      if (result.message) apply([result.message]);
      setDraft(''); setHasThread(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pesan gagal dikirim.');
    } finally { setSending(false); inputRef.current?.focus({preventScroll:true}); }
  };

  const openAdminMessages = () => { setOpen(false); pushLocation(navigationHash('admin', {view:'messages'})); window.dispatchEvent(new Event('maktabah:navigate')); };
  const buttonHidden = suppressed || (scrollHidden && !open);
  const admin = isAdminBrowser();

  return (
    <>
      {open && !suppressed && (
        <section role="dialog" aria-modal="false" aria-labelledby="message-panel-title"
          className="fixed z-[55] inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] h-[min(72dvh,600px)] sm:inset-x-auto sm:right-4 sm:w-[380px] xl:bottom-24 xl:right-6 flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-[var(--reader-paper)] text-[var(--app-text)] shadow-2xl motion-safe:animate-[message-panel-in_180ms_ease-out]">
          <header className="flex items-center gap-3 bg-[var(--app-primary)] text-white px-4 py-3">
            <MessageCircle size={22} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id="message-panel-title" className="font-bold leading-tight">Pesan ke Admin</h2>
              <p className="text-xs text-white/80">Pertanyaan, laporan kesalahan, atau saran</p>
            </div>
            {permission !== 'unsupported' && (
              <button type="button" onClick={enableNotifications} disabled={permission !== 'default'}
                title={permission === 'granted' ? 'Notifikasi aktif' : permission === 'denied' ? 'Notifikasi diblokir di pengaturan peramban' : 'Aktifkan notifikasi balasan'}
                aria-label={permission === 'granted' ? 'Notifikasi aktif' : permission === 'denied' ? 'Notifikasi diblokir' : 'Aktifkan notifikasi balasan'}
                className="p-2 rounded-full hover:bg-white/15 disabled:opacity-70 disabled:hover:bg-transparent">
                {permission === 'denied' ? <BellOff size={18} /> : <Bell size={18} fill={permission === 'granted' ? 'currentColor' : 'none'} />}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Tutup pesan" className="p-2 rounded-full hover:bg-white/15"><X size={20} /></button>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-[var(--reader-bg)]" aria-live="polite">
            {admin ? (
              <div className="m-2 rounded-xl border bg-[var(--reader-paper)] p-4 text-sm space-y-3">
                <p>Anda sedang masuk sebagai admin. Pesan pengunjung dibaca dan dibalas dari panel admin.</p>
                <button type="button" onClick={openAdminMessages} className="rounded-lg bg-[var(--app-primary)] text-white px-4 py-2 font-semibold">Buka Pesan di panel admin</button>
              </div>
            ) : messages.length === 0 ? (
              <div className="m-2 rounded-xl border bg-[var(--reader-paper)] p-4 text-sm leading-relaxed">
                <p className="font-semibold mb-1">Assalamu‘alaikum 👋</p>
                <p>Tulis pesan untuk admin al Maktabah as Sunniyyah. Balasan akan muncul di sini dan Anda akan diberi tahu.</p>
                <p className="mt-2 text-xs opacity-70">Percakapan terhubung dengan peramban ini (tanpa akun). Jangan kirim data pribadi yang sensitif.</p>
              </div>
            ) : messages.map(m => (
              <div key={m.id} className={`flex ${m.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm ${m.sender === 'visitor' ? 'bg-[var(--app-primary)] text-white rounded-br-md' : 'bg-[var(--reader-paper)] border border-black/5 rounded-bl-md'}`}>
                  {m.sender === 'admin' && <div className="text-[11px] font-bold text-[var(--app-primary)] mb-0.5">Admin</div>}
                  <p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
                  <time dateTime={m.created_at} className={`block text-[10px] mt-1 text-right ${m.sender === 'visitor' ? 'text-white/75' : 'opacity-60'}`}>{messageTime(m.created_at)}</time>
                </div>
              </div>
            ))}
          </div>

          {!admin && (
            <form className="border-t border-black/10 p-3 space-y-2 bg-[var(--reader-paper)]" onSubmit={e => { e.preventDefault(); void send(); }}>
              {/* Honeypot for bots: hidden from people and assistive technology. */}
              <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />
              {!hasThread && (
                <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Nama (opsional)" aria-label="Nama (opsional)"
                  className="w-full rounded-lg border border-black/15 bg-[var(--reader-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]" />
              )}
              {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex items-end gap-2">
                <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} rows={1} maxLength={MESSAGE_MAX} dir="auto"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
                  placeholder="Tulis pesan…" aria-label="Tulis pesan"
                  className="flex-1 resize-none field-sizing-content max-h-32 min-h-[42px] rounded-xl border border-black/15 bg-[var(--reader-bg)] px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]" />
                <button type="submit" disabled={sending || !draft.trim()} aria-label="Kirim pesan"
                  className="shrink-0 grid place-items-center w-11 h-11 rounded-full bg-[var(--app-primary)] text-white disabled:opacity-50 hover:brightness-110 transition">
                  <Send size={18} />
                </button>
              </div>
              {draft.length > MESSAGE_MAX - 200 && <p className="text-xs text-right opacity-70">{draft.length}/{MESSAGE_MAX}</p>}
            </form>
          )}
        </section>
      )}

      <button type="button" onClick={() => { unlockMessageSound(); setOpen(v => !v); }}
        aria-label={unread > 0 ? `Pesan, ${unread} belum dibaca` : 'Pesan'} aria-expanded={open} aria-hidden={buttonHidden || undefined} tabIndex={buttonHidden ? -1 : 0}
        className={`fixed z-[55] right-4 xl:right-6 bottom-[calc(84px+env(safe-area-inset-bottom))] xl:bottom-6 grid place-items-center w-14 h-14 rounded-full bg-[var(--app-primary)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] ring-4 ring-white/40 transition-[transform,opacity] duration-300 ease-out hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-[var(--app-primary)]/40 ${open ? 'max-xl:hidden' : ''} ${buttonHidden ? 'translate-y-[calc(100%+120px)] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        {open ? <X size={26} /> : <MessageCircle size={26} />}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold grid place-items-center ring-2 ring-white motion-safe:animate-bounce">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
