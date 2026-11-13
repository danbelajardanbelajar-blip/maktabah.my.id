import { useEffect, useRef } from 'react';
export function useModalFocus(onEscape?:()=>void, enabled=true) {
  const root=useRef<HTMLDivElement>(null), close=useRef(onEscape);close.current=onEscape;
  useEffect(()=>{
    if(!enabled)return;
    const previous=document.activeElement as HTMLElement|null;
    const focusable=()=>Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]).filter(e=>e.getClientRects().length>0);
    const timer=setTimeout(()=>focusable()[0]?.focus({preventScroll:true}),0);
    const key=(e:KeyboardEvent)=>{
      const dialogs=Array.from(document.querySelectorAll<HTMLElement>('[role=dialog][aria-modal=true]')).filter(el=>el.getClientRects().length>0);
      if(dialogs.length&&dialogs.at(-1)!==root.current)return;
      if(e.key==='Escape'&&close.current){e.preventDefault();e.stopPropagation();close.current();return;}
      if(e.key!=='Tab')return;
      const items=focusable(),first=items[0],last=items.at(-1);
      if(!first){e.preventDefault();root.current?.focus();return;}
      if(!root.current?.contains(document.activeElement)||(!e.shiftKey&&document.activeElement===last)){e.preventDefault();first.focus();}
      else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    };
    document.addEventListener('keydown',key);
    return ()=>{clearTimeout(timer);document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[enabled]);
  return root;
}
