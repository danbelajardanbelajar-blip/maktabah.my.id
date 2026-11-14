import { X, BookOpen, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { renderMarkdown } from '../lib/ai-markdown';
import { useModalFocus } from '../lib/use-modal-focus';

type AuditReference = { bkid?: number | null; pageId?: number | null; title?: string; juz?: number | string | null; page?: number | string | null; excerpt?: string };
type AuditRejection = { stage?: string; reason?: string; references?: AuditReference[] };
type AuditMeta = { mode?: string | null; reviewed?: boolean; references?: AuditReference[]; quotes?: { source?: number | null; text?: string }[]; rejection?: AuditRejection };
const REJECTION_STAGES: Record<string, string> = {
  retrieval: 'Pencarian rujukan', verification: 'Pencocokan kutipan', topic: 'Kesesuaian topik', review: 'Review relevansi',
};
export type AskLogRow = { id: number; question?: string; response?: string; created_at?: string; ip?: string; user_agent?: string; session_id?: string | null; context_json?: string | null; meta_json?: string | null };

const parse = <T,>(raw?: string | null): T | null => { if (!raw) return null; try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v as T : null; } catch { return null; } };
const MODES: Record<string, [string, string]> = {
  grounded: ['Berdasarkan sumber (terverifikasi)', 'bg-emerald-100 text-emerald-800'],
  catalogue: ['Daftar katalog', 'bg-blue-100 text-blue-800'],
  no_context: ['Tidak terjawab / tidak terverifikasi', 'bg-amber-100 text-amber-800'],
  conversation: ['Percakapan umum', 'bg-gray-100 text-gray-700'],
};
const INTENTS: Record<string, string> = { translate: 'Terjemahkan teks terpilih', explain: 'Jelaskan teks terpilih', question: 'Pertanyaan tentang teks terpilih' };
export const formatLogTime = (value?: string) => { const d = new Date((value || '').replace(' ', 'T') + 'Z'); return isNaN(d.getTime()) ? (value || '-') : d.toLocaleString('id-ID'); };

export function AskLogDetail({ row, onClose }: { row: AskLogRow; onClose: () => void }) {
  const ref = useModalFocus(onClose);
  const [copied, setCopied] = useState(false);
  const meta = parse<AuditMeta>(row.meta_json);
  const context = parse<{ source?: { bookId?: number; pageId?: number; title?: string; part?: number | string | null; page?: number | string | null; text?: string }; intent?: string; previousQuestions?: string[] }>(row.context_json);
  const mode = meta?.mode ? MODES[meta.mode] || [meta.mode, 'bg-gray-100 text-gray-700'] : null;
  const references = meta?.references || [];
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Pertanyaan:\n${row.question || ''}\n\nJawaban AI:\n${row.response || ''}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* Clipboard may be blocked. */ }
  };
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="ask-log-title" tabIndex={-1} onClick={e => e.stopPropagation()}
        className="bg-white w-full md:max-w-3xl max-h-[92vh] rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 border-b bg-gray-50">
          <div className="min-w-0">
            <h2 id="ask-log-title" className="font-bold text-gray-800">Detail Tanya AI #{row.id}</h2>
            <div className="text-xs text-gray-500">{formatLogTime(row.created_at)} · IP {row.ip || '-'}</div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={copy} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600" title="Salin pertanyaan & jawaban" aria-label="Salin pertanyaan dan jawaban">{copied ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Copy size={18} />}</button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600" aria-label="Tutup"><X size={18} /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 md:p-5 space-y-5 text-sm">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Pertanyaan</h3>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 font-medium whitespace-pre-wrap break-words" dir="auto">{row.question || '-'}</div>
          </section>
          {context && (context.intent || context.source || context.previousQuestions?.length) ? (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Konteks</h3>
              <div className="p-3 rounded-xl bg-gray-50 border space-y-2">
                {context.intent && <div><span className="text-gray-500">Mode pembaca:</span> {INTENTS[context.intent] || context.intent}</div>}
                {context.source && <div><span className="text-gray-500">Sumber terpilih:</span> {context.source.title || `Kitab ${context.source.bookId ?? '-'}`}{context.source.part != null && context.source.part !== '' ? `, juz ${context.source.part}` : ''}{context.source.page != null ? `, hlm. ${context.source.page}` : ''}{context.source.text ? <div className="mt-1 text-gray-700 whitespace-pre-wrap break-words" dir="auto">{context.source.text}</div> : null}</div>}
                {context.previousQuestions?.length ? <div><span className="text-gray-500">Pertanyaan sebelumnya:</span><ul className="list-disc pl-5">{context.previousQuestions.map((q, i) => <li key={i} dir="auto">{q}</li>)}</ul></div> : null}
              </div>
            </section>
          ) : null}
          <section>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Jawaban AI</h3>
              {mode && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${mode[1]}`}>{mode[0]}</span>}
            </div>
            <div className="p-3 rounded-xl border leading-relaxed break-words" dir="auto" dangerouslySetInnerHTML={{ __html: row.response ? renderMarkdown(row.response) : '<span class="text-gray-400">(tidak ada jawaban tersimpan)</span>' }} />
          </section>
          {meta?.rejection && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Alasan tidak terverifikasi</h3>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div><span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">{REJECTION_STAGES[meta.rejection.stage || ''] || meta.rejection.stage || '-'}</span></div>
                <div className="text-amber-900 whitespace-pre-wrap break-words" dir="auto">{meta.rejection.reason || '-'}</div>
                {meta.rejection.references?.length ? (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-amber-900">Sumber yang dikirim ke AI ({meta.rejection.references.length})</summary>
                    <ol className="mt-2 space-y-2">{meta.rejection.references.map((r, i) => (
                      <li key={i} className="p-2 rounded-lg bg-white border">
                        <div className="font-semibold text-gray-800" dir="auto">[{i + 1}] {r.title || '-'}</div>
                        <div className="text-xs text-gray-500">ID kitab {r.bkid ?? '-'}{r.juz != null && r.juz !== '' ? ` · Juz ${r.juz}` : ''}{r.page != null && r.page !== '' ? ` · Hlm. ${r.page}` : ''}</div>
                        {r.excerpt && <div className="mt-1 text-gray-700 whitespace-pre-wrap break-words text-xs" dir="auto">{r.excerpt}</div>}
                      </li>
                    ))}</ol>
                  </details>
                ) : null}
              </div>
            </section>
          )}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Semua sumber yang diperiksa ({references.length})</h3>
            {!meta ? <div className="text-xs text-gray-400 italic">Log ini dibuat sebelum rujukan disimpan; hanya pertanyaan dan jawaban yang tersedia.</div>
              : references.length === 0 ? <div className="text-xs text-gray-400 italic">Tidak ada sumber kitab yang disimpan untuk jawaban ini.</div>
              : <ol className="space-y-2">{references.map((r, i) => {
                  const quotes = (meta.quotes || []).filter(q => q.source === i + 1);
                  return (
                    <li key={i} className="p-3 rounded-xl border bg-gray-50">
                      <div className="flex items-start gap-2 font-semibold text-gray-800"><BookOpen size={16} className="mt-0.5 shrink-0 text-emerald-600" /><span dir="auto">[{i + 1}] {r.title || '-'}</span></div>
                      <div className="text-xs text-gray-500 mt-0.5">ID kitab {r.bkid ?? '-'}{r.juz != null && r.juz !== '' ? ` · Juz ${r.juz}` : ''}{r.page != null && r.page !== '' ? ` · Hlm. ${r.page}` : ''}{r.pageId != null ? ` · ID halaman ${r.pageId}` : ''}</div>
                      {quotes.length > 0 && <div className="mt-3"><div className="text-[11px] font-semibold text-emerald-800 mb-1">Kutipan yang digunakan</div>{quotes.map((q, j) => <blockquote key={j} className="mb-2 border-r-4 border-emerald-400 pr-3 text-gray-800 whitespace-pre-wrap break-words" dir="auto">{q.text}</blockquote>)}</div>}
                      {r.excerpt && <div className="mt-3"><div className="text-[11px] font-semibold text-gray-600 mb-1">Cuplikan halaman sumber</div><div className="p-3 rounded-lg bg-white border text-gray-700 whitespace-pre-wrap break-words" dir="auto">{r.excerpt}</div></div>}
                    </li>
                  );
                })}</ol>}
          </section>
          <section className="text-xs text-gray-500 break-all">
            <div>Perangkat: {row.user_agent || '-'}</div>
            {row.session_id && <div>Sesi: {row.session_id.slice(0, 12)}…</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
