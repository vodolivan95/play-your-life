import assert from 'node:assert/strict';
import test from 'node:test';
import { newAccountGame } from '../src/accountGame.ts';
import { dateKey } from '../src/game.ts';
import { saveCustomQuest } from '../src/personalQuests.ts';
import { saveGoal } from '../src/planning.ts';
import { executionOverview, setTaskDependencies, moveTaskToDay, setTaskProject, quickPlanningTask } from '../src/planner.ts';
import { planningMetrics, planningSettings } from '../src/planningData.ts';

const today = dateKey();
const yesterday = dateKey(new Date(Date.now() - 86400000));

function setup() { return newAccountGame('Тест'); }

test('executionOverview: восемь показателей считаются по существующим данным, без новых полей', () => {
  let s = setup();
  // Задача на сегодня
  s = saveCustomQuest(s, { name: 'На сегодня', sphere: 'tasks', difficulty: 'Simple', dueAt: today }, 'u');
  const todayId = s.quests[s.quests.length - 1].id;
  // Просроченная задача
  s = saveCustomQuest(s, { name: 'Просрочена', sphere: 'tasks', difficulty: 'Simple', dueAt: yesterday }, 'u');
  // Задача без даты
  s = saveCustomQuest(s, { name: 'Без даты', sphere: 'tasks', difficulty: 'Simple' }, 'u');
  // Задача в активном проекте
  s = saveGoal(s, { name: 'Проект', sphere: 'tasks', target: 1, reward: 100 });
  const goalId = s.goals[s.goals.length - 1].id;
  s = saveCustomQuest(s, { name: 'Проектная', sphere: 'tasks', difficulty: 'Simple' }, 'u');
  const projectTaskId = s.quests[s.quests.length - 1].id;
  s = setTaskProject(s, projectTaskId, goalId, 'u');
  // Заблокированная зависимостями задача
  s = saveCustomQuest(s, { name: 'Блокер', sphere: 'tasks', difficulty: 'Simple' }, 'u');
  const blockerId = s.quests[s.quests.length - 1].id;
  s = saveCustomQuest(s, { name: 'Заблокированная', sphere: 'tasks', difficulty: 'Simple' }, 'u');
  const blockedId = s.quests[s.quests.length - 1].id;
  s = setTaskDependencies(s, blockedId, [blockerId], 'u');
  // Часто переносимая задача: переносов >= moveWarning (по умолчанию 3)
  s = quickPlanningTask(s, 'Переносимая', 'u', today);
  const movedId = s.quests[s.quests.length - 1].id;
  s = moveTaskToDay(s, movedId, dateKey(new Date(Date.now() + 86400000)), 'u', undefined, 'm1');
  s = moveTaskToDay(s, movedId, dateKey(new Date(Date.now() + 2 * 86400000)), 'u', undefined, 'm2');
  s = moveTaskToDay(s, movedId, dateKey(new Date(Date.now() + 3 * 86400000)), 'u', undefined, 'm3');

  const settings = planningSettings(s);
  const metrics = planningMetrics(s);
  const overview = executionOverview(s, s.quests, today, settings, metrics);

  assert.equal(overview.plannedToday, 1, 'ровно одна задача на сегодня (без учёта переносимой, которую подвинули)');
  assert.equal(overview.overdue >= 1, true);
  assert.equal(overview.noDate >= 1, true);
  assert.equal(overview.inActiveProjects >= 1, true);
  assert.equal(overview.blocked, 1);
  assert.equal(overview.oftenPostponed, 1);
  assert.equal(overview.totalActive, s.quests.filter((q) => !q.done && !q.wontDo && !q.planning?.archivedAt).length);
  assert.equal(s.quests.find((q) => q.id === todayId)?.dueAt, today);
});

test('executionOverview: проект на паузе и завершённый проект не считаются активными', () => {
  let s = setup();
  s = saveGoal(s, { name: 'На паузе', sphere: 'tasks', target: 1, reward: 100, paused: true });
  const pausedGoalId = s.goals[s.goals.length - 1].id;
  s = saveCustomQuest(s, { name: 'В проекте на паузе', sphere: 'tasks', difficulty: 'Simple' }, 'u');
  s = setTaskProject(s, s.quests[s.quests.length - 1].id, pausedGoalId, 'u');

  const settings = planningSettings(s);
  const overview = executionOverview(s, s.quests, today, settings);
  assert.equal(overview.inActiveProjects, 0);
});
