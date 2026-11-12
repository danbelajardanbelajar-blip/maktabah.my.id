// Tag only navigation created by this app; never infer safety from history.length.
export function backState(state:Record<string,unknown>|null, href:string) {
  const url=new URL(href);
  return {...state,maktabahPrevious:url.pathname+url.search+url.hash};
}
export function previousLocation(state:unknown, href:string):string|null {
  const previous=(state as {maktabahPrevious?:unknown}|null)?.maktabahPrevious;
  if (typeof previous !== 'string' || !previous.startsWith('/') || previous.startsWith('//')) return null;
  try {
    const current=new URL(href), target=new URL(previous,current);
    if(target.origin !== current.origin || target.pathname !== current.pathname || target.href === current.href || target.username || target.password) return null;
    return target.pathname+target.search+target.hash;
  } catch {return null;}
}
export function pushLocation(hash:string,state:Record<string,unknown>|null=null) {
  window.history.pushState(backState(state,window.location.href),'',hash);
}
export function backFallback(hash:string) {
  const [path,query='']=hash.split('?'),params=new URLSearchParams(query);
  if(path==='#/penulis'&&params.has('id')) {params.delete('id');params.delete('page');return '#/penulis'+(params.size?'?'+params:'');}
  if(path==='#/katalog' && params.has('cat')) {
    const parent=new URLSearchParams();
    if(params.get('filter'))parent.set('filter',params.get('filter')!);
    return '#/katalog'+(parent.size?'?'+parent:'');
  }
  return '#/beranda';
}
