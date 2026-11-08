export type AiPageSource={bookId:number;pageId:number;title?:string;part?:string|number|null;page?:string|number|null;text?:string};
export type AiIntent='explain'|'translate';
export type AiRequest={source?:AiPageSource;intent?:AiIntent};
export type AiHistoryItem={query:string}&AiRequest;
export function readAiSource(value:any):AiPageSource|undefined {
  if(!value || !Number.isSafeInteger(value.bookId)||value.bookId<1||!Number.isSafeInteger(value.pageId)||value.pageId<0)return;
  const label=(v:any)=>typeof v==='string'?v.slice(0,100):typeof v==='number'?v:null;
  return {bookId:value.bookId,pageId:value.pageId,title:typeof value.title==='string'?value.title.slice(0,1000):'Halaman kitab yang dipilih',part:label(value.part),page:label(value.page),...(typeof value.text==='string'&&value.text.trim()&&value.text.length<=8000?{text:value.text}: {})};
}
