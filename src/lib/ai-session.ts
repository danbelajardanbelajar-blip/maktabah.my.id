import {legacyAiError} from './ai-errors.ts';
import {readAiSource} from './ai-source.ts';
export const AI_SESSION_KEY = 'maktabah-ai-session';
export function readAiSession(storage: {getItem:(key:string)=>string|null}) {
  try {
    const data = JSON.parse(storage.getItem(AI_SESSION_KEY) || '{}');
    const messages = Array.isArray(data.messages) ? data.messages.filter((m:any)=>m && ['user','ai','error'].includes(m.role) && typeof m.content==='string' && m.content.length<=30000).slice(-60).map((m:any)=>({
      role:m.role,content:m.role==='error'?legacyAiError(m.content):m.content,
      ...(m.references ? {references:Array.isArray(m.references)?m.references.filter((r:any)=>r && Number.isSafeInteger(r.bkid) && r.bkid>0 && typeof r.title==='string' && (r.pageId==null || Number.isSafeInteger(r.pageId))).slice(0,8):[]} : {}),
    })) : [];
    const input = typeof data.input==='string' ? data.input.slice(0,1500) : '';
    if(data.pending)messages.push({role:'error',content:'Permintaan sebelumnya terputus saat halaman dimuat ulang. Periksa percakapan lalu kirim kembali jika diperlukan.'});
    const source=readAiSource(data.source);
    return {messages,input:input || (data.pending && typeof data.lastQuestion==='string' ? data.lastQuestion.slice(0,1500):''),...(source?{source,intent:data.intent==='translate'?'translate' as const:'explain' as const}: {})};
  } catch { return {messages:[],input:''}; }
}
