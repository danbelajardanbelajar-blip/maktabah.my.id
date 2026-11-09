export const COMPACT_MAGIC='MAKTABAH-PARTS-1\n';
export const MAX_COMPACT_RAW=8*1024*1024,MAX_COMPACT_COMPRESSED=MAX_COMPACT_RAW+65536;
export type CompactFrame={offset:number;length:number;hash:string};
export type CompactArchive={file:File;id:string;frames:CompactFrame[];manifest:{kind:string;books:number;pages:number;titles:number;categories:{id:number;name:string}[]}};
const hex=(data:Uint8Array)=>[...data].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function openCompact(file:File,onProgress?:(percent:number)=>void,signal?:AbortSignal):Promise<CompactArchive>{
 const magic=new TextDecoder().decode(await file.slice(0,COMPACT_MAGIC.length).arrayBuffer());
 if(magic!==COMPACT_MAGIC)throw new Error('Pilih file .mkt hasil Export hemat ruang. File .db lama memakai mode SQLite.');
 const frames:CompactFrame[]=[];let offset=COMPACT_MAGIC.length;
 while(offset<file.size){
  if(signal?.aborted)throw new DOMException('Dibatalkan','AbortError');
  if(offset+36>file.size||frames.length>=100000)throw new Error('Susunan bagian file tidak valid.');
  const header=await file.slice(offset,offset+36).arrayBuffer(),length=new DataView(header).getUint32(0);
  if(!length||length>MAX_COMPACT_COMPRESSED||offset+36+length>file.size)throw new Error('File terpotong atau ukuran bagian tidak valid.');
  frames.push({offset:offset+36,length,hash:hex(new Uint8Array(header,4,32))});offset+=36+length;
  if(frames.length%100===0)onProgress?.(Math.round(offset/file.size*100));
 }
 if(frames.length<2)throw new Error('Paket belum lengkap.');
 const first=frames[0],compressed=await file.slice(first.offset,first.offset+first.length).arrayBuffer();
 if(hex(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed)))!==first.hash)throw new Error('Manifest rusak. Pilih file asli.');
 if(typeof DecompressionStream==='undefined')throw new Error('Browser belum mendukung dekompresi. Gunakan Chrome atau Edge terbaru.');
 const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_COMPACT_RAW)throw new Error('Manifest terlalu besar.');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const raw=new Uint8Array(size);let at=0;for(const chunk of chunks){raw.set(chunk,at);at+=chunk.length;}
 const part=JSON.parse(new TextDecoder().decode(raw));
 if(part.format!=='maktabah-parts'||part.version!==1||part.sequence!==0||!/^[a-f0-9]{48}$/.test(part.id)||part.records?.length!==1||part.records[0]?.type!=='manifest')throw new Error('Manifest paket tidak valid.');
 const manifest=part.records[0].manifest;
 if(!manifest||!Array.isArray(manifest.categories)||!['books','pages','titles'].every(k=>Number.isSafeInteger(manifest[k])&&manifest[k]>=0))throw new Error('Ringkasan paket tidak valid.');
 onProgress?.(100);return {file,id:part.id,frames,manifest};
}
