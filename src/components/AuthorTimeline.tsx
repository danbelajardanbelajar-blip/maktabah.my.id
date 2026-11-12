import {ArrowUpRight,BookOpen,Feather,HelpCircle} from 'lucide-react';
import {navigationHash} from '../lib/navigation';
export interface AuthorDate {kind:string;year:number|null;century:number|null;sortYear:number|null;label:string;original:string;}
export interface AuthorSummary {id:number;name:string;death_text:string;workCount:number;hasBiography?:boolean;deathDate?:AuthorDate;}
interface Props {authors:AuthorSummary[];context:Record<string,string|number|undefined>;onOpen:(id:number)=>void;}
export const dateOf=(author:AuthorSummary):AuthorDate=>author.deathDate||{kind:'unknown',year:null,century:null,sortYear:null,label:'Tahun belum terpetakan',original:author.death_text||''};
function AuthorCard({author,context,onOpen,compact=false}:{author:AuthorSummary;context:Props['context'];onOpen:Props['onOpen'];compact?:boolean}) {
  const date=dateOf(author);
  return <a href={navigationHash('authors',{...context,id:author.id})} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(author.id);}}} className={`author-journey-card${compact?' author-journey-card--compact':''}`}>
    <div className="author-journey-date"><span className={`author-date-pill ${date.kind==='unknown'?'is-undated':date.kind==='exact'?'is-exact':'is-qualified'}`}>{date.label}</span><ArrowUpRight size={15} aria-hidden="true"/></div>
    <h2 dir="rtl">{author.name}</h2>
    {date.kind!=='exact'&&date.original&&<p className="author-journey-source" dir="auto">{date.original}</p>}
    <div className="author-journey-card-footer"><span><BookOpen size={14} aria-hidden="true"/>{author.workCount.toLocaleString('id-ID')} kitab</span><span>{author.hasBiography?'Biografi tersedia':'Profil sumber'}</span></div>
    <span className="author-journey-card-link">Jelajahi profil <span aria-hidden="true">↗</span></span>
  </a>;
}
export function AuthorTimeline({authors,context,onOpen}:Props) {
  const dated=authors.filter(a=>dateOf(a).kind!=='unknown'),unknown=authors.filter(a=>dateOf(a).kind==='unknown');
  const rows=Array.from({length:Math.ceil(dated.length/4)},(_,i)=>dated.slice(i*4,i*4+4));
  return <div className="author-chronology">
    {rows.length>0&&<div className="author-chronology-rows" aria-label="Linimasa tahun wafat penulis">{rows.map((row,index)=><ol key={row[0].id} className="author-timeline-row" aria-label={`Bagian linimasa ${index+1}`} style={{'--timeline-columns':row.length} as React.CSSProperties}>{row.map((a,i)=><li key={a.id} className={`author-timeline-item ${i%2===0?'is-above':'is-below'}`} style={{gridColumn:i+1}}>
      <AuthorCard author={a} context={context} onOpen={onOpen}/>
      <div className="author-timeline-node" aria-hidden="true"><span className="author-timeline-stem"/><span className="author-timeline-orbit"><Feather size={21}/></span></div>
    </li>)}</ol>)}</div>}
    {unknown.length>0&&<section className="author-undated"><div className="author-undated-heading"><HelpCircle size={19} aria-hidden="true"/><div><h3>Waktu yang belum terpetakan</h3><p>Nama tetap ditampilkan tanpa menetapkan tahun wafat yang tidak tercantum jelas.</p></div></div><AuthorCards authors={unknown} context={context} onOpen={onOpen}/></section>}
  </div>;
}
export function AuthorCards({authors,context,onOpen}:Props) {
  return <div className="author-card-grid">{authors.map(a=><AuthorCard key={a.id} author={a} context={context} onOpen={onOpen} compact/>)}</div>;
}
