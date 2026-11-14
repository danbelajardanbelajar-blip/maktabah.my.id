// Attach identity only to this application's API. A client flag or shared IP is not trusted.
export function adminRequestOptions(input:RequestInfo|URL,init:RequestInit|undefined,base:string,token:string|null):RequestInit|undefined {
  if(!token)return init;
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,base);
  if(url.origin!==new URL(base).origin || !url.pathname.startsWith('/api/'))return init;
  const headers=new Headers(init?.headers || (input instanceof Request?input.headers:undefined));
  if(!headers.has('Authorization'))headers.set('Authorization',`Bearer ${token}`);
  return {...init,headers};
}
export function installAdminRequestIdentity() {
  const original=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    let token:string|null=null;
    try{token=localStorage.getItem('adminToken');}catch{/* Browser storage can be unavailable. */}
    return original(input,adminRequestOptions(input,init,window.location.href,token));
  };
}
