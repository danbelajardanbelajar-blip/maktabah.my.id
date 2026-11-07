import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreAdminEntities} from '../src/lib/admin-loader.ts';
import {adminLocation} from '../src/lib/admin-navigation.ts';

const category={id:0,name:'Tanpa kategori',catord:0,lvl:0,book_count:2};
const book={bkid:12,bk:'Kitab A',cat:0,category:category.name};
const api={book:async()=>({data:book}),categories:async()=>({data:[category]}),page:async(book,id)=>({data:{book_id:book,id,part:1,page:1,nass:'Isi halaman'}})};

test('refresh restores category zero, book metadata and editor from actual API response shape',async()=>{
  const result=await restoreAdminEntities(adminLocation('#/admin?view=edit_page&book=12&pid=0'),{},api);
  assert.equal(result.category.id,0);assert.equal(result.book.bkid,12);
  assert.equal(result.page.id,0);assert.equal(result.page.preview,'Isi halaman');
  const list=await restoreAdminEntities(adminLocation('#/admin?view=books&cat=0'),{},api);
  assert.equal(list.category.id,0);assert.equal(list.book,null);assert.equal(list.page,null);
});

test('restoration replaces stale book/page context and reports missing entities for retry UI',async()=>{
  const route=adminLocation('#/admin?view=edit_page&cat=99&book=12&pid=0');
  const result=await restoreAdminEntities(route,{book:{bkid:99,cat:99},page:{id:0,book_id:99}},api);
  assert.equal(result.book.bkid,12);assert.equal(result.category.id,0);assert.equal(result.page.book_id,12);
  await assert.rejects(restoreAdminEntities(route,{}, {...api,book:async()=>({})}),/Kitab tidak ditemukan/);
  await assert.rejects(restoreAdminEntities(route,{}, {...api,categories:async()=>({data:[]})}),/Kategori tidak ditemukan/);
  await assert.rejects(restoreAdminEntities(route,{}, {...api,page:async()=>({})}),/Halaman tidak ditemukan/);
  await assert.rejects(restoreAdminEntities(route,{}, {...api,categories:async()=>{throw new Error('401');}}),/401/);
});
