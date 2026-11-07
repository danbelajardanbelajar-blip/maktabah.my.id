import type { adminLocation } from './admin-navigation';

export interface AdminCategory { id:number; name:string; catord:number; lvl:number; book_count:number; }
export interface AdminBook { bkid:number; bk:string; cat:number; cat_name:string; }
export interface AdminPage { id:number; book_id:number; part:number; page:number; preview:string; }
export type AdminContext = {category?:AdminCategory; book?:AdminBook; page?:AdminPage};
type API = {
  book:(id:number)=>Promise<{data?:any}>;
  categories:()=>Promise<{data?:AdminCategory[]}>;
  page:(book:number,page:number)=>Promise<{data?:any}>;
};

// API responses intentionally use {data}; public metadata does not return a success flag.
export async function restoreAdminEntities(route:ReturnType<typeof adminLocation>, cached:AdminContext, api:API) {
  let category=cached.category, book=cached.book, page=cached.page;
  if (route.view !== 'books') {
    if (route.bookId === undefined) throw new Error('Tautan tidak memuat ID kitab.');
    if (!book || book.bkid !== route.bookId) {
      const result=await api.book(route.bookId);
      if (!result.data) throw new Error('Kitab tidak ditemukan.');
      book={...result.data,cat_name:result.data.category};
    }
  } else book=undefined;
  const categoryId=book?.cat ?? route.categoryId;
  if (categoryId === undefined) throw new Error('Tautan tidak memuat kategori.');
  if (!category || category.id !== categoryId) {
    category=(await api.categories()).data?.find(item=>item.id===categoryId);
    if (!category) throw new Error('Kategori tidak ditemukan atau telah dihapus.');
  }
  if (route.view === 'edit_page') {
    if (route.pageId === undefined) throw new Error('Tautan tidak memuat ID halaman.');
    if (!page || page.id !== route.pageId || page.book_id !== book!.bkid) {
      const result=await api.page(book!.bkid,route.pageId);
      if (!result.data) throw new Error('Halaman tidak ditemukan.');
      page={...result.data,preview:String(result.data.nass || '').slice(0,200)};
    }
  } else page=undefined;
  return {category:category!,book:book || null,page:page || null};
}
