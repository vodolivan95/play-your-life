import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achievements, initialState, personalState, playerProgress, questsForToday, spheres } from '../src/game.ts';

const personalStandard = achievements.find((a) => a.name === 'Личный стандарт')!;

test('самооценка 9 при первом запуске не открывает «Личный стандарт»', () => {
  const scores = Object.fromEntries(spheres.map((s) => [s.id, 9]));
  const state = personalState({ name: 'Иван', avatar: '🦊' }, scores, { name: 'Цель', sphere: 'sport', target: 10 });
  assert.equal(personalStandard.unlocked(state), false);
  assert.equal(personalStandard.progress(state), 0);
});

test('достижение, полученное ранее действием Life Score → 9, сохраняется', () => {
  const state = initialState();
  state.events = [{ id: 'e', sphere: 'sport', title: 'Life Score: 8 → 9', xp: 15, date: new Date().toISOString(), kind: 'score', scoreBefore: 8, scoreAfter: 9 }];
  assert.equal(personalStandard.unlocked(state), true);
  assert.equal(personalStandard.progress(state), 1);
});

test('достижение открывается на 100 уровне сферы', () => {
  const state = initialState();
  state.spheres.sport = { ...state.spheres.sport, xp: 20000 };
  assert.equal(personalStandard.unlocked(state), true);
});

test('демо-режим: полоса считается внутри текущего уровня', () => {
  const state = initialState();
  state.xp = 2450 + 550 + 275; // середина 13 уровня
  const progress = playerProgress(state);
  assert.equal(progress.level, 13);
  assert.equal(Math.round(progress.progress), 50);
  state.xp = 2450;
  assert.equal(playerProgress(state).progress, 0);
});

test('выполненный квест без completedAt ищется по sourceId, а не по названию', () => {
  const now = new Date('2026-10-10T12:00:00');
  const state = initialState();
  state.quests = [
    { id: 'a', name: 'Тренировка', sphere: 'sport', xp: 35, difficulty: 'Hard', done: true },
    { id: 'b', name: 'Тренировка', sphere: 'sport', xp: 35, difficulty: 'Hard', done: true },
  ];
  state.events = [
    { id: 'e1', sphere: 'sport', title: 'Тренировка', xp: 35, date: now.toISOString(), kind: 'quest', sourceId: 'a' },
    { id: 'e2', sphere: 'sport', title: 'Тренировка', xp: 35, date: '2026-10-01T12:00:00', kind: 'quest', sourceId: 'b' },
  ];
  assert.deepEqual(questsForToday(state, now).map((q) => q.id), ['a']);
});
