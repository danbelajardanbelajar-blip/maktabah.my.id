// Splits plain message text into text and link parts so links can be rendered as <a> elements while
// everything else stays text (never HTML). Only http(s) links and bare "www." addresses become links.
export type TextPart = {type:'text'; text:string} | {type:'link'; text:string; href:string};

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+/giu;
// Punctuation that usually ends a sentence rather than the address (Latin and Arabic).
const TRAILING = /[.,;:!?'"*_~،؛؟。]+$/u;
const PAIRS: Record<string, string> = {')':'(', ']':'[', '}':'{'};

function trimTrailing(candidate: string) {
  let url = candidate;
  for (;;) {
    const before = url;
    url = url.replace(TRAILING, '');
    const last = url.at(-1);
    // A closing bracket belongs to the link only when it closes a bracket inside it, as in Wikipedia URLs.
    if (last && PAIRS[last] && url.split(PAIRS[last]).length - 1 < url.split(last).length - 1) url = url.slice(0, -1);
    if (url === before) return url;
  }
}

export function safeHref(text: string) {
  try {
    const url = new URL(/^www\./i.test(text) ? `https://${text}` : text);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname.includes('.') || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function linkifyText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let index = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    // "xwww.example.com" or an address glued to a word is not treated as a link.
    if (start > 0 && /[\p{L}\p{N}_@/]/u.test(text[start - 1])) continue;
    const link = trimTrailing(match[0]);
    const href = link.length > 4 ? safeHref(link) : null;
    if (!href) continue;
    if (start > index) parts.push({type:'text', text:text.slice(index, start)});
    parts.push({type:'link', text:link, href});
    index = start + link.length;
  }
  if (index < text.length) parts.push({type:'text', text:text.slice(index)});
  return parts;
}
