import { useCallback, useEffect, useRef, useState } from 'react';
import { MESSAGE_MAX, adminMessagesAPI, mergeMessages, messagePreview, playMessageSound, readAttachment, showMessageNotification, unlockMessageSound } from './messages';
import type { ChatMessage, MessageThreadRow } from './messages';
import { AuthEventSource } from './auth-event-source';

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

// Admin inbox shared by the full page and floating panel: authenticated SSE with polling fallback.
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
  const [syncFailures,setSyncFailures]=useState({list:false,thread:false,stream:false});
  const listRequest=useRef(0);
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;
  const viewingRef=useRef(isViewing);viewingRef.current=isViewing;

  const handle = useCallback((e: unknown) => {
    const message = e instanceof Error ? e.message : 'Terjadi kesalahan.';
    if (message === '401') onAuthError(); else setError(message);
  }, [onAuthError]);

  const loadList = useCallback(async () => {
    if (!enabled || !token) return;
    const request=++listRequest.current;
    try {
      const res = await adminMessagesAPI.list(token, page, search);
      if(request!==listRequest.current)return;
      setThreads(res.data); setTotal(res.total); setPages(res.pages); setUnread(res.unread);
      setSyncFailures(current=>({...current,list:false}));
      // The list carries read receipts too, so a refresh also updates ✓/✓✓ in the open conversation.
      const open = res.data.find(t => t.id === selectedRef.current);
      if (open) setThread(current => current && current.id === open.id ? {...current, visitor_read_id:Math.max(current.visitor_read_id || 0, open.visitor_read_id || 0)} : current);
      if (res.page !== page) setPage(res.page);
    } catch (e) {
      if(request!==listRequest.current)return;
      if(e instanceof Error&&e.message==='401')handle(e);
      else setSyncFailures(current=>({...current,list:true}));
    }
  }, [enabled, token, page, search, handle]);

  const openThread = useCallback(async (id: number) => {
    selectedRef.current=id;
    setSelected(id); setLoading(true); setError('');
    try {
      const res = await adminMessagesAPI.thread(token, id);
      if(selectedRef.current!==id)return;
      setThread(res.thread); setMessages(res.messages); setUnread(res.unread);
      setSyncFailures(current=>({...current,thread:false}));
      setThreads(list => list.map(t => t.id === id ? {...t, admin_unread:0} : t));
      onUnreadChange?.();
    } catch (e) { if(selectedRef.current===id){handle(e);setSelected(null);} } finally { if(selectedRef.current===id)setLoading(false); }
  }, [token, handle, onUnreadChange]);

  const closeThread = useCallback(() => { selectedRef.current=null;setSelected(null); setThread(null); setMessages([]); }, []);

  const refreshThread=useCallback(async()=>{
    const id=selectedRef.current;
    if(!id||!enabled||!token||document.visibilityState!=='visible'||!viewingRef.current())return;
    try{
      const res=await adminMessagesAPI.thread(token,id);
      if(selectedRef.current!==id)return;
      setMessages(current=>mergeMessages(current,res.messages));setThread(res.thread);setUnread(res.unread);
      setSyncFailures(current=>({...current,thread:false}));
    }catch(e){
      if(selectedRef.current!==id)return;
      if(e instanceof Error&&e.message==='401')handle(e);
      else setSyncFailures(current=>({...current,thread:true}));
    }
  },[enabled,token,handle]);

  useEffect(() => { void loadList(); }, [loadList]);

  // The stream stays open across renders; it reads the latest callbacks through this ref.
  const latest = useRef({loadList, refreshThread, openThread, onUnreadChange, isViewing, onNotificationClick, onAuthError});
  latest.current = {loadList, refreshThread, openThread, onUnreadChange, isViewing, onNotificationClick, onAuthError};
  useEffect(() => {
    if (!enabled || !token) return;
    // Authenticated with the token (not the admin cookie), so every admin session gets live updates.
    const source = new AuthEventSource('/api/admin/messages/stream', token, () => latest.current.onAuthError());
    // After a (re)connect, catch up on whatever happened while disconnected.
    source.addEventListener('open', () => {
      setSyncFailures(current=>({...current,stream:false}));
      void latest.current.loadList();void latest.current.refreshThread();
    });
    source.addEventListener('error',()=>setSyncFailures(current=>({...current,stream:true})));
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
    // Another admin tab changed a conversation's attachment permission.
    source.addEventListener('permissions', event => {
      let p: {threadId?: number; allow_files?: number; allow_images?: number};
      try { p = JSON.parse((event as MessageEvent).data); } catch { return; }
      const patch = {allow_files:p.allow_files, allow_images:p.allow_images};
      setThread(current => current && current.id === p.threadId ? {...current, ...patch} : current);
      setThreads(list => list.map(t => t.id === p.threadId ? {...t, ...patch} : t));
    });
    // The visitor read the admin's replies: their ✓ turns into ✓✓.
    source.addEventListener('seen', event => {
      let p: {threadId?: number; visitor_read_id?: number};
      try { p = JSON.parse((event as MessageEvent).data); } catch { return; }
      const id = p.visitor_read_id;
      if (typeof id !== 'number') return;
      const patch = (t: MessageThreadRow) => t.id === p.threadId ? {...t, visitor_read_id:Math.max(t.visitor_read_id || 0, id)} : t;
      setThread(current => current && patch(current));
      setThreads(list => list.map(patch));
    });
    source.addEventListener('read', refresh);
    source.addEventListener('deleted', refresh);
    const reconnect=()=>{void latest.current.loadList();void latest.current.refreshThread();};
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') reconnect(); }, 30000);
    const visible=()=>{if(document.visibilityState==='visible')reconnect();};
    window.addEventListener('online',reconnect);
    document.addEventListener('visibilitychange',visible);
    const unlock = () => unlockMessageSound();
    window.addEventListener('pointerdown', unlock);
    return () => { source.close();window.clearInterval(timer); window.removeEventListener('pointerdown', unlock);window.removeEventListener('online',reconnect);document.removeEventListener('visibilitychange',visible); };
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
    } catch (e) {
      if(e instanceof Error&&e.message==='401')handle(e);
      else setError(`Balasan belum dapat dikonfirmasi. Periksa percakapan sebelum mengirim ulang. ${e instanceof Error?e.message:''}`);
      void refreshThread();
      return false;
    } finally { setSending(false); }
  }, [selected, sending, token, loadList, handle,refreshThread]);

  // Attachment permission for the open conversation only; the visitor's panel updates live.
  const [savingPermissions, setSavingPermissions] = useState(false);
  const setPermissions = useCallback(async (value: {allowFiles: boolean; allowImages: boolean}) => {
    if (!selected) return;
    const id = selected;
    setSavingPermissions(true); setError('');
    try {
      const res = await adminMessagesAPI.permissions(token, id, value);
      const patch = {allow_files:res.allow_files, allow_images:res.allow_images};
      setThread(current => current && current.id === id ? {...current, ...patch} : current);
      setThreads(list => list.map(t => t.id === id ? {...t, ...patch} : t));
    } catch (e) { handle(e); } finally { setSavingPermissions(false); }
  }, [selected, token, handle]);

  const remove = useCallback(async () => {
    if (!selected || !window.confirm('Hapus seluruh percakapan ini? Pesan di peramban pengunjung juga akan hilang. Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await adminMessagesAPI.remove(token, selected);
      closeThread(); void loadList(); onUnreadChange?.();
    } catch (e) { handle(e); }
  }, [selected, token, closeThread, loadList, onUnreadChange, handle]);

  return {threads, total, unread, page, setPage, pages, search, setSearch, selected, thread, messages, loading, sending, error, setError,
    syncIssue:syncFailures.list||syncFailures.stream||(!!selected&&syncFailures.thread),
    retrySync:()=>{void loadList();void refreshThread();},
    loadList, openThread, closeThread, reply, remove, setPermissions, savingPermissions};
}
