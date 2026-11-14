const cookieName='maktabah_admin_session';
export function adminActivityIdentity(getStateDb) {
  return (req,res,next)=>{
    const bearer=/^Bearer ([A-Za-z0-9_-]{1,256})$/.exec(req.headers.authorization||'')?.[1];
    const cookie=String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    req.isAdminActivity=false;
    for(const token of [bearer,cookie]) {
      if(!token || token.length>256)continue;
      try {if(getStateDb()?.prepare('SELECT 1 FROM admin_tokens WHERE token=?').get(token)){req.isAdminActivity=true;break;}}catch{/* Public requests must remain available. */}
    }
    next();
  };
}
export function setAdminActivityCookie(req,res,token) {
  res.append('Set-Cookie',`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax${token?'':'; Max-Age=0'}${req.secure?'; Secure':''}`);
}
