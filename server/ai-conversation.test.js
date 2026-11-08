import test from 'node:test';import assert from 'node:assert/strict';import {conversationalReply} from './ai-conversation.js';
test('social matching consumes the whole utterance and cannot bypass evidence for religious or translation requests',()=>{
 for(const q of ['Halo, siapa kamu?','halo siaoa kamu','Siapakah Anda?','السلام عليكم','من أنت؟','apa yang bisa kamu lakukan'])assert.ok(conversationalReply(q),q);
 for(const q of ['halo apa hukum bunga bank','siapa kamu dan apa hukum zakat','assalamualaikum jelaskan shalat','terima kasih bagaimana hukum puasa','terjemahkan siapa kamu','apa hukum menyapa halo'])assert.equal(conversationalReply(q),null,q);
});
