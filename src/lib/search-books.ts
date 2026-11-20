// Books a visitor ticked for "search only in these books". The list is kept on this device so it survives
// reloads; whether it is applied to a search travels in the URL (?books=1,2,3) like the category filter.
export interface PickedBook { bkid: number; bk: string; author?: string | null }

export const MAX_PICKED_BOOKS = 100; // same limit as MAX_SEARCH_BOOKS on the server
const LIST_KEY = 'maktabah:search-books';
const ACTIVE_KEY = 'maktabah:search-books-active';

const valid = (book: unknown): book is PickedBook => !!book && typeof book === 'object'
  && Number.isSafeInteger((book as PickedBook).bkid) && (book as PickedBook).bkid > 0 && typeof (book as PickedBook).bk === 'string';

export function loadPickedBooks(): PickedBook[] {
  try {
    const value = JSON.parse(localStorage.getItem(LIST_KEY) || '[]');
    return Array.isArray(value) ? value.filter(valid).slice(0, MAX_PICKED_BOOKS) : [];
  } catch { return []; }
}

export function savePickedBooks(list: PickedBook[]) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, MAX_PICKED_BOOKS))); } catch { /* storage unavailable */ }
}

export function loadPickedActive() {
  try { return localStorage.getItem(ACTIVE_KEY) === '1'; } catch { return false; }
}

export function savePickedActive(active: boolean) {
  try { localStorage.setItem(ACTIVE_KEY, active ? '1' : '0'); } catch { /* storage unavailable */ }
}

/** Books for IDs from a shared link: known titles are reused, unknown ones get a placeholder title. */
export function booksFromIds(ids: number[], known: PickedBook[]): PickedBook[] {
  return ids.slice(0, MAX_PICKED_BOOKS).map(id => known.find(book => book.bkid === id) || { bkid: id, bk: `Kitab #${id}` });
}
