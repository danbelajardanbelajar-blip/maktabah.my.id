const arabicFonts:Record<string,string> = {Amiri:'Amiri:ital,wght@0,400;0,700;1,400',Lateef:'Lateef:wght@400;500;600','Scheherazade New':'Scheherazade+New:wght@400;500;600;700'};
const latinFonts:Record<string,string> = {Inter:'Inter:wght@400;600;700',Merriweather:'Merriweather:ital,wght@0,400;0,700;1,400',Roboto:'Roboto:ital,wght@0,400;0,700;1,400'};

export function selectedFontsUrl(arabic:string,latin:string) {
  const a=Object.hasOwn(arabicFonts,arabic)?arabicFonts[arabic]:arabicFonts.Amiri;
  const l=Object.hasOwn(latinFonts,latin)?latinFonts[latin]:latinFonts.Inter;
  return `https://fonts.googleapis.com/css2?family=${a}&family=${l}&display=swap`;
}
export function loadSelectedFonts(arabic:string,latin:string) {
  const link=document.createElement('link');
  link.rel='stylesheet';link.href=selectedFontsUrl(arabic,latin);
  // The interface renders with system fonts while the selected web fonts load.
  link.media='print';link.onload=()=>{link.media='all';};
  document.head.appendChild(link);
  return ()=>{link.onload=null;link.remove();};
}
