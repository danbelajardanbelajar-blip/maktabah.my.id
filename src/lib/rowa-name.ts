type RowaName = {Name?:string|null; A_esm?:string|null; IsoName?:string|null};

export function rowaFullName(rowa:RowaName) {
  return [rowa.A_esm,rowa.Name,rowa.IsoName].find(value=>typeof value==='string' && value.trim())?.trim() || 'Nama tidak tersedia';
}
