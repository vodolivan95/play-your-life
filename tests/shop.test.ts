import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { buyItem, redeemPurchase, selectRewardTarget, shopItems } from '../src/shop.ts';
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

import { saveCustomReward, removeCustomReward, shopCatalog, findShopItem, MAX_CUSTOM_REWARDS } from '../src/shop.ts';
const photo = 'data:image/jpeg;base64,' + 'A'.repeat(400);
test('своя награда: картинка, цена, покупка, использование и резервная копия', () => {
  let state = saveCustomReward({ ...initialState(), coins: 500 }, { name: '  Поход в кино с друзьями ', price: 220, image: photo, description: 'IMAX' });
  const reward = state.shop!.customRewards![0];
  assert.equal(reward.name, 'Поход в кино с друзьями');
  assert.match(reward.id, /^custom-/);
  assert.ok(shopCatalog(state).some((i) => i.id === reward.id && i.custom && i.image === photo));
  state = buyItem(state, reward.id);
  assert.equal(state.coins, 280);
  state = redeemPurchase(state, state.shop!.purchases[0].id);
  assert.ok(state.shop!.purchases[0].usedAt);
  assert.deepEqual(restoreBackup(backupText(state)), state);
  state = selectRewardTarget(state, reward.id);
  assert.equal(state.shop!.rewardTargetId, reward.id);
  const edited = saveCustomReward(state, { id: reward.id, name: 'Кино', price: 300 });
  assert.equal(edited.shop!.customRewards![0].price, 300);
  assert.equal(edited.shop!.customRewards![0].image, undefined);
  assert.equal(edited.shop!.purchases[0].price, 220, 'прежняя покупка не меняется');
});
test('своя награда: проверки цены, названия и лимита', () => {
  const s = initialState();
  assert.throws(() => saveCustomReward(s, { name: '', price: 10 }), /Название/);
  assert.throws(() => saveCustomReward(s, { name: 'Х', price: 0 }), /Цена/);
  assert.throws(() => saveCustomReward(s, { name: 'Х', price: 1.5 }), /Цена/);
  assert.throws(() => saveCustomReward(s, { name: 'Х', price: 10, image: 'javascript:alert(1)' }), /картинка/);
  let many = s;
  for (let i = 0; i < MAX_CUSTOM_REWARDS; i++) many = saveCustomReward(many, { name: `Награда ${i}`, price: 10 });
  assert.throws(() => saveCustomReward(many, { name: 'Лишняя', price: 10 }), /до 24/);
});
test('купленную свою награду убирают из витрины, но покупка остаётся', () => {
  let state = saveCustomReward({ ...initialState(), coins: 100 }, { name: 'Торт', price: 50 });
  const id = state.shop!.customRewards![0].id;
  const fresh = removeCustomReward(state, id);
  assert.equal(fresh.shop!.customRewards!.length, 0, 'некупленная удаляется');
  state = selectRewardTarget(buyItem(state, id), id);
  state = removeCustomReward(state, id);
  assert.equal(state.shop!.customRewards![0].archived, true);
  assert.equal(state.shop!.rewardTargetId, undefined);
  assert.ok(!shopCatalog(state).some((i) => i.id === id));
  assert.equal(findShopItem(state, id)?.name, 'Торт');
  assert.throws(() => buyItem(state, id), /недоступна/);
  assert.deepEqual(restoreBackup(backupText(state)), state);
});
test('сохранение с поддельной своей наградой отклоняется', () => {
  const state = saveCustomReward(initialState(), { name: 'Торт', price: 50 });
  const bad = { ...state, shop: { ...state.shop!, customRewards: [{ ...state.shop!.customRewards![0], price: -5 }] } };
  assert.throws(() => restoreBackup(backupText(bad as typeof state)));
  const orphan = { ...state, shop: { ...state.shop!, purchases: [{ id: 'p', itemId: 'custom-unknown-0000', price: 1, date: new Date().toISOString() }] } };
  assert.throws(() => restoreBackup(backupText(orphan as typeof state)));
});

test('раздел «Награда Люкс»: много дорогих наград, обычные награды отдельно', () => {
  const lux = shopItems.filter((i) => 'lux' in i && i.lux);
  assert.ok(lux.length >= 9);
  assert.ok(lux.every((i) => i.kind === 'reward' && i.price >= 1500));
  assert.ok(shopItems.filter((i) => i.kind === 'reward' && !('lux' in i)).length >= 8);
  const state = buyItem({ ...initialState(), coins: 5000 }, 'luxhotel');
  assert.equal(state.coins, 2000);
  assert.deepEqual(restoreBackup(backupText(state)), state);
});
test('своя награда может попасть в «Награду Люкс» и сохраняется', () => {
  const base = { ...initialState(), coins: 9000 };
  const next = saveCustomReward(base, { name: 'Новый велосипед', price: 6000, lux: true });
  const own = shopCatalog(next).find((i) => i.name === 'Новый велосипед')!;
  assert.equal(own.lux, true);
  assert.equal(own.price, 6000);
  assert.equal(shopCatalog(saveCustomReward(base, { name: 'Пицца', price: 200 })).find((i) => i.name === 'Пицца')!.lux, undefined);
  assert.deepEqual(restoreBackup(backupText(next)), next);
  assert.equal(buyItem(next, own.id).coins, 3000);
  const broken = { ...next, shop: { ...next.shop, customRewards: [{ ...next.shop!.customRewards![0], lux: 'да' }] } };
  assert.throws(() => restoreBackup(JSON.stringify(broken)));
});
