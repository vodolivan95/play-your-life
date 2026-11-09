import assert from 'node:assert/strict';
import test from 'node:test';
import { newAccountGame } from '../src/accountGame.ts';
import {
  forwardMoveCount, monthlyActualMinutes, monthlyMoves, moveCount,
  postponementAnalytics, retimeCount, timeAnalytics, validPlanningEvent,
} from '../src/planningData.ts';
import { logTaskTime, moveTaskToDay, quickPlanningTask } from '../src/planner.ts';
import { updateTaskSettings } from '../src/taskSettings.ts';

function setup() { return quickPlanningTask(newAccountGame('Тест'), 'Пройти урок английского', 'u'); }

test('переносы: направление вперёд/назад и изменение времени считаются раздельно', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  assert.equal(moveCount(s, id), 0, 'первое назначение даты не перенос');
  s = moveTaskToDay(s, id, '2026-11-07', 'u', undefined, 'fwd-1');
  assert.equal(moveCount(s, id), 1);
  assert.equal(forwardMoveCount(s, id), 1);
  assert.equal(s.events.find((e) => e.id === 'fwd-1')!.planningChange?.direction, 'forward');
  s = moveTaskToDay(s, id, '2026-11-06', 'u', undefined, 'back-1');
  assert.equal(moveCount(s, id), 2);
  assert.equal(forwardMoveCount(s, id), 1, 'перенос назад не входит в счётчик «вперёд»');
  assert.equal(s.events.find((e) => e.id === 'back-1')!.planningChange?.direction, 'backward');
  // Изменение только времени в пределах того же дня — отдельная категория, не 'reschedule'.
  s = updateTaskSettings(s, id, { dueAt: '2026-11-06T15:00:00', actionId: 'retime-1' });
  assert.equal(moveCount(s, id), 2, 'смена времени в тот же день не увеличивает счётчик переносов');
  assert.equal(retimeCount(s, id), 1);
  assert.equal(s.events.find((e) => e.id === 'retime-1')!.planningChange?.type, 'retime');
});

test('переносы: причина — и свободный текст, и категория одновременно', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  s = moveTaskToDay(s, id, '2026-11-09', 'u', 'Заболел', 'r-1', 'noTime');
  const change = s.events.find((e) => e.id === 'r-1')!.planningChange;
  assert.equal(change?.reason, 'Заболел');
  assert.equal(change?.reasonCode, 'noTime');
});

test('TickTick: перенос у задачи с активным повторением не считается в основном счётчике, но остаётся в истории', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  s = { ...s, quests: s.quests.map((q) => (q.id === id ? { ...q, tickTickRepeatFlag: 'RRULE:FREQ=DAILY;INTERVAL=30' } : q)) };
  s = updateTaskSettings(s, id, { dueAt: '2026-12-05', actionId: 'auto-1' });
  assert.equal(moveCount(s, id), 0, 'наступление следующего повтора не считается переносом');
  const event = s.events.find((e) => e.id === 'auto-1')!;
  assert.equal(event.planningChange?.type, 'reschedule');
  assert.equal(event.planningChange?.auto, true, 'событие сохранено в истории с пометкой auto');
  // Задача без repeatFlag продолжает считаться как обычно.
  const plain = setup(); const pid = plain.quests[0].id;
  let p = moveTaskToDay(plain, pid, '2026-11-05', 'u');
  p = moveTaskToDay(p, pid, '2026-11-07', 'u', undefined, 'manual-1');
  assert.equal(moveCount(p, pid), 1);
});

test('аналитика переносов: неделя/месяц, топ-10 и ставка откладывания', () => {
  let s = newAccountGame('Тест');
  const ids: string[] = [];
  for (let i = 0; i < 6; i++) {
    s = quickPlanningTask(s, `Задача ${i}`, 'u');
    ids.push(s.quests[s.quests.length - 1].id);
  }
  const now = new Date('2026-11-09T12:00:00.000Z');
  // Пять задач получают плановую дату (нужна минимальная история для ставки откладывания).
  for (const id of ids.slice(0, 5)) s = moveTaskToDay(s, id, '2026-11-01', 'u');
  const empty = postponementAnalytics(s, now);
  assert.equal(empty.insufficientData, false);
  assert.equal(empty.postponementRate, 0);
  // Задача 0 переносится дважды вперёд на этой неделе.
  s = moveTaskToDay(s, ids[0], '2026-11-08', 'u', undefined, 'w-1');
  s = moveTaskToDay(s, ids[0], '2026-11-10', 'u', undefined, 'w-2');
  // Задача 1 переносится один раз назад (не считается в ставке откладывания).
  s = moveTaskToDay(s, ids[1], '2026-10-20', 'u', undefined, 'w-3');
  // Даты событий — не момент вызова теста, а тот же день, что и 'now' (значит точно внутри текущей недели/месяца).
  s = {
    ...s,
    events: s.events.map((e) => (['w-1', 'w-2', 'w-3'].includes(e.id) ? { ...e, date: '2026-11-09T10:00:00.000Z' } : e)),
  };
  const a = postponementAnalytics(s, now);
  assert.equal(a.totalMoves, 3);
  assert.equal(a.tasksWithMoves, 2);
  assert.equal(a.forwardMoves, 2);
  assert.equal(a.backwardMoves, 1);
  assert.equal(a.mostPostponed?.id, ids[0]);
  assert.equal(a.top10[0].moves, 2);
  assert.equal(a.movesThisWeek, 3, 'все три переноса сделаны 9 ноября — внутри текущей недели');
  assert.equal(a.movesThisMonth, 3);
  // Ставка: 1 из 5 запланированных задач была перенесена вперёд хотя бы раз.
  assert.equal(a.postponementRate, 1 / 5);
});

test('аналитика переносов: «Недостаточно данных» при малой истории', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  const a = postponementAnalytics(s);
  assert.equal(a.insufficientData, true);
  assert.equal(a.postponementRate, undefined);
});

test('аналитика времени: Plan Accuracy и среднее отклонение', () => {
  let s = setup(); const id = s.quests[0].id;
  s = updateTaskSettings(s, id, { estimateMinutes: 40 });
  s = logTaskTime(s, id, 65, 'u', 't-1');
  const a = timeAnalytics(s);
  assert.equal(a.tasksWithBoth, 1);
  assert.equal(a.plannedMinutes, 40);
  assert.equal(a.actualMinutes, 65);
  assert.equal(a.averageDeviationMinutes, 25);
  // |65-40|/40 = 0.625 → точность 1 - 0.625 = 0.375.
  assert.ok(a.planAccuracy !== undefined && Math.abs(a.planAccuracy - 0.375) < 1e-9);
});

test('месячные показатели: переносы и факт времени по дате события', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  s = moveTaskToDay(s, id, '2026-11-07', 'u', undefined, 'm-1');
  s = logTaskTime(s, id, 30, 'u', 'm-2');
  // Подменяем дату событий на известный месяц для детерминированной проверки.
  s = { ...s, events: s.events.map((e) => (e.id === 'm-1' || e.id === 'm-2' ? { ...e, date: '2026-11-07T10:00:00.000Z' } : e)) };
  assert.deepEqual(monthlyMoves(s, '2026-11'), { moves: 1, forward: 1 });
  assert.equal(monthlyActualMinutes(s, '2026-11'), 30);
  assert.deepEqual(monthlyMoves(s, '2026-12'), { moves: 0, forward: 0 });
});

test('аналитика переносов: ограничение набором задач проекта/этапа (questIds)', () => {
  let s = newAccountGame('Тест');
  const ids: string[] = [];
  for (let i = 0; i < 6; i++) {
    s = quickPlanningTask(s, `Задача ${i}`, 'u');
    ids.push(s.quests[s.quests.length - 1].id);
  }
  for (const id of ids.slice(0, 5)) s = moveTaskToDay(s, id, '2026-11-01', 'u');
  s = moveTaskToDay(s, ids[0], '2026-11-08', 'u');
  s = moveTaskToDay(s, ids[1], '2026-11-09', 'u');
  const now = new Date('2026-11-09T12:00:00.000Z');
  const all = postponementAnalytics(s, now);
  assert.equal(all.totalMoves, 2);
  // Только задача 0 входит в «проект» — перенос задачи 1 не должен учитываться.
  const scoped = postponementAnalytics(s, now, [ids[0]]);
  assert.equal(scoped.totalMoves, 1);
  assert.equal(scoped.tasksWithMoves, 1);
  const scopedTime = timeAnalytics(s, [ids[0]]);
  assert.equal(scopedTime.tasksWithBoth, 0, 'без оценки/факта времени для этой задачи');
});

test('validPlanningEvent: direction и auto допустимы только при reschedule', () => {
  const base = { kind: 'planning', xp: 0, sourceId: 'q1' } as Record<string, unknown>;
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', direction: 'forward' } }), true);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'schedule', to: '2026-11-02T00:00:00.000Z', direction: 'forward' } }), false, 'direction недопустим для schedule');
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'retime', from: '2026-11-01T09:00:00.000Z', to: '2026-11-01T10:00:00.000Z' } }), true);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', reasonCode: 'not-a-real-code' } }), false);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', reasonCode: 'noTime' } }), true);
});
