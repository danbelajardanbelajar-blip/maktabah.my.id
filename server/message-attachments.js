import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Attachments for visitor ↔ admin messages. The type is decided from the file's own bytes, never from the
// name or the browser-supplied MIME type, and only formats that browsers cannot run as a page are accepted
// (no SVG/HTML). Images are shown inline; every other file is served as a download.
export const ATTACHMENT_LIMITS = {imageBytes:8 * 1024 * 1024, fileBytes:10 * 1024 * 1024, name:120, perHour:10, ipPerHour:20};
export const IMAGE_TYPES = {jpg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp'};
export const FILE_TYPES = {
  pdf:'application/pdf', doc:'application/msword', xls:'application/vnd.ms-excel', ppt:'application/vnd.ms-powerpoint',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip:'application/zip', txt:'text/plain; charset=utf-8', csv:'text/csv; charset=utf-8',
};
const EXT_ALIASES = {jpeg:'jpg', jpe:'jpg'};

const starts = (buffer, bytes, offset = 0) => bytes.every((b, i) => buffer[offset + i] === b);
export function detectImage(buffer) {
  if (starts(buffer, [0xff, 0xd8, 0xff])) return 'jpg';
  if (starts(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (buffer.subarray(0, 6).toString('latin1') === 'GIF87a' || buffer.subarray(0, 6).toString('latin1') === 'GIF89a') return 'gif';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}
const isText = buffer => {
  if (buffer.includes(0)) return false;
  try { new TextDecoder('utf-8', {fatal:true}).decode(buffer); return true; } catch { return false; }
};
const FILE_SIGNATURES = {
  pdf:b => b.subarray(0, 5).toString('latin1') === '%PDF-',
  docx:b => starts(b, [0x50, 0x4b, 0x03, 0x04]), xlsx:b => starts(b, [0x50, 0x4b, 0x03, 0x04]),
  pptx:b => starts(b, [0x50, 0x4b, 0x03, 0x04]), zip:b => starts(b, [0x50, 0x4b, 0x03, 0x04]),
  doc:b => starts(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), xls:b => starts(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  ppt:b => starts(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), txt:isText, csv:isText,
};

const reject = (error, status = 400) => Object.assign(new Error(error), {status});
const megabytes = bytes => `${Math.round(bytes / 1024 / 1024)} MB`;

// A display name only: path parts, control/bidi characters and anything outside a short length are removed.
export function cleanAttachmentName(value, ext) {
  let name = String(typeof value === 'string' ? value : '').normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').split(/[\\/]/).pop().replace(/\s+/g, ' ').trim();
  const base = name.replace(/\.[^.]*$/, '').replace(/^\.+/, '').trim() || 'lampiran';
  return `${base.slice(0, ATTACHMENT_LIMITS.name - ext.length - 1)}.${ext}`;
}

// Decodes and validates {name, data} where data is base64 or a data: URL. Returns what will be stored.
export function parseAttachment(input) {
  if (!input || typeof input !== 'object' || typeof input.data !== 'string') throw reject('Lampiran tidak valid.');
  const base64 = input.data.replace(/^data:[^,]{0,200},/, '').replace(/\s+/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw reject('Lampiran tidak valid.');
  if (base64.length * 3 / 4 > ATTACHMENT_LIMITS.fileBytes + 4) throw reject(`Ukuran file maksimal ${megabytes(ATTACHMENT_LIMITS.fileBytes)}.`, 413);
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw reject('Lampiran kosong.');
  const named = String(input.name || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] || '';
  const claimed = EXT_ALIASES[named] || named;
  const image = detectImage(buffer);
  if (image) {
    if (buffer.length > ATTACHMENT_LIMITS.imageBytes) throw reject(`Ukuran gambar maksimal ${megabytes(ATTACHMENT_LIMITS.imageBytes)}.`, 413);
    return {kind:'image', ext:image, mime:IMAGE_TYPES[image], name:cleanAttachmentName(input.name || 'gambar', image), buffer};
  }
  if (IMAGE_TYPES[claimed] || named === 'svg') throw reject('Gambar harus berformat JPG, PNG, GIF, atau WEBP.');
  if (!FILE_TYPES[claimed]) throw reject('Jenis file tidak didukung. Gunakan PDF, Word, Excel, PowerPoint, TXT, CSV, atau ZIP.');
  if (!FILE_SIGNATURES[claimed](buffer)) throw reject('Isi file tidak sesuai dengan jenisnya.');
  return {kind:'file', ext:claimed, mime:FILE_TYPES[claimed], name:cleanAttachmentName(input.name, claimed), buffer};
}

export function createAttachmentStorage(dir) {
  const resolve = file => {
    if (!/^[a-f0-9-]{36}\.[a-z0-9]{1,5}$/.test(String(file || ''))) return null;
    return path.join(dir, file);
  };
  return {
    save(parsed) {
      fs.mkdirSync(dir, {recursive:true});
      const file = `${crypto.randomUUID()}.${parsed.ext}`;
      fs.writeFileSync(path.join(dir, file), parsed.buffer, {flag:'wx'});
      return file;
    },
    resolve,
    remove(files) { for (const file of files) { const full = resolve(file); if (full) fs.rm(full, {force:true}, () => {}); } },
  };
}

// RFC 6266 filename: an ASCII fallback plus the UTF-8 name, so Arabic names survive downloads.
export function contentDisposition(type, name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
