import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BookOpen, Clock, Loader2, Search, X } from 'lucide-react';
import { webAPI } from '../api';

export interface AutocompleteBook {
  bkid: number;
  title: string;
  category: string;
}

export interface AutocompleteQuery {
  text: string;
  count: number;
}

interface AutocompleteResult {
  books: AutocompleteBook[];
  queries: AutocompleteQuery[];
}

const LOCAL_HISTORY_KEY = 'maktabah_local_searches_v2';
const clientCache = new Map<string, { at: number; data: AutocompleteResult }>();
const CACHE_TTL = 2 * 60 * 1000;

export function getLocalSearches(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function saveLocalSearch(query: string) {
  const clean = String(query || '').trim();
  if (clean.length < 2) return;
  try {
    const prev = getLocalSearches();
    const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 20);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function removeLocalSearch(query: string) {
  const target = String(query || '').trim().toLowerCase();
  if (!target) return;
  try {
    const next = getLocalSearches().filter((item) => item.toLowerCase() !== target);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return text;
  const idx = text.toLowerCase().indexOf(cleanQuery.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + cleanQuery.length);
  const after = text.slice(idx + cleanQuery.length);
  return (
    <>
      {before}
      <mark className="bg-[var(--app-primary)]/15 text-inherit font-bold rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}

type FlatItem =
  | { kind: 'local'; text: string }
  | { kind: 'book'; book: AutocompleteBook }
  | { kind: 'query'; text: string; count: number };

interface SearchAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectQuery: (query: string) => void;
  onSelectBook: (book: AutocompleteBook) => void;
  placeholder?: string;
}

export const SearchAutocompleteInput: React.FC<SearchAutocompleteInputProps> = ({
  value,
  onChange,
  onSelectQuery,
  onSelectBook,
  placeholder = 'Cari di sini...',
}) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<AutocompleteResult>({ books: [], queries: [] });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [historyVersion, setHistoryVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listboxId = useId();

  const trimmed = value.trim();

  // Match local search history immediately (0ms), or show recent items when focused empty
  const localMatches = useMemo(() => {
    void historyVersion;
    const all = getLocalSearches();
    if (trimmed.length === 0) return all.slice(0, 5);
    if (trimmed.length < 2) return [];
    const lower = trimmed.toLowerCase();
    return all
      .filter((item) => item.toLowerCase().includes(lower) && item.toLowerCase() !== lower)
      .slice(0, 2);
  }, [trimmed, historyVersion]);

  // Fetch remote suggestions with debounce (250ms), AbortController, and client cache
  useEffect(() => {
    if (!focused || trimmed.length < 2) {
      setRemote({ books: [], queries: [] });
      setLoading(false);
      return;
    }

    const cacheKey = trimmed.toLowerCase();
    const cached = clientCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setRemote(cached.data);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setRemote({ books: [], queries: [] });
    setLoading(true);
    const timer = setTimeout(() => {
      webAPI
        .getAutocomplete(trimmed, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          const data: AutocompleteResult = {
            books: Array.isArray(res?.books) ? res.books : [],
            queries: Array.isArray(res?.queries) ? res.queries : [],
          };
          if (clientCache.size >= 200) {
            const firstKey = clientCache.keys().next().value;
            if (firstKey !== undefined) clientCache.delete(firstKey);
          }
          clientCache.set(cacheKey, { at: Date.now(), data });
          setRemote(data);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setRemote({ books: [], queries: [] });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, focused]);

  // Flatten items for keyboard navigation
  const flatItems = useMemo<FlatItem[]>(() => {
    const list: FlatItem[] = [];
    const localLower = new Set(localMatches.map((l) => l.toLowerCase()));

    for (const l of localMatches) {
      list.push({ kind: 'local', text: l });
    }
    for (const b of remote.books) {
      list.push({ kind: 'book', book: b });
    }
    for (const q of remote.queries) {
      if (!localLower.has(q.text.toLowerCase())) {
        list.push({ kind: 'query', text: q.text, count: q.count });
      }
    }
    return list;
  }, [localMatches, remote]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed, remote]);

  useEffect(() => {
    if (activeIndex >= 0) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const chooseItem = (item: FlatItem) => {
    setOpen(false);
    setFocused(false);
    setActiveIndex(-1);
    if (item.kind === 'book') {
      onSelectBook(item.book);
    } else {
      onChange(item.text);
      onSelectQuery(item.text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      setOpen(false);
      setFocused(false);
      setActiveIndex(-1);
      return;
    }

    if (!open || flatItems.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Enter' && activeIndex >= 0 && flatItems[activeIndex]) {
      e.preventDefault();
      chooseItem(flatItems[activeIndex]);
    } else if (e.key === 'Enter') {
      setOpen(false);
    }
  };

  const showDropdown =
    open &&
    focused &&
    ((trimmed.length === 0 && localMatches.length > 0) ||
      (trimmed.length >= 2 && (flatItems.length > 0 || loading)));

  return (
    <div className="relative flex-1" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 right-4 flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(getLocalSearches().length > 0);
              }}
              aria-label="Hapus teks pencarian"
              className="p-1 text-[var(--app-text)]/55 hover:text-[var(--app-text)] rounded-full hover:bg-[var(--app-text)]/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
          <div className="pointer-events-none">
            {loading ? (
              <Loader2 className="text-[var(--app-primary)] animate-spin" size={20} />
            ) : (
              <Search className="text-[var(--app-text)]/50" size={20} />
            )}
          </div>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const nextVal = e.target.value;
            onChange(nextVal);
            setOpen(nextVal.trim().length >= 2 || (nextVal.trim().length === 0 && getLocalSearches().length > 0));
          }}
          onFocus={() => {
            setFocused(true);
            if (trimmed.length >= 2 || (trimmed.length === 0 && getLocalSearches().length > 0)) {
              setOpen(true);
            }
          }}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setOpen(false);
              setFocused(false);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={showDropdown && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          className={`w-full pl-4 ${value ? 'pr-20' : 'pr-12'} py-4 rounded-xl border-2 border-[var(--app-text)]/15 text-lg md:text-xl text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)] bg-[var(--reader-paper)] shadow-inner transition-all`}
        />
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[var(--reader-paper)] text-[var(--app-text)] border border-[var(--app-text)]/15 rounded-2xl shadow-2xl overflow-hidden divide-y divide-[var(--app-text)]/10"
        >
          {flatItems.length === 0 && loading ? (
            <div className="px-4 py-3 text-sm text-[var(--app-text)]/65 flex items-center gap-2">
              <Loader2 size={15} className="animate-spin text-[var(--app-primary)]" />
              <span>Mencari usulan...</span>
            </div>
          ) : (
            <div className="py-1.5 max-h-80 overflow-y-auto">
              {flatItems.map((item, idx) => {
                const isActive = idx === activeIndex;
                const optionId = `${listboxId}-option-${idx}`;
                const showGroupHeader = idx === 0 || flatItems[idx - 1].kind !== item.kind;
                const groupLabel =
                  item.kind === 'local'
                    ? 'Riwayat Anda'
                    : item.kind === 'book'
                      ? 'Kitab'
                      : 'Saran Pencarian';

                const headerEl = showGroupHeader ? (
                  <div
                    className={`px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text)]/50 ${
                      idx > 0 ? 'mt-1 border-t border-[var(--app-text)]/10' : ''
                    }`}
                  >
                    {groupLabel}
                  </div>
                ) : null;

                if (item.kind === 'local') {
                  return (
                    <React.Fragment key={`local-${item.text}`}>
                      {headerEl}
                      <div
                        className={`flex items-center transition-colors ${
                          isActive ? 'bg-[var(--app-primary)]/12 text-[var(--app-primary)]' : 'hover:bg-[var(--app-text)]/5'
                        }`}
                      >
                        <button
                          id={optionId}
                          ref={(el) => { itemRefs.current[idx] = el; }}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            chooseItem(item);
                          }}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className="flex-1 min-w-0 text-left pl-4 pr-2 py-2.5 flex items-center gap-3"
                        >
                          <Clock size={16} className="shrink-0 text-[var(--app-text)]/50" />
                          <span className="flex-1 truncate font-medium text-sm md:text-base" dir="auto">
                            {renderHighlightedText(item.text, trimmed)}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Hapus riwayat ${item.text}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeLocalSearch(item.text);
                            setHistoryVersion((v) => v + 1);
                          }}
                          className="mr-3 p-1.5 rounded-full text-[var(--app-text)]/45 hover:text-[var(--app-text)] hover:bg-[var(--app-text)]/10 transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </React.Fragment>
                  );
                }

                if (item.kind === 'book') {
                  return (
                    <React.Fragment key={`book-${item.book.bkid}`}>
                      {headerEl}
                      <button
                        id={optionId}
                        ref={(el) => { itemRefs.current[idx] = el; }}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          chooseItem(item);
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                          isActive ? 'bg-[var(--app-primary)]/12' : 'hover:bg-[var(--app-text)]/5'
                        }`}
                      >
                        <BookOpen size={17} className="shrink-0 text-[var(--app-primary)]" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm md:text-base truncate" dir="auto">
                            {renderHighlightedText(item.book.title, trimmed)}
                          </div>
                          {item.book.category && (
                            <div className="text-xs text-[var(--app-text)]/60 truncate">{item.book.category}</div>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[var(--app-primary)]/15 text-[var(--app-primary)] shrink-0">
                          Buka Kitab
                        </span>
                      </button>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={`query-${item.text}`}>
                    {headerEl}
                    <button
                      id={optionId}
                      ref={(el) => { itemRefs.current[idx] = el; }}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        chooseItem(item);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                        isActive ? 'bg-[var(--app-primary)]/12 text-[var(--app-primary)]' : 'hover:bg-[var(--app-text)]/5'
                      }`}
                    >
                      <Search size={16} className="shrink-0 text-[var(--app-text)]/50" />
                      <span className="flex-1 truncate font-medium text-sm md:text-base" dir="auto">
                        {renderHighlightedText(item.text, trimmed)}
                      </span>
                      {item.count >= 3 && (
                        <span className="text-[11px] text-[var(--app-text)]/55 shrink-0">Populer</span>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
