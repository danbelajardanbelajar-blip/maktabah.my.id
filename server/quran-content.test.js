import test from 'node:test';
import assert from 'node:assert/strict';
import {showOpeningBismillah} from '../src/lib/quran-content.ts';

test('opening basmalah never duplicates Al-Fatihah verse 1 or appears mid-surah',()=>{
  assert.equal(showOpeningBismillah(1,1),false);
  assert.equal(showOpeningBismillah(9,1),false);
  assert.equal(showOpeningBismillah(2,1),true);
  assert.equal(showOpeningBismillah(2,255),false);
  assert.equal(showOpeningBismillah(null,undefined),false);
});
