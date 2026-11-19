import fs from 'node:fs';import path from 'node:path';
import Database from 'better-sqlite3';
import {normalizeIdentity,authorStats} from '../server/author-package.js';

// Keeps author links from an older package when a newer package does not link that book at all.
// Example: a newer Shamela source may lack authors that an older source had (and the site showed).
// Books the new package already attributes are never touched, so newer data always wins.
// Usage: node scripts/merge-author-packages.js new.db previous.db output.db
const [basePath,previousPath,output]=process.argv.slice(2);
if(!output)throw Error('Usage: node scripts/merge-author-packages.js new.db previous.db output.db');
if(fs.existsSync(output))throw Error('Output sudah ada; gunakan nama baru.');
fs.copyFileSync(basePath,output,fs.constants.COPYFILE_EXCL);
let dst,prev;
try {
  dst=new Database(output);dst.pragma('foreign_keys=ON');
  prev=new Database(previousPath,{readonly:true,fileMustExist:true});
  const prevSource=prev.prepare('SELECT source,created_at FROM manifest').get();
  const byKey=new Map();for(const a of dst.prepare('SELECT id,name_key FROM authors').all())byKey.set(a.name_key,[...(byKey.get(a.name_key)||[]),a.id]);
  const linked=new Set(dst.prepare('SELECT DISTINCT book_id FROM attributions').all().map(r=>r.book_id));
  const hasWork=dst.prepare('SELECT 1 FROM works WHERE book_id=?'),idTaken=dst.prepare('SELECT 1 FROM authors WHERE id=?');
  const putAuthor=dst.prepare('INSERT INTO authors VALUES(?,?,?,?,?,?)'),putLink=dst.prepare('INSERT OR IGNORE INTO attributions VALUES(?,?,?,?)');
  let nextId=dst.prepare('SELECT max(id) n FROM authors').get().n||0;
  const mapped=new Map();let links=0,reusedAuthors=0,addedAuthors=0,skippedBooks=0;
  dst.transaction(()=>{
    for(const r of prev.prepare('SELECT t.book_id,t.author_id,t.basis,t.evidence,a.name,a.biography,a.death_text,a.source_ref FROM attributions t JOIN authors a ON a.id=t.author_id ORDER BY t.book_id').iterate()) {
      if(linked.has(r.book_id))continue;
      if(!hasWork.get(r.book_id)){skippedBooks++;continue;}
      if(!mapped.has(r.author_id)) {
        const key=normalizeIdentity(r.name),same=byKey.get(key)||[];
        if(same.length===1){mapped.set(r.author_id,same[0]);reusedAuthors++;}
        else {
          const id=same.length===0&&!idTaken.get(r.author_id)?r.author_id:++nextId;
          putAuthor.run(id,r.name,r.biography,r.death_text,`${r.source_ref} (dari paket sebelumnya)`,key);
          byKey.set(key,[id]);mapped.set(r.author_id,id);addedAuthors++;
        }
      }
      links+=putLink.run(r.book_id,mapped.get(r.author_id),r.basis,`${r.evidence} Dipertahankan dari paket ${prevSource.created_at.slice(0,10)} (${prevSource.source}) karena sumber baru tidak menautkan kitab ini.`.slice(0,10000)).changes;
    }
    const authors=dst.prepare('SELECT count(*) n FROM authors').get().n,m=dst.prepare('SELECT source FROM manifest').get();
    dst.prepare('UPDATE manifest SET authors=?,source=?,created_at=?').run(authors,`${m.source} + relasi lama dipertahankan dari ${path.basename(previousPath)}`.slice(0,1000),new Date().toISOString());
  })();
  if(dst.pragma('integrity_check',{simple:true})!=='ok'||dst.pragma('foreign_key_check').length)throw Error('Integritas paket gagal.');
  console.log(JSON.stringify({output:path.resolve(output),...authorStats(dst),keptLinks:links,reusedAuthors,addedAuthors,skippedBooksNotInLibrary:skippedBooks},null,2));
  dst.close();dst=null;
}catch(e){if(dst?.open)dst.close();fs.rmSync(output,{force:true});throw e;}
finally{prev?.close();}
