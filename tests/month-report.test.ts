import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import type { Event } from '../src/game.ts';
import { validateState } from '../src/stateValidation.ts';
import { habitsReport, monthReport, percentChange, quarterKey, setImportance, validImportance } from '../src/monthReport.ts';
import { patchSphereReview } from '../src/keyResults.ts';

const now = new Date(2026, 9, 18, 12);
function fixture() {
  const state = initialState();
  state.events = [];
  state.activeDates = [];
  state.monthlyTracking = { since: new Date(2026, 8, 1).toISOString(), scores: Object.fromEntries(Object.entries(state.spheres).map(([id, s]) => [id, s.score])) };
  const add = (id: string, sphere: string, xp: number, date: Date, kind: Event['kind'] = 'quest') => state.events.push({ id, sphere, title: id, xp, date: date.toISOString(), kind });
  add('s1', 'health', 100, new Date(2026, 8, 10, 12));
  add('o1', 'health', 120, new Date(2026, 9, 5, 12));
  add('o2', 'sport', 60, new Date(2026, 9, 6, 12));
  add('g1', 'sport', 40, new Date(2026, 9, 7, 12), 'goal');
  state.activeDates = ['2026-10-05', '2026-10-06', '2026-10-07'];
  return state;
}

test('отчёт считает XP месяца, сравнение и доли сфер', () => {
  const r = monthReport(fixture(), '2026-10', now);
  assert.equal(r.summary.xp, 220);
  assert.equal(r.previousXp, 100);
  assert.equal(r.xpChange, 120);
  assert.equal(r.daysPassed, 18);
  assert.equal(r.daysLeft, 13);
  assert.equal(r.sphereRows.find((s) => s.id === 'health')!.share, 55);
  assert.equal(r.bestDay?.number, 5);
  assert.equal(r.achievements.length, 1);
  assert.equal(r.months.length, 6);
  assert.equal(r.months[5].xp, 220);
});

test('пустой месяц не ломает отчёт', () => {
  const r = monthReport(initialState(), '2026-10', now);
  assert.equal(r.summary.xp, 0);
  assert.equal(r.xpChange, null);
  assert.equal(r.bestDay, null);
  assert.equal(percentChange(5, 0), null);
});

test('привычки: выполнено, пропущено и будущие дни', () => {
  const state = fixture();
  state.habits = [{ id: 'h1', ownerId: 'u', title: 'Зарядка', sphere: 'health', iconId: 'x', targetValue: 1, unit: '', weekdays: [0, 1, 2, 3, 4, 5, 6], rewardCoins: 0, rewardXp: 0, isActive: true, currentStreak: 2, bestStreak: 5, totalCompletions: 2, createdAt: new Date(2026, 9, 1, 12).toISOString(), timezoneMinutes: 0, rewardLocked: false }];
  state.habitCompletions = ['2026-10-02', '2026-10-03'].map((day, i) => ({ id: `c${i}`, habitId: 'h1', ownerId: 'u', dayOrdinal: i, day, value: 1, completedAt: day, rewardClaimed: true }));
  const report = habitsReport(state, '2026-10', now);
  assert.equal(report.rows[0].made, 2);
  assert.equal(report.rows[0].due, 17);
  assert.equal(report.rate, 12);
});

test('важность сфер: раз в квартал, 1–5, проходит проверку сохранения', () => {
  let state = initialState();
  state = setImportance(state, 'finance', 5, now);
  state = setImportance(state, 'health', 4, now);
  assert.equal(state.sphereImportance?.quarter, quarterKey(now));
  assert.equal(setImportance(state, 'finance', 6, now), state);
  assert.equal(setImportance(state, 'nope', 3, now), state);
  assert.ok(validImportance(state.sphereImportance));
  assert.ok(!validImportance({ quarter: 'bad', values: {} }));
  validateState(JSON.parse(JSON.stringify(state)));
  const r = monthReport(state, '2026-10', now);
  assert.equal(r.values.find((v) => v.id === 'finance')!.flag, 'focus');
  assert.ok(r.focusNote.includes('Финансы'));
});

test('статус итога сферы берётся из «Мои итоги»', () => {
  let state = fixture();
  state = patchSphereReview(state, '2026-10', 'health', { achieved: 'Сдал анализы', next: 'Сон до 23:00' }, now);
  state = patchSphereReview(state, '2026-10', 'sport', { next: '10 км' }, now);
  const r = monthReport(state, '2026-10', now);
  assert.equal(r.sphereRows.find((s) => s.id === 'health')!.status, 'done');
  assert.equal(r.sphereRows.find((s) => s.id === 'sport')!.status, 'draft');
  assert.equal(r.sphereRows.find((s) => s.id === 'english')!.status, 'none');
  assert.equal(r.filled, 2);
});
