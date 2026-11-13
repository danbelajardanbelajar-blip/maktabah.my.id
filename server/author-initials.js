import {normalizeIdentity} from './author-package.js';
export const AUTHOR_LETTERS=Array.from('ابتثجحخدذرزسشصضطظعغفقكلمنهوي');
const fold=text=>normalizeIdentity(text).replace(/[أإآٱء]/gu,'ا').replace(/ؤ/gu,'و').replace(/[ىئ]/gu,'ي').replace(/ة/gu,'ه');
export function authorInitial(name){
  const letter=fold(name).match(/\p{L}/u)?.[0];
  return AUTHOR_LETTERS.includes(letter)?letter:'other';
}
export function readAuthorInitial(value){
  if(value===undefined||value==='')return '';
  if(value==='other')return value;
  if(typeof value==='string'){const letter=fold(value);if(Array.from(letter).length===1&&AUTHOR_LETTERS.includes(letter))return letter;}
  throw Object.assign(Error('Pilihan huruf awal tidak valid.'),{status:400});
}
export function authorInitialCounts(authors){
  const counts=new Map([...AUTHOR_LETTERS,'other'].map(letter=>[letter,0]));
  for(const author of authors){const letter=authorInitial(author.name);counts.set(letter,counts.get(letter)+1);}
  return [...counts].map(([initial,count])=>({initial,count}));
}
