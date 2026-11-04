import React, { useState, useRef, useEffect } from 'react';
import { webAPI } from '../api';
import { Send, Bot, User, BookOpen, AlertCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'ai' | 'error';
  content: string;
  references?: Array<{bkid: number, title: string, juz: number | string, page: number | string}>;
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

export default function AskAI({ openBook }: { openBook: (id: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Assalamu'alaikum. Saya Maktabah Bot, asisten AI Anda. Tanyakan apa saja seputar ilmu agama, dan saya akan mencarikannya di dalam ribuan kitab database ini." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<{query:string}[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    webAPI.getRecentQuestions().then(res => {
      if (res.data) setRecentQuestions(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await webAPI.askAI(q);
      if (res.status === 'success') {
        setMessages(prev => [...prev, { role: "ai", content: res.answer, references: res.references }]);
      } else {
        setMessages(prev => [...prev, { role: 'error', content: res.message || 'Terjadi kesalahan sistem.' }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'error', content: 'Gagal terhubung ke server: ' + err.message }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] bg-gray-50 max-w-4xl mx-auto w-full border-x border-gray-200">
      
      {/* Header */}
      <div className="bg-white p-4 border-b border-gray-200 flex items-center gap-3 shrink-0 shadow-sm">
        <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
          <Bot size={24} />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-lg">Tanya AI Maktabah</h2>
          <p className="text-xs text-gray-500">Gemini Flash AI + Database Kitab Lokal</p>
        </div>
      </div>

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
                style={m.role !== 'user' ? { fontFamily: 'var(--arabic-font)' } : {}}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
              />
              
              {m.references && m.references.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Referensi Kitab:</p>
                  {m.references.map((ref, idx) => (
                    <button 
                      key={idx}
                      onClick={() => openBook(ref.bkid)}
                      className="w-full text-left bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 p-2 rounded-lg text-sm flex items-start gap-2 transition-colors"
                    >
                      <BookOpen size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-700 truncate" dir="auto">{ref.title}</p>
                        <p className="text-xs text-gray-500">Juz {ref.juz} • Halaman {ref.page}</p>
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
                      onClick={() => { setInput(rq.query); }}
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
          <div className="flex gap-3">
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
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Tanya soal fiqih, hadits, atau akidah..."
            className="w-full bg-gray-100 border-transparent focus:bg-white focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-primary)]/20 rounded-full py-3 md:py-4 pl-6 pr-14 text-sm md:text-base outline-none transition-all disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
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
