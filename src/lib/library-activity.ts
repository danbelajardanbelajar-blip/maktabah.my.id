import {useEffect} from 'react';

export interface LibraryActivity {
  action:'browse'|'search'|'read_book'|'book_detail'|'edition'|'timeline_year';
  query?:string; target_id?:number; target_name?:string; result_count?:number;
  context?:Record<string,string|number|boolean|undefined>;
}
export function recordLibraryActivity(feature:'hadith'|'authors', event:LibraryActivity) {
  void fetch(`/api/log/library/${feature}`, {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(event),keepalive:true,signal:AbortSignal.timeout(5000)}).catch(()=>{});
}

// Record only successfully displayed catalogue states. Cleanup skips abandoned requests
// and React's development-only effect replay; typing alone does not change the route.
export function useCatalogueActivity(ready:boolean, route:string, event:LibraryActivity) {
  const serialized = JSON.stringify(event);
  useEffect(()=>{
    if (!ready) return;
    const timer = setTimeout(()=>recordLibraryActivity('hadith',JSON.parse(serialized)),150);
    return ()=>clearTimeout(timer);
  },[ready,route,serialized]);
}
