import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeScore,
  completeQuest,
  dateKey,
  initialState,
  streak,
  updateGoal,
} from '../src/game.ts';

test('квест начисляет XP обеим шкалам и монеты только один раз', () => {
  const state = initialState();
  const done = completeQuest(state, 'english-1');
  assert.equal(done.xp, state.xp + 20);
  assert.equal(done.spheres.english.xp, state.spheres.english.xp + 20);
  assert.equal(done.coins, state.coins + 4);
  assert.equal(done.completed, 1);
  assert.equal(done.activeDates.length, 1);
  assert.deepEqual(completeQuest(done, 'english-1'), done);
  assert.equal(state.quests[0].done, false);
});
test('Life Score начисляет бонус за рост и исключает фарм', () => {
  const state = initialState();
  const improved = changeScore(state, 'sport', 7);
  assert.equal(improved.xp - state.xp, 45);
  assert.equal(improved.spheres.sport.xp - state.spheres.sport.xp, 45);
  const lowered = changeScore(improved, 'sport', 4);
  assert.equal(lowered.xp, improved.xp);
  assert.equal(lowered.spheres.sport.previousScore, 7);
  const restored = changeScore(lowered, 'sport', 7);
  assert.equal(restored.xp, improved.xp);
  assert.equal(changeScore(restored, 'sport', 8).xp, improved.xp + 15);
  assert.deepEqual(changeScore(restored, 'sport', 7), restored);
  assert.deepEqual(changeScore(restored, 'sport', 10), restored);
});
test('цель выдаёт награду один раз, включая снижение и восстановление', () => {
  const state = initialState();
  const done = updateGoal(state, 'b2', 100);
  assert.equal(done.xp, state.xp + 200);
  assert.equal(done.spheres.english.xp, state.spheres.english.xp + 200);
  assert.equal(done.goals[0].rewarded, true);
  const restored = updateGoal(updateGoal(done, 'b2', 10), 'b2', 100);
  assert.equal(restored.xp, done.xp);
});
test('серия учитывает календарные дни, вчера и пропуски', () => {
  const now = new Date(2026, 9, 3, 12);
  assert.equal(streak(['2026-10-01', '2026-10-02', '2026-10-03'], now), 3);
  assert.equal(streak(['2026-10-01', '2026-10-02'], now), 2);
  assert.equal(streak(['2026-10-01'], now), 0);
  assert.equal(streak(['2026-10-02', '2026-10-02'], now), 1);
  assert.equal(streak(['2026-09-30', '2026-10-01'], new Date(2026, 9, 1)), 2);
});
test('награда за рубеж серии не повторяется при втором квесте', () => {
  const state = initialState();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const before = new Date();
  before.setDate(before.getDate() - 2);
  state.activeDates = [dateKey(before), dateKey(yesterday)];
  const done = completeQuest(state, 'english-1');
  assert.equal(done.xp, state.xp + 20 + 10);
  assert.equal(done.streakClaims.length, 1);
  const next = completeQuest(done, 'sport-1');
  assert.equal(next.xp, done.xp + 35);
  assert.equal(next.streakClaims.length, 1);
});
