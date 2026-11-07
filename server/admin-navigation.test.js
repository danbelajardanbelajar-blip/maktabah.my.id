import test from 'node:test';
import assert from 'node:assert/strict';
import {adminParent,adminTitle} from '../src/lib/admin-navigation.ts';

test('every non-root admin view has a working parent and an accurate title',()=>{
  for(const view of ['books','pages','edit_page','transfer','feedback','requests','submissions','ai_settings','log_search','log_download','log_visit','log_quran','log_rowa','log_ask']) {
    assert.ok(adminParent(view));assert.notEqual(adminParent(view),view);assert.ok(adminTitle(view));
  }
  assert.equal(adminParent('pages'),'books');assert.equal(adminParent('edit_page'),'pages');
  assert.equal(adminTitle('ai_settings'),'Pengaturan AI');assert.equal(adminTitle('transfer'),'Import / Export');
});
