import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { Check, CheckCheck, Download, FileText, ImagePlus, Paperclip, X } from 'lucide-react';
import { linkifyText } from '../lib/linkify';
import { FILE_ACCEPT, IMAGE_ACCEPT, adminMessagesAPI, checkAttachment, formatBytes, messageTime } from '../lib/messages';
import type { ChatAttachment, ChatMessage, MessageSettings } from '../lib/messages';

// Shared pieces of the visitor ↔ admin chat: message text with clickable links, attachments, and the
// attachment picker used by the visitor widget and both admin inboxes.

export function MessageText({ text, mine }: { text: string; mine: boolean }) {
  if (!text) return null;
  return (
    <p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
      {linkifyText(text).map((part, i) => part.type === 'text' ? part.text : (
        <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc"
          className={`underline underline-offset-2 break-all ${mine ? 'text-white decoration-white/70 hover:decoration-white' : 'text-[var(--app-primary)] hover:brightness-75'}`}>
          {part.text}
        </a>
      ))}
    </p>
  );
}

// Visitors fetch attachments with their own cookie, so a plain URL works. Admin sessions may only have the
// bearer token, so for them the file is fetched with it and shown from a blob URL.
function useAttachmentUrl(attachment: ChatAttachment, token?: string) {
  const [blobUrl, setBlobUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const wanted = Boolean(token) && attachment.kind === 'image';
  useEffect(() => {
    if (!wanted || !token) return;
    let url = '', active = true;
    adminMessagesAPI.attachment(token, attachment.url).then(blob => {
      url = URL.createObjectURL(blob);
      if (active) setBlobUrl(url); else URL.revokeObjectURL(url);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [wanted, token, attachment.url]);
  return {src:token ? blobUrl : attachment.url, failed};
}

async function downloadWithToken(token: string, attachment: ChatAttachment) {
  const url = URL.createObjectURL(await adminMessagesAPI.attachment(token, attachment.url, true));
  const a = document.createElement('a');
  a.href = url; a.download = attachment.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function FileCard({ attachment, mine, token }: { attachment: ChatAttachment; mine: boolean; token?: string }) {
  const [error, setError] = useState('');
  const className = `flex items-center gap-3 rounded-xl px-3 py-2 text-left w-full min-w-0 ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-black/5 hover:bg-black/10'}`;
  const inner = <>
    <FileText size={26} className="shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1">
      <span dir="auto" className="block truncate font-semibold text-sm">{attachment.name}</span>
      <span className="block text-xs opacity-75">{formatBytes(attachment.size)}{error ? ` · ${error}` : ''}</span>
    </span>
    <Download size={18} className="shrink-0" aria-hidden="true" />
  </>;
  if (token) return (
    <button type="button" className={className} aria-label={`Unduh ${attachment.name}`}
      onClick={() => { setError(''); downloadWithToken(token, attachment).catch(() => setError('gagal mengunduh')); }}>{inner}</button>
  );
  return <a href={`${attachment.url}?download=1`} download={attachment.name} className={className} aria-label={`Unduh ${attachment.name}`}>{inner}</a>;
}

function ImageAttachment({ attachment, mine, token }: { attachment: ChatAttachment; mine: boolean; token?: string }) {
  const {src, failed} = useAttachmentUrl(attachment, token);
  const [broken, setBroken] = useState(false);
  if (failed || broken) return <FileCard attachment={attachment} mine={mine} token={token} />;
  if (!src) return <div className="w-56 max-w-full h-40 rounded-xl bg-black/10 animate-pulse" aria-label="Memuat gambar" />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block" title={`Buka ${attachment.name}`}>
      <img src={src} alt={attachment.name} loading="lazy" onError={() => setBroken(true)}
        className="block max-w-full max-h-64 rounded-xl object-contain bg-black/5" />
    </a>
  );
}

export function MessageBody({ message, mine, token }: { message: ChatMessage; mine: boolean; token?: string }) {
  const attachment = message.attachment;
  return <>
    {attachment && <div className={message.body ? 'mb-1.5' : ''}>
      {attachment.kind === 'image' ? <ImageAttachment attachment={attachment} mine={mine} token={token} /> : <FileCard attachment={attachment} mine={mine} token={token} />}
    </div>}
    <MessageText text={message.body} mine={mine} />
  </>;
}

// Sender-side receipt next to the time: ✓ stored on the server, ✓✓ (highlighted) read by the other side.
export function ReadTicks({ read }: { read: boolean }) {
  const Icon = read ? CheckCheck : Check, label = read ? 'Dibaca' : 'Terkirim';
  return (
    <span role="img" aria-label={label} title={label} className={`inline-flex shrink-0 ${read ? 'text-sky-300' : 'opacity-80'}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}

// Time under a bubble, plus the receipt on one's own messages.
export function MessageMeta({ message, mine, read, full = false, className = '' }: { message: ChatMessage; mine: boolean; read?: boolean; full?: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${className}`}>
      <time dateTime={message.created_at}>{messageTime(message.created_at, full)}</time>
      {mine && read !== undefined && <ReadTicks read={read} />}
    </div>
  );
}

// Admin switches for the open conversation only: may this visitor send files and/or pictures?
export function ThreadPermissions({ thread, saving, onChange, compact = false }: {
  thread: {allow_files?: number; allow_images?: number} | null;
  saving: boolean;
  onChange: (value: {allowFiles: boolean; allowImages: boolean}) => void;
  compact?: boolean;
}) {
  if (!thread) return null;
  const allowFiles = Boolean(thread.allow_files), allowImages = Boolean(thread.allow_images);
  const box = 'w-4 h-4 accent-[var(--app-primary)]';
  return (
    <fieldset disabled={saving} className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-black/[0.03] px-3 py-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      <legend className="sr-only">Izin lampiran untuk pengunjung ini</legend>
      <span className="font-semibold opacity-80">Izinkan pengunjung ini:</span>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" className={box} checked={allowFiles} onChange={e => onChange({allowFiles:e.target.checked, allowImages})} /> kirim file
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" className={box} checked={allowImages} onChange={e => onChange({allowFiles, allowImages:e.target.checked})} /> kirim gambar
      </label>
      {saving && <span className="opacity-60" role="status">Menyimpan…</span>}
    </fieldset>
  );
}

export type PendingAttachment ={file: File; kind: 'image'|'file'; preview: string};

const pastedName = (file: File) => {
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const d = new Date(), pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `tempelan-${stamp}.${ext}`;
};

// One pending attachment per message: picked with a button, pasted from the clipboard, or dropped on the form.
export function useAttachmentDraft(settings: MessageSettings, admin = false) {
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const [error, setError] = useState('');
  const previewRef = useRef('');
  const release = () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = ''; };
  useEffect(() => release, []);

  const pick = useCallback((file: File | null | undefined, pasted = false) => {
    if (!file) return false;
    const named = pasted && (!file.name || /^image\.\w+$/i.test(file.name)) ? new File([file], pastedName(file), {type:file.type}) : file;
    const check = checkAttachment(named, settings, admin);
    if ('error' in check) { setError(check.error); return false; }
    release();
    const preview = check.kind === 'image' ? URL.createObjectURL(named) : '';
    previewRef.current = preview;
    setPending({file:named, kind:check.kind, preview}); setError('');
    return true;
  }, [settings, admin]);

  const clear = useCallback(() => { release(); setPending(null); }, []);

  // Text in the clipboard wins (copying from a document often carries a picture of the text as well).
  const onPaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = e.clipboardData.files?.[0];
    if (!file || e.clipboardData.getData('text/plain')) return;
    e.preventDefault();
    pick(file, true);
  }, [pick]);

  const dropProps = {
    onDragOver:(e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); },
    onDrop:(e: DragEvent) => { const file = e.dataTransfer.files?.[0]; if (file) { e.preventDefault(); pick(file); } },
  };
  const canImage = admin || settings.allowImages, canFile = admin || settings.allowFiles;
  return {pending, error, setError, pick, clear, onPaste, dropProps, canImage, canFile};
}

export function AttachmentButtons({ draft, disabled }: { draft: ReturnType<typeof useAttachmentDraft>; disabled?: boolean }) {
  const imageRef = useRef<HTMLInputElement>(null), fileRef = useRef<HTMLInputElement>(null);
  if (!draft.canImage && !draft.canFile) return null;
  const button = 'shrink-0 grid place-items-center w-10 h-10 rounded-full hover:bg-black/5 disabled:opacity-50 text-[var(--app-primary)]';
  const take = (input: HTMLInputElement | null) => { draft.pick(input?.files?.[0]); if (input) input.value = ''; };
  return <>
    {draft.canImage && <>
      <input ref={imageRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={e => take(e.currentTarget)} tabIndex={-1} aria-hidden="true" />
      <button type="button" className={button} disabled={disabled} onClick={() => imageRef.current?.click()} aria-label="Lampirkan gambar" title="Lampirkan gambar (atau tempel dengan Ctrl+V)"><ImagePlus size={20} /></button>
    </>}
    {draft.canFile && <>
      <input ref={fileRef} type="file" accept={FILE_ACCEPT} className="hidden" onChange={e => take(e.currentTarget)} tabIndex={-1} aria-hidden="true" />
      <button type="button" className={button} disabled={disabled} onClick={() => fileRef.current?.click()} aria-label="Lampirkan file" title="Lampirkan file (PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP)"><Paperclip size={20} /></button>
    </>}
  </>;
}

export function PendingAttachmentChip({ draft }: { draft: ReturnType<typeof useAttachmentDraft> }) {
  const pending = draft.pending;
  if (!pending) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-[var(--reader-bg)] p-2">
      {pending.preview ? <img src={pending.preview} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <FileText size={28} className="text-[var(--app-primary)] mx-1" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <div dir="auto" className="truncate text-sm font-semibold">{pending.file.name}</div>
        <div className="text-xs opacity-70">{pending.kind === 'image' ? 'Gambar' : 'File'} · {formatBytes(pending.file.size)}</div>
      </div>
      <button type="button" onClick={draft.clear} aria-label="Batalkan lampiran" className="p-1.5 rounded-full hover:bg-black/10"><X size={16} /></button>
    </div>
  );
}
