/** Match whole social utterances only. A greeting followed by a substantive question
 * must continue through retrieval and evidence verification. */
export function conversationalReply(question) {
 const text=String(question).normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 const greeting='(?:halo|hallo|hai|hi|hello|assalamualaikum|assalamu alaikum|assalamu alaykum|السلام عليكم)(?: warahmatullahi wabarakatuh| ورحمة الله وبركاته)?';
 const identity='(?:siapa|siaoa) (?:kamu|anda)|(?:kamu|anda) siapa|siapakah (?:kamu|anda)|apa nama(?:mu| kamu| anda)|who are you|من أنت|من انت';
 if(new RegExp('^(?:'+greeting+' )?(?:'+identity+')$').test(text))
  return 'Halo! Saya Maktabah Bot, asisten AI di al Maktabah as Sunniyyah. Saya membantu mencari rujukan kitab serta menjelaskan atau menerjemahkan halaman yang Anda pilih. Silakan tuliskan pertanyaan atau buka sebuah kitab untuk mulai.';
 if(new RegExp('^'+greeting+'$').test(text))
  return (/^(?:assalam|assalamu|السلام)/.test(text)?'Wa’alaikumussalam! ':'Halo! ')+'Ada yang ingin Anda cari atau pelajari? Saya bisa membantu mencari rujukan kitab, menjelaskan isi halaman, atau menerjemahkannya.';
 if(/^(?:terima kasih|terimakasih|makasih|thanks|thank you|شكرا|شكرا لك)$/.test(text))
  return 'Sama-sama. Silakan tuliskan pertanyaan berikutnya jika ada yang ingin Anda pelajari.';
 if(/^(?:apa yang bisa (?:kamu|anda) lakukan|bagaimana cara (?:menggunakan|memakai) (?:tanya ai|fitur ini)|what can you do)$/.test(text))
  return 'Tuliskan topik atau pertanyaan untuk mencari rujukan dari kitab yang tersedia. Untuk membahas teks tertentu, buka kitab lalu pilih Jelaskan halaman ini atau Terjemahkan halaman ini. Anda juga dapat memilih sebagian teks. Periksa jawaban melalui tautan sumber yang disertakan.';
 return null;
}
