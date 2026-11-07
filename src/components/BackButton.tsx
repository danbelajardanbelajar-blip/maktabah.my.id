import {ArrowLeft} from 'lucide-react';

export function BackButton({onClick,label='Kembali',title,disabled=false,light=false}:{
  onClick:()=>void;label?:string;title?:string;disabled?:boolean;light?:boolean;
}) {
  return <button type="button" onClick={onClick} disabled={disabled} title={title || label} aria-label={title || label} className={`app-back-button${light?' app-back-button-light':''}`} dir="ltr">
    <span className="app-back-icon" aria-hidden="true"><ArrowLeft size={18} strokeWidth={2.2}/></span>
    <span>{label}</span>
  </button>;
}
