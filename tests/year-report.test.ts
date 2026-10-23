import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, spheres } from '../src/game.ts';
import type { Event } from '../src/game.ts';
import { historyYears, yearHabitsReport, yearReport } from '../src/yearReport.ts';

const october = new Date(2026, 9, 18, 12);

function fixture() {
  const state = initialState();
  state.events = [];
  state.activeDates = [];
  state.monthlyTracking = {
    since: new Date(2025, 0, 1, 12).toISOString(),
    scores: Object.fromEntries(spheres.map((sphere) => [sphere.id, sphere.score])),
  };
  return state;
}

function event(id: string, kind: Event['kind'], date: Date, sphere = 'health', xp = 10, more: Partial<Event> = {}): Event {
  return { id, kind, sphere, xp, title: id, date: date.toISOString(), ...more };
}

test('годовой отчёт не смешивает границы лет и lifetime-показатели', () => {
  const state = fixture();
  state.events = [
    event('previous-quest', 'quest', new Date(2025, 11, 31, 12), 'sport', 90),
    event('year-quest', 'quest', new Date(2026, 0, 1, 12), 'health', 20),
    event('year-score', 'score', new Date(2026, 1, 1, 12), 'health', 15),
    event('future-quest', 'quest', new Date(2026, 10, 1, 12), 'health', 100),
  ];
  state.xp = 99999;

  const report = yearReport(state, '2026', october);
  assert.equal(report.xp, 35);
  assert.equal(report.quests, 1);
  assert.equal(report.sphereRows.find((row) => row.id === 'health')?.tasks, 1);
  assert.equal(report.sphereRows.find((row) => row.id === 'sport')?.tasks, 0);
  assert.equal(report.months[0].quests, 1);
  assert.equal(report.months[11].xp, 0);
  assert.equal(report.daysTotal, 365);
  assert.equal(report.daysPassed, 291);
  assert.equal(report.daysLeft, 74);
});

test('учитываются только завершённые игровые задачи и цели выбранного года', () => {
  const state = fixture();
  state.events = [
    event('quest-health', 'quest', new Date(2026, 2, 2, 12), 'health', 20),
    event('quest-sport', 'quest', new Date(2026, 2, 3, 12), 'sport', 20),
    event('goal', 'goal', new Date(2026, 2, 4, 12), 'sport', 200),
    event('habit-is-not-quest', 'habit', new Date(2026, 2, 5, 12), 'health', 5),
    event('planning-is-not-goal', 'planning', new Date(2026, 2, 6, 12), 'health', 0),
    event('old-goal', 'goal', new Date(2025, 11, 31, 12), 'health', 200),
  ];

  const report = yearReport(state, '2026', october);
  assert.equal(report.quests, 2);
  assert.equal(report.goals, 1);
  assert.equal(report.sphereRows.find((row) => row.id === 'health')?.tasks, 1);
  assert.equal(report.sphereRows.find((row) => row.id === 'sport')?.tasks, 1);
  assert.equal(report.sphereRows.find((row) => row.id === 'health')?.share, 50);
  assert.equal(report.sphereRows.find((row) => row.id === 'sport')?.share, 50);
});

test('активные дни дедуплицируются и остаются в выбранном году до сегодня', () => {
  const state = fixture();
  state.activeDates = [
    '2025-12-31',
    '2026-01-02',
    '2026-01-02',
    '2026-10-18',
    '2026-10-19',
    '2027-01-01',
  ];

  const report = yearReport(state, '2026', october);
  assert.deepEqual(report.activeDates, ['2026-01-02', '2026-10-18']);
  assert.equal(report.activeDays, 2);
  assert.ok(historyYears(state, october).includes('2025'));
  assert.ok(!historyYears(state, october).includes('2027'));
});

test('годовой rate привычек берёт только плановые даты и подтверждённые отметки года', () => {
  const state = fixture();
  state.habits = [{
    id: 'h1', ownerId: 'u', title: 'Зарядка', sphere: 'health', iconId: 'training', targetValue: 1, unit: '', weekdays: [0, 1, 2, 3, 4, 5, 6], rewardCoins: 0, rewardXp: 0, isActive: true, currentStreak: 0, bestStreak: 0, totalCompletions: 0, createdAt: new Date(2026, 0, 2, 12).toISOString(), timezoneMinutes: 0, rewardLocked: false,
  }];
  state.habitCompletions = [
    { id: 'old', habitId: 'h1', ownerId: 'u', dayOrdinal: 0, day: '2025-12-31', value: 1, completedAt: '2025-12-31', rewardClaimed: true },
    { id: 'done-1', habitId: 'h1', ownerId: 'u', dayOrdinal: 1, day: '2026-01-02', value: 1, completedAt: '2026-01-02', rewardClaimed: true },
    { id: 'duplicate', habitId: 'h1', ownerId: 'u', dayOrdinal: 1, day: '2026-01-02', value: 1, completedAt: '2026-01-02', rewardClaimed: true },
    { id: 'done-2', habitId: 'h1', ownerId: 'u', dayOrdinal: 2, day: '2026-01-04', value: 1, completedAt: '2026-01-04', rewardClaimed: true },
    { id: 'unclaimed', habitId: 'h1', ownerId: 'u', dayOrdinal: 3, day: '2026-01-03', value: 1, completedAt: '2026-01-03', rewardClaimed: false },
  ];
  const now = new Date(2026, 0, 5, 12);

  const habits = yearHabitsReport(state, '2026', now);
  assert.equal(habits.totalDue, 3);
  assert.equal(habits.totalMade, 2);
  assert.equal(habits.rate, 67);
  assert.equal(yearReport(state, '2026', now).habits.rate, 67);
  assert.equal(yearReport(state, '2025', now).habits.rate, null);
});

test('баланс использует реальные оценки начала и конца года, а не текущий state.spheres', () => {
  const state = fixture();
  state.spheres.health.score = 9;
  state.events = [
    event('december-score', 'score', new Date(2025, 11, 31, 12), 'health', 20, { scoreAfter: 5 }),
    event('march-score', 'score', new Date(2026, 2, 1, 12), 'health', 40, { scoreAfter: 8 }),
  ];

  const report = yearReport(state, '2026', october);
  const health = report.sphereRows.find((row) => row.id === 'health')!;
  assert.equal(health.before, 5);
  assert.equal(health.after, 8);
  assert.ok(report.balance);
  assert.notEqual(report.balance?.after, state.spheres.health.score);
});
