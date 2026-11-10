import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, completeQuest, dateKey } from '../src/game.ts';
import { saveGoal, saveStage, saveTask } from '../src/planning.ts';
import { quickPlanningTask, moveTaskToDay, logTaskTime } from '../src/planner.ts';
import { mondayOf, addDays } from '../src/tasksCalendar.ts';
import {
  MAX_WEEKLY_FOCUS,
  confirmWeeklyReview,
  validWeeklyReview,
  weekAnchor,
  weeklyReviewOf,
  weeklyReviewProblemTasks,
  weeklyReviewProjects,
  weeklyReviewTotals,
  weeklyReviews,
} from '../src/weeklyReview.ts';
import type { GameState } from '../src/game.ts';

function fixture() {
  let s = initialState();
  s = saveGoal(s, { name: 'Цель', sphere: 'english', target: 100, reward: 200, progressMode: 'tasks' });
  const id = s.goals.at(-1)!.id;
  s = saveStage(s, id, { name: 'Этап', status: 'active', completionMode: 'tasks' });
  return { s, id, a: s.goals.at(-1)!.stages![0].id };
}
function goal(s: GameState, id: string) {
  return s.goals.find((g) => g.id === id)!;
}

test('недельный обзор: якорь недели — всегда понедельник', () => {
  const anchor = weekAnchor(new Date('2026-11-12T10:00:00Z')); // четверг
  assert.equal(anchor, mondayOf(anchor));
});

test('итоги недели: выполненные/невыполненные/просроченные/переносы/время — только внутри недели', () => {
  // Переносы и учёт времени записываются с реальной отметкой времени (planningData.ts,
  // addPlanningEvent) — поэтому неделя обзора берётся текущей, а не произвольной будущей.
  const monday = mondayOf(dateKey());
  let s = quickPlanningTask(initialState(), 'Задача недели', 'u');
  const id = s.quests[0].id;
  s = moveTaskToDay(s, id, monday, 'u'); // первое назначение — не перенос
  s = moveTaskToDay(s, id, addDays(monday, 2), 'u', undefined, 'm1'); // перенос внутри недели
  s = logTaskTime(s, id, 30, 'u', 't1');
  // Другая задача — завершена в пределах той же недели.
  s = quickPlanningTask(s, 'Готовая задача', 'u');
  const doneId = s.quests[1].id;
  s = moveTaskToDay(s, doneId, addDays(monday, 1), 'u');
  s = completeQuest(s, doneId);
  s.quests[1].completedAt = addDays(monday, 1);
  // Третья задача — вне недели обзора, не должна учитываться.
  s = quickPlanningTask(s, 'Задача другой недели', 'u');
  s = moveTaskToDay(s, s.quests[2].id, addDays(monday, 20), 'u');
  const totals = weeklyReviewTotals(s, monday, new Date(`${addDays(monday, 5)}T12:00:00Z`));
  assert.equal(totals.weekStart, monday);
  assert.equal(totals.weekEnd, addDays(monday, 6));
  assert.equal(totals.done, 1);
  assert.equal(totals.undone, 1);
  assert.equal(totals.overdue, 1); // задача перенесена на monday+2, «сейчас» — monday+5
  assert.equal(totals.moves, 1);
  assert.equal(totals.actualMinutes, 30);
});

test('проблемные задачи: часто переносимые и просроченные — в списке, выполненные — нет', () => {
  let s = quickPlanningTask(initialState(), 'Переносимая', 'u');
  const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2000-01-01', 'u');
  s = moveTaskToDay(s, id, '2000-01-02', 'u', undefined, 'm1');
  s = quickPlanningTask(s, 'Готовая', 'u');
  s = completeQuest(s, s.quests[1].id);
  const problems = weeklyReviewProblemTasks(s);
  assert.equal(problems.some((p) => p.id === id), true);
  assert.equal(problems.some((p) => p.name === 'Готовая'), false);
  assert.equal(problems.find((p) => p.id === id)!.moves, 1);
  assert.equal(problems.find((p) => p.id === id)!.overdue, true);
});

test('продвижение проектов: завершённая задача на неделе — «продвинулся», иначе по наличию следующего шага', () => {
  // Событие награды за завершённую задачу датируется реальным временем (game.ts, award()) —
  // поэтому неделя обзора берётся текущей.
  const monday = mondayOf(dateKey());
  const now = new Date(`${addDays(monday, 5)}T12:00:00Z`);
  const f = fixture();
  let s = saveTask(f.s, { name: 'Шаг', sphere: 'english', difficulty: 'Micro', goalId: f.id, stageId: f.a });
  s = completeQuest(s, s.quests.at(-1)!.id);
  const [advanced] = weeklyReviewProjects(s, monday, now);
  assert.equal(advanced.status, 'advanced');
  // Без активности на неделе, но с доступной задачей — «нужно внимание».
  const f2 = fixture();
  const s2 = saveTask(f2.s, { name: 'Шаг', sphere: 'english', difficulty: 'Micro', goalId: f2.id, stageId: f2.a });
  const [needsAttention] = weeklyReviewProjects(s2, monday, now);
  assert.equal(needsAttention.status, 'needsAttention');
  // Без задач вовсе — «нет активности».
  const f3 = fixture();
  const [noActivity] = weeklyReviewProjects(f3.s, monday, now);
  assert.equal(noActivity.status, 'noActivity');
});

test('продвижение проектов: проекты на паузе и завершённые не попадают в список', () => {
  const f = fixture();
  const s = { ...f.s, goals: f.s.goals.map((g) => (g.id === f.id ? { ...g, paused: true } : g)) };
  assert.equal(weeklyReviewProjects(s, mondayOf(dateKey())).length, 0);
});

test('подтверждение обзора: ограничение фокуса, понедельник, валидация, сохранение и чтение истории', () => {
  const f = fixture();
  const monday = mondayOf('2026-11-16');
  assert.throws(() => confirmWeeklyReview(f.s, '2026-11-17', [], {}), /понедельника/);
  assert.throws(() => confirmWeeklyReview(f.s, monday, [f.id, f.id], {}), /дважды/);
  assert.throws(() => confirmWeeklyReview(f.s, monday, ['нет-такого'], {}), /не найден/);
  assert.throws(() => confirmWeeklyReview(f.s, monday, Array.from({ length: MAX_WEEKLY_FOCUS + 1 }, () => f.id)), /не больше/);
  const s = confirmWeeklyReview(f.s, monday, [f.id], { focusNote: 'Больше заниматься английским' });
  assert.equal(validWeeklyReview(weeklyReviewOf(s, monday)), true);
  assert.deepEqual(weeklyReviewOf(s, monday)!.focusGoalIds, [f.id]);
  assert.equal(weeklyReviewOf(s, monday)!.focusNote, 'Больше заниматься английским');
  assert.equal(weeklyReviews(s)[0].weekStart, monday);
  // Повторное подтверждение той же недели обновляет запись, а не плодит дубликаты.
  const s2 = confirmWeeklyReview(s, monday, []);
  assert.equal(Object.keys(s2.weeklyReviews!).length, 1);
  assert.deepEqual(weeklyReviewOf(s2, monday)!.focusGoalIds, []);
});
