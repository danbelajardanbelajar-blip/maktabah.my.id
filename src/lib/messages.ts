// Client side of visitor ↔ admin messages: REST calls, merging live updates, and the new-message alert.
export type ChatMessage = {id:number; sender:'visitor'|'admin'; body:string; created_at:string};
export type MessageThreadRow = {id:number; name:string; ip?:string; user_agent?:string; admin_unread:number; visitor_unread:number; created_at:string; updated_at:string; last_body?:string|null; last_sender?:'visitor'|'admin'|null; message_count?:number};
export const MESSAGE_MAX = 2000;

async function request(path:string, init:RequestInit = {}) {
  const res = await fetch(`/api${path}`, {...init, headers:{...(init.body ? {'Content-Type':'application/json'} : {}), ...(init.headers || {})}});
  let data:any = null;
  try { data = await res.json(); } catch { /* Empty or non-JSON body. */ }
  if (res.status === 401) throw new Error('401');
  if (!res.ok) throw new Error(data?.error || `Gagal (${res.status}). Silakan coba lagi.`);
  return data;
}
const auth = (token:string) => ({Authorization:`Bearer ${token}`});

export const messagesAPI = {
  load:(after = 0) => request(`/messages${after ? `?after=${after}` : ''}`) as Promise<{thread:{id:number; name:string}|null; messages:ChatMessage[]; unread:number}>,
  send:(body:string, name:string, website:string) => request('/messages', {method:'POST', body:JSON.stringify({body, name, website})}) as Promise<{success:boolean; message:ChatMessage|null; thread?:{id:number; name:string}}>,
  markRead:() => request('/messages/read', {method:'POST'}),
};
export const adminMessagesAPI = {
  list:(token:string, page = 1, q = '') => request(`/admin/messages?${new URLSearchParams({page:String(page), q})}`, {headers:auth(token)}) as Promise<{data:MessageThreadRow[]; total:number; page:number; pages:number; unread:number}>,
  thread:(token:string, id:number) => request(`/admin/messages/${id}`, {headers:auth(token)}) as Promise<{thread:MessageThreadRow; messages:ChatMessage[]; unread:number}>,
  reply:(token:string, id:number, body:string) => request(`/admin/messages/${id}`, {method:'POST', headers:auth(token), body:JSON.stringify({body})}) as Promise<{message:ChatMessage}>,
  remove:(token:string, id:number) => request(`/admin/messages/${id}`, {method:'DELETE', headers:auth(token)}),
};

// Live events can repeat what a reload already fetched; keep each message once, in id order.
export function mergeMessages(current:ChatMessage[], incoming:ChatMessage[]) {
  if (!incoming.length) return current;
  const byId = new Map(current.map(m => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function messageTime(value:string, withDate = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date().toDateString() === date.toDateString();
  return date.toLocaleString('id-ID', withDate || !today ? {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'} : {hour:'2-digit', minute:'2-digit'});
}

// A short two-tone chime made with Web Audio, so no sound file is downloaded. Browsers only allow
// audio after the person has interacted with the page; until then the chime is silently skipped.
let audio:AudioContext|null = null;
export function unlockMessageSound() {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!audio && Ctor) audio = new Ctor();
    if (audio?.state === 'suspended') void audio.resume();
  } catch { /* Audio is optional. */ }
}
export function playMessageSound() {
  try {
    if (!audio || audio.state !== 'running') return;
    const start = audio.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = audio.createOscillator(), gain = audio.createGain(), at = start + i * 0.14;
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + 0.26);
    }
  } catch { /* Audio is optional. */ }
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export function notificationPermission():NotificationPermission|'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}
export async function requestNotifications() {
  if (!notificationsSupported() || Notification.permission !== 'default') return notificationPermission();
  try { return await Notification.requestPermission(); } catch { return notificationPermission(); }
}
export function showMessageNotification(title:string, body:string, onClick:() => void) {
  if (notificationPermission() !== 'granted') return;
  try {
    const n = new Notification(title, {body:body.length > 160 ? body.slice(0, 157) + '…' : body, icon:'/logo.png', tag:'maktabah-pesan'});
    n.onclick = () => { window.focus(); onClick(); n.close(); };
  } catch { /* Some mobile browsers only allow notifications from a service worker. */ }
}
export function setAppBadge(count:number) {
  try { const nav = navigator as any; if (count > 0) nav.setAppBadge?.(count)?.catch?.(() => {}); else nav.clearAppBadge?.()?.catch?.(() => {}); } catch { /* Optional API. */ }
}

// Hide-on-scroll: down hides, up shows; tiny jitters are ignored and the top of the page always shows.
export function nextScrollHidden(previousY:number, y:number, hidden:boolean, threshold = 8) {
  if (y <= 64) return {hidden:false, anchor:y};
  if (Math.abs(y - previousY) < threshold) return {hidden, anchor:previousY};
  return {hidden:y > previousY, anchor:y};
}
