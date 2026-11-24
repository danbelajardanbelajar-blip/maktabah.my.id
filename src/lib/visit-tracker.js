// Shared by the React app and the standalone privacy page. No React dependency.
const routes = new Set(['beranda','cari','katalog','quran','perawi','kutub-hadis','penulis','tentang','privasi','pengaturan','lainnya','tanya-ai','masukan','permintaan-kitab','kirim-kitab','koleksi','donasi']);
const parameters = new Set(['q','cat','filter','id','page','mode','filters','scope','books','cats','excluded','surah','ayat','view','book','century','initial','year','sort','group','edition','matching','source','listPage','bpage','available','notcats','notbooks']);
const prefix = 'maktabah-analytics-v1:';
const lifetime = 24 * 60 * 60 * 1000;

export function visitPath(href) {
  const url = new URL(href);
  if (/^\/privacy-policy(?:\/|\.html)?$/.test(url.pathname)) return '/privacy-policy';
  const [route, query = ''] = url.hash.replace(/^#\/?/, '').split('?');
  // The reader records the actual page only after its content loads successfully.
  if (route.startsWith('read/') || route === 'admin' || (!route && url.searchParams.get('admin') === '1')) return null;
  const path = routes.has(route) ? route : 'beranda';
  const params = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(query)) {
    if (parameters.has(key) && value) params.set(key, value.slice(0, key === 'q' ? 200 : 300));
  }
  params.sort();
  return ('/' + path + (params.size ? '?' + params : '')).slice(0, 2000);
}

export function createLogClient({fetch: send, storage, now = Date.now, randomId = () => globalThis.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`, schedule = setTimeout, cancel = clearTimeout}) {
  const pending = new Map();
  let running = false, timer, stopped = false;
  const remove = id => { pending.delete(id); try { storage?.removeItem(prefix + id); } catch { /* Memory remains usable. */ } };
  const restore = () => {
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          const event = JSON.parse(storage.getItem(key));
          if (event?.event_id && event.path && ['visit','action'].includes(event.kind)) pending.set(event.event_id, event);
        } catch { /* Ignore damaged entries. */ }
      }
    } catch { /* Storage may be disabled. */ }
  };
  const persist = event => { try { storage?.setItem(prefix + event.event_id, JSON.stringify(event)); } catch { /* Keep in memory. */ } };
  const flush = async () => {
    if (stopped || running) return;
    running = true;
    if (timer) cancel(timer);
    restore();
    try {
      for (const event of pending.values()) {
        if (now() - event.at > lifetime || event.at > now() + 60000) { remove(event.event_id); continue; }
        if (event.next > now()) continue;
        try {
          const response = await send(event.kind === 'action' ? '/api/log/site-action' : '/api/log/visit', {
            method: 'POST', headers: {'Content-Type':'application/json'}, credentials:'same-origin', keepalive:true,
            signal: AbortSignal.timeout(8000), body: JSON.stringify({event_id:event.event_id,path:event.path,...(event.action ? {action:event.action} : {})}),
          });
          // A network success with an HTML error page is not an acknowledgement.
          const reply = response.ok ? await response.json() : null;
          if (reply?.success === true || [400,401,403,404,413,422].includes(response.status)) { remove(event.event_id); continue; }
        } catch { /* Offline, timeout, or lost acknowledgement: retry the same ID. */ }
        if (!pending.has(event.event_id)) continue; // An in-flight event may have been evicted at the queue limit.
        event.attempt = (event.attempt || 0) + 1;
        event.next = now() + Math.min(60000, 1000 * 2 ** Math.min(event.attempt, 6));
        persist(event);
      }
    } finally {
      running = false;
      if (!stopped && pending.size) {
        const next = Math.min(...[...pending.values()].map(event => event.next || now()));
        timer = schedule(() => { void flush(); }, Math.max(500, next - now()));
      }
    }
  };
  const enqueue = (kind, path, action) => {
    if (stopped) return;
    restore();
    while (pending.size >= 100) remove(pending.keys().next().value);
    const event = {event_id:randomId(),kind,path,...(action ? {action} : {}),at:now(),attempt:0,next:0};
    pending.set(event.event_id,event); persist(event); void flush();
  };
  return { enqueue, flush, size:() => pending.size, stop:() => { stopped = true; if(timer)cancel(timer); } };
}

let client, lastPath;
function browserClient() {
  if (!client) {
    let storage;
    try { storage = window.sessionStorage; } catch { /* Optional. */ }
    client = createLogClient({fetch:window.fetch.bind(window),storage});
  }
  return client;
}
export function recordVisit(path) {
  if (!path || path === lastPath) return;
  lastPath = path;
  browserClient().enqueue('visit',path);
}
export function recordSiteAction(action) {
  if (['qris_view','qris_download'].includes(action)) browserClient().enqueue('action','/donasi/qris',action);
}
export function startVisitTracking() {
  const track = () => recordVisit(visitPath(window.location.href));
  const resume = () => { void browserClient().flush(); };
  const pageShow = event => { if(event.persisted) { lastPath = undefined; track(); } resume(); };
  const visible = () => { if(document.visibilityState === 'visible')resume(); };
  for (const event of ['hashchange','popstate','maktabah:location','maktabah:navigate']) window.addEventListener(event,track);
  window.addEventListener('online',resume); window.addEventListener('pageshow',pageShow);
  document.addEventListener('visibilitychange',visible);
  track(); resume();
  return () => {
    for (const event of ['hashchange','popstate','maktabah:location','maktabah:navigate'])window.removeEventListener(event,track);
    window.removeEventListener('online',resume); window.removeEventListener('pageshow',pageShow);
    document.removeEventListener('visibilitychange',visible);
  };
}
