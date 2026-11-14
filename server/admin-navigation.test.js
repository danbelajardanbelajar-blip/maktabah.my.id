import test from 'node:test';
import assert from 'node:assert/strict';
import {adminParent,adminTitle,adminLocation,adminGroups,adminGroup} from '../src/lib/admin-navigation.ts';

test('every non-root admin view has a working parent and an accurate title',()=>{
  for(const view of ['books','pages','edit_page','transfer','feedback','requests','submissions','ai_settings','storage','log_search','log_download','log_visit','log_quran','log_rowa','log_ask']) {
    assert.ok(adminParent(view));assert.notEqual(adminParent(view),view);assert.ok(adminTitle(view));
  }
  assert.equal(adminParent('pages'),'books');assert.equal(adminParent('edit_page'),'pages');
  assert.equal(adminTitle('ai_settings'),'Pengaturan AI');assert.equal(adminTitle('transfer'),'Import / Export');
});
test('admin routes restore nested entities and all menu views belong to exactly one group',()=>{
  assert.deepEqual(adminLocation('#/admin?view=edit_page&cat=0&book=12&pid=7'),{view:'edit_page',categoryId:0,bookId:12,pageId:7});
  assert.equal(adminLocation('#/admin?view=garbage&cat=-1').view,'categories');
  assert.equal(adminLocation('#/admin?view=constructor').view,'categories');
  const views=adminGroups.flatMap(g=>g.views);assert.equal(new Set(views).size,views.length);
  assert.equal(adminGroup('edit_page'),'Kitab');assert.equal(adminGroup('storage'),'Pengaturan');
  for(const view of ['log_hadith','log_authors']){assert.equal(adminLocation(`#/admin?view=${view}`).view,view);assert.equal(adminGroup(view),'Aktivitas');}
});
