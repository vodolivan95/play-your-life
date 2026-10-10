import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { validateState } from '../src/stateValidation.ts';
import { MAX_MONTHLY_FOCUS, monthKey, monthlyFocusGoals, toggleMonthlyFocus, validMonthlyFocus } from '../src/monthlyFocus.ts';

const now = new Date('2026-10-11T12:00:00Z');

test('главные квесты месяца выбираются и снимаются', () => {
  const state = initialState();
  const [first] = state.goals;
  const picked = toggleMonthlyFocus(state, first.id, now);
  assert.deepEqual(monthlyFocusGoals(picked, now).map((g) => g.id), [first.id]);
  const removed = toggleMonthlyFocus(picked, first.id, now);
  assert.equal(monthlyFocusGoals(removed, now).length, 0);
});

test('больше трёх квестов выбрать нельзя, неизвестную цель тоже', () => {
  let state = initialState();
  const goals = Array.from({ length: 4 }, (_, i) => ({ ...state.goals[0], id: `g${i}`, name: `Цель ${i}` }));
  state = { ...state, goals };
  for (let i = 0; i < MAX_MONTHLY_FOCUS; i++) state = toggleMonthlyFocus(state, `g${i}`, now);
  assert.throws(() => toggleMonthlyFocus(state, 'g3', now));
  assert.throws(() => toggleMonthlyFocus(state, 'нет-такой', now));
});

test('выбор прошлого месяца не переносится', () => {
  const state = initialState();
  const picked = toggleMonthlyFocus(state, state.goals[0].id, now);
  assert.equal(monthlyFocusGoals(picked, new Date('2026-11-02T10:00:00Z')).length, 0);
  assert.equal(monthKey(now), '2026-10');
});

test('проверка формата сохранения', () => {
  assert.equal(validMonthlyFocus({ month: '2026-10', goalIds: ['a', 'b'] }), true);
  assert.equal(validMonthlyFocus({ month: '2026-10', goalIds: ['a', 'a'] }), false);
  assert.equal(validMonthlyFocus({ month: 'октябрь', goalIds: [] }), false);
  assert.equal(validMonthlyFocus({ month: '2026-10', goalIds: ['a', 'b', 'c', 'd'] }), false);
  const state = initialState();
  const saved = toggleMonthlyFocus(state, state.goals[0].id, now);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(saved))));
  assert.throws(() => validateState({ ...saved, monthlyFocus: { month: 'x', goalIds: [] } } as never));
});
