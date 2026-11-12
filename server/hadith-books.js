import fs from 'node:fs';
import {normalizeIdentity} from './author-package.js';
export const hadithCatalogue=JSON.parse(fs.readFileSync(new URL('./data/hadith-books.json',import.meta.url),'utf8'));

export function hadithBooks(library) {
  const byId=new Map(),conflicts=new Set();
  for(const b of library){
    if(!Number.isSafeInteger(b.bkid)||b.bkid<1||typeof b.bk!=='string'||!b.bk.trim())continue;
    const previous=byId.get(b.bkid);
    if(previous&&normalizeIdentity(previous.bk)!==normalizeIdentity(b.bk))conflicts.add(b.bkid);
    else byId.set(b.bkid,b);
  }
  const books=hadithCatalogue.books.map(({titles,...book})=>{
    const allowed=new Set(titles.map(normalizeIdentity));
    const editions=[...byId.values()].filter(b=>!conflicts.has(b.bkid)&&allowed.has(normalizeIdentity(b.bk)))
      .map(b=>({id:b.bkid,title:b.bk})).sort((a,b)=>a.title.localeCompare(b.title,'ar')||a.id-b.id);
    return {...book,editions};
  });
  return{books,groups:hadithCatalogue.groups,references:hadithCatalogue.references};
}
export function registerHadithBooks(app,getLibrary){
  app.get('/api/hadith-books',(req,res)=>{
    try{res.set('Cache-Control','no-store').json(hadithBooks(getLibrary()));}
    catch{res.status(503).json({error:'Katalog Kutub Hadis belum dapat dimuat. Silakan coba lagi.'});}
  });
}
