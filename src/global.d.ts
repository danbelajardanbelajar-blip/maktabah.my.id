export {};

declare global {
  interface Window {
    electronAPI: {
      search: (query: string, page?: number, limit?: number) => Promise<{ results: any[], total: number, error: string | null }>;
      getBookInfo: (bookId: number) => Promise<any>;
      getToc: (bookId: number) => Promise<any>;
      getPage: (bookId: number, pageId?: number) => Promise<any>;
      getNextPage: (bookId: number, pageId: number) => Promise<any>;
      getPrevPage: (bookId: number, pageId: number) => Promise<any>;
      getMatnSharh: (bookId: number, pageId: number) => Promise<any>;
      getQuranSurahs: () => Promise<any>;
      getQuranAyahs: (surahId: number) => Promise<any>;
      searchRowa: (query: string) => Promise<any>;
      getRowaInfo: (rowaId: number) => Promise<any>;
    };
  }
}
