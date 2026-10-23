import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, completeQuest } from '../src/game.ts';
import { saveGoal, saveStage, saveTask } from '../src/planning.ts';
import { toggleMonthlyFocus } from '../src/monthlyFocus.ts';
import { nextPeak, goalPeak } from '../src/nextPeak.ts';
import type { GameState } from '../src/game.ts';

const NOW = new Date('2026-10-19T12:00:00+03:00');
function empty(): GameState {
  const s = initialState();
  return { ...s, goals: [], quests: [], monthlyFocus: undefined };
}
function withGoal(s: GameState, name: string) {
  const next = saveGoal(s, {
    name,
    sphere: 'english',
    target: 100,
    reward: 100,
    progressMode: 'tasks',
  });
  return { s: next, id: next.goals.at(-1)!.id };
}
function addStage(s: GameState, goalId: string, name: string) {
  const next = saveStage(s, goalId, {
    name,
    status: 'active',
    completionMode: 'tasks',
  });
  return {
    s: next,
    id: next.goals.find((g) => g.id === goalId)!.stages!.at(-1)!.id,
  };
}
function addTask(s: GameState, goalId: string, stageId: string, name: string) {
  const next = saveTask(s, {
    name,
    sphere: 'english',
    difficulty: 'Simple',
    goalId,
    stageId,
  });
  return { s: next, id: next.quests.at(-1)!.id };
}

test('без целей вершины нет: карточка не выдумывает прогресс', () => {
  assert.equal(nextPeak(empty(), NOW), null);
});

test('счётчик и прогресс считаются по реальным задачам активного этапа', () => {
  const goal = withGoal(empty(), 'Выучить английский');
  const id = goal.id;
  const stage = addStage(goal.s, id, 'Основы');
  let s = stage.s;
  const a = addTask(s, id, stage.id, 'Урок 1');
  s = a.s;
  s = addTask(s, id, stage.id, 'Урок 2').s;
  s = addTask(s, id, stage.id, 'Урок 3').s;
  let peak = nextPeak(s, NOW)!;
  assert.equal(peak.counter, '0/3');
  assert.equal(peak.percent, 0);
  assert.equal(peak.stageName, 'Основы');
  assert.match(peak.detail, /осталось 3 задачи/);
  assert.ok(peak.taskId);
  s = completeQuest(s, a.id);
  peak = nextPeak(s, NOW)!;
  assert.equal(peak.counter, '1/3');
  assert.equal(peak.done, 1);
  assert.ok(peak.percent > 0 && peak.percent < 100);
  assert.notEqual(peak.taskId, a.id);
});

test('после завершения этапа карточка переходит на следующий этап', () => {
  const goal = withGoal(empty(), 'Здоровье');
  const id = goal.id;
  const first = addStage(goal.s, id, 'Первый');
  let s = first.s;
  const t1 = addTask(s, id, first.id, 'Шаг 1');
  s = t1.s;
  const second = addStage(s, id, 'Второй');
  s = second.s;
  s = addTask(s, id, second.id, 'Шаг 2').s;
  assert.equal(nextPeak(s, NOW)!.stageName, 'Первый');
  s = completeQuest(s, t1.id);
  assert.equal(nextPeak(s, NOW)!.stageName, 'Второй');
});

test('главная цель месяца выбирается раньше более продвинутой', () => {
  const a = withGoal(empty(), 'Почти готова');
  const stageA = addStage(a.s, a.id, 'Этап А');
  let s = stageA.s;
  const t = addTask(s, a.id, stageA.id, 'Сделано');
  s = addTask(t.s, a.id, stageA.id, 'Осталось').s;
  s = completeQuest(s, t.id);
  const b = withGoal(s, 'Цель месяца');
  s = b.s;
  const stageB = addStage(s, b.id, 'Этап Б');
  s = addTask(stageB.s, b.id, stageB.id, 'Начать').s;
  assert.equal(nextPeak(s, NOW)!.goalName, 'Почти готова');
  s = toggleMonthlyFocus(s, b.id, NOW);
  assert.equal(nextPeak(s, NOW)!.goalName, 'Цель месяца');
});

test('цель без этапов показывает реальный процент или задачи цели', () => {
  const { s, id } = withGoal(empty(), 'Без этапов');
  const peak = nextPeak(s, NOW)!;
  assert.equal(peak.goalId, id);
  assert.equal(peak.stageId, undefined);
  assert.equal(peak.counter, '0%');
  assert.equal(peak.taskId, undefined);
});

test('карточка конкретной цели не подменяется другой главной целью месяца', () => {
  const first = withGoal(empty(), 'Первая цель');
  const firstStage = addStage(first.s, first.id, 'Первый этап');
  const firstTask = addTask(firstStage.s, first.id, firstStage.id, 'Первая задача');
  const second = withGoal(firstTask.s, 'Вторая цель');
  const secondStage = addStage(second.s, second.id, 'Второй этап');
  const secondTask = addTask(secondStage.s, second.id, secondStage.id, 'Вторая задача');
  let state = toggleMonthlyFocus(secondTask.s, first.id, NOW);
  state = toggleMonthlyFocus(state, second.id, NOW);
  const a = goalPeak(state, state.goals.find(g => g.id === first.id)!, NOW);
  const b = goalPeak(state, state.goals.find(g => g.id === second.id)!, NOW);
  assert.equal(a.goalName, 'Первая цель');
  assert.equal(a.stageName, 'Первый этап');
  assert.equal(a.taskId, firstTask.id);
  assert.equal(b.goalName, 'Вторая цель');
  assert.equal(b.stageName, 'Второй этап');
  assert.equal(b.taskId, secondTask.id);
});
