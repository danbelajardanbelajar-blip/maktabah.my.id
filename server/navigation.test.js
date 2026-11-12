import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNavigation,navigationHash,routePage,routeCategories} from '../src/lib/navigation.ts';
test('navigation restores search modes, category zero, page and Unicode query from a shareable URL',()=>{
  const hash=navigationHash('advanced_search',{q:'صلاة الجماعة',mode:'text',page:3,cats:'0,12'});
  const route=parseNavigation(hash);
  assert.equal(route.tab,'advanced_search');assert.equal(route.params.get('q'),'صلاة الجماعة');
  assert.equal(routePage(route.params.get('page')),3);assert.deepEqual(routeCategories(route.params.get('cats')),[0,12]);
});
test('navigation supports legacy admin links and bounds malformed pagination',()=>{
  assert.equal(parseNavigation('','?admin=1').tab,'admin');
  assert.equal(parseNavigation('#/beranda','?admin=1').tab,'home');
  assert.equal(parseNavigation('#/unknown').tab,'home');assert.equal(routePage('abc'),1);
  assert.equal(routePage('-2'),1);assert.equal(routePage('99999999'),100000);
  assert.deepEqual(routeCategories('0,no,-1,2,2'),[0,2]);
});
test('author profile and author management routes preserve identifiers and Arabic search',()=>{
  const route=parseNavigation(navigationHash('authors',{id:512,q:'يوسف',page:2}));
  assert.equal(route.tab,'authors');assert.equal(route.params.get('id'),'512');assert.equal(route.params.get('q'),'يوسف');
});
