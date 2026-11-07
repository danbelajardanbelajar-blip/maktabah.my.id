import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReaderData } from '../src/lib/reader-loader.ts';

test('reader distinguishes an invalid link, missing book and missing page', async () => {
  const api = { getBookInfo: async () => ({data:null}), getPage: async () => ({data:null}) };
  await assert.rejects(loadReaderData(api,NaN), /tidak valid/);
  await assert.rejects(loadReaderData(api,1), /Kitab tidak ditemukan/);
  api.getBookInfo = async () => ({data:{bkid:1}});
  await assert.rejects(loadReaderData(api,1), /belum memiliki halaman/);
  await assert.rejects(loadReaderData(api,1,999), /Halaman yang dituju/);
});

test('reader retry can recover and does not reuse metadata from a different book', async () => {
  let failed = true, bookRequests = 0;
  const api = { getBookInfo: async id => {bookRequests++;return {data:{bkid:id}};}, getPage: async () => {
    if (failed) throw new Error('Network interrupted');
    return {data:{id:7,text:'page'}};
  }};
  await assert.rejects(loadReaderData(api,2,7,{bkid:1}),/Network interrupted/);
  failed = false;
  const result = await loadReaderData(api,2,7,{bkid:1});
  assert.equal(result.book.bkid,2);assert.equal(result.page.id,7);assert.equal(bookRequests,2);
  await loadReaderData(api,2,7,{bkid:2});assert.equal(bookRequests,2);
});
