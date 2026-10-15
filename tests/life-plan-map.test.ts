import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, spheres } from '../src/game.ts';
import type { GameState } from '../src/game.ts';
import { validateState } from '../src/stateValidation.ts';
import {
  MAX_KEY_SPHERES,
  buildPlanMap,
  keySphereIds,
  planMapRange,
  planSpans,
  shiftAnchor,
  spanPlacement,
  toggleKeySphere,
  validKeySpheres,
} from '../src/lifePlanMap.ts';

const now = new Date('2026-10-15T12:00:00');
const ids = spheres.map((s) => s.id);

function sample(): GameState {
  const base = initialState();
  const goal = {
    ...base.goals[0],
    id: 'g1',
    sphere: 'sport',
    current: 1,
    target: 10,
    startsAt: '2026-10-01T09:00:00',
    dueAt: '2026-10-20T09:00:00',
    stages: [
      { id: 's1', name: 'Этап 1', startsAt: '2026-10-03T09:00:00', dueAt: '2026-10-09T09:00:00' },
      { id: 's2', name: 'Готовый', status: 'completed' as const, startsAt: '2026-10-01T09:00:00', dueAt: '2026-10-02T09:00:00' },
    ],
  };
  return { ...base, goals: [goal], quests: [] };
}

test('ключевые сферы: выбор, снятие, лимит три, неизвестная сфера', () => {
  let state = initialState();
  state = toggleKeySphere(state, 'sport', ids, now);
  assert.deepEqual(keySphereIds(state, now), ['sport']);
  assert.deepEqual(keySphereIds(toggleKeySphere(state, 'sport', ids, now), now), []);
  state = initialState();
  for (const id of ids.slice(0, MAX_KEY_SPHERES)) state = toggleKeySphere(state, id, ids, now);
  assert.throws(() => toggleKeySphere(state, ids[8], ids, now));
  assert.throws(() => toggleKeySphere(state, 'нет', ids, now));
});

test('выбор прошлого месяца не переносится; формат проверяется', () => {
  const state = toggleKeySphere(initialState(), 'sport', ids, now);
  assert.deepEqual(keySphereIds(state, new Date('2026-11-03T10:00:00')), []);
  assert.equal(validKeySpheres({ month: '2026-10', sphereIds: ['a'] }), true);
  assert.equal(validKeySpheres({ month: '2026-10', sphereIds: ['a', 'a'] }), false);
  assert.equal(validKeySpheres({ month: 'октябрь', sphereIds: [] }), false);
  assert.equal(validKeySpheres({ month: '2026-10', sphereIds: ['a', 'b', 'c', 'd'] }), false);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(state))));
  assert.throws(() => validateState({ ...state, keySpheres: { month: 'x', sphereIds: [] } } as never));
});

test('отрезки: готовые этапы пропускаются, у цели без этапов берутся её даты', () => {
  const spans = planSpans(sample());
  assert.deepEqual(spans.map((s) => s.id), ['g1:s1']);
  const noStages = sample();
  noStages.goals[0] = { ...noStages.goals[0], stages: [] };
  assert.equal(planSpans(noStages)[0].kind, 'goal');
  const done = sample();
  done.goals[0] = { ...done.goals[0], current: 10 };
  assert.equal(planSpans(done).length, 0);
});

test('периоды: дни месяца, недели квартала, месяцы года; сдвиг', () => {
  assert.equal(planMapRange('month', now).columns.length, 31);
  assert.equal(planMapRange('month', now).title, 'Октябрь 2026');
  const quarter = planMapRange('quarter', now);
  assert.equal(quarter.columns[0].start.getMonth(), 9);
  assert.equal(quarter.columns.at(-1)!.end.getDate(), 31);
  assert.equal(planMapRange('year', now).columns.length, 12);
  assert.equal(shiftAnchor('month', now, 1).getMonth(), 10);
  assert.equal(shiftAnchor('year', now, -1).getFullYear(), 2025);
});

test('карта: нагрузка по дням, пик, баланс и свободные окна', () => {
  const state = sample();
  const map = buildPlanMap(state, 'month', now, ids, new Date('2026-10-05T08:00:00'));
  assert.equal(map.load[2], 1);
  assert.equal(map.load[1], 0);
  assert.equal(map.load[9], 0);
  assert.equal(map.peak?.value, 1);
  assert.equal(map.bySphere.sport[4], 1);
  assert.equal(map.balance.find((b) => b.sphere === 'sport')?.share, 1);
  // с 10 по 31 октября пусто, окно не начинается раньше сегодняшней даты
  assert.equal(map.freeWindows[0].start.getDate(), 10);
  assert.equal(map.freeWindows[0].days, 22);
  assert.ok(map.freeWindows.every((w) => w.start >= new Date('2026-10-05T00:00:00')));
});

test('пустой период не ломает карту; положение отрезка на шкале в границах', () => {
  const empty = buildPlanMap({ ...initialState(), goals: [], quests: [] }, 'year', now, ids);
  assert.equal(empty.peak, null);
  assert.ok(empty.balance.every((b) => b.share === 0));
  const state = sample();
  const range = planMapRange('month', now);
  const place = spanPlacement(planSpans(state)[0], range);
  assert.ok(place.left >= 0 && place.left + place.width <= 100.0001);
  const wide = spanPlacement({ ...planSpans(state)[0], from: new Date('2026-01-01'), to: new Date('2026-12-31') }, range);
  assert.ok(wide.left === 0 && Math.abs(wide.width - 100) < 0.001);
});
