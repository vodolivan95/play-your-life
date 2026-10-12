import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, completeQuest } from '../src/game.ts';
import { roomStats } from '../src/roomStats.ts';
import { roomConfigs, objectSpec, purchaseRoomObject } from '../src/roomEngine.ts';

test('экран спортзала показывает реальный уровень, неделю и задания сферы', () => {
  let state = initialState();
  state.quests = [
    { id: 'run', name: 'Пробежка', sphere: 'sport', xp: 35, difficulty: 'Hard', done: false },
    { id: 'read', name: 'Чтение', sphere: 'growth', xp: 20, difficulty: 'Medium', done: false },
  ];
  const before = roomStats(state, 'sport', 'СПОРТ');
  assert.deepEqual(before.tasks.map((t) => t.id), ['run']);
  state = completeQuest(state, 'run');
  const after = roomStats(state, 'sport', 'СПОРТ');
  assert.equal(after.tasks.length, 0);
  assert.equal(after.weekXp - before.weekXp >= 35, true);
  assert.equal(after.weekDone, before.weekDone + 1);
});

test('кубки — завершённые цели и этапы сферы', () => {
  const state = initialState();
  state.goals = [{ id: 'g', name: 'Марафон', sphere: 'sport', current: 1, target: 1, created: '2026-10-01', reward: 100, rewarded: true, stages: [{ id: 's1', name: 'Этап', status: 'completed' }, { id: 's2', name: 'Этап 2' }] }];
  assert.equal(roomStats(state, 'sport', 'СПОРТ').trophies, 2);
});

test('в каталоге спортзала 11 предметов с моделями и уровнями до 30', () => {
  const catalog = roomConfigs.sport.catalog;
  assert.equal(catalog.length, 11);
  assert.equal(new Set(catalog.map((i) => i.id)).size, 11);
  assert.equal(objectSpec('power-rack').level, 30);
  const rich = { ...initialState(), coins: 5000 };
  rich.spheres.sport = { ...rich.spheres.sport, xp: 200 * 12 };
  assert.ok(purchaseRoomObject(rich, 'sport', 'exercise-bike').rooms?.sport?.purchased.includes('exercise-bike'));
  assert.throws(() => purchaseRoomObject(rich, 'sport', 'power-rack'), /уровень/);
});
