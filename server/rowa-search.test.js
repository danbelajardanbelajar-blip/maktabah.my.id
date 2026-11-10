import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {searchRowa} from './rowa-search.js';
import {rowaFullName} from '../src/lib/rowa-name.ts';

const full='أحمد بن إبراهيم بن فيل الأسدي أبو الحسن البالسي الأنطاكي';
const builders={
  buildLikeMatch:q=>q,
  buildFtsMatch:q=>({exactPhrase:`"${q}"`,andMatch:q.includes(' ')?`(${q.split(' ').map(w=>`"${w}"`).join(' AND ')}) NOT "${q}"`:''}),
};
function fixture(fts=false,iso=true) {
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE rowa(id INTEGER PRIMARY KEY,Name TEXT,A_esm TEXT,${iso?'IsoName TEXT,':''}A_kona TEXT,ROTBA TEXT,R_ZAHBI TEXT,birth TEXT,death TEXT)`);
  if(iso)db.prepare('INSERT INTO rowa(id,Name,A_esm,IsoName) VALUES(1,?,?,?)').run('','',full);
  else db.prepare('INSERT INTO rowa(id,Name,A_esm) VALUES(1,?,?)').run('أحمد',full);
  if(fts)db.exec("CREATE VIRTUAL TABLE rowa_fts USING fts5(Name,IsoName,content='rowa',content_rowid='id'); INSERT INTO rowa_fts(rowa_fts) VALUES('rebuild')");
  return db;
}
test('FTS results return the complete IsoName even when both display-name fields are empty',()=>{
  const db=fixture(true);
  try {
    const result=searchRowa(db,{q:'أحمد بن إبراهيم',limit:1},builders);
    assert.equal(result.total,1);assert.equal(result.data[0].IsoName,full);
    assert.equal(rowaFullName(result.data[0]),full);
    assert.equal(searchRowa(db,{q:'أحمد بن إبراهيم',page:2,limit:1},builders).data.length,0);
  } finally {db.close();}
});
test('LIKE fallback searches complete IsoName, and older schemas without IsoName still work',()=>{
  for(const iso of [true,false]) {
    const db=fixture(false,iso);
    try {const result=searchRowa(db,{q:'الأنطاكي'},builders);assert.equal(result.total,1);assert.equal(rowaFullName(result.data[0]),full);}
    finally {db.close();}
  }
});
test('full names take precedence, with safe fallbacks for missing and whitespace-only data',()=>{
  assert.equal(rowaFullName({Name:'أحمد',A_esm:` ${full} `,IsoName:'other'}),full);
  assert.equal(rowaFullName({Name:' الاسم ',A_esm:'  '}),'الاسم');
  assert.equal(rowaFullName({Name:' ',A_esm:null,IsoName:` ${full} `}),full);
  assert.equal(rowaFullName({}),'Nama tidak tersedia');
});

test('searchRowa automatically extracts hadith books from telmez when kutub column is absent', () => {
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE rowa(id INTEGER PRIMARY KEY,Name TEXT,A_esm TEXT,IsoName TEXT,A_kona TEXT,ROTBA TEXT,R_ZAHBI TEXT,birth TEXT,death TEXT,telmez TEXT)`);
    db.prepare('INSERT INTO rowa(id,Name,A_esm,IsoName,telmez) VALUES(1,?,?,?,?)').run('', '', full, 'B # # مسلم # أبو داود # الترمذى');
    const result = searchRowa(db, { q: 'أحمد' }, builders);
    assert.equal(result.total, 1);
    assert.ok(result.data[0].kutub.includes('صحيح مسلم'));
    assert.ok(result.data[0].kutub.includes('سنن أبي داود'));
    assert.ok(result.data[0].kutub.includes('جامع الترمذي'));
    assert.equal(result.data[0].telmez, undefined);
  } finally {
    db.close();
  }
});
