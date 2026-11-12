import test from 'node:test';import assert from 'node:assert/strict';
import {authorDeathDate,compareAuthorDates} from './author-chronology.js';
test('death references retain exact, qualified, Arabic digits and century-only meaning',()=>{
  assert.equal(authorDeathDate('٩١١ هـ').year,911);assert.equal(authorDeathDate('۹۱۱').year,911);
  assert.equal(authorDeathDate('بعد 1198').kind,'after');assert.equal(authorDeathDate('نحو 543').kind,'approx');
  assert.equal(authorDeathDate('قبل 300').label,'Sebelum 300 H');
  const c=authorDeathDate('ق 4');assert.equal(c.year,null);assert.equal(c.century,4);assert.equal(c.sortYear,301);assert.equal(c.label,'Abad ke-4 H');
  for(const v of ['',null,'0','-','911 / 1505','غير معروف'])assert.equal(authorDeathDate(v).kind,'unknown');
});
test('chronology orders before pagination with unknowns last and no fabricated year for a century',()=>{
  const rows=[['Unknown',''],['Late','911'],['Century','ق 4'],['Early','13'],['Qualified','نحو 543']].map(([name,death_text],i)=>({id:i,name,deathDate:authorDeathDate(death_text)}));
  rows.sort(compareAuthorDates);assert.deepEqual(rows.map(r=>r.name),['Early','Century','Qualified','Late','Unknown']);
});
