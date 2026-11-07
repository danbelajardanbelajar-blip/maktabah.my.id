import test from 'node:test';import assert from 'node:assert/strict';
import {readingPositions,rememberReadingPosition,swipeDirection} from '../src/lib/reading-position.ts';
test('last reading position survives reload, preserves page zero and isolates each book',()=>{
  let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}};
  rememberReadingPosition(storage,{bookId:1,pageId:0,page:0,part:1,title:'A',updatedAt:1});
  rememberReadingPosition(storage,{bookId:2,pageId:8,page:4,part:1,title:'B',updatedAt:2});
  rememberReadingPosition(storage,{bookId:1,pageId:7,page:6,part:1,title:'A',updatedAt:3});
  assert.deepEqual(readingPositions(storage).map(p=>[p.bookId,p.pageId]),[[1,7],[2,8]]);
  raw='broken';assert.deepEqual(readingPositions(storage),[]);
});
test('vertical scrolling, selection and pending loading never turn pages',()=>{
  assert.equal(swipeDirection(70,200),null);assert.equal(swipeDirection(80,10,true),null);
  assert.equal(swipeDirection(80,10,false,true),null);assert.equal(swipeDirection(80,10),'next');assert.equal(swipeDirection(-80,10),'previous');
});
