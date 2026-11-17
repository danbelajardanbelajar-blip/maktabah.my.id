// Server-Sent Events over fetch, so the admin stream can send the Bearer token. EventSource cannot set
// headers and would depend on the admin cookie, which older admin sessions do not have; without it the
// inbox fell back to a slow poll and read receipts arrived late.
// Dispatches MessageEvent objects like EventSource ('open' included) and reconnects after a drop.

export function parseEventBlock(block: string): {event: string; data: string} | null {
  let event = 'message';
  const data: string[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value || 'message';
    else if (field === 'data') data.push(value);
  }
  return data.length ? {event, data:data.join('\n')} : null;
}

export class AuthEventSource extends EventTarget {
  private controller: AbortController | null = null;
  private timer = 0;
  private closed = false;
  private retryMs = 3000;
  private url: string;
  private token: string;
  private onUnauthorized?: () => void;

  constructor(url: string, token: string, onUnauthorized?: () => void) {
    super();
    this.url = url; this.token = token; this.onUnauthorized = onUnauthorized;
    void this.connect();
  }

  private async connect() {
    if (this.closed) return;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const res = await fetch(this.url, {headers:{Authorization:`Bearer ${this.token}`, Accept:'text/event-stream'}, cache:'no-store', signal:controller.signal});
      if (res.status === 401 || res.status === 403) { this.closed = true; this.onUnauthorized?.(); return; }
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      this.retryMs = 3000;
      this.dispatchEvent(new Event('open'));
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream:true}).replace(/\r\n/g, '\n');
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const parsed = parseEventBlock(buffer.slice(0, end));
          buffer = buffer.slice(end + 2);
          if (parsed) this.dispatchEvent(new MessageEvent(parsed.event, {data:parsed.data}));
        }
      }
    } catch { /* Dropped or refused; retried below unless closed. */ }
    if (this.closed) return;
    this.timer = window.setTimeout(() => void this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 30000);
  }

  close() {
    this.closed = true;
    window.clearTimeout(this.timer);
    this.controller?.abort();
  }
}
