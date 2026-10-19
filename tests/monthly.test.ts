import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeScore,
  completeQuest,
  initialState,
  migrateState,
  personalState,
  updateGoal,
} from '../src/game.ts';
import {
  monthKey,
  monthlySummary,
  moveMonth,
  saveReflection,
} from '../src/monthly.ts';
import type { Event } from '../src/game.ts';

const now = new Date(2026, 9, 20, 12);
function stateFixture() {
  const state = initialState();
  state.events = [];
  state.activeDates = [];
  state.monthlyTracking = {
    since: new Date(2026, 8, 1).toISOString(),
    scores: Object.fromEntries(
      Object.entries(state.spheres).map(([id, s]) => [id, s.score]),
    ),
  };
  return state;
}
function event(
  id: string,
  kind: Event['kind'],
  xp: number,
  day: number,
  month = 9,
  more: Partial<Event> = {},
): Event {
  return {
    id,
    kind,
    xp,
    sphere: 'sport',
    title: `Действие ${id}`,
    date: new Date(2026, month, day, 12).toISOString(),
    ...more,
  };
}
test('месяц суммирует все источники XP и считает только реальные квесты и цели', () => {
  const state = stateFixture();
  state.events = [
    event('q', 'quest', 35, 5),
    event('s', 'score', 15, 6),
    event('g', 'goal', 200, 7),
    event('st', 'streak', 10, 8),
    event('old', undefined, 20, 9),
    event('sep', 'quest', 50, 30, 8),
    event('future', 'quest', 50, 25),
  ];
  state.activeDates = [
    '2026-09-30',
    '2026-10-05',
    '2026-10-05',
    '2026-10-06',
    '2026-10-08',
    '2026-10-25',
  ];
  const result = monthlySummary(state, '2026-10', now);
  assert.equal(result.xp, 280);
  assert.equal(result.quests, 1);
  assert.equal(result.goals, 1);
  assert.equal(result.activeDays, 3);
  assert.equal(result.longest, 2);
  assert.equal(result.partial, true);
  assert.equal(
    result.breakdown.reduce((sum, row) => sum + row.xp, 0),
    result.xp,
  );
  assert.equal(result.topSphere?.id, 'sport');
  assert.equal(result.days.find((d) => d.number === 5)?.xp, 35);
  assert.equal(result.days.find((d) => d.number === 25)?.xp, 0);
  assert.equal(result.days.find((d) => d.number === 25)?.future, true);
});
test('Life Score восстанавливает начало и конец месяца, включая снижение без штрафа XP', () => {
  const state = stateFixture();
  state.events = [
    event('after', 'score', 15, 15, 9, { scoreBefore: 3, scoreAfter: 6 }),
    event('lower', 'score', 0, 10, 9, { scoreBefore: 5, scoreAfter: 3 }),
    event('before', 'score', 15, 30, 8, { scoreBefore: 4, scoreAfter: 5 }),
  ];
  const result = monthlySummary(state, '2026-10', now).sphereResults.find(
    (s) => s.id === 'sport',
  )!;
  assert.equal(result.before, 5);
  assert.equal(result.after, 6);
  assert.equal(result.delta, 1);
  const previous = monthlySummary(state, '2026-09', now).sphereResults.find(
    (s) => s.id === 'sport',
  )!;
  assert.equal(previous.before, 4);
  assert.equal(previous.after, 5);
});
test('изменения с одинаковым временем применяются в порядке действий', () => {
  const state = stateFixture();
  state.events = [
    event('second', 'score', 15, 10, 9, { scoreAfter: 6 }),
    event('first', 'score', 15, 10, 9, { scoreAfter: 5 }),
  ];
  assert.equal(
    monthlySummary(state, '2026-10', now).sphereResults.find(
      (s) => s.id === 'sport',
    )?.after,
    6,
  );
});
test('старые сохранения не получают вымышленных исторических оценок', () => {
  const state = stateFixture();
  delete state.monthlyTracking;
  const migrated = migrateState(state);
  assert.equal(migrated.xp, state.xp);
  assert.deepEqual(migrated.events, state.events);
  const past = monthlySummary(migrated, '2025-01', now);
  assert.equal(past.partial, true);
  assert.equal(past.sphereResults[0].before, null);
  assert.equal(past.sphereResults[0].after, null);
});
test('заметки разделены по месяцам, сериализуются и не начисляют XP', () => {
  const state = stateFixture();
  const october = saveReflection(
    state,
    '2026-10',
    { highlights: 'Моя победа', mood: 5 },
    now,
  );
  const september = saveReflection(
    october,
    '2026-09',
    { lessons: 'Мой вывод' },
    now,
  );
  const done = saveReflection(
    september,
    '2026-10',
    { status: 'completed' },
    now,
  );
  assert.equal(done.monthlyReflections?.['2026-10'].highlights, 'Моя победа');
  assert.equal(done.monthlyReflections?.['2026-09'].lessons, 'Мой вывод');
  assert.equal(done.monthlyReflections?.['2026-10'].status, 'completed');
  assert.equal(done.xp, state.xp);
  assert.deepEqual(done.spheres, state.spheres);
  assert.deepEqual(
    JSON.parse(JSON.stringify(done)).monthlyReflections,
    done.monthlyReflections,
  );
  assert.equal(
    saveReflection(done, '2026-11', { highlights: 'Будущее' }, now),
    done,
  );
  assert.equal(saveReflection(done, '2026-13', { mood: 5 }, now), done);
  assert.equal(saveReflection(done, '2026-10', { mood: 6 }, now), done);
});
test('новые действия сохраняют типы и история не обрезается после 200 событий', () => {
  const state = stateFixture();
  state.events = Array.from({ length: 210 }, (_, i) =>
    event(`previous-${i}`, 'quest', 5, 1),
  );
  const quest = completeQuest(state, 'sport-1');
  assert.equal(quest.events.length, 211);
  assert.equal(quest.events[0].kind, 'quest');
  const score = changeScore(quest, 'sport', 5);
  assert.equal(score.events[0].kind, 'score');
  assert.equal(score.events[0].scoreBefore, 4);
  assert.equal(score.events[0].scoreAfter, 5);
  const goal = updateGoal(score, 'b2', 100);
  assert.equal(goal.events[0].kind, 'goal');
  const noRepeat = completeQuest(goal, 'sport-1');
  assert.equal(noRepeat.events.length, goal.events.length);
});
test('календарь корректен на границе года, в високосном феврале и локальном часовом поясе', () => {
  assert.equal(moveMonth('2026-01', -1), '2025-12');
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  const state = stateFixture();
  const february = monthlySummary(state, '2024-02', now);
  assert.equal(february.days.length, 29);
  assert.equal(february.offset, 3);
  state.events = [
    {
      ...event('late', 'quest', 20, 1),
      date: new Date(2026, 8, 30, 23, 59).toISOString(),
    },
    {
      ...event('early', 'quest', 35, 1),
      date: new Date(2026, 9, 1, 0, 1).toISOString(),
    },
  ];
  assert.equal(monthlySummary(state, '2026-09', now).xp, 20);
  assert.equal(monthlySummary(state, '2026-10', now).xp, 35);
  assert.equal(monthKey(new Date(2026, 9, 1, 0, 1)), '2026-10');
});
test('пустой месяц не показывает рост, серию или награды', () => {
  const result = monthlySummary(stateFixture(), '2026-10', now);
  assert.equal(result.xp, 0);
  assert.equal(result.quests, 0);
  assert.equal(result.activeDays, 0);
  assert.equal(result.longest, 0);
  assert.equal(result.topSphere, null);
  assert.equal(result.partial, false);
  assert.equal(result.sphereResults.find((s) => s.id === 'sport')?.delta, 0);
});

test('обзор личной игры использует выбранные стартовые оценки, а не демооценки', () => {
  const initial = initialState();
  const scores = Object.fromEntries(
    Object.keys(initial.spheres).map((id) => [id, 8]),
  );
  const personal = personalState({ name: 'Игрок', avatar: '🦊' }, scores, {
    name: 'Моя цель',
    sphere: 'sport',
    target: 10,
  });
  const result = monthlySummary(changeScore(personal, 'sport', 9), monthKey());
  const sport = result.sphereResults.find((s) => s.id === 'sport')!;
  assert.equal(sport.before, 8);
  assert.equal(sport.after, 9);
  assert.equal(sport.delta, 1);
  assert.equal(result.xp, 15);
});
