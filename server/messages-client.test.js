import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MESSAGE_SETTINGS,checkAttachment,formatBytes,mergeMessages,messagePreview,nextScrollHidden} from '../src/lib/messages.ts';
import {linkifyText,safeHref} from '../src/lib/linkify.ts';
import {adminGroup,adminLocation,adminParent,adminTitle} from '../src/lib/admin-navigation.ts';

test('the floating message button hides on scroll down, returns on scroll up and near the top', () => {
  assert.deepEqual(nextScrollHidden(0, 400, false), {hidden:true, anchor:400});
  assert.deepEqual(nextScrollHidden(400, 404, true), {hidden:true, anchor:400}, 'small jitter is ignored');
  assert.deepEqual(nextScrollHidden(400, 300, true), {hidden:false, anchor:300});
  assert.deepEqual(nextScrollHidden(300, 40, true), {hidden:false, anchor:40});
});

test('live and reloaded messages merge once, in order', () => {
  const m = (id, body = String(id)) => ({id, sender:'visitor', body, created_at:''});
  const current = [m(1), m(3)];
  assert.equal(mergeMessages(current, []), current);
  assert.deepEqual(mergeMessages(current, [m(2), m(3, 'baru')]).map(x => [x.id, x.body]), [[1, '1'], [2, '2'], [3, 'baru']]);
});

test('links in messages become http(s) links without swallowing punctuation', () => {
  const links = text => linkifyText(text).filter(p => p.type === 'link').map(p => p.href);
  assert.deepEqual(linkifyText('Lihat https://maktab.my.id/#/cari?q=hukum.'), [
    {type:'text', text:'Lihat '}, {type:'link', text:'https://maktab.my.id/#/cari?q=hukum', href:'https://maktab.my.id/#/cari?q=hukum'}, {type:'text', text:'.'},
  ]);
  assert.deepEqual(links('(www.google.com)'), ['https://www.google.com/']);
  assert.deepEqual(links('https://en.wikipedia.org/wiki/Foo_(bar), ok'), ['https://en.wikipedia.org/wiki/Foo_(bar)']);
  assert.deepEqual(links('رابط: https://example.com/صفحة، شكرا'), ['https://example.com/%D8%B5%D9%81%D8%AD%D8%A9']);
  assert.deepEqual(links('dua link http://a.com dan https://b.org/x?y=1!'), ['http://a.com/', 'https://b.org/x?y=1']);
  for (const text of ['javascript:alert(1)', 'data:text/html,<b>', 'surel a@www.x.com', 'https://user:pass@x.com', 'http://localhost:3000', 'xhttps://a.com'])
    assert.deepEqual(links(text), [], text);
  assert.equal(safeHref('JaVaScRiPt:alert(1)'), null);
  const plain = linkifyText('tanpa tautan\nbaris dua');
  assert.deepEqual(plain, [{type:'text', text:'tanpa tautan\nbaris dua'}]);
});

test('attachment checks follow the admin switches, types and sizes; admins skip the switches', () => {
  const on = {...DEFAULT_MESSAGE_SETTINGS, allowFiles:true, allowImages:true};
  assert.deepEqual(checkAttachment({name:'a.png', type:'image/png', size:10}, on), {kind:'image'});
  assert.deepEqual(checkAttachment({name:'surat.PDF', type:'application/pdf', size:10}, on), {kind:'file'});
  assert.match(checkAttachment({name:'a.png', type:'image/png', size:10}, DEFAULT_MESSAGE_SETTINGS).error, /gambar/);
  assert.match(checkAttachment({name:'a.pdf', type:'', size:10}, DEFAULT_MESSAGE_SETTINGS).error, /file/);
  assert.deepEqual(checkAttachment({name:'a.pdf', type:'', size:10}, DEFAULT_MESSAGE_SETTINGS, true), {kind:'file'});
  assert.match(checkAttachment({name:'a.svg', type:'image/svg+xml', size:10}, on).error, /tidak didukung/);
  assert.match(checkAttachment({name:'a.exe', type:'', size:10}, on).error, /tidak didukung/);
  assert.match(checkAttachment({name:'a.png', type:'image/png', size:on.maxImageBytes + 1}, on).error, /maksimal 8,0 MB/);
  assert.match(checkAttachment({name:'a.zip', type:'', size:0}, on).error, /kosong/);
  assert.equal(formatBytes(512), '512 B');assert.equal(formatBytes(2048), '2 KB');
  assert.equal(messagePreview({id:1, sender:'visitor', body:'', created_at:'', attachment:{kind:'image', name:'x.png', mime:'image/png', size:1, url:''}}), '📷 x.png');
  assert.equal(messagePreview({id:1, sender:'visitor', body:'halo', created_at:''}), 'halo');
});

test('visitor messages are an admin view under Masukan', () => {
  assert.equal(adminLocation('#/admin?view=messages').view, 'messages');
  assert.equal(adminGroup('messages'), 'Masukan');assert.equal(adminParent('messages'), 'categories');assert.equal(adminTitle('messages'), 'Pesan Pengunjung');
});
