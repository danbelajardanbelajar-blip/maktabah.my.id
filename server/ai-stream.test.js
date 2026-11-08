import test from 'node:test';import assert from 'node:assert/strict';import {readAiResponse} from '../src/lib/ai-stream.ts';
const response=events=>new Response(events.map(e=>JSON.stringify(e)).join('\n')+'\n',{headers:{'content-type':'application/x-ndjson'}});
test('AI stream decodes split UTF8, reports stages and only resolves a complete result',async()=>{
 const text=JSON.stringify({type:'stage',stage:'answering',message:'Menyusun jawaban…'})+'\n'+JSON.stringify({type:'result',data:{status:'success',answer:'صلاة'}})+'\n';
 const bytes=new TextEncoder().encode(text);let offset=0,seen=[];
 const stream=new ReadableStream({pull(c){if(offset>=bytes.length)return c.close();c.enqueue(bytes.slice(offset,offset+3));offset+=3;}});
 const res=await readAiResponse(new Response(stream,{headers:{'content-type':'application/x-ndjson'}}),m=>seen.push(m));
 assert.equal(res.answer,'صلاة');assert.deepEqual(seen,['Menyusun jawaban…']);
 await assert.rejects(readAiResponse(response([{type:'heartbeat'}])),/terputus/);
 await assert.rejects(readAiResponse(response([{type:'error',httpStatus:409,message:'internal'}])),e=>e.status===409&&e.message.includes('pembaruan database'));
 await assert.rejects(readAiResponse(new Response('gateway',{status:504})),e=>e.status===504);
 assert.equal((await readAiResponse(new Response(JSON.stringify({status:'success',answer:'legacy'})))).answer,'legacy');
});
