import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesQuestionTopic,questionContext,readPreviousQuestions,readRelevanceReview} from './ai-relevance.js';

test('explicit short follow-ups inherit only bounded user questions, while new topics stand alone',()=>{
 assert.match(questionContext('kalau tiga?',['Berapa rakaat witir?']),/witir/);
 assert.match(questionContext('وماذا عن ثلاث؟',['كم ركعات الوتر؟']),/الوتر/);
 assert.equal(questionContext('berapa rakaat tarawih?',['Berapa rakaat witir?']),'berapa rakaat tarawih?');
 assert.equal(questionContext('kalau zakat fitrah?',['Berapa rakaat witir?']),'kalau zakat fitrah?');
 assert.equal(questionContext('kalau tiga?',[]),'kalau tiga?');
 assert.throws(()=>readPreviousQuestions(['x'.repeat(1501)]));assert.throws(()=>readPreviousQuestions(Array(6).fill('x'.repeat(1100))));
});

test('Arabic topic marks/articles are normalized and semantic verdict requires all literal booleans',()=>{
 assert.equal(matchesQuestionTopic('وفي الوَتْر بيان المسألة','berapa rakaat witir?'),true);
 assert.equal(matchesQuestionTopic('أحكام للوتر','witir'),true);
 assert.equal(matchesQuestionTopic('صلاة التراويح عشرون ركعة','witir'),false);
 assert.equal(matchesQuestionTopic('Witir biasanya tiga rakaat','witir'),true);
 assert.equal(readRelevanceReview('{"relevant":true,"supported":true,"complete":true}'),true);
 for(const text of ['not JSON','{}','{"relevant":true,"supported":false,"complete":true}','{"relevant":true,"supported":true,"complete":false}','{"relevant":"true","supported":true,"complete":true}'])assert.equal(readRelevanceReview(text),false);
});
