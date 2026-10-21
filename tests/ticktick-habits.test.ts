import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, checkinIdempotencyKey, dayOfStamp, dedupeCheckins, externalKey, fallbackIcon, linkStatusFor, localDay, mapIcon,
  newCheckins, normalizeCheckins, normalizeHabit, normalizeHabits, normalizeSections, parseRepeatRule, resolveDay, sphereForSection,
  stampOf, syncRange, validRange,
} from '../src/ticktickHabits.ts';

const spheres = ['health', 'sport', 'growth', 'english', 'finance', 'together', 'driving', 'tasks', 'hobby'];

test('RRULE: ежедневное и недельное расписание переводятся в дни недели, остальное остаётся только для чтения', () => {
  assert.deepEqual(parseRepeatRule('RRULE:FREQ=DAILY;INTERVAL=1'), { supported: true, weekdays: [0, 1, 2, 3, 4, 5, 6] });
  assert.deepEqual(parseRepeatRule('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'), { supported: true, weekdays: [1, 3, 5] });
  assert.deepEqual(parseRepeatRule('FREQ=WEEKLY;BYDAY=SU,SA,SU'), { supported: true, weekdays: [0, 6] });
  for (const rule of ['RRULE:FREQ=DAILY;INTERVAL=2', 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1', 'RRULE:FREQ=YEARLY', 'RRULE:FREQ=DAILY;COUNT=5', 'RRULE:FREQ=WEEKLY', 'RRULE:FREQ=WEEKLY;BYDAY=XX', '', 'мусор']) {
    const result = parseRepeatRule(rule);
    assert.equal(result.supported, false, rule);
    // Исходное правило сохраняется, чтобы не подменять его неверным расписанием.
    if (!result.supported) assert.equal(result.raw, rule.trim());
  }
});

test('иконки: известные iconRes переводятся, неизвестные получают запасную', () => {
  assert.equal(mapIcon('habit_reading'), 'reading');
  assert.equal(mapIcon('HABIT_WATER'), 'water');
  assert.equal(mapIcon('habit_something_new'), fallbackIcon);
  assert.equal(mapIcon(''), fallbackIcon);
});

test('разделы → сферы: по умолчанию, по выбору пользователя и «Без сферы»', () => {
  assert.equal(sphereForSection({ id: 's1', name: 'Health' }, {}, spheres), 'health');
  assert.equal(sphereForSection({ id: 's2', name: 'Learning' }, {}, spheres), 'growth');
  assert.equal(sphereForSection({ id: 's3', name: 'Other' }, {}, spheres), 'tasks');
  assert.equal(sphereForSection({ id: 's1', name: 'Health' }, { s1: 'sport' }, spheres), 'sport');
  assert.equal(sphereForSection({ id: 's4', name: 'Хобби-раздел' }, {}, spheres), null);
  // Несуществующая сфера не принимается.
  assert.equal(sphereForSection({ id: 's1', name: 'Health' }, { s1: 'nope' }, spheres), null);
});

test('часовые пояса: день считается в поясе привычки, а не по UTC', () => {
  const instant = '2026-10-19T22:30:00Z';
  assert.equal(localDay(instant, 0), '2026-10-19');
  assert.equal(localDay(instant, 180), '2026-10-20'); // Москва
  assert.equal(localDay(instant, -300), '2026-10-19');
  assert.equal(stampOf('2026-10-19'), 20261019);
  assert.equal(dayOfStamp(20261019), '2026-10-19');
  assert.throws(() => dayOfStamp(20261340));
  assert.throws(() => dayOfStamp(123));
  assert.throws(() => stampOf('19.10.2026'));
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('период синхронизации: 30/90/180 дней и весь период с верхним пределом', () => {
  assert.deepEqual(syncRange('2026-10-19', 90), { from: '2026-07-22', to: '2026-10-19' });
  assert.deepEqual(syncRange('2026-10-19', 30), { from: '2026-09-20', to: '2026-10-19' });
  assert.equal(syncRange('2026-10-19', 0).from, addDays('2026-10-19', -729));
  assert.equal(syncRange('2026-10-19', 99999).from, addDays('2026-10-19', -729));
  assert.throws(() => syncRange('2026-10-19', -1));
  assert.deepEqual(validRange('2026-07-21', '2026-10-19'), { from: '2026-07-21', to: '2026-10-19' });
  assert.throws(() => validRange('2026-10-19', '2026-07-21'));
  assert.throws(() => validRange('2020-01-01', '2026-10-19'));
});

test('нормализация привычки: поля, раздел, статус и безопасные значения', () => {
  const sections = normalizeSections({ sections: [{ id: 'section-1', name: 'Health' }, { id: 7, name: 'Other' }, { name: 'без id' }] });
  assert.deepEqual(sections, [{ id: 'section-1', name: 'Health' }, { id: '7', name: 'Other' }]);
  const habit = normalizeHabit({
    id: 'habit-1', name: ' Читать ', iconRes: 'habit_reading', color: '#4D8CF5', status: 0, goal: 1, step: 1, unit: 'Count',
    repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1', reminders: ['21:00', 5], sectionId: 'section-1', modifiedTime: 1792404000000, etag: 'e1', totalCheckIns: 12,
    targetDays: 7, targetStartDate: 20261021,
  }, sections)!;
  assert.equal(habit.name, 'Читать');
  assert.equal(habit.icon, 'reading');
  assert.equal(habit.iconRes, 'habit_reading');
  assert.equal(habit.sectionName, 'Health');
  assert.equal(habit.status, 'active');
  assert.deepEqual(habit.reminders, ['21:00']);
  assert.equal(habit.modifiedAt, '2026-10-19T10:00:00.000Z');
  assert.equal(habit.targetDays, 7);
  assert.equal(habit.targetStartDate, '2026-10-21');
  assert.equal(normalizeHabit({ id: 'x', name: 'A' })!.targetDays, 0);
  assert.equal(normalizeHabit({ id: 'x', name: 'A' })!.targetStartDate, '');
  assert.equal(normalizeHabit({ id: 'x', name: 'A', targetStartDate: 20261340 })!.targetStartDate, '');
  assert.equal(normalizeHabit({ id: 'x', name: 'A', status: 2 })!.status, 'archived');
  assert.equal(normalizeHabit({ id: 'x', name: 'A', color: 'url(javascript:1)' })!.color, '');
  assert.equal(normalizeHabit({ id: 'x', name: '   ' }), null);
  assert.equal(normalizeHabit({ name: 'нет id' }), null);
  assert.equal(normalizeHabit('строка'), null);
  assert.equal(normalizeHabits({ habits: [{ id: 'a', name: 'A' }, null, { id: 'b', name: 'B' }] }).length, 2);
  assert.equal(normalizeHabits([{ id: 'a', name: 'A' }]).length, 1);
  assert.equal(normalizeHabits({ nothing: true }).length, 0);
});

test('живой MCP TickTick оборачивает списки в {result:[...]}, а не {habits:[...]} — нормализация это понимает', () => {
  // Форма ответа снята с реального аккаунта владельца (list_habits/list_habit_sections): без ключа
  // «result» в listOf() эти привычки и разделы считались пустым списком, хотя в TickTick они были.
  const sections = normalizeSections({ result: [{ id: '68c08bb1a1fc1431fd041722', name: 'ОБУЧЕНИЕ 📖' }] });
  assert.deepEqual(sections, [{ id: '68c08bb1a1fc1431fd041722', name: 'ОБУЧЕНИЕ 📖' }]);
  const habits = normalizeHabits({
    result: [{
      id: '6ad75842d9209c036da5c656', name: 'Слова Sky Eng', iconRes: 'habit_learn_words', color: '#7BC4FA', status: 0,
      goal: 4, step: -1, unit: ' Модулей слов ', repeatRule: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR',
      sectionId: '68c08bb1a1fc1431fd041722', targetDays: 0, targetStartDate: 20261020,
    }],
  }, sections);
  assert.equal(habits.length, 1);
  assert.equal(habits[0].name, 'Слова Sky Eng');
  assert.equal(habits[0].sectionName, 'ОБУЧЕНИЕ 📖');
});

test('нормализация check-in и дедупликация по привычке и дню', () => {
  const checkins = normalizeCheckins({
    h1: [{ habitId: 'h1', stamp: 20261019, value: 1, goal: 1, status: 2 }, { habitId: 'h1', stamp: 20261019, value: 1, goal: 1, status: 2 }, { habitId: 'h1', stamp: 20261018, value: 0, goal: 1, status: 1 }],
    h2: [{ habitId: 'h2', stamp: 20261019, value: 3, goal: 5 }, { habitId: 'h2', stamp: 20269999, value: 1, goal: 1, status: 2 }],
  });
  assert.equal(checkins.length, 3);
  assert.deepEqual(checkins.filter((c) => c.completed).map((c) => externalKey(c.ticktickHabitId, c.stamp)), ['ticktick:h1:20261019']);
  assert.equal(checkins.find((c) => c.ticktickHabitId === 'h2')!.completed, false); // 3 из 5 — не выполнено
  assert.deepEqual(normalizeCheckins({ checkins: [{ habitId: 'h', stamp: 20261019, value: 1, goal: 1, status: 2 }] }).length, 1);
  const first = { ticktickHabitId: 'h', day: '2026-10-19', stamp: 20261019, value: 1, goal: 1, completed: false };
  const second = { ...first, completed: true };
  assert.equal(dedupeCheckins([first, second]).length, 1);
  assert.equal(dedupeCheckins([first, second])[0].completed, true);
});

test('повторный импорт не создаёт отметок и, значит, повторной награды', () => {
  const items = normalizeCheckins([
    { habitId: 'h1', stamp: 20261018, value: 1, goal: 1, status: 2 },
    { habitId: 'h1', stamp: 20261019, value: 1, goal: 1, status: 2 },
    { habitId: 'h1', stamp: 20261017, value: 0, goal: 1, status: 1 },
  ]);
  const imported = new Set<string>();
  const first = newCheckins(items, imported);
  assert.equal(first.length, 2); // невыполненная отметка не импортируется
  for (const item of first) imported.add(externalKey(item.ticktickHabitId, item.stamp));
  assert.equal(newCheckins(items, imported).length, 0);
  // Новая отметка добавляется, старые не повторяются.
  const more = [...items, ...normalizeCheckins([{ habitId: 'h1', stamp: 20261020, value: 1, goal: 1, status: 2 }])];
  assert.deepEqual(newCheckins(more, imported).map((c) => c.stamp), [20261020]);
});

test('ключ идемпотентности стабилен', () => {
  assert.equal(checkinIdempotencyKey('local-123', '2026-10-19', 1), checkinIdempotencyKey('local-123', '2026-10-19', 1));
  assert.notEqual(checkinIdempotencyKey('local-123', '2026-10-19', 1), checkinIdempotencyKey('local-123', '2026-10-20', 1));
  assert.equal(checkinIdempotencyKey('local-123', '2026-10-19', 1), 'checkin:local-123:20261019:1');
});

test('конфликты: новее побеждает, неопределённость сохраняется как конфликт', () => {
  const older = '2026-10-19T08:00:00Z';
  const newer = '2026-10-19T09:00:00Z';
  assert.deepEqual(resolveDay({ done: true, at: newer }, { done: false, at: older }), { winner: 'local', done: true });
  assert.deepEqual(resolveDay({ done: true, at: older }, { done: false, at: newer }), { winner: 'remote', done: false });
  assert.equal(resolveDay({ done: true, at: older }, { done: false, at: older }).winner, 'conflict');
  assert.equal(resolveDay({ done: true, at: '' }, { done: false, at: newer }).winner, 'conflict');
  assert.equal(resolveDay({ done: true, at: older }, { done: true, at: newer }).winner, 'none');
  assert.deepEqual(resolveDay(undefined, { done: true, at: newer }), { winner: 'remote', done: true });
  assert.deepEqual(resolveDay({ done: true, at: newer }, undefined), { winner: 'local', done: true });
  assert.equal(resolveDay(undefined, undefined).winner, 'none');
});

test('архив и удаление в TickTick не удаляют локальную привычку', () => {
  const remote = normalizeHabit({ id: 'h', name: 'A', status: 0 })!;
  assert.equal(linkStatusFor(remote), 'active');
  assert.equal(linkStatusFor({ ...remote, status: 'archived' }), 'archived');
  assert.equal(linkStatusFor(undefined), 'deleted');
});
