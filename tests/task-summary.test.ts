import assert from 'node:assert/strict';
import test from 'node:test';
import type { Quest } from '../src/game.ts';
import { completedInWeek, todayTaskGroups } from '../src/taskSummary.ts';
import { calendarItems, daySummary, nextItem, weekLoad } from '../src/tasksCalendar.ts';

const quest = (over: Partial<Quest>): Quest => ({
  id: 'q', name: 'Шаг', sphere: 'health', xp: 20, done: false, difficulty: 'Medium', ...over,
});
const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();

test('день выполнения определяется локально, в том числе сразу после полуночи', () => {
  const quests = [
    quest({ id: 'done', done: true, completedAt: local(7, 0, 15) }),
    quest({ id: 'yesterday', done: true, completedAt: local(6, 23, 45) }),
    quest({ id: 'today', dueAt: local(7, 0, 30) }),
    quest({ id: 'late', dueAt: '2026-11-06' }),
    quest({ id: 'loose' }),
    quest({ id: 'tomorrow', dueAt: '2026-11-08' }),
    quest({ id: 'skip', dueAt: '2026-11-07', wontDo: true }),
  ];
  const groups = todayTaskGroups(quests, '2026-11-07');
  assert.deepEqual(groups.done.map((q) => q.id), ['done']);
  assert.deepEqual(groups.overdue.map((q) => q.id), ['late']);
  assert.deepEqual(groups.today.map((q) => q.id), ['today', 'loose']);
});

test('недельные выполнения ограничены локальными понедельником и воскресеньем', () => {
  const quests = [
    quest({ id: 'before', done: true, completedAt: local(1, 23, 59) }),
    quest({ id: 'monday', done: true, completedAt: local(2, 0, 1) }),
    quest({ id: 'sunday', done: true, completedAt: local(8, 23, 59) }),
    quest({ id: 'after', done: true, completedAt: local(9, 0, 1) }),
    quest({ id: 'invalid', done: true, completedAt: 'invalid' }),
    quest({ id: 'open', completedAt: local(7, 12) }),
  ];
  assert.deepEqual(completedInWeek(quests, '2026-11-07').map((q) => q.id), ['monday', 'sunday']);
});

test('отказ от задачи сохраняет её в календаре, исключая из нагрузки, прогресса и ближайшего шага', () => {
  const items = calendarItems([
    quest({ id: 'skip', wontDo: true, dueAt: '2026-11-07' }),
    quest({ id: 'active', dueAt: '2026-11-07' }),
  ]);
  assert.equal(items.length, 2);
  assert.equal(daySummary(items, '2026-11-07').count, 1);
  assert.equal(weekLoad(items, '2026-11-07')[5].count, 1);
  assert.equal(nextItem(items, new Date(2026, 10, 7, 12))?.quest.id, 'active');
});
