import test from 'node:test';
import assert from 'node:assert/strict';
import {staticCacheControl} from './static-cache.js';
import {selectedFontsUrl} from '../src/lib/fonts.ts';

test('versioned assets can be reused while HTML and unversioned files stay refreshable',()=>{
  assert.equal(staticCacheControl('/app/dist/assets/index.dev-vcOle8HE.js'),'public, max-age=31536000, immutable');
  assert.equal(staticCacheControl('/app/dist/assets/index-Cjurx9qf.css'),'public, max-age=31536000, immutable');
  for(const name of ['index.dev.html','privacy-policy/index.html'])assert.equal(staticCacheControl('/app/dist/'+name),'no-cache');
  assert.equal(staticCacheControl('/app/dist/logo.png'),'public, max-age=3600');
  assert.equal(staticCacheControl('/app/dist/assets/app.js'),'public, max-age=3600');
});
test('only the two chosen font families load, with defaults for invalid saved choices',()=>{
  const url=new URL(selectedFontsUrl('Amiri','Inter'));
  assert.equal(url.searchParams.getAll('family').length,2);assert.equal(url.searchParams.get('display'),'swap');
  assert.match(url.searchParams.getAll('family')[0],/^Amiri:/);
  const changed=new URL(selectedFontsUrl('Lateef','Roboto'));
  assert.match(changed.searchParams.getAll('family')[0],/^Lateef:/);
  assert.match(changed.searchParams.getAll('family')[1],/^Roboto:/);
  assert.equal(selectedFontsUrl('constructor','unknown'),selectedFontsUrl('Amiri','Inter'));
});
