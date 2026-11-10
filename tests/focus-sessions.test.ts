import assert from 'node:assert/strict';
import test from 'node:test';
import { newAccountGame } from '../src/accountGame.ts';
import type { GameState } from '../src/game.ts';
import {
  comparisonText, dayFocus, discardFocus, extendFocus, finishFocus, FOCUS_MODES, FocusBusyError, focusByTask, focusComparison,
  focusEventId, focusHeatLevel, focusRecords, focusSlices, focusSnapshot, focusTotals, formatClock, formatFocus, monthFocus,
  NO_SPHERE, pauseFocus, projectFocus, recordDays, resumeFocus, stageFocus, startFocus, startStopwatch, taskFocusHistory, taskFocusSeconds,
} from '../src/focusSessions.ts';
import { actualMinutes, validActiveFocus, validPlanningEvent } from '../src/planningData.ts';
import { logTaskTime, quickPlanningTask } from '../src/planner.ts';
import { mergeStates } from '../src/stateMerge.ts';
import { validateState } from '../src/stateValidation.ts';

// Все моменты времени задаются локальным конструктором Date — тесты не зависят от часового пояса CI.
const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);
const plus = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

function setup(...names: string[]) {
  let s: GameState = newAccountGame('Тест');
  for (const name of names.length ? names : ['Урок английского']) s = quickPlanningTask(s, name, 'u');
  return s;
}
const idOf = (s: GameState, name: string) => s.quests.find((q) => q.name === name)!.id;
/** Сессия без пауз: план `plan` минут, работа `worked` минут с момента `start`. */
function session(s: GameState, taskId: string, start: Date, worked: number, plan = Math.max(1, Math.ceil(worked)), id?: string) {
  return finishFocus(startFocus(s, { taskId, minutes: plan }, start, id), {}, plus(start, worked));
}
function place(s: GameState, taskId: string, patch: { goalId?: string; stageId?: string; sphere?: string }): GameState {
  return { ...s, quests: s.quests.map((q) => (q.id === taskId ? { ...q, ...patch } : q)) };
}
function withProject(s: GameState): GameState {
  const goal = {
    id: 'g1', name: 'Выучить английский', sphere: 'english', current: 0, target: 100, created: '2026-11-01', reward: 0, rewarded: false,
    stages: [{ id: 'st1', name: 'Грамматика' }, { id: 'st2', name: 'Разговор' }],
  };
  return { ...s, goals: [...s.goals, goal as GameState['goals'][number]] };
}

test('Тест 1. Семь готовых интервалов 5/15/25/30/60/120/180 и своя продолжительность 1–180', () => {
  assert.deepEqual(FOCUS_MODES.map((m) => m.minutes), [5, 15, 25, 30, 60, 120, 180]);
  const s = setup(); const id = s.quests[0].id;
  for (const mode of FOCUS_MODES) {
    const started = startFocus(s, { taskId: id, minutes: mode.minutes }, at(2026, 11, 10));
    assert.equal(started.focusSession?.mode, mode.id);
    assert.equal(started.focusSession?.plannedSeconds, mode.minutes * 60);
    assert.ok(validActiveFocus(started.focusSession));
  }
  assert.equal(startFocus(s, { taskId: id, minutes: 47 }, at(2026, 11, 10)).focusSession?.mode, 'custom');
  assert.equal(startFocus(s, { taskId: id, minutes: 1 }, at(2026, 11, 10)).focusSession?.plannedSeconds, 60);
  for (const bad of [0, 181, 2.5, -5]) assert.throws(() => startFocus(s, { taskId: id, minutes: bad }, at(2026, 11, 10)));
  assert.throws(() => startFocus(s, { taskId: 'нет-такой', minutes: 25 }, at(2026, 11, 10)), /не найдена/);
});

test('Тесты 2–3. Досрочное завершение и пауза: план 120, работа 47, пауза 8 — засчитано 47 минут', () => {
  let s = setup(); const id = s.quests[0].id;
  const t0 = at(2026, 11, 10, 10, 0);
  s = startFocus(s, { taskId: id, minutes: 120, firstAction: '  Открыть учебник  ' }, t0, 'sess-1');
  assert.equal(focusSnapshot(s.focusSession!, plus(t0, 30)).status, 'active');
  s = pauseFocus(s, plus(t0, 30));
  const paused = focusSnapshot(s.focusSession!, plus(t0, 35));
  assert.equal(paused.status, 'paused');
  assert.equal(paused.focusedSeconds, 30 * 60, 'на паузе время не идёт');
  assert.equal(paused.pausedSeconds, 5 * 60);
  assert.equal(pauseFocus(s, plus(t0, 36)), s, 'повторная пауза ничего не меняет');
  s = resumeFocus(s, plus(t0, 38));
  s = finishFocus(s, { result: 'Прошёл раздел 3' }, plus(t0, 55));
  assert.equal(s.focusSession, undefined, 'сессия закрыта');
  const event = s.events.find((e) => e.id === focusEventId('sess-1'))!;
  assert.ok(validPlanningEvent(event as unknown as Record<string, unknown>));
  const change = event.planningChange;
  assert.ok(change?.type === 'time' && change.session);
  assert.equal(change.minutes, 47);
  assert.equal(change.session.focusedSeconds, 47 * 60, 'хранятся секунды, не плановые 120 минут');
  assert.equal(change.session.pausedSeconds, 8 * 60);
  assert.equal(change.session.plannedSeconds, 120 * 60);
  assert.equal(change.session.status, 'interrupted');
  assert.equal(change.session.segments.length, 2, 'начало паузы и момент возобновления видны по отрезкам');
  assert.equal(change.session.firstAction, 'Открыть учебник');
  assert.equal(change.session.result, 'Прошёл раздел 3');
  assert.equal(taskFocusSeconds(s, id), 47 * 60);
  assert.equal(actualMinutes(s, id), 47, 'прежний «факт» задачи читает то же событие');
});

test('время не округляется при сохранении: 90 секунд остаются 90 секундами', () => {
  const s0 = setup(); const id = s0.quests[0].id;
  const t0 = at(2026, 11, 10, 9, 0);
  const s = finishFocus(startFocus(s0, { taskId: id, minutes: 5 }, t0), {}, new Date(t0.getTime() + 90500));
  assert.equal(taskFocusSeconds(s, id), 90);
  assert.equal(focusRecords(s)[0].status, 'interrupted');
});

test('Тест 4. Продление — та же сессия и одна запись; ожидание после истечения в фокус не входит', () => {
  let s = setup(); const id = s.quests[0].id;
  const t0 = at(2026, 11, 8, 18, 0);
  s = startFocus(s, { taskId: id, minutes: 30 }, t0, 'sess-ext');
  const expired = focusSnapshot(s.focusSession!, plus(t0, 40));
  assert.equal(expired.status, 'expired');
  assert.equal(expired.focusedSeconds, 30 * 60);
  assert.equal(expired.remainingSeconds, 0);
  assert.throws(() => resumeFocus(s, plus(t0, 40)), /истекло/);
  s = extendFocus(s, 5, plus(t0, 40)); // 10 минут ожидания кнопки — не работа
  assert.equal(focusSnapshot(s.focusSession!, plus(t0, 42)).status, 'active');
  assert.equal(focusSnapshot(s.focusSession!, plus(t0, 42)).focusedSeconds, 32 * 60);
  s = finishFocus(s, {}, plus(t0, 60));
  const records = taskFocusHistory(s, id);
  assert.equal(records.length, 1, 'продление не создаёт вторую запись');
  assert.equal(records[0].seconds, 35 * 60, 'режим 30 минут, фокус 35 — как в примере истории задачи');
  assert.equal(records[0].plannedSeconds, 35 * 60);
  assert.equal(records[0].mode, 'extended');
  assert.equal(records[0].status, 'completed');
  assert.equal(records[0].pausedSeconds, 10 * 60);
  // Продление до истечения просто увеличивает план.
  const fresh = setup();
  const early = extendFocus(startFocus(fresh, { taskId: fresh.quests[0].id, minutes: 5 }, t0), 15, plus(t0, 2));
  assert.equal(early.focusSession?.plannedSeconds, 20 * 60);
  assert.equal(early.focusSession?.segments.length, 1);
});

test('закрытое приложение не добавляет больше остатка плана; countUntil обрезает время отсутствия', () => {
  const s0 = setup(); const id = s0.quests[0].id;
  const t0 = at(2026, 11, 10, 8, 0);
  const started = startFocus(s0, { taskId: id, minutes: 25 }, t0);
  // Вкладку закрыли и вернулись через 9 часов — засчитано не больше 25 минут.
  assert.equal(taskFocusSeconds(finishFocus(started, {}, plus(t0, 540)), id), 25 * 60);
  // Игрок подтвердил, что работал только первые 10 минут.
  assert.equal(taskFocusSeconds(finishFocus(started, { countUntil: plus(t0, 10) }, plus(t0, 540)), id), 10 * 60);
});

test('одна активная сессия на игрока; повтор старта и завершения идемпотентен', () => {
  let s = setup('Первая', 'Вторая');
  const a = idOf(s, 'Первая'); const b = idOf(s, 'Вторая');
  const t0 = at(2026, 11, 10, 10, 0);
  s = startFocus(s, { taskId: a, minutes: 60 }, t0, 'one');
  assert.equal(startFocus(s, { taskId: a, minutes: 60 }, plus(t0, 1), 'one'), s, 'повтор того же запроса ничего не меняет');
  assert.throws(() => startFocus(s, { taskId: b, minutes: 25 }, plus(t0, 1), 'two'), (e: unknown) => e instanceof FocusBusyError && e.taskId === a);
  const before = s;
  const done = finishFocus(s, {}, plus(t0, 20));
  // Повторная отправка завершения той же сессии (второй клик или второе устройство).
  const again = finishFocus({ ...done, focusSession: before.focusSession }, {}, plus(t0, 45));
  assert.equal(again.focusSession, undefined);
  assert.equal(again.events.length, done.events.length);
  assert.equal(taskFocusSeconds(again, a), 20 * 60, 'время не удвоилось и не выросло');
  // Два устройства завершили одну и ту же сессию, сохранения слились — запись одна.
  const other = finishFocus(before, {}, plus(t0, 20));
  const merged = mergeStates(before, done, other);
  assert.equal(focusRecords(merged).length, 1);
  assert.equal(merged.focusSession, undefined);
  // Сессия без подтверждённого времени не попадает в историю.
  const empty = finishFocus(startFocus(done, { taskId: b, minutes: 5 }, plus(t0, 30)), {}, plus(t0, 30));
  assert.equal(empty.events.length, done.events.length);
  assert.equal(empty.focusSession, undefined);
  const cancelled = discardFocus(startFocus(done, { taskId: b, minutes: 5 }, plus(t0, 30)));
  assert.equal(cancelled.events.length, done.events.length);
});

test('Тесты 5–7. Одна запись даёт время задаче, этапу и проекту; перенос задачи не переписывает историю', () => {
  let s = withProject(setup('Правила', 'Диалоги', 'Вне проекта'));
  const rules = idOf(s, 'Правила'); const talk = idOf(s, 'Диалоги'); const loose = idOf(s, 'Вне проекта');
  s = place(s, rules, { goalId: 'g1', stageId: 'st1', sphere: 'english' });
  s = place(s, talk, { goalId: 'g1', stageId: 'st2', sphere: 'english' });
  s = session(s, rules, at(2026, 11, 3, 10), 60);
  s = session(s, rules, at(2026, 11, 9, 10), 30);
  s = session(s, talk, at(2026, 11, 9, 15), 45);
  s = session(s, loose, at(2026, 11, 9, 20), 15);
  assert.equal(taskFocusSeconds(s, rules), 90 * 60);
  assert.equal(focusByTask(s).get(talk), 45 * 60);
  assert.equal(focusByTask(s), focusByTask(s), 'суммы по задачам не пересчитываются, пока история не изменилась');

  const stage = stageFocus(s, 'g1', 'st1', at(2026, 11, 10));
  assert.equal(stage.totalSeconds, 90 * 60);
  assert.equal(stage.sessions, 2);
  assert.equal(stage.activeDays, 2);
  assert.equal(stage.averageSeconds, 45 * 60);
  assert.equal(stage.longestSeconds, 60 * 60);
  assert.equal(stage.last7Seconds, 30 * 60, '3 ноября не входит в последние 7 дней от 10 ноября');
  assert.equal(stage.topTask?.name, 'Правила');
  assert.deepEqual(stage.byDay, [{ day: '2026-11-03', seconds: 3600 }, { day: '2026-11-09', seconds: 1800 }]);

  const project = projectFocus(s, 'g1');
  assert.equal(project.totalSeconds, 135 * 60);
  assert.equal(project.sessions, 3);
  assert.deepEqual(project.byStage.map((g) => [g.name, g.seconds]), [['Грамматика', 5400], ['Разговор', 2700]]);
  assert.equal(Math.round(project.byStage[0].share * 100), 67);
  assert.equal(projectFocus(s, 'g1', { from: '2026-11-09', to: '2026-11-09' }).totalSeconds, 75 * 60);

  // Задачу перенесли в другой этап и выполнили — прошлые сессии остаются за прежним этапом и за задачей.
  const moved = { ...place(s, rules, { stageId: 'st2' }) };
  moved.quests = moved.quests.map((q) => (q.id === rules ? { ...q, done: true } : q));
  assert.equal(stageFocus(moved, 'g1', 'st1').totalSeconds, 90 * 60);
  assert.equal(stageFocus(moved, 'g1', 'st2').totalSeconds, 45 * 60);
  assert.equal(taskFocusHistory(moved, rules).length, 2);
  assert.throws(() => startFocus(moved, { taskId: rules, minutes: 25 }), /выполнена/);
});

test('Тест 8. Сумма по сферам равна общему времени, включая «Без сферы»', () => {
  let s = setup('Английский', 'Спорт', 'Призрак');
  const en = idOf(s, 'Английский'); const sp = idOf(s, 'Спорт'); const ghost = idOf(s, 'Призрак');
  s = place(s, en, { sphere: 'english' });
  s = place(s, sp, { sphere: 'sport' });
  s = session(s, en, at(2026, 11, 2, 9), 50);
  s = session(s, sp, at(2026, 11, 4, 9), 25);
  s = session(s, ghost, at(2026, 11, 5, 9), 10);
  // Сфера, которой больше нет в справочнике.
  const ghostEvent = s.events.find((e) => e.sourceId === ghost)!;
  s = { ...s, events: s.events.map((e) => (e === ghostEvent ? { ...e, sphere: 'удалённая' } : e)) };
  const month = monthFocus(s, '2026-11', {}, at(2026, 11, 10));
  assert.equal(month.totalSeconds, 85 * 60);
  assert.equal(month.spheres.reduce((sum, row) => sum + row.seconds, 0), month.totalSeconds);
  assert.equal(month.spheres.find((row) => row.id === NO_SPHERE)?.seconds, 10 * 60);
  assert.equal(month.spheres[0].id, 'english');
  assert.equal(Math.round(month.spheres[0].share * 100), 59);
  assert.ok(month.spheres.some((row) => row.id === 'health' && row.seconds === 0), 'нулевые сферы есть в списке для «Показать все сферы»');
  assert.equal(monthFocus(s, '2026-11', { sphere: 'sport' }, at(2026, 11, 10)).totalSeconds, 25 * 60);
});

test('Тест 9. Месячный отчёт на контрольных данных: показатели, календарь, детализация дня', () => {
  let s = withProject(setup('А', 'Б'));
  const a = idOf(s, 'А'); const b = idOf(s, 'Б');
  s = place(s, a, { goalId: 'g1', stageId: 'st1', sphere: 'english' });
  s = session(s, a, at(2026, 11, 1, 10), 20);
  s = session(s, a, at(2026, 11, 1, 16), 40);
  s = session(s, b, at(2026, 11, 5, 10), 130);
  s = session(s, a, at(2026, 10, 31, 10), 60); // прошлый месяц — не входит
  const month = monthFocus(s, '2026-11', {}, at(2026, 11, 10));
  assert.equal(month.totalSeconds, 190 * 60);
  assert.equal(month.sessions, 3);
  assert.equal(month.activeDays, 2);
  assert.equal(month.averageSeconds, (190 * 60) / 3);
  assert.equal(month.days.length, 30);
  assert.deepEqual(month.days.slice(0, 5).map((d) => d.level), [3, 0, 0, 0, 4]);
  assert.equal(month.days[0].sessions, 2);
  assert.equal(month.days[10].future, true);
  assert.equal(month.days[9].future, false);
  assert.deepEqual(month.projects.map((p) => [p.name, p.seconds]), [['Без проекта', 7800], ['Выучить английский', 3600]]);
  assert.deepEqual(month.tasks.map((t) => t.name), ['Б', 'А']);
  const day = dayFocus(s, '2026-11-01');
  assert.equal(day.totalSeconds, 3600);
  assert.equal(day.sessions, 2);
  assert.deepEqual(day.spheres.map((x) => x.name), ['Английский']);
  const empty = monthFocus(setup(), '2026-11', {}, at(2026, 11, 10));
  assert.equal(empty.totalSeconds, 0);
  assert.equal(empty.averageSeconds, 0, 'без сессий средняя — 0, не NaN');
  assert.throws(() => monthFocus(s, '2026-13'));
  assert.deepEqual([0, 30, 60, 29 * 60, 30 * 60, 59 * 60, 60 * 60, 119 * 60, 120 * 60].map(focusHeatLevel), [0, 1, 1, 1, 2, 2, 3, 3, 4]);
});

test('Тест 10. Сессия через полночь и границу месяца делится по фактическим отрезкам, паузы исключены', () => {
  let s = setup(); const id = s.quests[0].id;
  const t0 = at(2026, 11, 30, 23, 40);
  s = startFocus(s, { taskId: id, minutes: 60 }, t0);
  s = pauseFocus(s, at(2026, 11, 30, 23, 50)); // 10 минут в ноябре
  s = resumeFocus(s, at(2026, 12, 1, 0, 0)); // пауза 10 минут через полночь
  s = finishFocus(s, {}, at(2026, 12, 1, 0, 20)); // 20 минут в декабре
  const record = focusRecords(s)[0];
  assert.equal(record.seconds, 30 * 60);
  assert.deepEqual(recordDays(record), [{ day: '2026-11-30', seconds: 600 }, { day: '2026-12-01', seconds: 1200 }]);
  assert.equal(monthFocus(s, '2026-11', {}, at(2026, 12, 5)).totalSeconds, 600);
  assert.equal(monthFocus(s, '2026-12', {}, at(2026, 12, 5)).totalSeconds, 1200);
  assert.equal(monthFocus(s, '2026-11', {}, at(2026, 12, 5)).days[29].seconds, 600);
  assert.equal(monthFocus(s, '2026-12', {}, at(2026, 12, 5)).days[0].seconds, 1200);
  // Сумма кусков по дням всегда равна времени записи, даже при неровных секундах.
  let odd = setup(); const oddId = odd.quests[0].id;
  odd = finishFocus(startFocus(odd, { taskId: oddId, minutes: 5 }, new Date(at(2026, 11, 9, 23, 58).getTime() + 300)), {}, new Date(at(2026, 11, 10, 0, 1).getTime() + 900));
  const parts = recordDays(focusRecords(odd)[0]);
  assert.equal(parts.length, 2);
  assert.equal(parts.reduce((sum, p) => sum + p.seconds, 0), focusRecords(odd)[0].seconds);
  assert.equal(focusTotals(focusSlices(odd)).sessions, 1, 'одна сессия остаётся одной, даже разделённая на два дня');
});

test('Тест 11. Сравнение: текущий месяц — с тем же числом дней прошлого, завершённый — полный с полным', () => {
  let s = setup(); const id = s.quests[0].id;
  s = session(s, id, at(2026, 10, 5, 10), 60); // 1–10 октября
  s = session(s, id, at(2026, 10, 20, 10), 120); // после 10 октября
  s = session(s, id, at(2026, 11, 3, 10), 90);
  const partial = focusComparison(s, '2026-11', {}, at(2026, 11, 10, 9, 50));
  assert.equal(partial.partial, true);
  assert.deepEqual(partial.range, { from: '2026-11-01', to: '2026-11-10' });
  assert.deepEqual(partial.previousRange, { from: '2026-10-01', to: '2026-10-10' });
  assert.equal(partial.previousSeconds, 3600, '10 ноября сравнивается с 1–10 октября, а не со всем октябрём');
  assert.equal(partial.percent, 50);
  assert.equal(comparisonText(partial), '+50% времени фокуса · +30 мин');
  const full = focusComparison(s, '2026-11', {}, at(2026, 12, 15));
  assert.equal(full.partial, false);
  assert.deepEqual(full.previousRange, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(full.previousSeconds, 3 * 3600);
  assert.equal(full.percent, -50);
  assert.equal(comparisonText(full), 'В этом периоде фокуса на 1 ч 30 мин меньше');
  assert.doesNotMatch(comparisonText(full), /лен|плох|неудач|дисциплин|провал/i);
  const noBase = focusComparison(s, '2026-10', {}, at(2026, 12, 15));
  assert.equal(noBase.percent, null, 'нет бесконечного процента роста');
  assert.equal(comparisonText(noBase), 'Нет данных для процентного сравнения');
  // 31 марта сравнивается с февралём целиком — интервал обрезается последним днём февраля.
  assert.deepEqual(focusComparison(s, '2026-03', {}, at(2026, 3, 31)).previousRange, { from: '2026-02-01', to: '2026-02-28' });
  assert.equal(comparisonText(focusComparison(setup(), '2026-11', {}, at(2026, 11, 10))), 'В обоих периодах фокуса пока нет');
});

test('секундомер и таймер — два способа работы, один отчёт: время обоих складывается', () => {
  let s = setup('Первая', 'Вторая');
  const a = idOf(s, 'Первая'); const b = idOf(s, 'Вторая');
  const t0 = at(2026, 11, 10, 10, 0);
  s = startStopwatch(s, { taskId: a }, t0, 'sw-1');
  assert.equal(s.focusSession?.mode, 'stopwatch');
  assert.ok(validActiveFocus(s.focusSession));
  const running = focusSnapshot(s.focusSession!, plus(t0, 200));
  assert.equal(running.stopwatch, true);
  assert.equal(running.status, 'active', 'секундомер не «истекает» вместе с каким-либо планом');
  assert.equal(running.focusedSeconds, 200 * 60);
  // Пока идёт секундомер, таймер начать нельзя, и наоборот — активная сессия одна.
  assert.throws(() => startFocus(s, { taskId: b, minutes: 25 }, plus(t0, 1), 'tm-1'), FocusBusyError);
  assert.throws(() => extendFocus(s, 5, plus(t0, 1)), /секундомер/i);
  s = pauseFocus(s, plus(t0, 40));
  s = resumeFocus(s, plus(t0, 50));
  s = finishFocus(s, { result: 'Готово' }, plus(t0, 73)); // 40 + 23 = 63 минуты работы
  const stopwatch = taskFocusHistory(s, a)[0];
  assert.equal(stopwatch.mode, 'stopwatch');
  assert.equal(stopwatch.seconds, 63 * 60);
  assert.equal(stopwatch.pausedSeconds, 10 * 60);
  assert.equal(stopwatch.plannedSeconds, undefined, 'у секундомера нет планового времени');
  assert.equal(stopwatch.status, 'completed');
  assert.ok(validPlanningEvent(s.events.find((e) => e.id === focusEventId('sw-1')) as unknown as Record<string, unknown>));
  assert.throws(() => startStopwatch(startFocus(s, { taskId: b, minutes: 25 }, plus(t0, 80), 'tm-2'), { taskId: a }, plus(t0, 81), 'sw-2'), FocusBusyError);
  // Таймер по другой задаче в тот же день — в отчёте одна общая сумма.
  s = session(s, b, plus(t0, 90), 25, 25);
  const month = monthFocus(s, '2026-11', {}, at(2026, 11, 10, 23));
  assert.equal(month.totalSeconds, (63 + 25) * 60);
  assert.equal(month.sessions, 2);
  assert.equal(month.days[9].seconds, (63 + 25) * 60);
  // Забытый секундомер останавливается на пределе 12 часов.
  const blank = setup();
  const forgotten = startStopwatch(blank, { taskId: blank.quests[0].id }, t0);
  assert.equal(focusSnapshot(forgotten.focusSession!, plus(t0, 3000)).status, 'expired');
  assert.equal(focusSnapshot(forgotten.focusSession!, plus(t0, 3000)).focusedSeconds, 12 * 3600);
});

test('время, внесённое вручную, входит в фокус той же записью — «Фокус» равен «Учтено фактически»', () => {
  let s = setup(); const id = s.quests[0].id;
  s = logTaskTime(s, id, 30, 'u', 'manual-1');
  s = session(s, id, at(2026, 11, 10, 10), 15);
  assert.equal(taskFocusSeconds(s, id), 45 * 60);
  assert.equal(actualMinutes(s, id) * 60, taskFocusSeconds(s, id));
  const manual = focusRecords(s).find((r) => r.id === 'manual-1')!;
  assert.equal(manual.mode, 'manual');
  assert.equal(recordDays(manual).length, 1);
});

test('Тест 12. Сохранение: игра с активной и завершённой сессией проходит проверку и переживает JSON', () => {
  let s = setup(); const id = s.quests[0].id;
  s = session(s, id, at(2026, 11, 9, 10), 25);
  s = pauseFocus(startFocus(s, { taskId: id, minutes: 60 }, at(2026, 11, 10, 9), 'live'), at(2026, 11, 10, 9, 10));
  s = resumeFocus(s, at(2026, 11, 10, 9, 15));
  const restored = JSON.parse(JSON.stringify(s)) as GameState;
  assert.doesNotThrow(() => validateState(restored));
  // После «перезагрузки» сессия продолжается с того же места: время считается от сохранённых моментов.
  const snap = focusSnapshot(restored.focusSession!, at(2026, 11, 10, 9, 25));
  assert.equal(snap.status, 'active');
  assert.equal(snap.focusedSeconds, 20 * 60);
  assert.equal(taskFocusSeconds(restored, id), 25 * 60);
  const broken = JSON.parse(JSON.stringify(s)) as { focusSession: { plannedSeconds: number } };
  broken.focusSession.plannedSeconds = -5;
  assert.throws(() => validateState(broken));
  const padded = JSON.parse(JSON.stringify(s)) as GameState;
  const change = padded.events.find((e) => e.planningChange?.type === 'time')!.planningChange as { session: { focusedSeconds: number } };
  change.session.focusedSeconds = 7200; // больше, чем сумма сохранённых отрезков работы
  assert.throws(() => validateState(padded), 'приписанное время отклоняется проверкой сохранения');
});

test('формат времени: до часа — минуты, дальше — часы и минуты', () => {
  assert.equal(formatFocus(0), '0 мин');
  assert.equal(formatFocus(20), '< 1 мин');
  assert.equal(formatFocus(42 * 60), '42 мин');
  assert.equal(formatFocus(155 * 60), '2 ч 35 мин');
  assert.equal(formatFocus(67 * 60), '1 ч 07 мин');
  assert.equal(formatFocus(6 * 3600), '6 ч');
  assert.equal(formatFocus(42 * 3600 + 30 * 60), '42 ч 30 мин');
  assert.equal(formatClock(24 * 60 + 59), '24:59');
  assert.equal(formatClock(3909), '1:05:09');
});
