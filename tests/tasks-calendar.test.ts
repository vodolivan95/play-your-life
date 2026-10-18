import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  calendarDays,
  calendarItem,
  daySummary,
  itemsForDay,
  mondayOf,
  nextItem,
  shiftAnchor,
  weekLoad,
} from '../src/tasksCalendar.ts';
import type { Quest } from '../src/game.ts';

const quest = (over: Partial<Quest>): Quest => ({
  id: 'q',
  name: 'Задача',
  sphere: 'health',
  xp: 20,
  done: false,
  difficulty: 'medium',
  ...over,
});

test('календарь: недели начинаются с понедельника', () => {
  assert.equal(mondayOf('2026-10-18'), '2026-10-12');
  assert.equal(mondayOf('2026-10-12'), '2026-10-12');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('календарь: число дней в видах', () => {
  assert.equal(calendarDays('day', '2026-10-18').length, 1);
  assert.deepEqual(calendarDays('week', '2026-10-18')[0], '2026-10-12');
  assert.equal(calendarDays('twoWeeks', '2026-10-18').length, 14);
  const month = calendarDays('month', '2026-10-18');
  assert.equal(month.length % 7, 0);
  assert.equal(month[0], '2026-09-28');
  assert.equal(month.length, 35);
  assert.equal(calendarDays('month', '2026-11-10').length, 42);
});

test('календарь: стрелки сдвигают день, неделю, две недели и месяц', () => {
  assert.equal(shiftAnchor('day', '2026-10-18', 1), '2026-10-19');
  assert.equal(shiftAnchor('week', '2026-10-18', -1), '2026-10-11');
  assert.equal(shiftAnchor('twoWeeks', '2026-10-18', 1), '2026-11-01');
  assert.equal(shiftAnchor('month', '2026-10-18', 1), '2026-11-01');
  assert.equal(shiftAnchor('month', '2026-01-31', -1), '2025-12-01');
});

test('календарь: задача без срока не попадает в календарь', () => {
  assert.equal(calendarItem(quest({})), undefined);
  const item = calendarItem(quest({ dueAt: '2026-10-20' }));
  assert.equal(item?.day, '2026-10-20');
  assert.equal(item?.start, undefined);
});

test('календарь: время берётся из срока и начала с временем', () => {
  const local = (h: number, m: number) => new Date(2026, 9, 20, h, m).toISOString();
  const due = calendarItem(quest({ dueAt: local(15, 0) }));
  assert.equal(due?.start, '15:00');
  assert.equal(due?.end, '16:00');
  const range = calendarItem(quest({ startsAt: local(9, 30), dueAt: local(11, 0) }));
  assert.equal(range?.start, '09:30');
  assert.equal(range?.end, '11:00');
});

test('календарь: дневной список — сначала без времени, потом по времени', () => {
  const local = (h: number) => new Date(2026, 9, 20, h, 0).toISOString();
  const items = [
    calendarItem(quest({ id: 'a', name: 'В два', dueAt: local(14) })),
    calendarItem(quest({ id: 'b', name: 'Весь день', dueAt: '2026-10-20' })),
    calendarItem(quest({ id: 'c', name: 'В десять', dueAt: local(10) })),
    calendarItem(quest({ id: 'd', name: 'Другой день', dueAt: '2026-10-21' })),
  ].filter((item) => item !== undefined);
  assert.deepEqual(itemsForDay(items, '2026-10-20').map((i) => i.quest.id), ['b', 'c', 'a']);
});

test('календарь: сводка дня, ближайшая задача и нагрузка недели', () => {
  const items = [
    calendarItem(quest({ id: 'a', dueAt: '2026-10-18', done: true, xp: 10 })),
    calendarItem(quest({ id: 'b', dueAt: '2026-10-18', xp: 30 })),
    calendarItem(quest({ id: 'c', dueAt: '2026-10-20' })),
  ].filter((item) => item !== undefined);
  const summary = daySummary(items, '2026-10-18');
  assert.equal(summary.count, 2);
  assert.equal(summary.done, 1);
  assert.equal(summary.percent, 50);
  assert.equal(summary.plan, 40);
  assert.equal(summary.earned, 10);
  assert.equal(nextItem(items, new Date(2026, 9, 18, 12, 0))?.quest.id, 'b');
  const load = weekLoad(items, '2026-10-18');
  assert.equal(load.length, 7);
  assert.equal(load[6].count, 2);
  assert.equal(weekLoad(items, '2026-10-20')[1].count, 1);
});
