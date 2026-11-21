import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {addSearchResultCategories} from './search-result-categories.js';

test('text result category metadata preserves order, fallback and primary identity across libraries',()=>{
  const db=new Database(':memory:');
  try{
    db.exec(`CREATE TABLE books_meta(bkid INTEGER PRIMARY KEY,bk TEXT,cat INTEGER,authno INTEGER,inf TEXT,betaka TEXT);
      CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT,catord INTEGER,lvl INTEGER);
      INSERT INTO categories VALUES(5,'الفقه',0,0);
      INSERT INTO books_meta(bkid,cat) VALUES(1,5),(2,NULL),(3,999999);
      ATTACH ':memory:' AS tambahan;
      CREATE TABLE tambahan.books_meta AS SELECT * FROM main.books_meta WHERE 0;
      INSERT INTO tambahan.books_meta(bkid,cat) VALUES(1,999999),(4,5);`);
    const rows=[{book_id:4,page_id:40},{book_id:1,page_id:10},{book_id:1,page_id:11},{book_id:2},{book_id:3}];
    const enriched=addSearchResultCategories(db,rows,true);
    assert.deepEqual(enriched.slice(0,3).map(r=>[r.book_id,r.page_id,r.category_id,r.category_name]),[[4,40,5,'الفقه'],[1,10,5,'الفقه'],[1,11,5,'الفقه']]);
    assert.equal(enriched[3].category_id,0);
    assert.equal(enriched[3].category_name,null);
    assert.equal(enriched[4].category_id,999999);
    assert.equal(rows[0].category_id,undefined);
    assert.equal(addSearchResultCategories(db,[{book_id:1}])[0].category_name,'الفقه');
    assert.deepEqual(addSearchResultCategories(db,[]),[]);
  }finally{db.close();}
});
