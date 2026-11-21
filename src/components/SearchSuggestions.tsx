import {useEffect, useState} from 'react';
import {webAPI} from '../api';
import {scopeKey,type SearchScope} from '../lib/search-scope';

// Shown for searches without results, and (withResults) above a short list of results, where a typo may still
// have matched a few pages. The server returns nothing for searches with many results.
export function SearchSuggestions({query, mode, categories, onSearch, withResults = false,scope}: {
  query:string; mode:'text'|'title'; categories:number[]; onSearch:(query:string)=>void; withResults?:boolean;scope?:SearchScope;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const categoryKey = categories.join(',');
  const selectionKey=scope?scopeKey(scope):'';
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setSuggestions([]);
    webAPI.searchSuggestions(query, mode, categoryKey, controller.signal,scope)
      .then(data => { if (!controller.signal.aborted) setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.filter((q:unknown):q is string => typeof q === 'string').slice(0,3) : []); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, mode, categoryKey,selectionKey,scope]);
  if (loading) return withResults ? null : <p role="status" className="mt-4 text-sm opacity-60">Mencari saran kata yang memiliki hasil…</p>;
  if (!suggestions.length) return null;
  return <div className={withResults ? 'mb-6 p-4 rounded-2xl border border-black/5 bg-[var(--reader-bg)] text-center' : 'mt-5 px-4'} aria-label="Saran pencarian">
    <p className="text-sm mb-3">{withResults ? 'Hasilnya sedikit. Mungkin maksud Anda:' : 'Coba kata atau istilah terkait berikut:'}</p>
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map(suggestion => <button type="button" key={suggestion} onClick={() => onSearch(suggestion)}
        className="min-h-11 max-w-full break-words px-4 py-2 rounded-xl border border-emerald-600 text-[var(--app-text)] hover:bg-emerald-500/10 focus-visible:outline-2 focus-visible:outline-emerald-600" dir="auto">{suggestion}</button>)}
    </div>
  </div>;
}
