import assert from 'node:assert/strict';
import test from 'node:test';
import { dueFor, duePreset, taskContribution, updateTaskSettings } from '../src/taskSettings.ts';
import type { GameState, Quest } from '../src/game.ts';

const quest = (over: Partial<Quest>): Quest => ({
  id: 'q1', name: 'Пробежка', sphere: 'sport', xp: 20, done: false, difficulty: 'Medium',
  sourceType: 'USER_CREATED', goalId: 'g1', stageId: 's1', ...over,
});
const state = (quests: Quest[]) => ({
  quests,
  goals: [{ id: 'g1', name: 'Марафон', sphere: 'sport', stages: [{ id: 's1', name: 'База' }, { id: 's2', name: 'Темп' }] }],
}) as unknown as GameState;

test('срок: быстрые варианты и распознавание', () => {
  assert.equal(dueFor('today', '2026-10-18'), '2026-10-18');
  assert.equal(dueFor('tomorrow', '2026-10-18'), '2026-10-19');
  assert.equal(dueFor('week', '2026-10-14'), '2026-10-18');
  assert.equal(dueFor('none', '2026-10-18'), null);
  assert.equal(duePreset('2026-10-19', '2026-10-18'), 'tomorrow');
  assert.equal(duePreset('2026-12-01', '2026-10-18'), 'date');
  assert.equal(duePreset(undefined, '2026-10-18'), 'none');
});
test('настройки: сложность меняет XP, этап и срок сохраняются', () => {
  const next = updateTaskSettings(state([quest({})]), 'q1', { difficulty: 'Hard', stageId: 's2', dueAt: '2026-11-02', name: ' Бег ' });
  const q = next.quests[0];
  assert.equal(q.xp, 40);
  assert.equal(q.stageId, 's2');
  assert.equal(q.dueAt, '2026-11-02');
  assert.equal(q.name, 'Бег');
  assert.equal(updateTaskSettings(next, 'q1', { dueAt: null }).quests[0].dueAt, undefined);
});
test('настройки: отказы', () => {
  const s = state([quest({}), quest({ id: 'q2', done: true }), quest({ id: 'q3', sourceType: 'SYSTEM' }), quest({ id: 'q4', goalId: undefined, stageId: undefined })]);
  assert.throws(() => updateTaskSettings(s, 'q2', { name: 'x' }));
  assert.throws(() => updateTaskSettings(s, 'q3', { difficulty: 'Hard' }));
  assert.throws(() => updateTaskSettings(s, 'q1', { stageId: 'нет' }));
  assert.throws(() => updateTaskSettings(s, 'q1', { dueAt: '31.12' }));
  // Одиночные задачи тоже можно отключать от TickTick.
  assert.equal(updateTaskSettings(s, 'q4', { sync: false }).quests.find((q) => q.id === 'q4')?.tickTickSync, false);
});
test('перенос в календаре: сдвигает срок (и начало) на N дней, время суток сохраняется', () => {
  const s = state([quest({ dueAt: '2026-10-20T15:30:00.000Z', startsAt: '2026-10-20T13:00:00.000Z' })]);
  const moved = updateTaskSettings(s, 'q1', { shiftDays: 2 }).quests[0];
  assert.equal(moved.dueAt, '2026-10-22T15:30:00.000Z');
  assert.equal(moved.startsAt, '2026-10-22T13:00:00.000Z');
  // Дата без времени (как у «Срок» без выбора часа) сдвигается так же просто.
  const plain = updateTaskSettings(state([quest({ dueAt: '2026-10-20' })]), 'q1', { shiftDays: -5 }).quests[0];
  assert.equal(plain.dueAt, '2026-10-15');
});
test('перенос в календаре: связанную с TickTick задачу (плановую дату) перетащить нельзя', () => {
  const s = state([quest({ dueAt: '2026-10-20', tickTickSharedAt: '2026-10-19T00:00:00.000Z' })]);
  assert.throws(() => updateTaskSettings(s, 'q1', { shiftDays: 1 }), /TickTick/);
});
test('перенос в календаре: без срока или без смещения — отказ', () => {
  assert.throws(() => updateTaskSettings(state([quest({})]), 'q1', { shiftDays: 1 }));
  assert.throws(() => updateTaskSettings(state([quest({ dueAt: '2026-10-20' })]), 'q1', { shiftDays: 0 }));
});
test('вклад: доля в цели и синхронизация', () => {
  const s = state([quest({}), quest({ id: 'q5' })]);
  const c = taskContribution(s, s.quests[0]);
  assert.equal(c.goalShare, 50);
  assert.equal(c.xp, 20);
  const off = updateTaskSettings(s, 'q1', { sync: false }).quests[0];
  assert.equal(off.tickTickSync, false);
  assert.equal(updateTaskSettings(updateTaskSettings(s, 'q1', { sync: false }), 'q1', { sync: true }).quests[0].tickTickSync, undefined);
});

import { nextRepeatDay, completeQuest } from '../src/game.ts';
import { newAccountGame } from '../src/accountGame.ts';
import { validateState } from '../src/stateValidation.ts';

test('повтор: следующая дата и новая задача после выполнения', () => {
  assert.equal(nextRepeatDay('2026-10-16', 'weekdays', '2026-10-15'), '2026-10-19');
  assert.equal(nextRepeatDay('2026-10-01', 'daily', '2026-10-18'), '2026-10-19');
  assert.equal(nextRepeatDay('2026-01-31', 'monthly', '2026-01-01').slice(0, 7), '2026-03');
  const s = newAccountGame('И');
  s.quests = [{ id: 'r1', name: 'Зарядка', sphere: 'health', xp: 20, done: false, difficulty: 'Medium', dueAt: '2026-10-18', repeat: 'daily', subtasks: [{ id: 'a', title: 'Шаг', done: true }] }];
  const next = completeQuest(s, 'r1');
  assert.equal(next.quests.length, 2);
  const copy = next.quests[1];
  assert.equal(copy.done, false);
  assert.equal(copy.repeat, 'daily');
  assert.equal(copy.subtasks?.[0].done, false);
  assert.ok(copy.dueAt && copy.dueAt > '2026-10-18');
});
test('повтор и подзадачи проходят проверку сохранения', () => {
  const s = newAccountGame('И');
  s.quests = [{ id: 'r2', name: 'Чтение', sphere: 'health', xp: 20, done: false, difficulty: 'Medium', repeat: 'weekly', subtasks: [{ id: 'a', title: 'Глава', done: false }] }];
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
  const bad = JSON.parse(JSON.stringify(s));
  bad.quests[0].repeat = 'hourly';
  assert.throws(() => validateState(bad));
});
import { migrateState, difficulties } from '../src/game.ts';
test('очки сложности: новые значения и переход старых сохранений', () => {
  assert.deepEqual(Object.values(difficulties), [5, 10, 20, 40, 80]);
  const s = newAccountGame('И');
  s.quests = [{ id: 'o', name: 'Старая', sphere: 'sport', xp: 35, done: false, difficulty: 'Hard', sourceType: 'USER_CREATED', ownerId: 'u', rewardCoins: 0 }];
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
  assert.equal(migrateState(s).quests[0].xp, 40);
  s.quests[0].xp = 41;
  assert.throws(() => validateState(JSON.parse(JSON.stringify(s))));
});
