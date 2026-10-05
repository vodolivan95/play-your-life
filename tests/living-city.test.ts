import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { buyCityUpgrade, cityBalance } from '../src/city.ts';
import { validateState } from '../src/stateValidation.ts';

test('Задачи и проекты дают жетоны, повторная покупка запрещена, сохранение валидно', () => {
  const state = initialState();
  state.events = [
    { id: 'q', sphere: 'hobby', title: 'Рисунок', xp: 20, kind: 'quest', date: new Date().toISOString() },
    { id: 'g', sphere: 'hobby', title: 'Картина', xp: 100, kind: 'goal', date: new Date().toISOString() },
  ];
  assert.equal(cityBalance(state), 110);
  const next = buyCityUpgrade(state, 'hobby', 0);
  assert.equal(cityBalance(next), 80);
  assert.equal(next.coins, state.coins);
  assert.equal(state.cityPurchases, undefined);
  assert.throws(() => buyCityUpgrade(next, 'hobby', 0));
  assert.throws(() => buyCityUpgrade(next, 'sport', 2));
  validateState(JSON.parse(JSON.stringify(next)));
  assert.equal(cityBalance(buyCityUpgrade(next, 'sport', 1)), 0);
});
test('Покупки проверяют сферу, слот и повреждённые сохранения', () => {
  const state = initialState();
  assert.equal(cityBalance(state), 0);
  assert.throws(() => buyCityUpgrade(state, 'unknown', 0));
  assert.throws(() => buyCityUpgrade(state, '__proto__', 0));
  assert.throws(() => buyCityUpgrade(state, 'health', -1));
  assert.throws(() => buyCityUpgrade(state, 'health', 0.5));
  assert.throws(() => validateState({ ...state, cityPurchases: [{ id: 'x', sphere: 'health', slot: 0, price: 0, date: new Date().toISOString() }] }));
});
