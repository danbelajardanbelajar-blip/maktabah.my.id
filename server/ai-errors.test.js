import test from 'node:test';
import assert from 'node:assert/strict';
import {webAPI} from '../src/api.ts';
import {AI_DATABASE_BUSY,aiFailureMessage,aiResponseError} from '../src/lib/ai-errors.ts';
import {readAiSession} from '../src/lib/ai-session.ts';

test('database busy responses explain maintenance instead of reporting a connection failure',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({error:'Import atau penghapusan sedang berjalan.'})});
    await assert.rejects(webAPI.askAI('Pertanyaan pengguna'),e=>e.status===409 && aiFailureMessage(e)===AI_DATABASE_BUSY);
    globalThis.fetch=async()=>({ok:false,status:409,json:async()=>{throw new SyntaxError('HTML response');}});
    await assert.rejects(webAPI.askAI('Pertanyaan pengguna'),e=>aiFailureMessage(e)===AI_DATABASE_BUSY);
  } finally {globalThis.fetch=original;}
});
test('saved 409 errors are corrected without changing user questions or AI answers',()=>{
  const old='Gagal terhubung ke server: API error: 409';
  const session=readAiSession({getItem:()=>JSON.stringify({messages:[{role:'error',content:old},{role:'user',content:old},{role:'ai',content:old}]})});
  assert.equal(session.messages[0].content,AI_DATABASE_BUSY);
  assert.equal(session.messages[1].content,old);assert.equal(session.messages[2].content,old);
});
test('server messages and real network failures retain the appropriate explanation',()=>{
  assert.equal(aiFailureMessage(aiResponseError(429,{message:'Kuota tercapai. Tunggu sebentar.'})),'Kuota tercapai. Tunggu sebentar.');
  assert.match(aiFailureMessage(new TypeError('Failed to fetch')),/Periksa jaringan/);
  assert.doesNotMatch(aiFailureMessage(aiResponseError(503,null)),/API error/);
});
