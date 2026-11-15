import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { quickPlanningTask, taskDay } from '../src/planner.ts';
import { updateTaskSettings } from '../src/taskSettings.ts';
import { linkWeekTask, moveWeekTask, saveWeekOutcome, validWeekPlanOutcomes, weekMoveIsLate, weekOutcomes, weekPlanDays, weekReviewTasks } from '../src/weekPlan.ts';

const monday = '2026-11-16';

test('результаты недели сохраняют связи, изолированы между неделями и поддерживают старые данные', () => {
  let state = quickPlanningTask(initialState(), 'Задача', 'owner', monday);
  const task = state.quests.at(-1)!;
  assert.deepEqual(weekOutcomes(state, monday), [null, null, null]);
  state = saveWeekOutcome(state, monday, 0, ' Первый результат ');
  state = saveWeekOutcome(state, monday, 1, 'Второй результат');
  assert.throws(() => linkWeekTask(state, monday, task.id, 0, 'another'));
  state = linkWeekTask(state, monday, task.id, 0, 'owner');
  state = linkWeekTask(state, monday, task.id, 1, 'owner');
  state = saveWeekOutcome(state, monday, 1, 'Обновлённый результат');
  assert.deepEqual(weekOutcomes(state, monday), [
    { title: 'Первый результат', taskIds: [] },
    { title: 'Обновлённый результат', taskIds: [task.id] },
    null,
  ]);
  assert.deepEqual(weekOutcomes(state, '2026-11-23'), [null, null, null]);
  assert.ok(validWeekPlanOutcomes(JSON.parse(JSON.stringify(state.weekPlanOutcomes))));
  assert.ok(!validWeekPlanOutcomes({ '2026-11-17': [null, null, null] }));
  assert.equal(weekPlanDays(state, monday, 'owner').days[0].tasks[0].id, task.id);
  assert.equal(weekPlanDays(state, monday, 'another').days[0].tasks.length, 0);
});

test('поздний перенос требует подтверждения и сохраняет дедлайн, снятие даты остаётся в итогах', () => {
  let state = quickPlanningTask(initialState(), 'Срочная задача', 'owner', monday);
  const id = state.quests.at(-1)!.id;
  state = updateTaskSettings(state, id, { deadlineAt: '2026-11-18', estimateMinutes: 120 });
  const q = state.quests.at(-1)!;
  assert.ok(weekMoveIsLate(q, '2026-11-23'));
  assert.ok(!weekMoveIsLate(q, '2026-11-18'));
  assert.throws(() => moveWeekTask(state, id, '2026-11-23', 'owner', false, monday), /дедлайна/);
  assert.throws(() => moveWeekTask(state, id, '2026-11-30', 'owner', true, monday), /следующей неделе/);
  const carried = moveWeekTask(state, id, '2026-11-23', 'owner', true, monday);
  assert.equal(carried.quests.at(-1)!.deadlineAt, '2026-11-18');
  assert.equal(taskDay(carried.quests.at(-1)!), '2026-11-23');
  assert.equal(weekReviewTasks(carried, monday, 'owner').moved[0].day, '2026-11-23');
  const queued = moveWeekTask(state, id, null, 'owner', false, monday);
  assert.equal(queued.quests.at(-1)!.deadlineAt, q.deadlineAt);
  assert.equal(taskDay(queued.quests.at(-1)!), undefined);
  assert.equal(weekReviewTasks(queued, monday, 'owner').pending.length, 0);
  assert.equal(weekReviewTasks(queued, monday, 'owner').moved[0].name, q.name);
  assert.equal(weekPlanDays(queued, monday, 'owner').backlog[0].id, id);
  assert.equal(weekPlanDays(state, monday, 'owner').days[0].planned, 120);
});
