import assert from 'node:assert/strict';
import test from 'node:test';
import { isInviteCode, isOurPage, lifeModeOf, makeInviteCode, normalizeInviteCode, ourNavigation, ourRoute, readOurRoute } from '../src/ourLife.ts';
import { ownSpaceId, pickSpace, toSpace } from '../src/sharedSpace.ts';

test('«Наша жизнь»: ровно четыре раздела в порядке ТЗ, у каждого свой адрес', () => {
  assert.deepEqual(ourNavigation.map((x) => x.label), ['Центр общения', 'Общий календарь', 'Наши места', 'Общие собрания']);
  for (const item of ourNavigation) assert.deepEqual(readOurRoute(ourRoute(item.id)), { page: item.id, joinCode: null });
  assert.equal(readOurRoute('#goals'), null);
  assert.equal(readOurRoute('#our/unknown'), null);
  assert.equal(lifeModeOf('our-places'), 'our');
  assert.equal(lifeModeOf('tasks'), 'my');
  assert.ok(isOurPage('our-chat') && !isOurPage('home'));
});

test('коды приглашений: 10 символов без похожих букв, ссылка разбирается', () => {
  const code = makeInviteCode();
  assert.ok(isInviteCode(code), code);
  assert.equal(normalizeInviteCode(' abcd-efgh 23 '), 'ABCDEFGH23');
  assert.deepEqual(readOurRoute(`#our/join/${code}`), { page: 'our-chat', joinCode: code });
  assert.ok(!isInviteCode('ABCDEFGHIO'), 'I и O не используются');
});

test('пространство: своё id без дублей, при нескольких выбирается то, где двое', () => {
  assert.equal(ownSpaceId('u1'), 's_u1');
  const solo = toSpace('s_ivan', { ownerId: 'ivan', memberIds: ['ivan'], members: { ivan: { name: 'Иван' } } })!;
  const pair = toSpace('s_alex', { ownerId: 'alex', memberIds: ['alex', 'ivan'], members: { alex: { name: 'Александр' } } })!;
  assert.equal(pickSpace([solo, pair])?.id, 's_alex');
  assert.equal(pair.members.ivan.name, 'Участник');
  assert.equal(toSpace('x', { memberIds: [] }), null);
  assert.equal(pickSpace([]), null);
});
