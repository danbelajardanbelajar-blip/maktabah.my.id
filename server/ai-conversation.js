/** Consume the entire social message, including repeated/mixed-language clauses.
 * Never classify by just a greeting prefix: substantive remainder needs sources. */
export function conversationalReply(question) {
 const normalized=String(question).normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 const fillers=new Set(['bro','kak','bang','gan','min','dong','sih','ya','nih','please','tolong','dan','and']);
 const text=normalized.split(' ').filter(w=>!fillers.has(w)).join(' ');
 const units=[
  ['greeting','(?:halo|hallo|hai|hi|hello|assalamualaikum|assalamu alaikum|assalamu alaykum|السلام عليكم)(?: warahmatullahi wabarakatuh| ورحمة الله وبركاته)?'],
  ['identity','(?:siapa|siaoa|siapakah) (?:kamu|anda|dirimu)|(?:kamu|anda) siapa|apa nama(?:mu| kamu| anda)|who are you|what is your name|perkenalkan diri(?:mu| kamu| anda)?|من أنت|من انت'],
  ['self','who (?:am i|are me)|siapa (?:saya|aku)'],
  ['thanks','terima kasih|terimakasih|makasih|thanks|thank you|شكرا لك|شكرا'],
  ['help','apa yang (?:bisa (?:kamu|anda)|(?:kamu|anda) bisa) lakukan|bagaimana cara (?:menggunakan|memakai) (?:tanya ai|fitur ini)|what can you do'],
 ].map(([kind,pattern])=>({kind,pattern:new RegExp('^(?:'+pattern+')(?: +|$)')}));
 let rest=text;const found=new Set();
 while(rest){
  const unit=units.find(u=>u.pattern.test(rest));
  if(!unit)return null;
  found.add(unit.kind);rest=rest.replace(unit.pattern,'');
 }
 if(!found.size)return null;
 if(found.has('help'))return 'Tuliskan topik atau pertanyaan untuk mencari rujukan dari kitab yang tersedia. Untuk membahas teks tertentu, buka kitab lalu pilih Jelaskan halaman ini atau Terjemahkan halaman ini. Anda juga dapat memilih sebagian teks. Periksa jawaban melalui tautan sumber yang disertakan.';
 if(found.has('identity'))return 'Halo! Saya Maktabah Bot, asisten AI di al Maktabah as Sunniyyah. Saya membantu mencari rujukan kitab serta menjelaskan atau menerjemahkan halaman yang Anda pilih. Silakan tuliskan pertanyaan atau buka sebuah kitab untuk mulai.';
 if(found.has('self'))return 'Saya belum mengetahui identitas Anda. Saya Maktabah Bot, asisten yang membantu mencari rujukan kitab serta menjelaskan atau menerjemahkan halaman pilihan.';
 if(found.has('thanks'))return 'Sama-sama. Silakan tuliskan pertanyaan berikutnya jika ada yang ingin Anda pelajari.';
 return (/^(?:assalam|assalamu|السلام)/.test(normalized)?'Wa’alaikumussalam! ':'Halo! ')+'Ada yang ingin Anda cari atau pelajari? Saya bisa membantu mencari rujukan kitab, menjelaskan isi halaman, atau menerjemahkannya.';
}
