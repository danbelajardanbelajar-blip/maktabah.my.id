import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages,nextScrollHidden} from '../src/lib/messages.ts';
import {adminGroup,adminLocation,adminParent,adminTitle} from '../src/lib/admin-navigation.ts';

test('the floating message button hides on scroll down, returns on scroll up and near the top', () => {
  assert.deepEqual(nextScrollHidden(0, 400, false), {hidden:true, anchor:400});
  assert.deepEqual(nextScrollHidden(400, 404, true), {hidden:true, anchor:400}, 'small jitter is ignored');
  assert.deepEqual(nextScrollHidden(400, 300, true), {hidden:false, anchor:300});
  assert.deepEqual(nextScrollHidden(300, 40, true), {hidden:false, anchor:40});
});

test('live and reloaded messages merge once, in order', () => {
  const m = (id, body = String(id)) => ({id, sender:'visitor', body, created_at:''});
  const current = [m(1), m(3)];
  assert.equal(mergeMessages(current, []), current);
  assert.deepEqual(mergeMessages(current, [m(2), m(3, 'baru')]).map(x => [x.id, x.body]), [[1, '1'], [2, '2'], [3, 'baru']]);
});

test('visitor messages are an admin view under Masukan', () => {
  assert.equal(adminLocation('#/admin?view=messages').view, 'messages');
  assert.equal(adminGroup('messages'), 'Masukan');assert.equal(adminParent('messages'), 'categories');assert.equal(adminTitle('messages'), 'Pesan Pengunjung');
});
