export const AI_DATABASE_BUSY='Tanya AI sementara tidak tersedia karena pembaruan database sedang berlangsung. Silakan coba lagi setelah selesai.';

export function legacyAiError(message:string) {
  return /API error:\s*409\b/i.test(message)?AI_DATABASE_BUSY:message;
}
export function aiResponseError(status:number,data:unknown) {
  const body=data && typeof data==='object'?data as {message?:unknown;error?:unknown}:{};
  const supplied=typeof body.message==='string'?body.message:typeof body.error==='string'?body.error:undefined;
  const message=status===409?AI_DATABASE_BUSY:supplied || (status===429?'Terlalu banyak pertanyaan. Tunggu sebentar sebelum mencoba lagi.':status===504?'Waktu menunggu jawaban habis. Silakan coba lagi.':'Layanan Tanya AI sedang mengalami gangguan. Silakan coba lagi.');
  return Object.assign(new Error(message),{status});
}
export function aiFailureMessage(error:unknown) {
  if(error && typeof error==='object' && 'status' in error && error.status===409)return AI_DATABASE_BUSY;
  if(error instanceof TypeError)return 'Koneksi terganggu. Periksa jaringan Anda lalu coba lagi.';
  return error instanceof Error?legacyAiError(error.message):'Pertanyaan belum berhasil diproses. Silakan coba lagi.';
}
