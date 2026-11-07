export function categoryBooks(db,{categoryId,page=1,limit=30,query='',paging=true,booksSql='main.books_meta',authorsSql='main.authors'}) {
  if(!Number.isSafeInteger(categoryId)||categoryId<0)throw Object.assign(new Error('Kategori tidak valid.'),{status:400});
  const q=typeof query==='string'?query.trim().slice(0,200):'';
  const size=Math.min(100,Math.max(1,Number.isSafeInteger(Number(limit))?Number(limit):30));
  const where='WHERE b.cat=?'+(q?' AND b.bk LIKE ?':'');
  const params=q?[categoryId,`%${q}%`]:[categoryId];
  const sql=`SELECT b.bkid,b.bk,a.auth AS author_name FROM ${booksSql} b LEFT JOIN ${authorsSql} a ON b.authno=a.authid ${where} ORDER BY b.bk,b.bkid`;
  if(!paging)return {data:db.prepare(sql).all(...params),error:null};
  const total=db.prepare(`SELECT count(*) n FROM ${booksSql} b ${where}`).get(...params).n;
  const lastPage=Math.max(1,Math.ceil(total/size));
  const current=Math.min(lastPage,Math.max(1,Number.isSafeInteger(Number(page))?Number(page):1));
  return {data:db.prepare(sql+' LIMIT ? OFFSET ?').all(...params,size,(current-1)*size),total,page:current,limit:size,totalPages:lastPage,error:null};
}
