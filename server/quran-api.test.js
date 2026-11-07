import test from 'node:test';
import assert from 'node:assert/strict';
import {webAPI} from '../src/api.ts';

test('Quran requests honor cancellation and preserve successful API data',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async(_url,{signal})=>new Promise((_resolve,reject)=>{
      const cancel=()=>reject(new DOMException('Aborted','AbortError'));
      if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
    });
    const controller=new AbortController();
    const pending=webAPI.getQuranAyahs(2,controller.signal);
    controller.abort();
    await assert.rejects(pending,{name:'AbortError'});
    await assert.rejects(webAPI.getTafsirPage(77,5,controller.signal),{name:'AbortError'});
    globalThis.fetch=async()=>({ok:true,json:async()=>({data:[{id:1,name:'الفاتحة'}]})});
    assert.deepEqual(await webAPI.getQuranSurahs(),{data:[{id:1,name:'الفاتحة'}]});
  } finally {globalThis.fetch=original;}
});
