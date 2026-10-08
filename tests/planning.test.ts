import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  achievements,
  completeQuest,
  initialState,
  migrateState,
  removeQuest,
  syncGoalTasks,
  updateGoal,
} from '../src/game.ts';
import {
  deleteGoal,
  durationEnd,
  localDateTime,
  periodBounds,
  periodItems,
  planCalendar,
  planTransferText,
  preserveDateInput,
  removeStage,
  saveGoal,
  saveStage,
  saveTask,
  toISO,
} from '../src/planning.ts';
import type { GameState, Goal } from '../src/game.ts';
function plan(): GameState {
  return saveGoal(initialState(), {
    name: 'Мой путь',
    sphere: 'english',
    target: 100,
    reward: 200,
    progressMode: 'tasks',
    startsAt: '2027-01-01T08:00:00Z',
    dueAt: '2027-12-31T18:00:00Z',
  });
}
function goal(s: GameState): Goal {
  return s.goals.at(-1)!;
}
function add(s: GameState, name = 'Первый шаг', extra = {}) {
  return saveTask(s, {
    name,
    sphere: 'english',
    difficulty: 'Medium',
    goalId: goal(s).id,
    startsAt: '2027-03-02T09:00:00Z',
    dueAt: '2027-03-02T10:00:00Z',
    estimateMinutes: 60,
    ...extra,
  });
}
test('редактирование текста не округляет сохранённые сроки; изменение и очистка даты явные', () => {
  for (const original of [
    '2027-03-02T09:05:38.123Z',
    '2027-03-02T12:05:38+03:00',
    '2027-03-02',
  ]) {
    assert.equal(
      preserveDateInput(localDateTime(new Date(original)), original),
      original,
    );
  }
  assert.equal(preserveDateInput('', undefined), undefined);
  assert.equal(preserveDateInput('', '2027-03-02T09:05:38.123Z'), undefined);
  const changed = '2027-03-03T10:45';
  assert.equal(
    preserveDateInput(changed, '2027-03-02T09:05:38.123Z'),
    toISO(changed),
  );
});
test('сроки в часах, днях, неделях, месяцах и годах; конец месяца ограничен', () => {
  assert.equal(
    durationEnd('2027-01-31T12:00:00Z', 2, 'hours'),
    '2027-01-31T14:00:00.000Z',
  );
  const local = new Date(2027, 0, 31, 12);
  const feb = new Date(durationEnd(local.toISOString(), 1, 'months'));
  assert.equal(feb.getMonth(), 1);
  assert.equal(feb.getDate(), 28);
  assert.equal(feb.getHours(), 12);
  const next = new Date(durationEnd(local.toISOString(), 12, 'months'));
  assert.equal(next.getFullYear(), 2028);
  assert.equal(next.getDate(), 31);
  const day = new Date(
    durationEnd(new Date(2027, 2, 13, 12).toISOString(), 1, 'days'),
  );
  assert.equal(day.getDate(), 14);
  assert.equal(day.getHours(), 12);
  const week = new Date(durationEnd(local.toISOString(), 1, 'weeks'));
  assert.equal(week.getDate(), 7);
  assert.equal(week.getMonth(), 1);
  assert.equal(toISO(''), undefined);
  assert.equal(localDateTime(new Date(2027, 2, 2, 9, 5)), '2027-03-02T09:05');
  assert.throws(() => durationEnd(local.toISOString(), 0, 'days'));
  assert.throws(() => durationEnd(local.toISOString(), Infinity, 'hours'));
  assert.throws(() => toISO('ошибка'));
});
test('задачи изменяют прогресс и начисляют награду цели один раз обеим шкалам', () => {
  const before = add(add(plan()), 'Второй шаг');
  const id = goal(before).id;
  const tasks = before.quests.filter((q) => q.goalId === id);
  const half = completeQuest(before, tasks[0].id);
  assert.equal(goal(half).current, 50);
  assert.equal(half.xp - before.xp, 20);
  const done = completeQuest(half, tasks[1].id);
  assert.equal(goal(done).current, 100);
  assert.equal(goal(done).rewarded, true);
  assert.equal(done.xp - before.xp, 240);
  assert.equal(done.spheres.english.xp - before.spheres.english.xp, 240);
  assert.equal(done.events.filter((e) => e.kind === 'goal').length, 1);
  assert.deepEqual(completeQuest(done, tasks[1].id), done);
  assert.equal(syncGoalTasks(done, id, true).xp, done.xp);
  assert.equal(updateGoal(half, id, 100).xp, half.xp);
  const expanded = add(done, 'Ещё шаг');
  assert.ok(Math.abs(goal(expanded).current - 200 / 3) < 0.000001);
  const again = completeQuest(expanded, expanded.quests.at(-1)!.id);
  assert.equal(again.xp - done.xp, 20);
  assert.equal(again.events.filter((e) => e.kind === 'goal').length, 1);
});
test('создание, изменение и удаление задач не выдают XP за цель', () => {
  let s = add(add(plan()), 'Не готово');
  s = completeQuest(s, s.quests.at(-2)!.id);
  const xp = s.xp;
  const last = s.quests.at(-1)!;
  s = removeQuest(s, last.id);
  assert.equal(s.xp, xp);
  assert.equal(goal(s).current, 100);
  assert.equal(goal(s).rewarded, false);
  s = syncGoalTasks(s, goal(s).id, true);
  assert.equal(s.xp, xp + 200);
  assert.equal(syncGoalTasks(s, goal(s).id, true).xp, s.xp);
});
test('смена режима сохраняет числовой результат и не повторяет награду', () => {
  let s = initialState();
  s = updateGoal(s, 'b2', 68);
  s = saveGoal(s, { ...s.goals[0], progressMode: 'tasks' });
  let g = s.goals[0];
  assert.equal(g.current, 68);
  assert.deepEqual(g.manualProgress, { current: 68, target: 100 });
  const xp = s.xp;
  s = saveGoal(s, { ...g, progressMode: 'manual' });
  assert.equal(s.goals[0].current, 68);
  assert.equal(s.xp, xp);
  s = updateGoal(s, 'b2', 100);
  const doneXP = s.xp;
  g = s.goals[0];
  s = saveGoal(s, { ...g, progressMode: 'tasks' });
  s = saveGoal(s, { ...s.goals[0], progressMode: 'manual' });
  assert.equal(s.xp, doneXP);
  assert.equal(updateGoal(s, 'b2', 100).xp, doneXP);
});
test('этапы и задачи проверяются относительно срока цели и этапа', () => {
  let s = plan();
  const id = goal(s).id;
  assert.throws(() =>
    saveStage(s, id, { name: 'Раньше', startsAt: '2026-01-01T00:00:00Z' }),
  );
  s = saveStage(s, id, {
    name: 'Март',
    startsAt: '2027-03-01T00:00:00Z',
    dueAt: '2027-03-31T23:00:00Z',
  });
  const stage = goal(s).stages![0];
  s = add(s, 'Шаг', { stageId: stage.id });
  assert.throws(() =>
    add(s, 'Раньше', { stageId: stage.id, startsAt: '2027-02-28T09:00:00Z' }),
  );
  assert.throws(() =>
    saveStage(s, id, { ...stage, dueAt: '2027-03-01T12:00:00Z' }),
  );
  assert.throws(() =>
    saveGoal(s, { ...goal(s), dueAt: '2027-02-28T12:00:00Z' }),
  );
  assert.throws(() => saveGoal(s, { ...goal(s), sphere: 'sport' }));
  assert.throws(() =>
    add(s, 'Перевёрнутый срок', {
      startsAt: '2027-03-03T09:00:00Z',
      dueAt: '2027-03-02T09:00:00Z',
    }),
  );
  const xp = s.xp;
  const ungrouped = removeStage(s, id, stage.id);
  assert.equal(ungrouped.quests.at(-1)!.stageId, undefined);
  assert.equal(ungrouped.quests.length, s.quests.length);
  assert.equal(ungrouped.xp, xp);
});
test('задачу можно перенести между целями; готовые действия неизменны', () => {
  let s = add(plan());
  const old = goal(s).id;
  const task = s.quests.at(-1)!;
  s = saveGoal(s, {
    name: 'Вторая цель',
    sphere: 'sport',
    target: 100,
    reward: 100,
    progressMode: 'tasks',
  });
  const next = goal(s).id;
  s = saveTask(s, {
    ...task,
    goalId: next,
    stageId: undefined,
    sphere: 'sport',
  });
  assert.equal(s.quests.at(-1)!.sphere, 'sport');
  assert.equal(s.goals.find((g) => g.id === old)!.current, 0);
  assert.equal(s.xp, 2450);
  s = completeQuest(s, task.id);
  assert.throws(() =>
    saveTask(s, { ...s.quests.at(-1)!, name: 'Другое действие' }),
  );
});
test('удаление цели оставляет задачи, XP, историю и достижение', () => {
  let s = add(plan());
  const id = goal(s).id;
  s = completeQuest(s, s.quests.at(-1)!.id);
  const removed = deleteGoal(s, id);
  assert.equal(
    removed.goals.some((g) => g.id === id),
    false,
  );
  assert.equal(removed.quests.at(-1)!.goalId, undefined);
  assert.equal(removed.xp, s.xp);
  assert.deepEqual(removed.events, s.events);
  assert.equal(
    achievements.find((a) => a.name === 'Новый горизонт')!.unlocked(removed),
    true,
  );
  const legacy = initialState();
  legacy.goals[0].rewarded = true;
  const migrated = deleteGoal(legacy, 'b2');
  assert.equal(
    achievements.find((a) => a.name === 'Новый горизонт')!.unlocked(migrated),
    true,
  );
});
test('периоды используют местные календарные границы и включают пересекающиеся цели', () => {
  const week = periodBounds('week', '2027-03-03');
  assert.equal(week.start.getDay(), 1);
  assert.equal(week.start.getDate(), 1);
  assert.equal(week.end.getDate(), 8);
  const month = periodBounds('month', '2027-03-03');
  assert.equal(month.start.getDate(), 1);
  assert.equal(month.end.getMonth(), 3);
  const year = periodBounds('year', '2027-03-03');
  assert.equal(year.start.getMonth(), 0);
  assert.equal(year.end.getFullYear(), 2028);
  const s = add(plan());
  const march = periodItems(s, 'month', '2027-03-03');
  assert.equal(march.goals.length, 1);
  assert.equal(march.tasks.length, 1);
  assert.equal(march.hours, 1);
  assert.equal(march.unscheduled.length, 4);
  assert.equal(periodItems(s, 'month', '2027-02-01').tasks.length, 0);
  assert.equal(periodItems(s, 'all', '2027-03-03').tasks.length, 5);
  assert.equal(periodItems(s, 'year', '2027-03-03').tasks.length, 1);
});
test('передача содержит даты и этап, исключает готовые задачи и не меняет состояние', () => {
  let s = plan();
  s = saveStage(s, goal(s).id, { name: 'Основы' });
  s = add(s, 'Квест', {
    stageId: goal(s).stages![0].id,
    notes: 'Повторить слова',
  });
  const snapshot = JSON.stringify(s);
  const text = planTransferText([s.quests.at(-1)!], s);
  assert.match(text, /Цель: Мой путь/);
  assert.match(text, /Этап: Основы/);
  assert.match(text, /Начало:/);
  assert.match(text, /Срок:/);
  assert.match(text, /Время: 60 мин/);
  assert.doesNotMatch(text, /XP/);
  assert.equal(JSON.stringify(s), snapshot);
  const done = completeQuest(s, s.quests.at(-1)!.id);
  assert.equal(planTransferText([done.quests.at(-1)!], done), '');
});
test('экспорт календаря экранирует текст и переносит длинные UTF-8 строки', () => {
  const s = add(plan(), 'Прочитать, понять; применить', {
    notes: 'Строка один\nСтрока два ' + 'Навык '.repeat(50),
  });
  const task = s.quests.at(-1)!;
  const ics = planCalendar(s.quests, s);
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20270302T090000Z/);
  assert.match(ics, /DTEND:20270302T100000Z/);
  assert.match(ics, /SUMMARY:Прочитать\\, понять\\; применить/);
  assert.match(ics.replace(/\r\n /g, ''), /Строка один\\nСтрока два/);
  for (const line of ics.split('\r\n'))
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  const done = completeQuest(s, task.id);
  assert.doesNotMatch(planCalendar(done.quests, done), /BEGIN:VEVENT/);
});
test('старые сохранения и новые связи переживают миграцию', () => {
  const s = add(plan());
  const restored = migrateState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.quests, s.quests);
  assert.deepEqual(restored.goals, s.goals);
  assert.equal(restored.xp, s.xp);
});
