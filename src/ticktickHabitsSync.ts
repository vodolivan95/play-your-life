// Планирование импорта и экспорта привычек TickTick. Чистые функции: без сети и без React.
// Импортированная история не попадает в `habitCompletions` и экономику: награды выдаются только за локальные отметки.
import { spheres } from './game.ts';
import type { GameState } from './game.ts';
import { saveHabit } from './personalQuests.ts';
import {
  addDays, checkinIdempotencyKey, externalKey, newCheckins, parseRepeatRule, sphereForSection,
} from './ticktickHabits.ts';
import type { HabitLink, HabitLinksState, HabitSection, RemoteCheckin, RemoteHabit, Schedule } from './ticktickHabits.ts';

export const sphereIds = spheres.map((s) => s.id);

export type CandidateState = 'new' | 'linked' | 'unsupported' | 'archived';
export type ImportCandidate = {
  remote: RemoteHabit;
  schedule: Schedule;
  /** Сфера по сопоставлению разделов; null — сферу нужно выбрать вручную. */
  sphere: string | null;
  state: CandidateState;
};

/** Какие привычки TickTick предложить к импорту. Уже связанные, архивные и с неподдерживаемым расписанием не импортируются молча. */
export function importCandidates(remote: readonly RemoteHabit[], links: HabitLinksState, sections: readonly HabitSection[]): ImportCandidate[] {
  const linked = new Set(Object.values(links.links).filter((l) => l.status !== 'deleted').map((l) => l.ticktickHabitId));
  return remote.map((habit) => {
    const schedule = parseRepeatRule(habit.repeatRule);
    const section = sections.find((s) => s.id === habit.sectionId) ?? { id: habit.sectionId, name: habit.sectionName };
    const sphere = habit.sectionId || habit.sectionName ? sphereForSection(section, links.sectionMap, sphereIds) : null;
    const state: CandidateState = linked.has(habit.ticktickHabitId) ? 'linked' : habit.status === 'archived' ? 'archived' : !schedule.supported ? 'unsupported' : 'new';
    return { remote: habit, schedule, sphere, state };
  });
}

export type ImportResult = {
  state: GameState;
  localId: string;
  link: HabitLink;
  /** Новые внешние ключи импортированных отметок (повторно не импортируются и не награждаются). */
  importedKeys: string[];
  /** Дни выполнения из TickTick для календаря и серий. */
  days: string[];
};

/** Создаёт локальную привычку из привычки TickTick с наградой, выбранной при импорте (0–5 лайфкоинов), без записи отметок в экономику. */
export function importHabit(
  state: GameState, candidate: ImportCandidate, sphere: string, rewardCoins: number, ownerId: string, range: { from: string; to: string },
  checkins: readonly RemoteCheckin[], imported: ReadonlySet<string>, now = new Date(),
): ImportResult {
  if (candidate.state !== 'new' || !candidate.schedule.supported) throw new Error('Эту привычку нельзя импортировать автоматически.');
  if (!sphereIds.includes(sphere)) throw new Error('Выберите сферу для привычки.');
  const coins = Math.min(5, Math.max(0, Math.round(rewardCoins) || 0));
  const remote = candidate.remote;
  const mine = checkins.filter((c) => c.ticktickHabitId === remote.ticktickHabitId && c.day >= range.from && c.day <= range.to);
  const fresh = newCheckins(mine, imported);
  const before = new Set((state.habits ?? []).map((h) => h.id));
  let next = saveHabit(state, {
    title: remote.name, sphere, iconId: remote.icon, targetValue: remote.goal, unit: remote.unit === 'Count' ? 'раз' : remote.unit,
    weekdays: candidate.schedule.weekdays, rewardCoins: coins,
  }, ownerId);
  const created = next.habits!.find((h) => !before.has(h.id))!;
  // Серия считается с первого дня истории, поэтому дата создания сдвигается к началу импортированного периода.
  const earliest = fresh.length ? fresh[0].day : range.from;
  const createdAt = new Date(`${earliest < now.toISOString().slice(0, 10) ? earliest : now.toISOString().slice(0, 10)}T12:00:00.000Z`).toISOString();
  next = { ...next, habits: next.habits!.map((h) => (h.id === created.id ? { ...h, createdAt } : h)) };
  const days = fresh.map((c) => c.day);
  return {
    state: next,
    localId: created.id,
    importedKeys: fresh.map((c) => externalKey(c.ticktickHabitId, c.stamp)),
    days,
    link: {
      ticktickHabitId: remote.ticktickHabitId, sectionId: remote.sectionId, iconRes: remote.iconRes, syncDirection: 'bidirectional', status: 'active',
      lastTicktickModifiedAt: remote.modifiedAt, lastLocalModifiedAt: now.toISOString(), lastSyncedCheckinDate: days.length ? days[days.length - 1] : '',
    },
  };
}

/** Дни из TickTick до сегодняшнего (сегодня можно отметить здесь и получить награду). Только для показа в календаре и сериях. */
export function externalDays(links: HabitLinksState, checkins: readonly RemoteCheckin[], today: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [localId, link] of Object.entries(links.links)) {
    if (link.status === 'deleted') continue;
    result[localId] = [...new Set(checkins.filter((c) => c.ticktickHabitId === link.ticktickHabitId && c.completed && c.day < today).map((c) => c.day))].sort();
  }
  return result;
}

// ---------- Очередь отправки отметок ----------

export type ExportOp = {
  key: string;
  localId: string;
  ticktickHabitId: string;
  day: string;
  value: number;
  goal: number;
  attempts: number;
  /** Время следующей автоматической попытки (мс). */
  nextAt: number;
  status: 'pending' | 'retrying' | 'failed';
};
export const MAX_AUTO_ATTEMPTS = 3;
export function backoffMs(attempts: number): number {
  return Math.min(1000 * 2 ** attempts, 30000);
}
/** Новые локальные отметки связанных активных привычек, которые ещё не отправлены в TickTick. */
export function pendingExports(state: GameState, links: HabitLinksState, queue: readonly ExportOp[], now = 0): ExportOp[] {
  const known = new Set(queue.map((op) => op.key));
  const result: ExportOp[] = [];
  for (const [localId, link] of Object.entries(links.links)) {
    if (link.status !== 'active' || link.syncDirection === 'ticktick_to_local') continue;
    const habit = state.habits?.find((h) => h.id === localId);
    if (!habit) continue;
    for (const c of state.habitCompletions ?? []) {
      if (c.habitId !== localId || !c.rewardClaimed || (link.lastSyncedCheckinDate && c.day <= link.lastSyncedCheckinDate)) continue;
      const key = checkinIdempotencyKey(localId, c.day, habit.targetValue);
      if (known.has(key)) continue;
      known.add(key);
      result.push({ key, localId, ticktickHabitId: link.ticktickHabitId, day: c.day, value: habit.targetValue, goal: habit.targetValue, attempts: 0, nextAt: now, status: 'pending' });
    }
  }
  return result.sort((a, b) => a.day.localeCompare(b.day));
}
/** Итог попытки отправки: успех снимает операцию, ошибка планирует повтор или оставляет в очереди как failed. */
export function afterAttempt(op: ExportOp, ok: boolean, now: number): ExportOp | null {
  if (ok) return null;
  const attempts = op.attempts + 1;
  return attempts >= MAX_AUTO_ATTEMPTS ? { ...op, attempts, status: 'failed', nextAt: Number.MAX_SAFE_INTEGER } : { ...op, attempts, status: 'retrying', nextAt: now + backoffMs(attempts) };
}
export function dueOps(queue: readonly ExportOp[], now: number): ExportOp[] {
  return queue.filter((op) => op.status !== 'failed' && op.nextAt <= now);
}
/** После ручного повтора счётчик попыток начинается заново. */
export function retryAll(queue: readonly ExportOp[], now: number): ExportOp[] {
  return queue.map((op) => ({ ...op, attempts: 0, status: 'pending', nextAt: now }));
}
export function exportedThrough(link: HabitLink, day: string): HabitLink {
  return { ...link, lastSyncedCheckinDate: !link.lastSyncedCheckinDate || day > link.lastSyncedCheckinDate ? day : link.lastSyncedCheckinDate };
}

// ---------- Конфликты ----------

export type HabitConflict = { localId: string; ticktickHabitId: string; day: string; title: string };
/** Конфликт: здесь день выполнен, а TickTick хранит за этот день отметку «не выполнено». Победителя по времени определить нельзя: отметка TickTick не содержит времени. */
export function findConflicts(state: GameState, links: HabitLinksState, checkins: readonly RemoteCheckin[]): HabitConflict[] {
  const result: HabitConflict[] = [];
  for (const [localId, link] of Object.entries(links.links)) {
    if (link.status !== 'active') continue;
    const habit = state.habits?.find((h) => h.id === localId);
    if (!habit) continue;
    const remote = new Map(checkins.filter((c) => c.ticktickHabitId === link.ticktickHabitId).map((c) => [c.day, c]));
    for (const c of state.habitCompletions ?? []) {
      if (c.habitId !== localId || !c.rewardClaimed) continue;
      const other = remote.get(c.day);
      if (other && !other.completed) result.push({ localId, ticktickHabitId: link.ticktickHabitId, day: c.day, title: habit.title });
    }
  }
  return result.sort((a, b) => a.day.localeCompare(b.day));
}

/** Привычки, исчезнувшие или заархивированные в TickTick: статусы связей обновляются, локальные привычки и история не удаляются. */
export function reconcileLinks(links: HabitLinksState, remote: readonly RemoteHabit[]): HabitLinksState {
  const byId = new Map(remote.map((h) => [h.ticktickHabitId, h]));
  let changed = false;
  const next: Record<string, HabitLink> = {};
  for (const [localId, link] of Object.entries(links.links)) {
    const habit = byId.get(link.ticktickHabitId);
    const status = link.status === 'conflict' ? 'conflict' : !habit ? 'deleted' : habit.status === 'archived' ? 'archived' : 'active';
    if (status !== link.status) changed = true;
    next[localId] = { ...link, status, lastTicktickModifiedAt: habit?.modifiedAt || link.lastTicktickModifiedAt };
  }
  return changed || Object.entries(next).some(([id, l]) => l.lastTicktickModifiedAt !== links.links[id].lastTicktickModifiedAt) ? { ...links, links: next } : links;
}
export { addDays };
