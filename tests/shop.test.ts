import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { buyItem, redeemPurchase, selectRewardTarget } from '../src/shop.ts';
import { backupText, restoreBackup } from '../src/backup.ts';

test('покупка списывает только монеты и сохраняется в копии', () => {
  const state = { ...initialState(), coins: 1000 };
  const next = buyItem(state, 'coffee');
  assert.equal(next.coins, 850);
  assert.equal(state.coins, 1000);
  assert.equal(next.xp, state.xp);
  assert.deepEqual(next.events, state.events);
  assert.deepEqual(next.spheres, state.spheres);
  assert.deepEqual(restoreBackup(backupText(next)), next);
  assert.equal(buyItem(next, 'coffee').shop?.purchases.length, 2);
});
test('нельзя потратить больше баланса или купить неизвестную награду', () => {
  const state = { ...initialState(), coins: 149 };
  assert.throws(() => buyItem(state, 'coffee'), /Недостаточно/);
  assert.throws(() => buyItem(state, 'unknown'));
  assert.equal(state.shop, undefined);
});
test('рамки покупаются один раз, надеваются только из инвентаря', () => {
  const state = buyItem({ ...initialState(), coins: 1000 }, 'gold');
  assert.throws(() => buyItem(state, 'gold'), /уже/);
  assert.equal(redeemPurchase(state, 'unknown'), state);
  const next = redeemPurchase(state, state.shop!.purchases[0].id);
  assert.equal(next.shop?.equippedFrame, 'gold');
  assert.equal(next.coins, 500);
  assert.deepEqual(restoreBackup(backupText(next)), next);
  assert.throws(() =>
    restoreBackup(
      JSON.stringify({ ...next, shop: { ...next.shop, equippedFrame: 'sky' } }),
    ),
  );
});
test('использование награды не даёт XP и не списывает повторно монеты', () => {
  const state = buyItem({ ...initialState(), coins: 1000 }, 'movie');
  const id = state.shop!.purchases[0].id;
  const next = redeemPurchase(state, id);
  assert.ok(next.shop?.purchases[0].usedAt);
  assert.equal(next.coins, 700);
  assert.equal(next.xp, state.xp);
  assert.equal(redeemPurchase(next, id), next);
});
test('старые сохранения работают, повреждённый магазин отклоняется', () => {
  const state = initialState();
  assert.deepEqual(restoreBackup(backupText(state)), state);
  for (const shop of [
    { purchases: 42 },
    {
      purchases: [
        {
          id: 'x',
          itemId: 'unknown',
          price: 1,
          date: new Date().toISOString(),
        },
      ],
    },
    { purchases: [], equippedFrame: 'gold' },
  ])
    assert.throws(() => restoreBackup(JSON.stringify({ ...state, shop })));
});

test('выбор награды сохраняется без покупки, списания монет или начисления XP', () => {
  const state = buyItem({ ...initialState(), coins: 1000 }, 'gold');
  const next = selectRewardTarget(state, 'games');
  assert.equal(next.shop?.rewardTargetId, 'games');
  assert.equal(next.coins, state.coins);
  assert.equal(next.xp, state.xp);
  assert.deepEqual(next.shop?.purchases, state.shop?.purchases);
  assert.equal(next.shop?.equippedFrame, state.shop?.equippedFrame);
  assert.equal(state.shop?.rewardTargetId, undefined);
  assert.deepEqual(restoreBackup(backupText(next)), next);
  assert.equal(selectRewardTarget(next, 'games'), next);
  const cleared = selectRewardTarget(next, null);
  assert.equal(cleared.shop?.rewardTargetId, undefined);
  assert.deepEqual(restoreBackup(backupText(cleared)), cleared);
});

test('цель накопления принимает только награды и отклоняет повреждённый импорт', () => {
  const state = initialState();
  assert.throws(() => selectRewardTarget(state, 'unknown'));
  assert.throws(() => selectRewardTarget(state, 'gold'));
  assert.equal(selectRewardTarget(state, null), state);
  const next = selectRewardTarget(state, 'coffee');
  for (const id of ['unknown', 'gold', 42, null]) {
    const copy = JSON.parse(backupText(next));
    copy.state.shop.rewardTargetId = id;
    assert.throws(() => restoreBackup(JSON.stringify(copy)));
  }
});
