export function SearchCategoryLabel({name,id}:{name?:string|null;id?:number|null}){
  const category=name?.trim()||(id?`Kategori #${id}`:'Tanpa kategori');
  return <span aria-label={`Kategori: ${category}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--app-primary)]/25 bg-[var(--app-primary)]/5 px-2.5 py-1 text-xs md:text-sm text-[var(--app-text)]">
    <span className="shrink-0 opacity-70">Kategori:</span><span dir="auto" className="min-w-0 break-words">{category}</span>
  </span>;
}
