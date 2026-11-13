import test from 'node:test';
import assert from 'node:assert/strict';
import {backState,previousLocation,pushLocation,backFallback} from '../src/lib/back-navigation.ts';

test('author profile fallback restores timeline filters and list page independently from works page',()=>{
  const hash=backFallback('#/penulis?id=54&view=timeline&century=8&initial=م&q=foo&listPage=3&page=2');
  const p=new URLSearchParams(hash.split('?')[1]);assert.equal(p.get('page'),'3');assert.equal(p.get('century'),'8');assert.equal(p.get('view'),'timeline');assert.equal(p.has('id'),false);assert.equal(p.has('listPage'),false);
  assert.equal(p.get('initial'),'م');
});

test('back remembers the exact internal query/page and preserves reader metadata across reload',()=>{
  const origin='https://maktab.my.id';
  const state=backState({maktabahReader:true,bookId:12},origin+'/?admin=1#/cari?q=kitab&page=3');
  assert.equal(state.maktabahReader,true);
  assert.equal(previousLocation(JSON.parse(JSON.stringify(state)),origin+'/?admin=1#/read/12/42'),'/?admin=1#/cari?q=kitab&page=3');
  assert.equal(previousLocation(state,origin+'/?admin=1#/cari?q=kitab&page=3'),null);
});
test('a direct link or untrusted history cannot send the back button outside the application',()=>{
  for(const previous of [undefined,'https://evil.test','//evil.test','/\\evil.test','javascript:alert(1)','/api/admin/books','/other-page','#/beranda']) {
    assert.equal(previousLocation({maktabahPrevious:previous},'https://maktab.my.id/#/tentang'),null);
  }
  assert.equal(previousLocation(null,'https://maktab.my.id/#/tentang'),null);
  assert.equal(backFallback('#/katalog?cat=0&filter=fiqih&page=3'),'#/katalog?filter=fiqih');
  for(const page of ['#/tentang','#/tanya-ai','#/koleksi','#/read/12/1','#/katalog'])assert.equal(backFallback(page),'#/beranda');
});
test('all application pushes store an internal return location without overwriting custom state',()=>{
  const original=globalThis.window;let pushed;
  try {
    globalThis.window={location:{href:'https://maktab.my.id/#/katalog?cat=0'},history:{pushState:(...args)=>{pushed=args;}}};
    pushLocation('#/read/12/0',{maktabahReader:true});
    assert.equal(pushed[0].maktabahPrevious,'/#/katalog?cat=0');
    assert.equal(pushed[0].maktabahReader,true);assert.equal(pushed[2],'#/read/12/0');
  } finally {if(original===undefined)delete globalThis.window;else globalThis.window=original;}
});
