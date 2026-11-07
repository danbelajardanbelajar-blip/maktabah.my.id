import test from 'node:test';import assert from 'node:assert/strict';
import {readAiSession} from '../src/lib/ai-session.ts';
test('AI session restores conversation and draft without silently resubmitting interrupted questions',()=>{
  const data={messages:[{role:'user',content:'Question'},{role:'ai',content:'Answer',references:[{bkid:1,pageId:2,title:'Book'}]}],input:'Unsent draft'};
  assert.deepEqual(readAiSession({getItem:()=>JSON.stringify(data)}),data);
  const interrupted=readAiSession({getItem:()=>JSON.stringify({...data,input:'',lastQuestion:'Question',pending:true})});
  assert.equal(interrupted.input,'Question');assert.equal(interrupted.messages.at(-1).role,'error');
});
test('malformed saved state cannot crash AI navigation',()=>{
  assert.deepEqual(readAiSession({getItem:()=>'{broken'}),{messages:[],input:''});
  assert.equal(readAiSession({getItem:()=>JSON.stringify({messages:[{role:'system',content:'invalid'}]})}).messages.length,0);
  assert.deepEqual(readAiSession({getItem:()=>JSON.stringify({messages:[{role:'ai',content:'Text',references:'broken'}]})}).messages[0].references,[]);
});
