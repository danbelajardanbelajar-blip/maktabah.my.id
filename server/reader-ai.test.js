import test from 'node:test';
import assert from 'node:assert/strict';
import {webAPI} from '../src/api.ts';
import {renderMarkdown} from '../src/lib/ai-markdown.ts';

test('reader AI sends selected page context and can cancel an in-flight request',async t=>{
  const controller=new AbortController(),source={bookId:7,pageId:12,text:'النص المختار'};let body;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'/api/ask');body=JSON.parse(options.body);
    assert(options.signal instanceof AbortSignal);
    return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
  });
  const pending=webAPI.askAI('Terjemahkan halaman ini',{intent:'translate',source},undefined,controller.signal);
  controller.abort();await assert.rejects(pending,e=>e.name==='AbortError');
  assert.deepEqual(body,{q:'Terjemahkan halaman ini',intent:'translate',source,stream:true});
});

test('reader and chat AI render formatting while escaping model HTML',()=>{
  const result=renderMarkdown('**Terjemahan**\n- satu\n- dua\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>');
  assert(result.includes('<strong>Terjemahan</strong>'));assert(result.includes('<ul'));assert(result.includes('<li dir="auto">satu</li>'));
  assert(!result.includes('<script>'));assert(!result.includes('<img'));assert(result.includes('&lt;script&gt;'));
});

test('each AI paragraph takes its own text direction',()=>{
  assert(renderMarkdown('**Kutipan sumber**\n\n«نص عربي» [1]').includes('<p class="mb-1" dir="auto">«نص عربي» [1]</p>'));
});
