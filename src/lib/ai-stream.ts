import {aiResponseError} from './ai-errors.ts';
const stages=new Set(['searching','preparing','answering','verifying','cached']);
export async function readAiResponse(res:Response,onProgress?:(message:string)=>void):Promise<any>{
 if(!res.ok || !res.headers.get('content-type')?.includes('application/x-ndjson')){
  let data;try{data=await res.json();}catch{throw res.ok?new Error('Jawaban belum diterima dengan lengkap. Silakan coba lagi.'):aiResponseError(res.status,null);}
  if(!res.ok)throw aiResponseError(res.status,data);
  return data;
 }
 if(!res.body)throw new Error('Jawaban belum diterima. Silakan coba lagi.');
 const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
 const parse=(line:string)=>{
  let event;try{event=JSON.parse(line);}catch{throw new Error('Jawaban belum diterima dengan lengkap. Silakan coba lagi.');}
  if(event.type==='error')throw aiResponseError(event.httpStatus || 502,event);
  if(event.type==='stage'&&stages.has(event.stage)&&typeof event.message==='string')onProgress?.(event.message.slice(0,200));
  if(event.type==='result'&&event.data?.status==='success'&&typeof event.data.answer==='string')return event.data;
 };
 try{
  while(true){
   const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});
   if(buffer.length>1000000)throw new Error('Jawaban terlalu panjang. Coba persempit pertanyaan.');
   const lines=buffer.split('\n');buffer=lines.pop() || '';
   for(const line of lines){if(line.trim()){const result=parse(line);if(result)return result;}}
   if(done){if(buffer.trim()){const result=parse(buffer);if(result)return result;}throw new Error('Koneksi jawaban terputus. Pertanyaan tetap tersedia untuk dikirim kembali.');}
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
