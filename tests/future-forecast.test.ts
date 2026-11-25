import assert from 'node:assert/strict';
import test from 'node:test';
import { dayKey, qualityMessage, summarizePace, windowStart } from '../src/futureForecast.ts';

const asOf = new Date('2026-11-25T12:00:00Z');
const daysAgo = (n: number) => dayKey(new Date(asOf.getTime() - n * 86_400_000));
const doneAgo = (n: number) => ({ done: true, completedAt: `${daysAgo(n)}T10:00:00.000Z` });

test('окно включает сегодня и считает ровно windowDays дней', () => {
  assert.equal(windowStart(asOf, 30), daysAgo(29));
  assert.equal(windowStart(asOf, 1), '2026-11-25');
});

test('без истории качество insufficient и нет дат', () => {
  const pace = summarizePace({ quests: [], activeDates: [] }, asOf);
  assert.equal(pace.dataQuality, 'insufficient');
  assert.equal(pace.windows[90].tasksDone, 0);
  assert.equal(qualityMessage(pace.dataQuality), 'Недостаточно данных для достоверного расчёта.');
});

test('задачи вне окна не считаются, невыполненные тоже', () => {
  const quests = [doneAgo(5), doneAgo(40), { done: false, completedAt: `${daysAgo(2)}T00:00:00.000Z` }];
  const pace = summarizePace({ quests, activeDates: [daysAgo(5)] }, asOf);
  assert.equal(pace.windows[30].tasksDone, 1);
  assert.equal(pace.windows[90].tasksDone, 2);
  assert.equal(pace.windows[30].tasksPerWeek, 0.2);
});

test('достаточная история: ready при 30 активных днях и 10 задачах за 90 дней', () => {
  const quests = Array.from({ length: 12 }, (_, i) => doneAgo(i * 6));
  const activeDates = Array.from({ length: 35 }, (_, i) => daysAgo(i));
  const pace = summarizePace({ quests, activeDates }, asOf);
  assert.equal(pace.dataQuality, 'ready');
  assert.deepEqual(pace.limitations, []);
});

test('короткая история даёт preliminary и пояснение', () => {
  const pace = summarizePace({ quests: [doneAgo(1), doneAgo(2)], activeDates: [daysAgo(1)] }, asOf);
  assert.equal(pace.dataQuality, 'preliminary');
  assert.equal(pace.limitations.length, 2);
  assert.equal(qualityMessage(pace.dataQuality), 'Прогноз носит предварительный характер.');
});

test('привычки считаются по дням с положительным значением', () => {
  const pace = summarizePace(
    { quests: [], activeDates: [], habitCompletions: [{ day: daysAgo(3), value: 1 }, { day: daysAgo(3), value: 1 }, { day: daysAgo(4), value: 0 }] },
    asOf,
  );
  assert.equal(pace.windows[30].habitDays, 1);
  assert.equal(pace.dataQuality, 'preliminary');
});
