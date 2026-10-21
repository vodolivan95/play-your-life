import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { completeHabit } from '../src/personalQuests.ts';
import { doneDays, habitStats, liveStreak } from '../src/habitsView.ts';
import { validateState } from '../src/stateValidation.ts';
import { emptyHabitLinks, externalKey, normalizeCheckins, normalizeHabits, normalizeSections } from '../src/ticktickHabits.ts';
import {
  afterAttempt, backoffMs, dueOps, exportedThrough, externalDays, findConflicts, importCandidates, importHabit, MAX_AUTO_ATTEMPTS, pendingExports, reconcileLinks, retryAll,
} from '../src/ticktickHabitsSync.ts';

const owner = 'alice';
const sections = normalizeSections({ sections: [{ id: 's1', name: 'Health' }, { id: 's2', name: 'Weird' }] });
const remote = normalizeHabits({
  habits: [
    { id: 'h1', name: 'Читать', iconRes: 'habit_reading', status: 0, goal: 1, unit: 'Count', repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1', sectionId: 's1', modifiedTime: 1792404000000 },
    { id: 'h2', name: 'Бег', status: 0, goal: 5, unit: 'km', repeatRule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE', sectionId: 's2' },
    { id: 'h3', name: 'Раз в 2 дня', status: 0, repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=2', sectionId: 's1' },
    { id: 'h4', name: 'Старая', status: 2, repeatRule: 'RRULE:FREQ=DAILY', sectionId: 's1' },
  ],
}, sections);
const checkins = normalizeCheckins({
  h1: [
    { habitId: 'h1', stamp: 20261015, value: 1, goal: 1, status: 2 },
    { habitId: 'h1', stamp: 20261016, value: 1, goal: 1, status: 2 },
    { habitId: 'h1', stamp: 20261017, value: 0, goal: 1, status: 1 },
    { habitId: 'h1', stamp: 20261018, value: 1, goal: 1, status: 2 },
    { habitId: 'h1', stamp: 20261019, value: 1, goal: 1, status: 2 },
  ],
});
const range = { from: '2026-07-22', to: '2026-10-19' };
const now = new Date('2026-10-19T10:00:00Z');

test('кандидаты импорта: новые, неподдерживаемое расписание, архив и уже связанные', () => {
  const found = importCandidates(remote, emptyHabitLinks(), sections);
  assert.deepEqual(found.map((c) => [c.remote.ticktickHabitId, c.state, c.sphere]), [['h1', 'new', 'health'], ['h2', 'new', null], ['h3', 'unsupported', 'health'], ['h4', 'archived', 'health']]);
  const links = { ...emptyHabitLinks(), links: { local: { ticktickHabitId: 'h1', sectionId: 's1', iconRes: '', syncDirection: 'bidirectional' as const, status: 'active' as const, lastTicktickModifiedAt: '', lastLocalModifiedAt: '', lastSyncedCheckinDate: '' } } };
  assert.equal(importCandidates(remote, links, sections)[0].state, 'linked');
  // Сопоставление раздела можно изменить.
  assert.equal(importCandidates(remote, { ...emptyHabitLinks(), sectionMap: { s2: 'hobby' } }, sections)[1].sphere, 'hobby');
});

test('импорт создаёт привычку с выбранной наградой, без отметок в экономике и с серией из истории', () => {
  const start = newAccountGame('Алиса');
  const candidate = importCandidates(remote, emptyHabitLinks(), sections)[0];
  const result = importHabit(start, candidate, 'health', 3, owner, range, checkins, new Set(), now);
  const habit = result.state.habits!.find((h) => h.id === result.localId)!;
  assert.equal(habit.title, 'Читать');
  assert.equal(habit.rewardCoins, 3);
  assert.equal(habit.iconId, 'reading');
  assert.deepEqual(habit.weekdays, [0, 1, 2, 3, 4, 5, 6]);
  // Экономика не тронута: ни отметок, ни лайфкоинов, ни XP, ни транзакций.
  assert.deepEqual(result.state.habitCompletions ?? [], []);
  assert.equal(result.state.coins, start.coins);
  assert.deepEqual(result.state.coinTransactions ?? [], start.coinTransactions ?? []);
  assert.deepEqual(result.state.events, start.events);
  assert.deepEqual(result.importedKeys, ['ticktick:h1:20261015', 'ticktick:h1:20261016', 'ticktick:h1:20261018', 'ticktick:h1:20261019']);
  assert.equal(result.link.lastSyncedCheckinDate, '2026-10-19');
  assert.equal(result.link.status, 'active');
  // Серия считается по импортированным дням: 18 и 19 подряд (17-е пропущено).
  const external = externalDays({ ...emptyHabitLinks(), links: { [result.localId]: result.link } }, checkins, '2026-10-20')[result.localId];
  assert.deepEqual(external, ['2026-10-15', '2026-10-16', '2026-10-18', '2026-10-19']);
  assert.equal(liveStreak(habit, doneDays(habit, [], external), '2026-10-20'), 2);
  // Статистика не приписывает награду импортированным дням.
  assert.equal(habitStats(habit, [], '2026-10-20', 90, external).xp, 0);
  assert.equal(habitStats(habit, [], '2026-10-20', 90, external).done, 4);
  // Сохранение остаётся валидным.
  assert.doesNotThrow(() => validateState(result.state));
});

test('сегодняшний день из TickTick не блокирует локальную отметку и награду', () => {
  const start = newAccountGame('Алиса');
  const candidate = importCandidates(remote, emptyHabitLinks(), sections)[0];
  const result = importHabit(start, candidate, 'health', 3, owner, range, checkins, new Set(), now);
  const links = { ...emptyHabitLinks(), links: { [result.localId]: result.link } };
  assert.ok(!externalDays(links, checkins, '2026-10-19')[result.localId].includes('2026-10-19'));
  const done = completeHabit(result.state, result.localId, owner, now);
  assert.equal(done.habitCompletions!.length, 1);
  assert.equal(done.coins, start.coins + 3); // лайфкоины начислены за сегодняшнюю локальную отметку, по выбранной при импорте награде
});

test('награда при импорте ограничена диапазоном 0–5 лайфкоинов, 0 допускается (без награды)', () => {
  const start = newAccountGame('Алиса');
  const candidate = importCandidates(remote, emptyHabitLinks(), sections)[0];
  const zero = importHabit(start, candidate, 'health', 0, owner, range, checkins, new Set(), now);
  assert.equal(zero.state.habits!.find((h) => h.id === zero.localId)!.rewardCoins, 0);
  const tooLow = importHabit(start, candidate, 'health', -2, owner, range, checkins, new Set(), now);
  assert.equal(tooLow.state.habits!.find((h) => h.id === tooLow.localId)!.rewardCoins, 0);
  const tooHigh = importHabit(start, candidate, 'health', 9, owner, range, checkins, new Set(), now);
  assert.equal(tooHigh.state.habits!.find((h) => h.id === tooHigh.localId)!.rewardCoins, 5);
});

test('повторная синхронизация не создаёт отметок и не награждает повторно', () => {
  const start = newAccountGame('Алиса');
  const candidate = importCandidates(remote, emptyHabitLinks(), sections)[0];
  const first = importHabit(start, candidate, 'health', 3, owner, range, checkins, new Set(), now);
  const again = importHabit(start, candidate, 'health', 3, owner, range, checkins, new Set(first.importedKeys), now);
  assert.deepEqual(again.importedKeys, []);
  assert.deepEqual(again.state.habitCompletions ?? [], []);
});

test('нельзя импортировать неподдерживаемое, архивное, связанное и без сферы', () => {
  const start = newAccountGame('Алиса');
  const [, , unsupported, archived] = importCandidates(remote, emptyHabitLinks(), sections);
  assert.throws(() => importHabit(start, unsupported, 'health', 3, owner, range, [], new Set(), now));
  assert.throws(() => importHabit(start, archived, 'health', 3, owner, range, [], new Set(), now));
  assert.throws(() => importHabit(start, importCandidates(remote, emptyHabitLinks(), sections)[0], 'нет-такой', 3, owner, range, [], new Set(), now));
});

test('экспорт: новые локальные отметки связанных привычек попадают в очередь один раз', () => {
  const start = newAccountGame('Алиса');
  const result = importHabit(start, importCandidates(remote, emptyHabitLinks(), sections)[0], 'health', 3, owner, range, [], new Set(), now);
  const links = { ...emptyHabitLinks(), links: { [result.localId]: result.link } };
  const done = completeHabit(result.state, result.localId, owner, now);
  const queue = pendingExports(done, links, [], 1000);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].key, `checkin:${result.localId}:20261019:1`);
  assert.equal(queue[0].ticktickHabitId, 'h1');
  assert.deepEqual(pendingExports(done, links, queue), []); // повторно не добавляется
  // После успешной отправки день отмечается как синхронизированный и больше не ставится в очередь.
  const synced = { ...links, links: { [result.localId]: exportedThrough(links.links[result.localId], '2026-10-19') } };
  assert.deepEqual(pendingExports(done, synced, []), []);
  // Направление «только из TickTick» не отправляет отметки.
  const pull = { ...links, links: { [result.localId]: { ...links.links[result.localId], syncDirection: 'ticktick_to_local' as const } } };
  assert.deepEqual(pendingExports(done, pull, []), []);
  // Архивные и удалённые в TickTick связи ничего не отправляют.
  const archived = { ...links, links: { [result.localId]: { ...links.links[result.localId], status: 'archived' as const } } };
  assert.deepEqual(pendingExports(done, archived, []), []);
});

test('очередь: три автоматические попытки с растущей паузой, затем «failed», ручной повтор сбрасывает', () => {
  assert.deepEqual([0, 1, 2, 3].map(backoffMs), [1000, 2000, 4000, 8000]);
  let op = { key: 'checkin:a:20261019:1', localId: 'a', ticktickHabitId: 'h', day: '2026-10-19', value: 1, goal: 1, attempts: 0, nextAt: 0, status: 'pending' as const };
  assert.equal(afterAttempt(op, true, 0), null);
  let t = 1000;
  for (let i = 1; i < MAX_AUTO_ATTEMPTS; i++) {
    op = afterAttempt(op, false, t)!;
    assert.equal(op.status, 'retrying');
    assert.equal(op.nextAt, t + backoffMs(i));
    assert.deepEqual(dueOps([op], t), []);
    assert.equal(dueOps([op], op.nextAt).length, 1);
    t = op.nextAt;
  }
  op = afterAttempt(op, false, t)!;
  assert.equal(op.status, 'failed');
  assert.deepEqual(dueOps([op], Number.MAX_SAFE_INTEGER - 1), []);
  const retried = retryAll([op], 5000);
  assert.equal(retried[0].attempts, 0);
  assert.equal(dueOps(retried, 5000).length, 1);
});

test('конфликт: день выполнен здесь, а в TickTick отмечен как «не выполнено»', () => {
  const start = newAccountGame('Алиса');
  const result = importHabit(start, importCandidates(remote, emptyHabitLinks(), sections)[0], 'health', 3, owner, range, [], new Set(), now);
  const links = { ...emptyHabitLinks(), links: { [result.localId]: result.link } };
  const done = completeHabit(result.state, result.localId, owner, now);
  const none = normalizeCheckins([{ habitId: 'h1', stamp: 20261019, value: 0, goal: 1, status: 1 }]);
  assert.deepEqual(findConflicts(done, links, none).map((c) => [c.day, c.title]), [['2026-10-19', 'Читать']]);
  assert.deepEqual(findConflicts(done, links, normalizeCheckins([{ habitId: 'h1', stamp: 20261019, value: 1, goal: 1, status: 2 }])), []);
  assert.deepEqual(findConflicts(done, links, []), []);
});

test('архив и удаление в TickTick меняют только статус связи, привычка и история остаются', () => {
  const start = newAccountGame('Алиса');
  const result = importHabit(start, importCandidates(remote, emptyHabitLinks(), sections)[0], 'health', 3, owner, range, checkins, new Set(), now);
  const links = { ...emptyHabitLinks(), links: { [result.localId]: result.link } };
  assert.equal(reconcileLinks(links, remote).links[result.localId].status, 'active');
  const archived = remote.map((h) => (h.ticktickHabitId === 'h1' ? { ...h, status: 'archived' as const } : h));
  assert.equal(reconcileLinks(links, archived).links[result.localId].status, 'archived');
  assert.equal(reconcileLinks(links, []).links[result.localId].status, 'deleted');
  // Локальная привычка не затрагивается ни при каких статусах.
  assert.ok(result.state.habits!.some((h) => h.id === result.localId));
  // Привычка вернулась в TickTick — связь снова активна.
  assert.equal(reconcileLinks(reconcileLinks(links, []), remote).links[result.localId].status, 'active');
  assert.equal(externalKey('h1', 20261019), 'ticktick:h1:20261019');
});
