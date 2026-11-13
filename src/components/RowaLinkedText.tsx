import {useEffect,useMemo,useRef,useState} from 'react';
import {useRowaCards} from './RowaCards';
import './rowa-links.css';
type Mention={start:number;end:number;label:string;count:number};
const tags=new Set(['DIV','P','SPAN','FONT','B','STRONG','I','EM','U','MARK','BR','SUP','SUB','BLOCKQUOTE','UL','OL','LI','TABLE','THEAD','TBODY','TR','TD','TH','HR']);
function safeTemplate(html:string){
  const template=document.createElement('template');template.innerHTML=html;
  for(const node of Array.from(template.content.querySelectorAll('*'))){
    if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','LINK','META','BASE'].includes(node.tagName)){node.remove();continue;}
    if(!tags.has(node.tagName)){node.replaceWith(...node.childNodes);continue;}
    for(const attr of Array.from(node.attributes)){if(!['dir','color','size','face','align','colspan','rowspan','style','class'].includes(attr.name))node.removeAttribute(attr.name);}
    const el=node as HTMLElement;const style=el.style;if(style){for(const property of Array.from(style)){if(!['color','background-color','font-weight','font-style','font-size','font-family','text-align','text-decoration','min-height','word-break'].includes(property)||/url\s*\(|expression\s*\(/i.test(style.getPropertyValue(property)))style.removeProperty(property);}}
  }
  return template;
}
function linkNames(html:string,mentions:Mention[]){
  const template=safeTemplate(html);
  for(const mention of [...mentions].reverse()){
    const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT);let offset=0,start:Text|null=null,end:Text|null=null,startOffset=0,endOffset=0,node;
    while((node=walker.nextNode())){const text=node as Text,next=offset+text.length;if(start===null&&mention.start>=offset&&mention.start<next){start=text;startOffset=mention.start-offset;}if(mention.end>offset&&mention.end<=next){end=text;endOffset=mention.end-offset;break;}offset=next;}
    if(!start||!end||start.parentElement?.closest('button')||(start.parentElement?.closest('p,div,li,td,th')||null)!==(end.parentElement?.closest('p,div,li,td,th')||null))continue;
    const range=document.createRange();range.setStart(start,startOffset);range.setEnd(end,endOffset);const button=document.createElement('button');button.type='button';button.className='rowa-name-link';button.dataset.rowaName=mention.label;button.title=mention.count>1?'Pilih profil perawi yang cocok':'Buka bithaqah perawi';button.append(range.extractContents());range.insertNode(button);
  }
  return template.innerHTML;
}
export const escapeRowaHtml=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function RowaLinkedText({html,className='',style}:{html:string;className?:string;style?:React.CSSProperties}) {
  const open=useRowaCards(),clean=useMemo(()=>safeTemplate(html).innerHTML,[html]);
  const text=useMemo(()=>safeTemplate(clean).content.textContent?.slice(0,60000)||'',[clean]);
  const [reply,setReply]=useState<{text:string;mentions:Mention[]}|null>(null);
  const root=useRef<HTMLDivElement>(null),pending=useRef<{text:string;mentions:Mention[]}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();pending.current=null;setReply(null);if(!text.trim())return;
    const apply=()=>{const selection=window.getSelection();if(selection?.toString()&&(root.current?.contains(selection.anchorNode)||root.current?.contains(selection.focusNode)))return;if(pending.current){setReply(pending.current);pending.current=null;}};
    document.addEventListener('selectionchange',apply);
    fetch('/api/rowa/mentions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts:[text]}),signal:controller.signal}).then(async r=>{if(!r.ok)return null;return r.json();}).then(result=>{if(!controller.signal.aborted&&Array.isArray(result?.data?.[0])){pending.current={text,mentions:result.data[0]};apply();}}).catch(()=>{});
    return()=>{controller.abort();pending.current=null;document.removeEventListener('selectionchange',apply);};
  },[text]);
  const rendered=useMemo(()=>reply?.text===text?linkNames(clean,reply.mentions):clean,[clean,text,reply]);
  const content=useMemo(()=>({__html:rendered}),[rendered]);
  return <div ref={root} data-rowa-linked-text className={className} style={style} onClick={e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-rowa-name]');if(button){e.preventDefault();e.stopPropagation();open(button.dataset.rowaName!);}}} dangerouslySetInnerHTML={content}/>;
}
