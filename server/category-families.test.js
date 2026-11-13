import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryFamily,groupCategoryFamilies} from '../src/lib/category-families.ts';

test('category families detect title alphabet while ignoring marks, numbers and presentation forms',()=>{
  for(const name of ['Hasil Bahtsu Masa\'il','BM-PBNU,PWNU,PCNU','Piss-Ktb 2015','Maktabah Al-Anwar Sarang','Fikih: شَ','other langh','123 --',''])assert.equal(categoryFamily(name),'bahsul-masail',name);
  for(const name of ['فقه شافعي','العقيــدة و علم الكلام','[سلة المحذوفات]','كتب عامة غير مصنفة','١٢٣: الحديث','ﻓﻘﻪ','فقه (ID)','ع a'])assert.equal(categoryFamily(name),'turats',name);
});

test('grouping preserves source IDs, names, order and category zero without mutating input',()=>{
  const categories=Object.freeze([Object.freeze({id:0,name:'كتب عامة غير مصنفة'}),Object.freeze({id:321,name:'BM-PBNU,PWNU,PCNU'}),Object.freeze({id:15,name:'فقه شافعي'}),Object.freeze({id:334,name:'Piss-Ktb'})]);
  const groups=groupCategoryFamilies([...categories]);
  assert.deepEqual(groups.map(group=>group.title),['Hasil Bahsul Masail','Kitab Turats']);
  assert.deepEqual(groups[0].categories.map(category=>category.id),[321,334]);
  assert.deepEqual(groups[1].categories.map(category=>category.id),[0,15]);
  assert.equal(groups.flatMap(group=>group.categories).length,categories.length);
  assert.equal(groups[1].categories[0],categories[0]);
  assert.deepEqual(groupCategoryFamilies([]).map(group=>group.categories),[[],[]]);
});
