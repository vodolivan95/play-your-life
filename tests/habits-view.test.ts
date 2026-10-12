import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, dayStatus, doneDays, habitStats, isScheduled, lastDays, liveStreak, mondayIndex, monthCells, weekPercent, weekRows } from '../src/habitsView.ts';
import type { Habit, HabitCompletion } from '../src/personalQuests.ts';

// 2026-10-12 — понедельник
const TODAY = '2026-10-12';
const habit = (extra: Partial<Habit> = {}): Habit => ({
  timezoneMinutes: 0, id: 'h1', ownerId: 'u', title: 'Чтение', sphere: 'growth', iconId: 'reading',
  targetValue: 20, unit: 'страниц', weekdays: [0, 1, 2, 3, 4, 5, 6], rewardCoins: 5, rewardXp: 5, isActive: true,
  currentStreak: 0, bestStreak: 0, totalCompletions: 0, createdAt: '2026-08-01T10:00:00.000Z', rewardLocked: false, ...extra,
});
const done = (habitId: string, days: string[]): HabitCompletion[] =>
  days.map((day) => ({ id: `habit:${habitId}:${day}`, habitId, ownerId: 'u', dayOrdinal: 0, day, value: 1, completedAt: `${day}T08:00:00Z`, rewardClaimed: true }));

test('даты: сдвиг, день недели, последние n дней', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(mondayIndex(TODAY), 0);
  assert.equal(mondayIndex('2026-10-18'), 6);
  assert.deepEqual(lastDays(TODAY, 3), ['2026-10-10', '2026-10-11', '2026-10-12']);
});

test('статус дня: выполнено, пропуск, сегодня, будущее, выходной', () => {
  const h = habit({ weekdays: [1, 2, 3, 4, 5] });
  const d = doneDays(h, done('h1', ['2026-10-09']));
  assert.equal(dayStatus(h, d, '2026-10-09', TODAY), 'done');
  assert.equal(dayStatus(h, d, '2026-10-08', TODAY), 'missed');
  assert.equal(dayStatus(h, d, '2026-10-10', TODAY), 'off');
  assert.equal(dayStatus(h, d, TODAY, TODAY), 'open');
  assert.equal(dayStatus(h, d, '2026-10-13', TODAY), 'future');
  assert.equal(isScheduled(habit({ isActive: false }), TODAY), false);
  assert.equal(isScheduled(h, '2026-07-31'), false, 'до создания привычка не запланирована');
});

test('серия: выходные не рвут, сегодняшний невыполненный день ещё не рвёт', () => {
  const h = habit({ weekdays: [1, 2, 3, 4, 5] });
  // пт 9, чт 8, ср 7; сб/вс — выходные; сегодня (пн) ещё не отмечен
  const d = doneDays(h, done('h1', ['2026-10-07', '2026-10-08', '2026-10-09']));
  assert.equal(liveStreak(h, d, TODAY), 3);
  const withToday = doneDays(h, done('h1', ['2026-10-07', '2026-10-08', '2026-10-09', TODAY]));
  assert.equal(liveStreak(h, withToday, TODAY), 4);
  const gap = doneDays(h, done('h1', ['2026-10-07', '2026-10-09']));
  assert.equal(liveStreak(h, gap, TODAY), 1, 'пропуск четверга разрывает серию');
});

test('статистика за 90 дней: проценты, пропуски, дни недели, XP', () => {
  const h = habit({ createdAt: '2026-10-05T10:00:00.000Z', weekdays: [1, 3] });
  const hist = done('h1', ['2026-10-05', '2026-10-07']);
  const s = habitStats(h, hist, TODAY);
  // запланированы пн 5, ср 7, пн 12 -> 3, выполнено 2
  assert.equal(s.scheduled, 3);
  assert.equal(s.done, 2);
  assert.equal(s.missed, 1);
  assert.equal(s.percent, 67);
  assert.equal(s.weekdayPercent[0], 50);
  assert.equal(s.weekdayPercent[2], 100);
  assert.equal(s.bestWeekday, 2);
  assert.equal(s.xp, 10);
  assert.equal(s.weeks.length, 8);
});

test('пустая история не даёт NaN и лучшего дня', () => {
  const s = habitStats(habit({ createdAt: '2026-10-12T10:00:00.000Z' }), [], TODAY);
  assert.equal(s.done, 0);
  assert.equal(s.percent, 0);
  assert.equal(s.bestWeekday, -1);
  assert.ok(Number.isFinite(s.perWeek));
});

test('процент за неделю по нескольким привычкам', () => {
  const a = habit({ id: 'a', createdAt: '2026-10-01T10:00:00.000Z' });
  const b = habit({ id: 'b', createdAt: '2026-10-01T10:00:00.000Z' });
  const hist = [...done('a', lastDays(TODAY, 7)), ...done('b', lastDays(TODAY, 7).slice(0, 3))];
  assert.equal(weekPercent([a, b], hist, TODAY), 71);
  assert.equal(weekPercent([], [], TODAY), 0);
});

test('календарь месяца и недель', () => {
  const cells = monthCells(TODAY);
  assert.equal(cells.filter((c) => c.blank).length, 3, '1 октября 2026 — четверг');
  assert.equal(cells.filter((c) => !c.blank).length, 31);
  assert.equal(cells.find((c) => c.isToday)?.num, 12);
  assert.ok(cells.find((c) => c.num === 13)?.future);
  const rows = weekRows(TODAY, 2);
  assert.equal(rows.length, 14);
  assert.equal(rows[7].day, TODAY);
  assert.equal(rows[0].day, '2026-10-05');
});

import { navigation } from '../src/navigation.ts';

test('меню: «Квесты» стали «Привычками», «Мои задачи» стоят над ними', () => {
  const ids = navigation.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'id разделов не повторяются');
  assert.equal(navigation.find((item) => item.id === 'quests')?.label, 'Привычки');
  assert.equal(navigation.find((item) => item.id === 'tasks')?.label, 'Мои задачи');
  assert.equal(ids.indexOf('tasks') + 1, ids.indexOf('quests'));
  assert.equal(navigation.some((item) => item.label === 'Квесты'), false);
});
