type ReaderApi = {
  getBookInfo: (id: number) => Promise<{ data?: any }>;
  getPage: (id: number, pageId?: number) => Promise<{ data?: any }>;
};

export async function loadReaderData(api: ReaderApi, bookId: number, pageId?: number, cachedBook?: any) {
  if (!Number.isSafeInteger(bookId) || bookId < 1 || (pageId !== undefined && (!Number.isSafeInteger(pageId) || pageId < 0))) {
    throw new Error('Tautan kitab atau halaman tidak valid.');
  }
  const book = cachedBook?.bkid === bookId ? cachedBook : (await api.getBookInfo(bookId)).data;
  if (!book) throw new Error('Kitab tidak ditemukan atau sudah dihapus.');
  const page = (await api.getPage(bookId, pageId)).data;
  if (!page) throw new Error(pageId === undefined ? 'Kitab ini belum memiliki halaman yang dapat dibaca.' : 'Halaman yang dituju tidak ditemukan.');
  return { book, page };
}
