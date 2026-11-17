import { useCallback, useEffect, useRef, useState } from 'react';
import { MESSAGE_MAX, adminMessagesAPI, mergeMessages, messagePreview, playMessageSound, readAttachment, showMessageNotification, unlockMessageSound } from './messages';
import type { ChatMessage, MessageThreadRow } from './messages';

export const threadName = (t: {name?: string; id: number}) => t.name || `Pengunjung #${t.id}`;

type Options = {
  token: string;
  enabled?: boolean;
  // Whether the inbox is on screen; a hidden inbox raises unread counts instead of marking messages read.
  isViewing?: () => boolean;
  onUnreadChange?: () => void;
  onAuthError: () => void;
  onNotificationClick?: (threadId: number) => void;
};

// Admin inbox state shared by the admin page and the floating message button: live via the admin SSE
// stream (HttpOnly admin cookie) with a slow poll as fallback for sessions without that cookie.
export function useAdminInbox({ token, enabled = true, isViewing = () => true, onUnreadChange, onAuthError, onNotificationClick }: Options) {
  const [threads, setThreads] = useState<MessageThreadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [thread, setThread] = useState<MessageThreadRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;

  const handle = useCallback((e: unknown) => {
    const message = e instanceof Error ? e.message : 'Terjadi kesalahan.';
    if (message === '401') onAuthError(); else setError(message);
  }, [onAuthError]);

  const loadList = useCallback(async () => {
    if (!enabled || !token) return;
    try {
      const res = await adminMessagesAPI.list(token, page, search);
      setThreads(res.data); setTotal(res.total); setPages(res.pages); setUnread(res.unread);
      if (res.page !== page) setPage(res.page);
    } catch (e) { handle(e); }
  }, [enabled, token, page, search, handle]);

  const openThread = useCallback(async (id: number) => {
    setSelected(id); setLoading(true); setError('');
    try {
      const res = await adminMessagesAPI.thread(token, id);
      setThread(res.thread); setMessages(res.messages); setUnread(res.unread);
      setThreads(list => list.map(t => t.id === id ? {...t, admin_unread:0} : t));
      onUnreadChange?.();
    } catch (e) { handle(e); setSelected(null); } finally { setLoading(false); }
  }, [token, handle, onUnreadChange]);

  const closeThread = useCallback(() => { setSelected(null); setThread(null); setMessages([]); }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  // The stream stays open across renders; it reads the latest callbacks through this ref.
  const latest = useRef({loadList, openThread, onUnreadChange, isViewing, onNotificationClick});
  latest.current = {loadList, openThread, onUnreadChange, isViewing, onNotificationClick};
  useEffect(() => {
    if (!enabled || !token) return;
    const source = new EventSource('/api/admin/messages/stream');
    source.addEventListener('message', event => {
      let payload: {threadId?: number; name?: string; message?: ChatMessage};
      try { payload = JSON.parse((event as MessageEvent).data); } catch { return; }
      const {threadId, message} = payload;
      if (!threadId || !message) return;
      const onScreen = document.visibilityState === 'visible' && latest.current.isViewing();
      if (threadId === selectedRef.current) {
        setMessages(current => mergeMessages(current, [message]));
        if (message.sender === 'visitor' && onScreen) void adminMessagesAPI.thread(token, threadId).then(res => { setUnread(res.unread); latest.current.onUnreadChange?.(); }).catch(() => {});
      }
      if (message.sender === 'visitor') {
        playMessageSound();
        if (!onScreen || threadId !== selectedRef.current) {
          const open = latest.current.onNotificationClick || ((id: number) => void latest.current.openThread(id));
          showMessageNotification(`Pesan baru dari ${threadName({name:payload.name, id:threadId})}`, messagePreview(message), () => open(threadId));
        }
        latest.current.onUnreadChange?.();
      }
      void latest.current.loadList();
    });
    const refresh = () => { void latest.current.loadList(); latest.current.onUnreadChange?.(); };
    source.addEventListener('read', refresh);
    source.addEventListener('deleted', refresh);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void latest.current.loadList(); }, 30000);
    const unlock = () => unlockMessageSound();
    window.addEventListener('pointerdown', unlock);
    return () => { source.close(); window.clearInterval(timer); window.removeEventListener('pointerdown', unlock); };
  }, [enabled, token]);

  const reply = useCallback(async (text: string, file?: File | null) => {
    const body = text.trim();
    if (!selected || (!body && !file) || sending) return false;
    if (body.length > MESSAGE_MAX) { setError(`Balasan maksimal ${MESSAGE_MAX.toLocaleString('id-ID')} karakter.`); return false; }
    setSending(true); setError('');
    try {
      const res = await adminMessagesAPI.reply(token, selected, body, file ? await readAttachment(file) : null);
      setMessages(current => mergeMessages(current, [res.message]));
      void loadList();
      return true;
    } catch (e) { handle(e); return false; } finally { setSending(false); }
  }, [selected, sending, token, loadList, handle]);

  const remove = useCallback(async () => {
    if (!selected || !window.confirm('Hapus seluruh percakapan ini? Pesan di peramban pengunjung juga akan hilang. Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await adminMessagesAPI.remove(token, selected);
      closeThread(); void loadList(); onUnreadChange?.();
    } catch (e) { handle(e); }
  }, [selected, token, closeThread, loadList, onUnreadChange, handle]);

  return {threads, total, unread, page, setPage, pages, search, setSearch, selected, thread, messages, loading, sending, error, setError,
    loadList, openThread, closeThread, reply, remove};
}
