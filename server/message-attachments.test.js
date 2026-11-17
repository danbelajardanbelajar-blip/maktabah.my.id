import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTACHMENT_LIMITS,cleanAttachmentName,contentDisposition,detectImage,parseAttachment} from './message-attachments.js';

const b64 = value => Buffer.from(value).toString('base64');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

test('images are recognised by their bytes and renamed to the real format', () => {
  assert.equal(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(detectImage(PNG), 'png');
  assert.equal(detectImage(Buffer.from('GIF89a....')), 'gif');
  assert.equal(detectImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(detectImage(Buffer.from('<svg/>')), null);
  const parsed = parseAttachment({name:'foto.jpeg', data:PNG.toString('base64')});
  assert.equal(parsed.kind, 'image');assert.equal(parsed.mime, 'image/png');assert.equal(parsed.name, 'foto.png');
  assert.equal(parseAttachment({name:'', data:'data:image/png;base64,' + PNG.toString('base64')}).name, 'gambar.png');
});

test('documents need a matching signature; scripts, SVG and unknown types are refused', () => {
  assert.equal(parseAttachment({name:'a.pdf', data:b64('%PDF-1.7 x')}).mime, 'application/pdf');
  assert.equal(parseAttachment({name:'a.docx', data:b64('PK\x03\x04rest')}).kind, 'file');
  assert.equal(parseAttachment({name:'catatan.txt', data:b64('السلام عليكم\nhalo')}).mime, 'text/plain; charset=utf-8');
  for (const [name, data, pattern] of [
    ['a.pdf', b64('<html>'), /tidak sesuai/], ['a.txt', b64('a\0b'), /tidak sesuai/], ['a.svg', b64('<svg/>'), /JPG, PNG/],
    ['a.png', b64('<html>'), /JPG, PNG/], ['a.html', b64('<html>'), /tidak didukung/], ['a.exe', b64('MZ'), /tidak didukung/], ['tanpa-ekstensi', b64('x'), /tidak didukung/],
  ]) assert.throws(() => parseAttachment({name, data}), pattern, name);
  for (const input of [null, {}, {data:''}, {data:'%%%'}, {name:'a.pdf', data:42}]) assert.throws(() => parseAttachment(input), /tidak valid/);
});

test('size limits differ for images and files', () => {
  const bigImage = Buffer.concat([PNG, Buffer.alloc(ATTACHMENT_LIMITS.imageBytes)]);
  assert.throws(() => parseAttachment({name:'a.png', data:bigImage.toString('base64')}), e => e.status === 413 && /gambar maksimal 8 MB/.test(e.message));
  const bigFile = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(ATTACHMENT_LIMITS.fileBytes)]);
  assert.throws(() => parseAttachment({name:'a.pdf', data:bigFile.toString('base64')}), e => e.status === 413 && /file maksimal 10 MB/.test(e.message));
  assert.equal(parseAttachment({name:'a.pdf', data:Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(9 * 1024 * 1024)]).toString('base64')}).kind, 'file');
});

test('names lose paths and control characters, and downloads keep Unicode names', () => {
  assert.equal(cleanAttachmentName('..\\..\\etc/passwd.pdf', 'pdf'), 'passwd.pdf');
  assert.equal(cleanAttachmentName('a‮fdp.exe', 'pdf'), 'afdp.pdf');
  assert.equal(cleanAttachmentName('.pdf', 'pdf'), 'lampiran.pdf');
  assert.equal(cleanAttachmentName('x'.repeat(300) + '.pdf', 'pdf').length, ATTACHMENT_LIMITS.name);
  assert.equal(contentDisposition('attachment', 'كتاب "1".pdf'), `attachment; filename="____ _1_.pdf"; filename*=UTF-8''${encodeURIComponent('كتاب "1".pdf')}`);
});
