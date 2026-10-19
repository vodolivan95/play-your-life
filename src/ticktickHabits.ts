// Чистые функции привычек TickTick: нормализация, расписание, иконки, сферы, ключи, конфликты.
// Здесь нет сети, токенов и записи в сохранение игры: модуль используют Worker, экран «Привычки» и тесты.

export type HabitStatus = 'active' | 'paused' | 'archived';
export type RemoteHabit = {
  ticktickHabitId: string;
  name: string;
  /** Исходный iconRes TickTick, хранится для повторного сопоставления. */
  iconRes: string;
  /** Идентификатор локальной иконки из `habitIcons`. */
  icon: string;
  color: string;
  status: HabitStatus;
  goal: number;
  step: number;
  unit: string;
  repeatRule: string;
  reminders: string[];
  sectionId: string;
  sectionName: string;
  modifiedAt: string;
  etag: string;
  totalCheckIns: number;
};
export type RemoteCheckin = {
  ticktickHabitId: string;
  /** День YYYY-MM-DD в часовом поясе привычки. */
  day: string;
  stamp: number;
  value: number;
  goal: number;
  completed: boolean;
};
export type HabitSection = { id: string; name: string };

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const number = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// ---------- Даты и часовые пояса ----------

/** 2026-10-19 → 20261019. */
export function stampOf(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Некорректная дата.');
  return Number(day.replaceAll('-', ''));
}
/** 20261019 → 2026-10-19. Недопустимые даты (например, 20261340) отклоняются. */
export function dayOfStamp(stamp: number): string {
  if (!Number.isSafeInteger(stamp) || stamp < 19000101 || stamp > 21001231) throw new Error('Некорректная отметка даты.');
  const s = String(stamp);
  const day = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error('Некорректная отметка даты.');
  return day;
}
/** Локальный день момента времени в часовом поясе привычки (смещение в минутах, как `Habit.timezoneMinutes`). Не берёт день по UTC. */
export function localDay(instant: Date | string | number, timezoneMinutes: number): string {
  const time = new Date(instant).getTime();
  if (!Number.isFinite(time)) throw new Error('Некорректное время.');
  return new Date(time + timezoneMinutes * 60000).toISOString().slice(0, 10);
}
export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
}
export const lookbackChoices = [30, 90, 180, 0] as const; // 0 — весь доступный период
export const MAX_LOOKBACK_DAYS = 730;
/** Период синхронизации: 30, 90, 180 дней или весь период (ограничен MAX_LOOKBACK_DAYS). Прошлое и будущее не смешиваются. */
export function syncRange(today: string, lookbackDays: number): { from: string; to: string } {
  if (!Number.isSafeInteger(lookbackDays) || lookbackDays < 0) throw new Error('Некорректный период.');
  const days = lookbackDays === 0 ? MAX_LOOKBACK_DAYS : Math.min(lookbackDays, MAX_LOOKBACK_DAYS);
  return { from: addDays(today, -(days - 1)), to: today };
}
export function validRange(from: string, to: string): { from: string; to: string } {
  stampOf(from); stampOf(to);
  if (from > to) throw new Error('Начало периода позже конца.');
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  if (span > MAX_LOOKBACK_DAYS) throw new Error('Период слишком большой.');
  return { from, to };
}

// ---------- Расписание (RRULE) ----------

export type Schedule =
  | { supported: true; weekdays: number[] }
  | { supported: false; raw: string; reason: string };
const byDay: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/** Локальная модель знает только дни недели (0 — воскресенье). Остальные правила сохраняются как есть и показываются только для чтения. */
export function parseRepeatRule(rule: string): Schedule {
  const raw = rule.trim();
  const unsupported = (reason: string): Schedule => ({ supported: false, raw, reason });
  if (!raw) return unsupported('Расписание не задано.');
  const parts = Object.fromEntries(
    raw.replace(/^RRULE:/i, '').split(';').filter(Boolean).map((p) => {
      const [k, ...v] = p.split('=');
      return [k.trim().toUpperCase(), v.join('=').trim().toUpperCase()];
    }),
  ) as Record<string, string>;
  const interval = parts.INTERVAL === undefined ? 1 : Number(parts.INTERVAL);
  if (!Number.isInteger(interval) || interval < 1) return unsupported('Неверный интервал повторения.');
  if (parts.COUNT || parts.UNTIL) return unsupported('Правила с ограничением по числу или дате не поддерживаются.');
  if (parts.FREQ === 'DAILY') {
    return interval === 1 && !parts.BYDAY ? { supported: true, weekdays: [0, 1, 2, 3, 4, 5, 6] } : unsupported('Повтор каждые несколько дней не поддерживается.');
  }
  if (parts.FREQ === 'WEEKLY') {
    if (interval !== 1) return unsupported('Повтор раз в несколько недель не поддерживается.');
    if (!parts.BYDAY) return unsupported('Не указаны дни недели.');
    const days = parts.BYDAY.split(',').map((d) => byDay[d.trim()]);
    if (!days.length || days.some((d) => d === undefined)) return unsupported('Дни недели не распознаны.');
    return { supported: true, weekdays: [...new Set(days)].sort((a, b) => a - b) };
  }
  if (parts.FREQ === 'MONTHLY' || parts.FREQ === 'YEARLY') return unsupported('Месячные и годовые правила пока показываются только для чтения.');
  return unsupported('Правило повторения не распознано.');
}

// ---------- Иконки и сферы ----------

/** Словарь известных iconRes → идентификатор локальной иконки (`habitIcons`). Неизвестные получают запасную. */
export const iconDictionary: Record<string, string> = {
  habit_reading: 'reading',
  habit_running: 'steps',
  habit_walking: 'steps',
  habit_gym: 'training',
  habit_workout: 'training',
  habit_health: 'food',
  habit_water: 'water',
  habit_sleep: 'sleep',
  habit_meditation: 'meditation',
  habit_study: 'learning',
  habit_english: 'english',
  habit_money: 'finance',
  habit_driving: 'driving',
  habit_art: 'art',
};
export const fallbackIcon = 'learning';
export function mapIcon(iconRes: string): string {
  return iconDictionary[iconRes.trim().toLowerCase()] ?? fallbackIcon;
}

/** Разделы TickTick → сферы игры по умолчанию. Пользователь может изменить сопоставление. */
export const defaultSectionSpheres: Record<string, string> = {
  health: 'health', learning: 'growth', english: 'english', finance: 'finance', other: 'tasks',
};
export type SectionMapping = Record<string, string>; // идентификатор или название раздела → id сферы
export function sphereForSection(section: { id: string; name: string }, mapping: SectionMapping = {}, known: readonly string[]): string | null {
  const chosen = mapping[section.id] ?? mapping[section.name.toLowerCase()] ?? defaultSectionSpheres[section.name.trim().toLowerCase()];
  return chosen && known.includes(chosen) ? chosen : null;
}

// ---------- Нормализация ответов TickTick ----------

function status(raw: unknown): HabitStatus {
  if (raw === 'archived' || raw === 2 || raw === 'ARCHIVED') return 'archived';
  if (raw === 'paused' || raw === 1 || raw === 'PAUSED') return 'paused';
  return 'active';
}
function iso(raw: unknown): string {
  const t = typeof raw === 'number' ? raw : typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : '';
}
/** Достаёт массив из ответа вида `[...]`, `{habits:[...]}` или `{items:[...]}`. */
export function listOf(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (object(payload)) for (const key of [...keys, 'items', 'data']) if (Array.isArray(payload[key])) return payload[key] as unknown[];
  return [];
}
export function normalizeSections(payload: unknown): HabitSection[] {
  return listOf(payload, 'sections').flatMap((item) => {
    if (!object(item) || (typeof item.id !== 'string' && typeof item.id !== 'number')) return [];
    return [{ id: String(item.id), name: text(item.name ?? item.title, 100) }];
  });
}
export function normalizeHabit(raw: unknown, sections: readonly HabitSection[] = []): RemoteHabit | null {
  if (!object(raw) || (typeof raw.id !== 'string' && typeof raw.id !== 'number')) return null;
  const name = text(raw.name, 100).trim();
  if (!name) return null;
  const sectionId = raw.sectionId === undefined || raw.sectionId === null ? '' : String(raw.sectionId);
  const reminders = Array.isArray(raw.reminders) ? raw.reminders.filter((r): r is string => typeof r === 'string').slice(0, 20) : [];
  const iconRes = text(raw.iconRes, 100);
  return {
    ticktickHabitId: String(raw.id),
    name,
    iconRes,
    icon: mapIcon(iconRes),
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color ?? '')) ? String(raw.color) : '',
    status: status(raw.status),
    goal: Math.max(number(raw.goal, 1), 0) || 1,
    step: Math.max(number(raw.step, 1), 0) || 1,
    unit: text(raw.unit, 30) || 'Count',
    repeatRule: text(raw.repeatRule, 300),
    reminders,
    sectionId,
    sectionName: sections.find((s) => s.id === sectionId)?.name ?? '',
    modifiedAt: iso(raw.modifiedTime ?? raw.modifiedAt),
    etag: text(raw.etag, 100),
    totalCheckIns: Math.max(number(raw.totalCheckIns, 0), 0),
  };
}
export function normalizeHabits(payload: unknown, sections: readonly HabitSection[] = []): RemoteHabit[] {
  return listOf(payload, 'habits').flatMap((item) => { const habit = normalizeHabit(item, sections); return habit ? [habit] : []; });
}
/** История отметок: `{habitId:[…]}`, `{checkins:[…]}` или плоский массив. Отметки без валидной даты отбрасываются. */
export function normalizeCheckins(payload: unknown): RemoteCheckin[] {
  const rows: unknown[] = [];
  if (object(payload) && !Array.isArray(payload.checkins) && !Array.isArray(payload.items) && !Array.isArray(payload.data)) {
    for (const value of Object.values(payload)) if (Array.isArray(value)) rows.push(...value);
  } else rows.push(...listOf(payload, 'checkins'));
  const result: RemoteCheckin[] = [];
  for (const row of rows) {
    if (!object(row) || (typeof row.habitId !== 'string' && typeof row.habitId !== 'number')) continue;
    let day: string;
    try { day = dayOfStamp(Number(row.stamp)); } catch { continue; }
    const value = number(row.value, 0);
    const goal = number(row.goal, 1);
    // status: 2 — выполнено, 1 — не выполнено, 0 — снято. Без статуса считаем по значению и цели.
    const completed = row.status === undefined ? value >= goal && value > 0 : row.status === 2;
    result.push({ ticktickHabitId: String(row.habitId), day, stamp: Number(row.stamp), value, goal, completed });
  }
  return dedupeCheckins(result);
}

// ---------- Дедупликация и ключи ----------

/** source = ticktick, external_key = ticktickHabitId + stamp. */
export function externalKey(ticktickHabitId: string, stamp: number): string {
  return `ticktick:${ticktickHabitId}:${stamp}`;
}
/** Одна отметка на привычку и день; при дубликатах побеждает выполненная, затем с большим значением. */
export function dedupeCheckins(items: readonly RemoteCheckin[]): RemoteCheckin[] {
  const byKey = new Map<string, RemoteCheckin>();
  for (const item of items) {
    const key = externalKey(item.ticktickHabitId, item.stamp);
    const old = byKey.get(key);
    if (!old || Number(item.completed) > Number(old.completed) || (item.completed === old.completed && item.value > old.value)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => a.stamp - b.stamp || a.ticktickHabitId.localeCompare(b.ticktickHabitId));
}
/** Устойчивый ключ идемпотентности отметки: один и тот же вход всегда даёт один и тот же ключ. */
export function checkinIdempotencyKey(localHabitId: string, day: string, value: number): string {
  return `checkin:${localHabitId}:${stampOf(day)}:${value}`;
}
/** Новые отметки для импорта: уже импортированные ключи пропускаются, поэтому награда повторно не выдаётся. */
export function newCheckins(items: readonly RemoteCheckin[], imported: ReadonlySet<string>): RemoteCheckin[] {
  return dedupeCheckins(items).filter((item) => item.completed && !imported.has(externalKey(item.ticktickHabitId, item.stamp)));
}

// ---------- Конфликты ----------

export type DayState = { done: boolean; at: string };
export type Resolution = { winner: 'local' | 'remote' | 'none' | 'conflict'; done: boolean };
/** Конфликт — разные значения за один день. Победитель определяется только если время обеих сторон известно и различается. */
export function resolveDay(local: DayState | undefined, remote: DayState | undefined): Resolution {
  if (!local && !remote) return { winner: 'none', done: false };
  if (!local) return { winner: 'remote', done: remote!.done };
  if (!remote) return { winner: 'local', done: local.done };
  if (local.done === remote.done) return { winner: 'none', done: local.done };
  const l = Date.parse(local.at);
  const r = Date.parse(remote.at);
  if (!Number.isFinite(l) || !Number.isFinite(r) || l === r) return { winner: 'conflict', done: local.done };
  return l > r ? { winner: 'local', done: local.done } : { winner: 'remote', done: remote.done };
}

// ---------- Статус удаления и архивации ----------

export type LinkStatus = 'active' | 'archived' | 'deleted' | 'conflict';
/** Привычка исчезла или заархивирована в TickTick: локальная привычка и история не удаляются. */
export function linkStatusFor(remote: RemoteHabit | undefined): LinkStatus {
  if (!remote) return 'deleted';
  return remote.status === 'archived' ? 'archived' : 'active';
}

// ---------- Связи привычек (хранятся на сервере, не в сохранении игры) ----------

export type HabitLink = {
  ticktickHabitId: string;
  sectionId: string;
  /** Исходный iconRes, чтобы позже повторно сопоставить иконку. */
  iconRes: string;
  syncDirection: 'ticktick_to_local' | 'local_to_ticktick' | 'bidirectional';
  status: LinkStatus;
  lastTicktickModifiedAt: string;
  lastLocalModifiedAt: string;
  lastSyncedCheckinDate: string;
  /** Исходное правило повтора, если локальная модель его не поддерживает (показывается только для чтения). */
  unsupportedRule?: string;
};
export type HabitLinksState = {
  revision: number;
  links: Record<string, HabitLink>; // ключ — локальный id привычки
  sectionMap: SectionMapping;
  lookbackDays: number;
  /** Внешние ключи уже импортированных отметок: по ним награда не выдаётся повторно. */
  imported: string[];
  lastSync?: string;
};
export const MAX_HABIT_LINKS = 500;
export const MAX_IMPORTED_KEYS = 20000;
export function emptyHabitLinks(revision = 0): HabitLinksState {
  return { revision, links: {}, sectionMap: {}, lookbackDays: 90, imported: [] };
}
export function validateHabitLinks(value: unknown): HabitLinksState {
  const invalid = (): never => { throw new Error('Некорректные связи привычек.'); };
  const id = (v: unknown) => typeof v === 'string' && /^[\w-]{1,100}$/.test(v);
  const when = (v: unknown) => v === '' || (typeof v === 'string' && Number.isFinite(Date.parse(v)));
  if (!object(value) || !object(value.links) || !object(value.sectionMap) || !Array.isArray(value.imported)) return invalid();
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) return invalid();
  if (!Number.isSafeInteger(value.lookbackDays) || Number(value.lookbackDays) < 0 || Number(value.lookbackDays) > MAX_LOOKBACK_DAYS) return invalid();
  const entries = Object.entries(value.links);
  if (entries.length > MAX_HABIT_LINKS || value.imported.length > MAX_IMPORTED_KEYS) return invalid();
  const links: Record<string, HabitLink> = {};
  for (const [localId, link] of entries) {
    if (!id(localId) || !object(link) || !id(link.ticktickHabitId)) return invalid();
    if (typeof link.sectionId !== 'string' || link.sectionId.length > 100 || typeof link.iconRes !== 'string' || link.iconRes.length > 100) return invalid();
    if (!['ticktick_to_local', 'local_to_ticktick', 'bidirectional'].includes(String(link.syncDirection))) return invalid();
    if (!['active', 'archived', 'deleted', 'conflict'].includes(String(link.status))) return invalid();
    if (!when(link.lastTicktickModifiedAt) || !when(link.lastLocalModifiedAt) || (link.lastSyncedCheckinDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(link.lastSyncedCheckinDate)))) return invalid();
    if (link.unsupportedRule !== undefined && (typeof link.unsupportedRule !== 'string' || link.unsupportedRule.length > 300)) return invalid();
    links[localId] = {
      ticktickHabitId: link.ticktickHabitId as string, sectionId: link.sectionId, iconRes: link.iconRes,
      syncDirection: link.syncDirection as HabitLink['syncDirection'], status: link.status as LinkStatus,
      lastTicktickModifiedAt: link.lastTicktickModifiedAt as string, lastLocalModifiedAt: link.lastLocalModifiedAt as string,
      lastSyncedCheckinDate: link.lastSyncedCheckinDate as string,
      ...(link.unsupportedRule ? { unsupportedRule: link.unsupportedRule } : {}),
    };
  }
  const sectionMap: SectionMapping = {};
  for (const [key, sphere] of Object.entries(value.sectionMap)) {
    if (key.length > 100 || typeof sphere !== 'string' || sphere.length > 40) return invalid();
    sectionMap[key] = sphere;
  }
  if (value.imported.some((k) => typeof k !== 'string' || !/^ticktick:[\w-]{1,100}:\d{8}$/.test(k))) return invalid();
  if (value.lastSync !== undefined && (typeof value.lastSync !== 'string' || !Number.isFinite(Date.parse(value.lastSync)))) return invalid();
  return {
    revision: Number(value.revision), links, sectionMap, lookbackDays: Number(value.lookbackDays),
    imported: [...new Set(value.imported as string[])], ...(value.lastSync ? { lastSync: value.lastSync as string } : {}),
  };
}

/** Время синхронизации для карточки: «сегодня, 12:30» или дата. */
export function syncedText(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === now.toDateString() ? `сегодня, ${time}` : `${date.toLocaleDateString('ru-RU')}, ${time}`;
}

