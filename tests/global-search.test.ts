import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import type { Goal, Quest } from '../src/game.ts';
import { searchEverything } from '../src/globalSearch.ts';

function withQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q1',
    name: 'Пробежать 5 км',
    sphere: 'sport',
    xp: 20,
    done: false,
    difficulty: 'Medium',
    ...overrides,
  };
}

function withGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    name: 'Выучить английский',
    sphere: 'english',
    current: 10,
    target: 100,
    created: new Date().toISOString(),
    reward: 100,
    rewarded: false,
    progressMode: 'manual',
    ...overrides,
  };
}

test('находит задачу по подстроке без учёта регистра', () => {
  const state = { ...initialState(), quests: [withQuest()], goals: [] };
  const results = searchEverything(state, 'пробеж');
  assert.ok(results.some((r) => r.kind === 'task' && r.id === 'q1'));
});

test('находит проект и показывает его прогресс', () => {
  const state = { ...initialState(), quests: [], goals: [withGoal()] };
  const results = searchEverything(state, 'англ');
  const found = results.find((r) => r.kind === 'goal' && r.id === 'g1');
  assert.ok(found);
  assert.match(found!.subtitle, /10%/);
});

test('находит сферу и соответствующее здание в Городе', () => {
  const state = { ...initialState(), quests: [], goals: [] };
  const results = searchEverything(state, 'финанс');
  assert.ok(results.some((r) => r.kind === 'sphere' && r.id === 'finance'));
  assert.ok(results.some((r) => r.kind === 'city' && r.id === 'finance'));
});

test('запрос «город» открывает саму вкладку Города', () => {
  const state = { ...initialState(), quests: [], goals: [] };
  const results = searchEverything(state, 'город');
  assert.ok(results.some((r) => r.kind === 'city' && r.id === ''));
});

test('находит достижение по названию', () => {
  const state = { ...initialState(), quests: [], goals: [] };
  const results = searchEverything(state, 'первый шаг');
  assert.ok(results.some((r) => r.kind === 'achievement'));
});

test('пустой запрос не возвращает результатов', () => {
  const state = initialState();
  assert.deepEqual(searchEverything(state, ''), []);
  assert.deepEqual(searchEverything(state, '   '), []);
});

test('результат ограничен лимитом', () => {
  const quests: Quest[] = Array.from({ length: 20 }, (_, i) => withQuest({ id: `q${i}`, name: `Задача номер ${i}` }));
  const state = { ...initialState(), quests, goals: [] };
  const results = searchEverything(state, 'задача', 5);
  assert.equal(results.length, 5);
});

test('совпадения с начала названия идут выше совпадений в середине', () => {
  const quests: Quest[] = [
    withQuest({ id: 'mid', name: 'Полить цветы' }),
    withQuest({ id: 'start', name: 'Цветы для бабушки' }),
  ];
  const state = { ...initialState(), quests, goals: [] };
  const results = searchEverything(state, 'цветы');
  const startIndex = results.findIndex((r) => r.id === 'start');
  const midIndex = results.findIndex((r) => r.id === 'mid');
  assert.ok(startIndex >= 0 && midIndex >= 0);
  assert.ok(startIndex < midIndex);
});
