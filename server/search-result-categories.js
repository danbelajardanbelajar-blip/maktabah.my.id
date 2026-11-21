import {categoryCatalogueSql} from './book-transfer.js';

// Enrich only the returned page, without adding category joins to FTS counting.
export function addSearchResultCategories(db,results,additional=false){
  if(!results.length)return results;
  const ids=[...new Set(results.map(row=>row.book_id))];
  const books=additional?'(SELECT bkid,cat FROM main.books_meta UNION ALL SELECT bkid,cat FROM tambahan.books_meta t WHERE NOT EXISTS(SELECT 1 FROM main.books_meta m WHERE m.bkid=t.bkid))':'main.books_meta';
  const metadata=new Map(db.prepare(`SELECT b.bkid,COALESCE(b.cat,0) AS category_id,c.name AS category_name FROM ${books} b LEFT JOIN ${categoryCatalogueSql(additional)} c ON c.id=COALESCE(b.cat,0) WHERE b.bkid IN (SELECT value FROM json_each(?))`).all(JSON.stringify(ids)).map(row=>[row.bkid,row]));
  return results.map(row=>{
    const category=metadata.get(row.book_id);
    return {...row,category_id:category?.category_id??0,category_name:category?.category_name||null};
  });
}
