import assert from 'node:assert/strict';
import test from 'node:test';
import { newAccountGame } from '../src/accountGame.ts';
import { completeQuest } from '../src/game.ts';
import {
  ambiguousMoveCount, forwardMoveCount, monthlyActualMinutes, monthlyMoves, moveCount,
  postponementAnalytics, retimeCount, timeAnalytics, validPlanningEvent,
} from '../src/planningData.ts';
import { logTaskTime, moveTaskToDay, quickPlanningTask } from '../src/planner.ts';
import { updateTaskSettings } from '../src/taskSettings.ts';

function setup() { return quickPlanningTask(newAccountGame('Тест'), 'Пройти урок английского', 'u'); }
function withRepeat(s: ReturnType<typeof setup>, id: string, repeatFlag: string) {
  return { ...s, quests: s.quests.map((q) => (q.id === id ? { ...q, tickTickRepeatFlag: repeatFlag } : q)) };
}

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

test('TickTick: сдвиг вперёд, совпадающий с шагом повтора, не доказан — не входит в счётчик, но виден в истории', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  s = withRepeat(s, id, 'RRULE:FREQ=DAILY;INTERVAL=30');
  // Сдвиг ровно на 30 дней — ровно шаг повтора (INTERVAL=30): возможен и автоповтор, и совпавший
  // по длительности ручной перенос — причина недоказуема.
  s = updateTaskSettings(s, id, { dueAt: '2026-12-05', actionId: 'ambiguous-1' });
  assert.equal(moveCount(s, id), 0, 'совпадающий с шагом повтора сдвиг не засчитан как достоверный перенос');
  assert.equal(ambiguousMoveCount(s, id), 1);
  const event = s.events.find((e) => e.id === 'ambiguous-1')!;
  assert.equal(event.planningChange?.type, 'reschedule');
  assert.equal(event.planningChange?.ambiguousRepeat, true, 'событие сохранено в истории с пометкой неопределённости');
  // Задача без repeatFlag продолжает считаться как обычно.
  const plain = setup(); const pid = plain.quests[0].id;
  let p = moveTaskToDay(plain, pid, '2026-11-05', 'u');
  p = moveTaskToDay(p, pid, '2026-11-07', 'u', undefined, 'manual-1');
  assert.equal(moveCount(p, pid), 1);
});

test('TickTick: ручной перенос повторяющейся задачи на срок, НЕ совпадающий с шагом повтора, засчитывается достоверно', () => {
  // Пример из ТЗ «Этап 2 — исправление» (раздел 2): ежедневная задача с 10 на 12 ноября —
  // сдвиг на 2 дня при шаге повтора «раз в день» не может быть автоматическим наступлением
  // следующего повтора, значит это доказанный перенос пользователя.
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-10', 'u');
  s = withRepeat(s, id, 'RRULE:FREQ=DAILY;INTERVAL=1');
  s = updateTaskSettings(s, id, { dueAt: '2026-11-12', actionId: 'manual-repeat-1' });
  assert.equal(moveCount(s, id), 1, 'сдвиг на 2 дня при ежедневном повторе — доказанный перенос пользователя');
  assert.equal(forwardMoveCount(s, id), 1);
  assert.equal(ambiguousMoveCount(s, id), 0);
  assert.equal(s.events.find((e) => e.id === 'manual-repeat-1')!.planningChange?.ambiguousRepeat, undefined);
});

test('TickTick: перенос повторяющейся задачи НАЗАД никогда не считается автоматическим', () => {
  // Автоматическое наступление следующего повтора всегда сдвигает дату вперёд — сдвиг назад
  // не может быть им по определению, даже если формально совпадает с шагом повтора.
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-10', 'u');
  s = withRepeat(s, id, 'RRULE:FREQ=DAILY;INTERVAL=1');
  s = updateTaskSettings(s, id, { dueAt: '2026-11-09', actionId: 'back-repeat-1' });
  assert.equal(moveCount(s, id), 1);
  assert.equal(ambiguousMoveCount(s, id), 0);
  assert.equal(s.events.find((e) => e.id === 'back-repeat-1')!.planningChange?.direction, 'backward');
});

test('TickTick: нераспознанный шаг повтора (несколько дней недели в BYDAY) — консервативно неопределённо', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-09', 'u'); // понедельник
  s = withRepeat(s, id, 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
  // Сдвиг на 2 дня (до среды) — в рамках паттерна «по будням» это нормальный шаг повтора, но
  // точный интервал непредсказуем без разбора BYDAY-дней, поэтому он не разбирается как точный
  // шаг: по умолчанию (шаг неизвестен) изменение вперёд остаётся неопределённым.
  s = updateTaskSettings(s, id, { dueAt: '2026-11-11', actionId: 'byday-1' });
  assert.equal(moveCount(s, id), 0);
  assert.equal(ambiguousMoveCount(s, id), 1);
});

test('TickTick: MONTHLY с одним BYMONTHDAY — перенос на ~месяц вперёд неопределён, на 5 дней — достоверен', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-10-15', 'u');
  s = withRepeat(s, id, 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15');
  s = updateTaskSettings(s, id, { dueAt: '2026-11-15', actionId: 'monthly-step' }); // ровно месяц — неопределённо
  assert.equal(moveCount(s, id), 0);
  assert.equal(ambiguousMoveCount(s, id), 1);
  s = updateTaskSettings(s, id, { dueAt: '2026-11-20', actionId: 'monthly-real' }); // +5 дней от 11-15 — не шаг повтора
  assert.equal(moveCount(s, id), 1);
  assert.equal(ambiguousMoveCount(s, id), 1);
});

test('TickTick: MONTHLY с несколькими BYMONTHDAY — шаг непредсказуем, форвард всегда неопределён, назад всегда достоверен', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-01', 'u');
  s = withRepeat(s, id, 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15');
  s = updateTaskSettings(s, id, { dueAt: '2026-11-04', actionId: 'multi-monthday-fwd' }); // короткий сдвиг — всё равно неопределён, шаг не разбирается
  assert.equal(moveCount(s, id), 0);
  assert.equal(ambiguousMoveCount(s, id), 1);
  s = updateTaskSettings(s, id, { dueAt: '2026-10-29', actionId: 'multi-monthday-back' }); // назад — всегда достоверно
  assert.equal(moveCount(s, id), 1);
  assert.equal(ambiguousMoveCount(s, id), 1);
});

test('TickTick: YEARLY — перенос на ~год вперёд неопределён, на 10 дней вперёд достоверен', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2025-11-09', 'u');
  s = withRepeat(s, id, 'RRULE:FREQ=YEARLY');
  s = updateTaskSettings(s, id, { dueAt: '2026-11-09', actionId: 'yearly-step' });
  assert.equal(moveCount(s, id), 0);
  assert.equal(ambiguousMoveCount(s, id), 1);
  s = updateTaskSettings(s, id, { dueAt: '2026-11-19', actionId: 'yearly-real' });
  assert.equal(moveCount(s, id), 1);
  assert.equal(ambiguousMoveCount(s, id), 1);
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
  assert.equal(a.ambiguousMoves, 0);
  assert.equal(a.mostPostponed?.id, ids[0]);
  assert.equal(a.top10[0].moves, 2);
  assert.equal(a.movesThisWeek, 3, 'все три переноса сделаны 9 ноября — внутри текущей недели');
  assert.equal(a.movesThisMonth, 3);
  // Ставка: 1 из 5 запланированных задач была перенесена вперёд хотя бы раз.
  assert.equal(a.postponementRate, 1 / 5);
});

test('аналитика переносов: событие в будущем (рассинхрон часов) не попадает в текущую неделю/месяц', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  s = moveTaskToDay(s, id, '2026-11-07', 'u', undefined, 'future-1');
  // Событие формально записано с датой следующего месяца — например, устройство со спешащими
  // часами. Без верхней границы оно ошибочно попало бы в счётчик текущей недели/месяца.
  s = { ...s, events: s.events.map((e) => (e.id === 'future-1' ? { ...e, date: '2026-12-15T10:00:00.000Z' } : e)) };
  const a = postponementAnalytics(s, new Date('2026-11-09T12:00:00.000Z'));
  assert.equal(a.movesThisWeek, 0);
  assert.equal(a.movesThisMonth, 0);
  assert.equal(a.totalMoves, 1, 'само событие всё равно учтено в общем счётчике — просто не в текущем периоде');
});

test('аналитика переносов: «Недостаточно данных» при малой истории', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  const a = postponementAnalytics(s);
  assert.equal(a.insufficientData, true);
  assert.equal(a.postponementRate, undefined);
});

test('аналитика переносов: задача с готовой датой при создании (без события schedule) всё равно учитывается в знаменателе ставки', () => {
  // Имитация синхронизации из TickTick при первом импорте: saveTask() создаёт задачу сразу с
  // dueAt, поэтому recordTaskSchedule() не создаёт событие 'schedule' (нет предыдущей версии
  // задачи для сравнения) — у задачи нет истории планирования, но план всё равно известен.
  let s = newAccountGame('Тест');
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    s = quickPlanningTask(s, `Задача с историей ${i}`, 'u');
    const taskId = s.quests[s.quests.length - 1].id;
    ids.push(taskId);
    s = moveTaskToDay(s, taskId, '2026-11-01', 'u');
  }
  // Шестая задача создана сразу с готовой датой — ни одного события планирования.
  s = quickPlanningTask(s, 'Импортировано с датой', 'u', '2026-11-03');
  const importedId = s.quests[s.quests.length - 1].id;
  assert.equal(s.events.some((e) => e.sourceId === importedId), false, 'у только что импортированной задачи нет истории планирования');
  const a = postponementAnalytics(s, new Date('2026-11-09T12:00:00.000Z'));
  assert.equal(a.insufficientData, false, 'шестая задача расширяет знаменатель, даже не имея события schedule');
});

test('аналитика времени: Plan Accuracy и среднее отклонение считаются только по завершённой задаче', () => {
  let s = setup(); const id = s.quests[0].id;
  s = updateTaskSettings(s, id, { estimateMinutes: 40 });
  s = logTaskTime(s, id, 65, 'u', 't-1');
  // Задача ещё не завершена — 65 минут это промежуточная сессия (например, через таймер), а не
  // окончательный факт: сравнивать его с планом как итог рано (ТЗ «Этап 2 — исправление», 5.2).
  const partial = timeAnalytics(s);
  assert.equal(partial.tasksWithBoth, 0, 'незавершённая задача не входит в расчёт точности оценки');
  assert.equal(partial.plannedMinutes, 40, 'сумма плана считается независимо от завершённости');
  assert.equal(partial.actualMinutes, 65, 'сумма факта считается независимо от завершённости');
  s = completeQuest(s, id);
  const a = timeAnalytics(s);
  assert.equal(a.tasksWithBoth, 1);
  assert.equal(a.averageDeviationMinutes, 25);
  // |65-40|/40 = 0.625 → точность 1 - 0.625 = 0.375.
  assert.ok(a.planAccuracy !== undefined && Math.abs(a.planAccuracy - 0.375) < 1e-9);
});

test('аналитика времени: неучтённое время считается неизвестным, а не нулём', () => {
  let s = setup(); const id = s.quests[0].id;
  s = updateTaskSettings(s, id, { estimateMinutes: 40 });
  s = completeQuest(s, id);
  const a = timeAnalytics(s);
  assert.equal(a.tasksWithBoth, 0, 'факт не зафиксирован — задача не входит в расчёт точности');
  assert.equal(a.planAccuracy, undefined);
  assert.equal(a.averageDeviationMinutes, undefined);
});

test('месячные показатели: переносы и факт времени по дате события', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  s = moveTaskToDay(s, id, '2026-11-07', 'u', undefined, 'm-1');
  s = logTaskTime(s, id, 30, 'u', 'm-2');
  // Подменяем дату событий на известный месяц для детерминированной проверки.
  s = { ...s, events: s.events.map((e) => (e.id === 'm-1' || e.id === 'm-2' ? { ...e, date: '2026-11-07T10:00:00.000Z' } : e)) };
  assert.deepEqual(monthlyMoves(s, '2026-11'), { moves: 1, forward: 1, ambiguous: 0 });
  assert.equal(monthlyActualMinutes(s, '2026-11'), 30);
  assert.deepEqual(monthlyMoves(s, '2026-12'), { moves: 0, forward: 0, ambiguous: 0 });
});

test('месячные показатели: неопределённые изменения повторяющихся задач считаются отдельно от moves/forward', () => {
  let s = setup(); const id = s.quests[0].id;
  s = moveTaskToDay(s, id, '2026-11-05', 'u');
  s = withRepeat(s, id, 'RRULE:FREQ=DAILY;INTERVAL=30');
  s = updateTaskSettings(s, id, { dueAt: '2026-12-05', actionId: 'amb-month-1' });
  s = { ...s, events: s.events.map((e) => (e.id === 'amb-month-1' ? { ...e, date: '2026-11-20T10:00:00.000Z' } : e)) };
  assert.deepEqual(monthlyMoves(s, '2026-11'), { moves: 0, forward: 0, ambiguous: 1 });
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

test('validPlanningEvent: direction и ambiguousRepeat допустимы только при reschedule', () => {
  const base = { kind: 'planning', xp: 0, sourceId: 'q1' } as Record<string, unknown>;
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', direction: 'forward' } }), true);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'schedule', to: '2026-11-02T00:00:00.000Z', direction: 'forward' } }), false, 'direction недопустим для schedule');
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'retime', from: '2026-11-01T09:00:00.000Z', to: '2026-11-01T10:00:00.000Z' } }), true);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', reasonCode: 'not-a-real-code' } }), false);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', reasonCode: 'noTime' } }), true);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z', ambiguousRepeat: true } }), true);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'retime', from: '2026-11-01T09:00:00.000Z', to: '2026-11-01T10:00:00.000Z', ambiguousRepeat: true } }), false, 'ambiguousRepeat недопустим для retime');
});

test('совместимость: старое событие планирования без новых полей всё ещё валидно', () => {
  // Форма события из версии 0.74.0/0.75.0 — до появления reasonCode/direction/ambiguousRepeat.
  const base = { kind: 'planning', xp: 0, sourceId: 'q1' } as Record<string, unknown>;
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'reschedule', from: '2026-11-01T00:00:00.000Z', to: '2026-11-02T00:00:00.000Z' } }), true);
  assert.equal(validPlanningEvent({ ...base, planningChange: { type: 'time', minutes: 15 } }), true);
});
