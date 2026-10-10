import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { saveGoal, saveTask } from '../src/planning.ts';
import {
  deadlineLabel,
  goalDaysLeft,
  goalNextStep,
  goalUpcomingTasks,
  goalsSummary,
  pluralDays,
  sortGoals,
} from '../src/goalsOverview.ts';

const now = new Date('2026-10-10T12:00:00');
const inDays = (n: number) =>
  new Date(now.getTime() + n * 86400000).toISOString();

function fixture() {
  let s = initialState();
  s = saveGoal(s, {
    name: 'Ближняя',
    sphere: 'health',
    target: 100,
    reward: 100,
    dueAt: inDays(5),
  });
  s = saveGoal(s, {
    name: 'Дальняя',
    sphere: 'sport',
    target: 100,
    reward: 250,
    dueAt: inDays(40),
  });
  s = saveGoal(s, {
    name: 'Без срока',
    sphere: 'english',
    target: 100,
    reward: 100,
  });
  return s;
}

test('склонение дней и подпись срока', () => {
  assert.equal(pluralDays(1), '1 день');
  assert.equal(pluralDays(3), '3 дня');
  assert.equal(pluralDays(11), '11 дней');
  assert.equal(pluralDays(22), '22 дня');
  const s = fixture();
  const [near, far, none] = s.goals.slice(-3);
  assert.equal(goalDaysLeft(near, now), 5);
  assert.equal(deadlineLabel(far, now), 'Осталось 40 дней');
  assert.equal(deadlineLabel(none, now), 'Без срока');
  assert.equal(
    deadlineLabel({ ...near, dueAt: inDays(-3) }, now),
    'Просрочено на 3 дня',
  );
  assert.equal(
    deadlineLabel({ ...near, current: near.target }, now),
    'Цель достигнута',
  );
});

test('сводка считает только активные цели и ближайший срок', () => {
  const s = fixture();
  const goals = s.goals.slice(-3);
  const done = { ...goals[0], current: goals[0].target };
  const summary = goalsSummary(s, [done, goals[1], goals[2]], now);
  assert.equal(summary.active, 2);
  assert.equal(summary.nearestDays, 40);
  assert.equal(summary.pendingReward, 350);
  assert.equal(goalsSummary(s, [], now).nearestDays, undefined);
});

test('сортировка по сроку ставит цели без срока в конец', () => {
  const s = fixture();
  const goals = s.goals.slice(-3);
  const ordered = sortGoals(s, [goals[2], goals[1], goals[0]], 'due', now);
  assert.deepEqual(
    ordered.map((g) => g.name),
    ['Ближняя', 'Дальняя', 'Без срока'],
  );
});

test('следующий шаг берётся из настоящих задач цели', () => {
  let s = fixture();
  const goal = s.goals.find((g) => g.name === 'Ближняя')!;
  assert.equal(goalNextStep(s, goal, now), undefined);
  s = saveTask(s, {
    name: 'Сделать первый шаг',
    difficulty: 'Micro',
    sphere: 'health',
    goalId: goal.id,
  });
  const next = goalNextStep(s, s.goals.find((g) => g.id === goal.id)!, now);
  assert.equal(next?.kind, 'task');
  assert.equal(next?.text, 'Сделать первый шаг');
});

test('ближайшие задачи: по сроку, без срока в конце, без выполненных', () => {
  let s = fixture();
  const goal = s.goals.find((g) => g.name === 'Дальняя')!;
  const add = (name: string, dueAt?: string) => {
    s = saveTask(s, { name, difficulty: 'Micro', sphere: 'health', goalId: goal.id, dueAt });
  };
  add('Без срока');
  add('Поздно', inDays(9));
  add('Рано', inDays(2));
  const names = (n = 4) =>
    goalUpcomingTasks(s, goal, n).map((q) => q.name);
  assert.deepEqual(names(), ['Рано', 'Поздно', 'Без срока']);
  assert.deepEqual(names(1), ['Рано']);
  s = {
    ...s,
    quests: s.quests.map((q) => (q.name === 'Рано' ? { ...q, done: true } : q)),
  };
  assert.deepEqual(names(), ['Поздно', 'Без срока']);
});
