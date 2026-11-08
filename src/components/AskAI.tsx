import type {AiPageSource,AiIntent,AiRequest,AiHistoryItem} from '../lib/ai-source';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { webAPI } from '../api';
import { AI_SESSION_KEY, readAiSession } from '../lib/ai-session';
import {aiFailureMessage} from '../lib/ai-errors';
import { Send, Bot, User, BookOpen, AlertCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'ai' | 'error';
  content: string;
  references?: Array<{bkid: number, title: string, juz: number | string | null, page: number | string | null; pageId?: number | null; excerpt?: string}>;
}

// ── Lightweight Markdown renderer (no external lib needed) ──────────────────
function renderMarkdown(text: string): string {
  if (!text) return '';

  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Process block elements line by line
  const lines = html.split('\n');
  const result: string[] = [];
  let inOrderedList = false;
  let inUnorderedList = false;

  const closeListsIfOpen = () => {
    if (inOrderedList)   { result.push('</ol>');  inOrderedList = false; }
    if (inUnorderedList) { result.push('</ul>');  inUnorderedList = false; }
  };

  for (let line of lines) {
    // Numbered list: lines starting with "1.", "2.", etc.
    const olMatch = line.match(/^(\d+)\.\s+(.+)/);
    // Bullet list: lines starting with -, *, or •
    const ulMatch = line.match(/^[-*•]\s+(.+)/);

    if (olMatch) {
      if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
      if (!inOrderedList)  { result.push('<ol class="list-decimal list-inside space-y-1 my-2 pl-1">'); inOrderedList = true; }
      result.push(`<li>${inlineMarkdown(olMatch[2])}</li>`);
    } else if (ulMatch) {
      if (inOrderedList)   { result.push('</ol>'); inOrderedList = false; }
      if (!inUnorderedList){ result.push('<ul class="list-disc list-inside space-y-1 my-2 pl-1">'); inUnorderedList = true; }
      result.push(`<li>${inlineMarkdown(ulMatch[1])}</li>`);
    } else {
      closeListsIfOpen();
      if (line.trim() === '') {
        result.push('<br/>');
      } else {
        result.push(`<p class="mb-1">${inlineMarkdown(line)}</p>`);
      }
    }
  }
  closeListsIfOpen();

  return result.join('\n');
}

// Process inline elements: **bold**, *italic*, `code`
function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-gray-700 px-1 rounded text-sm font-mono">$1</code>');
}
// ────────────────────────────────────────────────────────────────────────────

export default function AskAI({ openBook, initialQuestion = '', questionVersion = 0, initialSource, initialIntent, onBusyChange }: { openBook: (id: number, pageId?: number) => void; initialSource?:AiPageSource; initialIntent?:AiIntent; initialQuestion?: string; questionVersion?: number; onBusyChange?: (busy:boolean)=>void }) {
  const [restored] = useState(() => readAiSession(sessionStorage));
  const welcome: Message[] = [
    { role: "ai", content: "Assalamu'alaikum. Saya Maktabah Bot, asisten AI Anda. Tanyakan apa saja seputar ilmu agama, dan saya akan mencarikannya di dalam ribuan kitab database ini." }
  ];
  const [messages, setMessages] = useState<Message[]>(restored.messages.length ? restored.messages : welcome);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityMessage,setAvailabilityMessage]=useState('');
  const [input, setInput] = useState<string>(initialQuestion || restored.input);
  const [source,setSource]=useState<AiPageSource|undefined>(initialSource || restored.source);
  const [intent,setIntent]=useState<AiIntent>(initialIntent || restored.intent || 'explain');
  const [loading, setLoading] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<AiHistoryItem[]>([]);
  const lastQuestion = useRef('');
  const requestActive = useRef(false);
  const handledQuestionVersion = useRef(0);
  useEffect(() => {
    try { sessionStorage.setItem(AI_SESSION_KEY,JSON.stringify({messages,input,source,intent,pending:loading,lastQuestion:lastQuestion.current})); } catch {}
  },[messages,input,source,intent,loading]);
  useEffect(() => { onBusyChange?.(loading); },[loading,onBusyChange]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
    if(questionVersion>0 && initialQuestion){setSource(initialSource);setIntent(initialIntent || 'explain');}
    if (initialQuestion) inputRef.current?.focus({ preventScroll: true });
  }, [initialQuestion, questionVersion, initialSource, initialIntent]);

  useEffect(() => {
    let disposed=false;let controller:AbortController|null=null;
    const refresh=async()=>{
      controller?.abort();controller=new AbortController();
      try {
        const r=await fetch('/api/ai/status',{cache:'no-store',signal:controller.signal});
        if(!r.ok)throw new Error('status');
        const data=await r.json();
        if(!disposed){setAvailable(data.available===true);setAvailabilityMessage(data.message || (data.available?'':'Tanya AI belum tersedia. Silakan coba lagi nanti.'));}
      } catch {if(!disposed && !controller?.signal.aborted){setAvailable(false);setAvailabilityMessage('Status Tanya AI belum dapat diperiksa. Memeriksa kembali secara otomatis…');}}
    };
    const visible=()=>{if(document.visibilityState!=='hidden')void refresh();};
    void refresh();const interval=setInterval(visible,5000);document.addEventListener('visibilitychange',visible);
    webAPI.getRecentQuestions().then(res => {
      if (res.data) setRecentQuestions(res.data);
    }).catch(() => {});
    return()=>{disposed=true;controller?.abort();clearInterval(interval);document.removeEventListener('visibilitychange',visible);};
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuestion = useCallback(async (question:string,options:AiRequest={}) => {
    const q = question.trim();
    if (!q || requestActive.current || available !== true) return;
    // A ref closes the gap before React renders loading=true (double clicks/effect replay).
    requestActive.current = true;
    lastQuestion.current = q;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await webAPI.askAI(q,options);
      webAPI.getRecentQuestions().then(data => { if (data.data) setRecentQuestions(data.data); }).catch(() => {});
      if (res.status === 'success') {
        setMessages(prev => [...prev, { role: "ai", content: res.answer, references: res.references }]);
      } else {
        setMessages(prev => [...prev, { role: 'error', content: res.message || 'Terjadi kesalahan sistem.' }]);
        setInput(current=>current || q);
      }
    } catch (err: any) {
      if(err.status===409){setAvailable(false);setAvailabilityMessage(aiFailureMessage(err));}
      setMessages(prev => [...prev, { role: 'error', content: aiFailureMessage(err) }]);
      setInput(current=>current || q);
    }
    finally {
      requestActive.current = false;
      setLoading(false);
    }
  },[available]);

  useEffect(() => {
    if (!initialQuestion.trim() || questionVersion <= handledQuestionVersion.current || loading || requestActive.current || available !== true) return;
    // Only an explicit history click creates a new version. Opening the tab or restoring
    // a saved conversation must never resend a question or duplicate a provider request.
    handledQuestionVersion.current = questionVersion;
    void sendQuestion(initialQuestion,initialSource?{source:initialSource,intent:initialIntent || 'explain'}:{});
  },[initialQuestion,questionVersion,initialSource,initialIntent,loading,available,sendQuestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input,source?{source,intent}:{});
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-150px)] xl:h-[calc(100dvh-140px)] min-h-[22rem] bg-gray-50 max-w-4xl mx-auto w-full border-x border-gray-200">
      
      {/* Header */}
      <div className="bg-white p-4 border-b border-gray-200 flex items-center gap-3 shrink-0 shadow-sm">
        <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
          <Bot size={24} />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-lg">Tanya AI Maktabah</h2>
          <p className="text-xs text-gray-500">Gemini AI + Rujukan Kitab Perpustakaan</p>
        </div>
      </div>

      {available !== true && <p role="status" className="bg-amber-50 text-amber-900 text-sm p-4 border-b">{available===null?'Memeriksa ketersediaan Tanya AI…':availabilityMessage}</p>}
      {loading && initialQuestion.trim() && questionVersion > handledQuestionVersion.current && <p role="status" className="bg-emerald-50 text-emerald-800 text-sm p-4 border-b">Pertanyaan yang dipilih akan dikirim otomatis setelah jawaban sebelumnya selesai.</p>}
      <div className="flex justify-end px-4 py-2 bg-white border-b"><button type="button" disabled={loading} onClick={() => { if (messages.length>1 && !window.confirm('Mulai percakapan baru? Percakapan pada sesi ini akan dikosongkan.')) return; setMessages(welcome); setInput(''); setSource(undefined); }} className="text-sm font-semibold text-emerald-700 disabled:opacity-40">Percakapan baru</button></div>
      {source && <section aria-label="Halaman sumber" className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 text-sm shrink-0 max-h-44 overflow-y-auto">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-emerald-900" dir="auto">{source.title}</p><p className="text-xs text-emerald-800">Jilid {source.part ?? '—'} · Halaman {source.page ?? '—'} · {source.text?'Teks pilihan':'Seluruh halaman'}</p></div><button type="button" disabled={loading} onClick={()=>setSource(undefined)} className="min-h-11 px-2 text-emerald-800 underline disabled:opacity-40">Lepas sumber</button></div>
        {source.text && <p dir="auto" className="truncate mt-1">{source.text}</p>}
        <label className="flex items-center gap-2 mt-2">Tindakan <select aria-label="Tindakan halaman" value={intent} disabled={loading} onChange={e=>setIntent(e.target.value as AiIntent)} className="rounded-lg border border-emerald-300 bg-white p-2"><option value="explain">Jelaskan</option><option value="translate">Terjemahkan</option></select></label>
      </section>}
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-[var(--app-primary)] text-white' : m.role === 'error' ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-600'}`}>
              {m.role === 'user' ? <User size={16} /> : m.role === 'error' ? <AlertCircle size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${m.role === 'user' ? 'bg-[var(--app-primary)] text-white rounded-tr-none' : m.role === 'error' ? 'bg-red-50 border border-red-100 text-red-700 rounded-tl-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'}`}>
              <div
                className="leading-relaxed text-[15px] prose prose-sm max-w-none"
                dir="auto"
                style={m.role === 'ai' ? { fontFamily: 'var(--arabic-font)' } : {}}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
              />
              
              {m.references && m.references.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Referensi Kitab:</p><p className="text-xs text-gray-500">Periksa penjelasan dengan teks sumber melalui tautan di bawah.</p>
                  {m.references.map((ref, idx) => (
                    <button 
                      key={idx}
                      onClick={() => openBook(ref.bkid, ref.pageId ?? undefined)}
                      className="w-full text-left bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 p-2 rounded-lg text-sm flex items-start gap-2 transition-colors"
                    >
                      <BookOpen size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-700 truncate" dir="auto">[{idx + 1}] {ref.title}</p>
                        <p className="text-xs text-gray-500">{ref.pageId == null ? 'Informasi katalog kitab' : `Juz ${ref.juz ?? '—'} • Halaman ${ref.page ?? '—'}`}</p>
                        {ref.excerpt && ref.pageId != null && <p className="text-xs text-gray-600 mt-1" dir="auto">{ref.excerpt.slice(0, 240)}…</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {messages.length === 1 && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-transparent"></div>
            <div className="max-w-[85%] md:max-w-[75%]">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Pertanyaan Terakhir:</p>
              {recentQuestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recentQuestions.map((rq, idx) => (
                    <button 
                      key={idx}
                      onClick={() => { setSource(rq.source);setIntent(rq.intent || 'explain');void sendQuestion(rq.query,rq.source?{source:rq.source,intent:rq.intent || 'explain'}:{}); }}
                      disabled={loading || available !== true}
                      className="bg-white hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 border border-gray-200 hover:border-emerald-200 px-4 py-2 rounded-full text-sm transition-all shadow-sm"
                      dir="auto"
                    >
                      {rq.query}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic ml-1">Belum ada pertanyaan sebelumnya.</p>
              )}
            </div>
          </div>
        )}
        {loading && (
          <div className="flex gap-3" role="status" aria-live="polite">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-emerald-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-emerald-700 italic">Mesin sedang membaca referensi kitab & berpikir... (mohon tunggu, butuh hingga 1 menit)</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 md:p-4 bg-white border-t border-gray-200">
        <div className="relative flex items-center">
          <input 
            ref={inputRef}
            type="text" 
            maxLength={1500}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Tanya soal fiqih, hadits, atau akidah..."
            className="w-full bg-gray-100 border-transparent focus:bg-white focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-primary)]/20 rounded-full py-3 md:py-4 pl-6 pr-14 text-sm md:text-base outline-none transition-all disabled:opacity-50"
          />
          <button 
            type="submit"
            aria-label="Kirim pertanyaan"
            disabled={input.trim().length < 5 || loading || available !== true}
            className="absolute right-2 w-10 h-10 md:w-12 md:h-12 bg-[var(--app-primary)] hover:bg-[var(--app-primary-hover)] text-white rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <Send size={18} className={input.trim() && !loading ? "translate-x-0.5" : ""} />
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-2">AI dapat membuat kesalahan. Selalu periksa kembali rujukan aslinya.</p>
      </form>
    </div>
  );
}
