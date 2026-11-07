import assert from 'node:assert/strict';
import test from 'node:test';
import { newAccountGame } from '../src/accountGame.ts';
import { backupText, restoreBackup } from '../src/backup.ts';
import { validateState } from '../src/stateValidation.ts';
import { actualMinutes, moveCount, planningSettings, validPlanningSettings } from '../src/planningData.ts';
import { applyWeekProposal, availableMinutes, changeTaskPlanning, inboxTask, logTaskTime, moveTaskToDay, planningConflicts, proposeWeek, quickPlanningTask, savePlanningSettings, setTaskWorkflow } from '../src/planner.ts';
import { duplicateQuest } from '../src/personalQuests.ts';
import { mergeStates } from '../src/stateMerge.ts';
import { assembleFromCloud, splitForCloud } from '../src/cloudSplit.ts';
import { addDays, mondayOf } from '../src/tasksCalendar.ts';
import { completeQuest, dateKey } from '../src/game.ts';

function setup() { return quickPlanningTask(newAccountGame('Тест'), 'Первый шаг', 'u'); }

test('план: старая игра не требует миграции; быстрая задача попадает во входящие', () => {
  const old = newAccountGame('Тест');
  assert.equal(old.planningSettings, undefined);
  assert.equal(planningSettings(old).mainLimit, 3);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(old))));
  const s = setup();
  assert.equal(inboxTask(s.quests[0]), true);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
  assert.equal(s.xp, 0);
});
test('переносы: первоначальное назначение отдельно, смена дня сохраняет историю и дедлайн', () => {
  let s = setup(); const id = s.quests[0].id;
  s.quests[0].deadlineAt = '2026-12-31';
  s = moveTaskToDay(s, id, '2026-11-10', 'u');
  assert.equal(moveCount(s, id), 0);
  s = moveTaskToDay(s, id, '2026-11-11', 'u', 'Не хватило времени', 'move-1');
  assert.equal(moveCount(s, id), 1);
  assert.equal(s.quests[0].deadlineAt, '2026-12-31');
  const event = s.events.find((e) => e.id === 'move-1')!;
  assert.equal(event.planningChange?.type, 'reschedule');
  assert.equal(event.xp, 0);
  assert.equal(moveTaskToDay(s, id, '2026-11-12', 'u', undefined, 'move-1'), s);
  assert.equal(inboxTask(s.quests[0]), false);
  const cleared = moveTaskToDay(s, id, null, 'u');
  assert.equal(inboxTask(cleared.quests[0]), true);
});
test('факт: записи идемпотентны, сумма и история переживают backup и cloud split', () => {
  let s = setup(); const id = s.quests[0].id;
  s = logTaskTime(s, id, 25, 'u', 'time-1');
  assert.equal(logTaskTime(s, id, 25, 'u', 'time-1'), s);
  assert.throws(() => logTaskTime(s, id, -1, 'u'));
  assert.throws(() => logTaskTime(s, id, 5, 'other'));
  s = logTaskTime(s, id, 15, 'u', 'time-2');
  assert.equal(actualMinutes(s, id), 40);
  assert.equal(actualMinutes(restoreBackup(backupText(s)), id), 40);
  const split = splitForCloud(s, new Date('2027-12-01'));
  assert.equal(actualMinutes(assembleFromCloud(split.stored, split.history, split.images), id), 40);
  assert.equal(s.coins, 0);
});
test('журнал: два клиента сохраняют разные записи времени и переносят настройки', () => {
  const base = setup(); const id = base.quests[0].id;
  const local = logTaskTime(base, id, 10, 'u', 'a');
  const remote = logTaskTime(base, id, 20, 'u', 'b');
  const merged = mergeStates(base, local, remote);
  assert.equal(actualMinutes(merged, id), 30);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(merged))));
});
test('валидация: новые данные проверяются до восстановления', () => {
  const s = setup();
  s.quests[0].planning = { mainDay: '2026-02-30' };
  assert.throws(() => validateState(JSON.parse(JSON.stringify(s))));
  assert.equal(validPlanningSettings({ ...planningSettings(s), weekdays: [1, 1] }), false);
  assert.throws(() => savePlanningSettings(s, { ...planningSettings(s), reservePercent: 100 }));
});
test('канбан: завершение и возврат используют существующую защиту награды', () => {
  let s = setup(); const id = s.quests[0].id;
  s = setTaskWorkflow(s, id, 'doing', 'u');
  s = setTaskWorkflow(s, id, 'done', 'u');
  const xp = s.xp;
  s = setTaskWorkflow(s, id, 'ready', 'u');
  s = setTaskWorkflow(s, id, 'done', 'u');
  assert.equal(s.xp, xp);
  assert.equal(s.quests[0].done, true);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
});
test('копия не наследует дневной фокус, архив и фактическое время', () => {
  let s = setup(); const id = s.quests[0].id;
  s = changeTaskPlanning(s, id, { mainDay: '2026-11-10', archivedAt: '2026-11-10T12:00:00Z', workflow: 'doing' }, 'u');
  s = logTaskTime(s, id, 15, 'u');
  const copy = duplicateQuest(s, id, 'u').quests[1];
  assert.equal(copy.planning?.archivedAt, undefined);
  assert.equal(copy.planning?.mainDay, undefined);
  assert.equal(copy.planning?.workflow, undefined);
  assert.equal(actualMinutes(s, copy.id), 0);
});
test('неделя: предложение не меняет задачи, учитывает лимит и не пишет неизвестные оценки', () => {
  let s = setup(); const id = s.quests[0].id;
  s.quests[0].estimateMinutes = 30;
  s = quickPlanningTask(s, 'Без оценки', 'u');
  s = savePlanningSettings(s, { ...planningSettings(s), weekdays: [0, 1, 2, 3, 4, 5, 6], dailyMinutes: 30, reservePercent: 0 });
  const anchor = addDays(mondayOf(dateKey()), 7);
  const p = proposeWeek(s, s.quests.map((q) => q.id), anchor, 'u');
  assert.equal(s.quests[0].dueAt, undefined);
  assert.equal(p.assignments.length, 1);
  assert.equal(p.unplaced.length, 1);
  assert.equal(availableMinutes(s, anchor), 30);
  const planned = applyWeekProposal(s, p, 'u');
  assert.equal(planned.quests.find((q) => q.id === id)?.dueAt, anchor);
  assert.throws(() => applyWeekProposal(planned, p, 'u'), /изменился/);
  const changed = savePlanningSettings(s, { ...planningSettings(s), dailyMinutes: 0 });
  assert.throws(() => applyWeekProposal(changed, p, 'u'), /изменился/);
});
test('пересечения: соприкасающиеся границы и задачи без времени не создают конфликт', () => {
  const q = setup().quests[0];
  const range = (id: string, start: string, end: string) => ({ ...q, id, startsAt: start, dueAt: end });
  const a = range('a', '2026-11-10T09:00', '2026-11-10T10:00');
  const b = range('b', '2026-11-10T10:00', '2026-11-10T11:00');
  const c = range('c', '2026-11-10T09:30', '2026-11-10T10:30');
  assert.equal(planningConflicts([a, b]).length, 0);
  assert.equal(planningConflicts([a, b, c]).length, 2);
  assert.equal(planningConflicts([a, { ...c, done: true }, { ...b, startsAt: '2026-11-10', dueAt: '2026-11-10' }]).length, 0);
});

test('завершение не обходит отказ от задачи и паузу проекта без этапов', () => {
  const s = setup(); const id = s.quests[0].id;
  s.quests[0].wontDo = true;
  assert.equal(completeQuest(s, id), s);
  assert.throws(() => setTaskWorkflow(s, id, 'done', 'u'), /верни задачу/);
  delete s.quests[0].wontDo;
  s.goals = [{ id: 'g', name: 'Проект', sphere: 'tasks', current: 0, target: 1, created: new Date().toISOString(), reward: 0, rewarded: false, paused: true }];
  s.quests[0].goalId = 'g';
  assert.equal(completeQuest(s, id), s);
  assert.throws(() => setTaskWorkflow(s, id, 'done', 'u'), /приостановлен/);
  assert.equal(s.xp, 0);
  assert.equal(s.quests[0].done, false);
});
