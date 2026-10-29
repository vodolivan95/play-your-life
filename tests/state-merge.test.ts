import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates } from '../src/stateMerge.ts';
import { newAccountGame } from '../src/accountGame.ts';
import type { GameState } from '../src/game.ts';

const base = (): GameState => newAccountGame('Игрок');
const quest = (id: string, extra: Partial<Record<string, unknown>> = {}) => ({
  id, name: id, sphere: 'english', xp: 10, done: true, difficulty: 'Medium',
  ...extra,
});

test('stateMerge: новая задача на каждом устройстве — обе сохраняются', () => {
  const b = base();
  const local: GameState = { ...b, quests: [quest('q-local')] };
  const remote: GameState = { ...b, quests: [quest('q-remote')] };
  const merged = mergeStates(b, local, remote);
  assert.deepEqual(
    merged.quests.map((q: { id: string }) => q.id).sort(),
    ['q-local', 'q-remote'],
  );
});

test('stateMerge: удаление на одном устройстве без правок на другом побеждает', () => {
  const b = { ...base(), quests: [quest('q-old')] };
  const local: GameState = { ...b, quests: [] }; // удалили на телефоне
  const remote: GameState = { ...b }; // на компьютере не трогали
  const merged = mergeStates(b, local, remote);
  assert.deepEqual(merged.quests, []);
});

test('stateMerge: удаление на одном устройстве против правки на другом — правка побеждает', () => {
  const b = { ...base(), quests: [quest('q-old', { done: false })] };
  const local: GameState = { ...b, quests: [] }; // удалили на телефоне
  const remote: GameState = {
    ...b,
    quests: [quest('q-old', { done: true })], // на компьютере отметили выполненной
  };
  const merged = mergeStates(b, local, remote);
  assert.equal(merged.quests.length, 1);
  assert.equal(merged.quests[0].done, true);
});

test('stateMerge: накопительные поля (xp, монеты, xp сферы) складывают честный вклад каждой стороны', () => {
  const b = base();
  const local: GameState = {
    ...b,
    xp: b.xp + 20,
    coins: b.coins + 5,
    spheres: {
      ...b.spheres,
      english: { ...b.spheres.english, xp: b.spheres.english.xp + 20 },
    },
  };
  const remote: GameState = {
    ...b,
    xp: b.xp + 30,
    coins: b.coins + 2,
    spheres: {
      ...b.spheres,
      english: { ...b.spheres.english, xp: b.spheres.english.xp + 30 },
    },
  };
  const merged = mergeStates(b, local, remote);
  assert.equal(merged.xp, b.xp + 50);
  assert.equal(merged.coins, b.coins + 7);
  assert.equal(merged.spheres.english.xp, b.spheres.english.xp + 50);
});

test('stateMerge: обычный скаляр не трогали локально — берём облачное значение', () => {
  const b = base();
  const local: GameState = { ...b }; // имя не менялось на этом устройстве
  const remote: GameState = { ...b, profile: { ...b.profile, name: 'Новое имя' } };
  const merged = mergeStates(b, local, remote);
  assert.equal(merged.profile.name, 'Новое имя');
});

test('stateMerge: обычный скаляр изменён только локально — остаётся локальное значение', () => {
  const b = base();
  const local: GameState = { ...b, profile: { ...b.profile, name: 'С телефона' } };
  const remote: GameState = { ...b };
  const merged = mergeStates(b, local, remote);
  assert.equal(merged.profile.name, 'С телефона');
});

test('stateMerge: обе стороны изменили один и тот же скаляр по-разному — побеждает текущее устройство (local)', () => {
  const b = base();
  const local: GameState = { ...b, profile: { ...b.profile, name: 'С телефона' } };
  const remote: GameState = { ...b, profile: { ...b.profile, name: 'С компьютера' } };
  const merged = mergeStates(b, local, remote);
  assert.equal(merged.profile.name, 'С телефона');
});

test('stateMerge: ничего не менялось ни там, ни там — результат идентичен базе', () => {
  const b = base();
  const merged = mergeStates(b, b, b);
  assert.deepEqual(merged, b);
});
