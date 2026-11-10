/**
 * Focus Tracking — единый учёт рабочего времени (ТЗ «Этап 4.1»).
 *
 * Один источник данных. Каждая рабочая сессия — одно событие истории `Event` с
 * `planningChange.type === 'time'` (тот же механизм, что учёт фактического времени Этапа 2).
 * Задача, этап, проект, сфера и «Фокус месяца» ничего не хранят сами: все показатели здесь
 * считаются из этих событий. Отдельных счётчиков времени нет, поэтому двойной учёт невозможен.
 *
 * Время, внесённое вручную («Учесть время»), и записи таймера до 0.78.0 — те же события без
 * поля `session`. Они входят в фокус как записи режима `manual`: целые минуты, отнесённые к
 * дню записи. Так «Фокус» задачи всегда равен «Учтено фактически».
 *
 * Текущая сессия — `GameState.focusSession` (см. `ActiveFocusSession`). Все операции — чистые
 * функции над состоянием; сохранение и синхронизация идут обычным путём сохранения игры.
 *
 * Календарные дни и месяцы считаются по часовому поясу устройства — как во всей игре (`dateKey`).
 */
import { dateKey, spheres } from './game.ts';
import type { Event, GameState, Quest } from './game.ts';
import {
  addPlanningEvent, FOCUS_FIRST_ACTION_MAX, FOCUS_MAX_SECONDS, FOCUS_MAX_SEGMENTS, FOCUS_RESULT_MAX,
} from './planningData.ts';
import type { ActiveFocusSession, FocusModeId, FocusSegment, FocusSessionData } from './planningData.ts';

// ───────────────────────── Конфигурация ─────────────────────────

export type FocusMode = { id: Exclude<FocusModeId, 'custom' | 'stopwatch'>; minutes: number; name: string; purpose: string };
/** Семь готовых режимов (ТЗ, раздел 3). */
export const FOCUS_MODES: readonly FocusMode[] = [
  { id: 'quick', minutes: 5, name: 'Быстрый старт', purpose: 'Преодоление трудностей с началом' },
  { id: 'short', minutes: 15, name: 'Короткий фокус', purpose: 'Небольшие задачи' },
  { id: 'standard', minutes: 25, name: 'Стандартный фокус', purpose: 'Обычная рабочая сессия' },
  { id: 'extended', minutes: 30, name: 'Расширенный фокус', purpose: 'Выполнение запланированной задачи' },
  { id: 'deep', minutes: 60, name: 'Глубокая работа', purpose: 'Задачи с высокой концентрацией' },
  { id: 'long', minutes: 120, name: 'Длительная работа', purpose: 'Большие задачи и проекты' },
  { id: 'marathon', minutes: 180, name: 'Длительная работа', purpose: 'Продолжительные рабочие сессии' },
];
/** «Своя продолжительность», минуты. */
export const FOCUS_CUSTOM_MINUTES = { min: 1, max: 180 } as const;
/** Быстрые варианты продления после истечения времени, минуты. */
export const FOCUS_EXTENSIONS: readonly number[] = [5, 15, 25];
/**
 * Пороги тепловой карты, минуты фокуса за день (ТЗ, раздел 10): уровень 0 — нет фокуса,
 * 1 — от 1 минуты, 2 — от 30, 3 — от 60, 4 — от 120.
 */
export const FOCUS_HEAT_MINUTES: readonly number[] = [1, 30, 60, 120];
/** Категория для сессий, сфера которых не найдена в справочнике. */
export const NO_SPHERE = 'none';
export const NO_SPHERE_NAME = 'Без сферы';

export function focusModeName(mode: FocusModeId | 'manual'): string {
  if (mode === 'manual') return 'Вручную';
  if (mode === 'stopwatch') return 'Секундомер';
  if (mode === 'custom') return 'Своя продолжительность';
  return FOCUS_MODES.find((m) => m.id === mode)?.name ?? 'Фокус';
}
/** Короткая подпись режима записи для истории: «30 мин», «Своя длительность», «Секундомер», «Вручную». */
export function focusModeLabel(mode: FocusModeId | 'manual'): string {
  const preset = FOCUS_MODES.find((m) => m.id === mode);
  if (preset) return `${preset.minutes} мин`;
  return mode === 'custom' ? 'Своя длительность' : focusModeName(mode);
}
export function focusModeForMinutes(minutes: number): FocusModeId {
  return FOCUS_MODES.find((m) => m.minutes === minutes)?.id ?? 'custom';
}

// ───────────────────────── Формат ─────────────────────────

/** До часа — минуты, дальше — часы и минуты. Округление только здесь, при показе. */
export function formatFocus(seconds: number): string {
  if (!(seconds > 0)) return '0 мин';
  if (seconds < 60) return '< 1 мин';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${String(m).padStart(2, '0')} мин` : `${h} ч`;
}
/** Часы циферблата таймера: 1:05:09 или 24:59. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
export function focusHeatLevel(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (!(seconds > 0)) return 0;
  // Меньше минуты, но фокус был — всё равно первый уровень, а не «нет фокуса».
  const level = Math.max(1, FOCUS_HEAT_MINUTES.filter((limit) => seconds / 60 >= limit).length);
  return Math.min(4, level) as 0 | 1 | 2 | 3 | 4;
}

// ───────────────────────── Текущая сессия ─────────────────────────

type Interval = [start: number, end: number];
type Timeline = { intervals: Interval[]; running: boolean; expiredAt?: number };

/**
 * Отрезки работы на момент `now`. Открытый отрезок считается до `now`, но не дольше остатка
 * планового времени: когда отработано всё плановое время, сессия переходит в «время истекло»
 * и дальше не накапливает ничего, пока её не продлят. Поэтому закрытое приложение не может
 * добавить к сессии больше, чем оставалось по плану (ТЗ, раздел 4.3).
 *
 * Отрезки заодно упорядочиваются и очищаются от пересечений — на случай, если две версии
 * сессии с разных устройств слились при синхронизации.
 */
function timeline(session: ActiveFocusSession, now: number): Timeline {
  const raw = session.segments
    .map((s): Interval => [Date.parse(s.start), s.end === undefined ? Infinity : Date.parse(s.end)])
    .filter(([a, b]) => Number.isFinite(a) && !Number.isNaN(b))
    .sort((x, y) => x[0] - y[0]);
  const budget = session.plannedSeconds * 1000;
  const intervals: Interval[] = [];
  let worked = 0;
  let cursor = -Infinity;
  for (let i = 0; i < raw.length; i += 1) {
    const open = raw[i][1] === Infinity;
    const start = Math.max(raw[i][0], cursor);
    // Открытым может быть только последний отрезок; «открытый» в середине закрывается началом следующего.
    let end = open ? (i === raw.length - 1 ? now : raw[i + 1][0]) : raw[i][1];
    end = Math.min(end, now);
    if (end <= start) continue;
    if (worked + (end - start) >= budget) {
      const expiredAt = start + (budget - worked);
      if (expiredAt > start) intervals.push([start, expiredAt]);
      return { intervals, running: false, expiredAt };
    }
    intervals.push([start, end]);
    worked += end - start;
    cursor = end;
  }
  return { intervals, running: raw.length > 0 && raw[raw.length - 1][1] === Infinity };
}
const sumMs = (intervals: Interval[]) => intervals.reduce((sum, [a, b]) => sum + (b - a), 0);
function gapsMs(intervals: Interval[]) {
  let sum = 0;
  for (let i = 1; i < intervals.length; i += 1) sum += intervals[i][0] - intervals[i - 1][1];
  return sum;
}

export type FocusStatus = 'active' | 'paused' | 'expired';
export type FocusSnapshot = {
  status: FocusStatus;
  /** true — секундомер: показывать прошедшее время, а не остаток; плана и продления нет. */
  stopwatch: boolean;
  plannedSeconds: number;
  /** Подтверждённое рабочее время к этому моменту. */
  focusedSeconds: number;
  /** Паузы, включая текущую, если сессия стоит на паузе. */
  pausedSeconds: number;
  remainingSeconds: number;
};
/** Состояние текущей сессии на момент `now` — вычисляется, а не тикает в памяти вкладки. */
export function focusSnapshot(session: ActiveFocusSession, now = new Date()): FocusSnapshot {
  const t = now.getTime();
  const line = timeline(session, t);
  const worked = sumMs(line.intervals);
  const last = line.intervals.at(-1);
  const status: FocusStatus = line.expiredAt !== undefined ? 'expired' : line.running ? 'active' : 'paused';
  const trailing = status === 'paused' && last ? Math.max(0, t - last[1]) : 0;
  const focusedSeconds = Math.min(session.plannedSeconds, Math.floor(worked / 1000));
  return {
    status,
    stopwatch: session.mode === 'stopwatch',
    plannedSeconds: session.plannedSeconds,
    focusedSeconds,
    pausedSeconds: Math.floor((gapsMs(line.intervals) + trailing) / 1000),
    remainingSeconds: Math.max(0, session.plannedSeconds - focusedSeconds),
  };
}

/**
 * Приводит текущую сессию в порядок после слияния сохранений с двух устройств (замечание ревью
 * к PR #306). Слияние объединяет массивы отрезков как множества, поэтому, если одну сессию
 * независимо ставили на паузу и продолжали на двух устройствах, получается несколько открытых
 * отрезков и пересечения — такое сохранение не прошло бы проверку. Здесь:
 * - отрезки упорядочиваются, пересекающиеся объединяются;
 * - открытым остаётся только самый поздний; более ранний открытый закрывается началом следующего;
 * - если запись этой сессии уже есть в истории (на другом устройстве её завершили), текущая
 *   сессия убирается — иначе она «воскресла» бы после слияния.
 * Состояние без сессии или с уже правильной сессией возвращается без изменений.
 */
export function normalizeFocusState(state: GameState): GameState {
  const session = state.focusSession;
  if (!session || !Array.isArray(session.segments)) return state;
  const eventId = focusEventId(session.id);
  if (state.events.some((e) => e.id === eventId)) return withoutSession(state);
  const raw = session.segments
    .map((s): Interval => [Date.parse(s.start), s.end === undefined ? Infinity : Date.parse(s.end)])
    .filter(([a, b]) => Number.isFinite(a) && !Number.isNaN(b) && b >= a)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const lastOpen = raw.reduce((latest, [a, b]) => (b === Infinity ? Math.max(latest, a) : latest), -Infinity);
  const merged: Interval[] = [];
  raw.forEach(([start, rawEnd], i) => {
    const next = raw.slice(i + 1).find(([a]) => a > start);
    const end = rawEnd === Infinity && start !== lastOpen ? (next ? next[0] : start) : rawEnd;
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  });
  const segments: FocusSegment[] = merged.map(([a, b]) => (b === Infinity
    ? { start: new Date(a).toISOString() }
    : { start: new Date(a).toISOString(), end: new Date(b).toISOString() }));
  const same = segments.length === session.segments.length
    && segments.every((s, i) => s.start === session.segments[i].start && s.end === session.segments[i].end);
  return same ? state : { ...state, focusSession: { ...session, segments } };
}

/** Попытка начать вторую сессию. Интерфейс предлагает: вернуться к текущей, завершить её или отменить действие. */
export class FocusBusyError extends Error {
  taskId: string;
  constructor(taskId: string) {
    super('Сейчас уже идёт другая сессия фокуса. Вернитесь к ней или завершите её.');
    this.name = 'FocusBusyError';
    this.taskId = taskId;
  }
}

function closedSegments(intervals: Interval[]) {
  return intervals.map(([a, b]) => ({ start: new Date(a).toISOString(), end: new Date(b).toISOString() }));
}
function withSession(state: GameState, session: ActiveFocusSession, now: Date): GameState {
  return { ...state, focusSession: { ...session, updatedAt: now.toISOString() } };
}
function withoutSession(state: GameState): GameState {
  if (!state.focusSession) return state;
  const next = { ...state };
  delete next.focusSession;
  return next;
}
function checkMinutes(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < FOCUS_CUSTOM_MINUTES.min || minutes > FOCUS_CUSTOM_MINUTES.max)
    throw new Error(`Укажи от ${FOCUS_CUSTOM_MINUTES.min} до ${FOCUS_CUSTOM_MINUTES.max} минут.`);
}

/**
 * Начать сессию. Повтор с тем же `id` ничего не меняет (идемпотентно); при уже идущей другой
 * сессии — `FocusBusyError`.
 */
export function startFocus(
  state: GameState,
  input: { taskId: string; minutes: number; firstAction?: string },
  now = new Date(),
  id: string = crypto.randomUUID(),
): GameState {
  if (state.focusSession) {
    if (state.focusSession.id === id) return state;
    throw new FocusBusyError(state.focusSession.taskId);
  }
  checkMinutes(input.minutes);
  const task = state.quests.find((q) => q.id === input.taskId);
  if (!task) throw new Error('Задача не найдена.');
  if (task.done) throw new Error('Задача уже выполнена. Верни её в работу, чтобы начать фокус.');
  const firstAction = input.firstAction?.trim().slice(0, FOCUS_FIRST_ACTION_MAX);
  const iso = now.toISOString();
  return {
    ...state,
    focusSession: {
      id, taskId: task.id, mode: focusModeForMinutes(input.minutes), plannedSeconds: input.minutes * 60,
      startedAt: iso, segments: [{ start: iso }], ...(firstAction ? { firstAction } : {}), updatedAt: iso,
    },
  };
}
/**
 * Начать секундомер: отсчёт вверх без планового времени. Это та же сессия и та же запись в
 * истории, что у таймера, — время обоих попадает в один отчёт, и одновременно может идти
 * только что-то одно. Пауза, продолжение и завершение — общие (`pauseFocus`, `resumeFocus`,
 * `finishFocus`). Забытый секундомер останавливается сам через 12 часов.
 */
export function startStopwatch(
  state: GameState,
  input: { taskId: string; firstAction?: string },
  now = new Date(),
  id: string = crypto.randomUUID(),
): GameState {
  const started = startFocus(state, { ...input, minutes: FOCUS_CUSTOM_MINUTES.max }, now, id);
  if (started === state || !started.focusSession) return started;
  return { ...started, focusSession: { ...started.focusSession, mode: 'stopwatch', plannedSeconds: FOCUS_MAX_SECONDS } };
}
/** Пауза: учёт рабочего времени прекращается. Повторная пауза ничего не меняет. */
export function pauseFocus(state: GameState, now = new Date()): GameState {
  const session = state.focusSession;
  if (!session) return state;
  const line = timeline(session, now.getTime());
  if (!line.running && line.expiredAt === undefined) return state;
  return withSession(state, { ...session, segments: closedSegments(line.intervals) }, now);
}
/** Продолжить после паузы. Если время истекло — сначала продление (`extendFocus`). */
export function resumeFocus(state: GameState, now = new Date()): GameState {
  const session = state.focusSession;
  if (!session) return state;
  const line = timeline(session, now.getTime());
  if (line.expiredAt !== undefined) throw new Error(session.mode === 'stopwatch' ? 'Секундомер дошёл до предела в 12 часов. Заверши сессию.' : 'Время сессии истекло. Продли её или заверши.');
  if (line.running) return state;
  if (line.intervals.length >= FOCUS_MAX_SEGMENTS) throw new Error('Слишком много пауз в одной сессии. Заверши её и начни новую.');
  return withSession(state, { ...session, segments: [...closedSegments(line.intervals), { start: now.toISOString() }] }, now);
}
/**
 * Продление — та же сессия, новая запись не создаётся (ТЗ, раздел 3.4). Если время уже истекло,
 * отсчёт возобновляется с момента продления: промежуток между истечением и продлением в фокус
 * не входит. На паузе сессия остаётся на паузе.
 */
export function extendFocus(state: GameState, minutes: number, now = new Date()): GameState {
  const session = state.focusSession;
  if (!session) return state;
  if (session.mode === 'stopwatch') throw new Error('У секундомера нет планового времени — продлевать нечего.');
  checkMinutes(minutes);
  const plannedSeconds = session.plannedSeconds + minutes * 60;
  if (plannedSeconds > FOCUS_MAX_SECONDS) throw new Error('Сессия не может быть длиннее 12 часов. Заверши её и начни новую.');
  const line = timeline(session, now.getTime());
  if (line.expiredAt === undefined) return withSession(state, { ...session, plannedSeconds }, now);
  if (line.intervals.length >= FOCUS_MAX_SEGMENTS) throw new Error('Слишком много пауз в одной сессии. Заверши её и начни новую.');
  return withSession(state, {
    ...session, plannedSeconds,
    segments: [...closedSegments(line.intervals), { start: now.toISOString() }],
  }, now);
}
/**
 * Завершить сессию и сохранить фактическое время одним событием истории. Идентификатор события
 * выводится из идентификатора сессии, поэтому повторное завершение (второй клик, второе
 * устройство, повтор после сетевой ошибки) не создаёт вторую запись и не удваивает время.
 * Сессия без подтверждённого времени (меньше секунды) просто закрывается без записи.
 * `countUntil` — не засчитывать работу позже этого момента (например, когда приложение было закрыто).
 */
export function finishFocus(
  state: GameState,
  options: { result?: string; countUntil?: Date } = {},
  now = new Date(),
): GameState {
  const session = state.focusSession;
  if (!session) return state;
  const eventId = focusEventId(session.id);
  if (state.events.some((e) => e.id === eventId)) return withoutSession(state);
  const until = options.countUntil ? Math.min(options.countUntil.getTime(), now.getTime()) : now.getTime();
  const line = timeline(session, until);
  const focusedSeconds = Math.min(session.plannedSeconds, Math.floor(sumMs(line.intervals) / 1000));
  if (focusedSeconds < 1 || !line.intervals.length) return withoutSession(state);
  const task = state.quests.find((q) => q.id === session.taskId);
  if (!task) throw new Error('Задача этой сессии не найдена. Время не сохранено — сессию можно только отменить.');
  const result = options.result?.trim().slice(0, FOCUS_RESULT_MAX);
  const endedAt = line.intervals[line.intervals.length - 1][1];
  const data: FocusSessionData = {
    mode: session.mode,
    plannedSeconds: session.plannedSeconds,
    focusedSeconds,
    pausedSeconds: Math.floor(gapsMs(line.intervals) / 1000),
    startedAt: new Date(line.intervals[0][0]).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    // У секундомера нет плана, значит нет и «досрочно»: любая его сессия завершена.
    status: session.mode === 'stopwatch' || focusedSeconds >= session.plannedSeconds ? 'completed' : 'interrupted',
    segments: closedSegments(line.intervals),
    ...(session.firstAction ? { firstAction: session.firstAction } : {}),
    ...(result ? { result } : {}),
  };
  const saved = addPlanningEvent(
    state, task, { type: 'time', minutes: Math.round(focusedSeconds / 60), session: data }, eventId, new Date(endedAt),
  );
  return withoutSession(saved);
}
/** Отменить сессию без учёта времени — только по явному действию игрока. */
export function discardFocus(state: GameState): GameState {
  return withoutSession(state);
}
export function focusEventId(sessionId: string) {
  return `focus-${sessionId}`;
}
/** Задача текущей сессии, если она ещё существует. */
export function focusTask(state: GameState): Quest | undefined {
  const session = state.focusSession;
  return session ? state.quests.find((q) => q.id === session.taskId) : undefined;
}

// ───────────────────────── Записи фокуса ─────────────────────────

export type FocusRecord = {
  id: string;
  taskId: string;
  /** Проект, этап и сфера — как были на момент сессии. */
  goalId?: string;
  stageId?: string;
  sphere: string;
  seconds: number;
  /** Нет у секундомера и у времени, внесённого вручную. */
  plannedSeconds?: number;
  pausedSeconds: number;
  startedAt: string;
  endedAt: string;
  mode: FocusModeId | 'manual';
  status: 'completed' | 'interrupted';
  firstAction?: string;
  result?: string;
  /** Отрезки работы, мс. Пусто у записей без сессии — они целиком относятся к дню записи. */
  intervals: Interval[];
};
const sphereIds = new Set(spheres.map((s) => s.id));
function recordOf(e: Event): FocusRecord | undefined {
  const change = e.planningChange;
  if (change?.type !== 'time' || !e.sourceId) return undefined;
  const base = {
    id: e.id, taskId: e.sourceId, sphere: sphereIds.has(e.sphere) ? e.sphere : NO_SPHERE,
    ...(e.goalId ? { goalId: e.goalId } : {}), ...(e.stageId ? { stageId: e.stageId } : {}),
  };
  const s = change.session;
  if (!s) {
    if (!(change.minutes > 0)) return undefined;
    return { ...base, seconds: change.minutes * 60, pausedSeconds: 0, startedAt: e.date, endedAt: e.date, mode: 'manual', status: 'completed', intervals: [] };
  }
  if (!(s.focusedSeconds > 0)) return undefined;
  return {
    ...base, seconds: s.focusedSeconds, ...(s.mode === 'stopwatch' ? {} : { plannedSeconds: s.plannedSeconds }), pausedSeconds: s.pausedSeconds,
    startedAt: s.startedAt, endedAt: s.endedAt, mode: s.mode, status: s.status,
    ...(s.firstAction ? { firstAction: s.firstAction } : {}), ...(s.result ? { result: s.result } : {}),
    intervals: s.segments.map((seg): Interval => [Date.parse(seg.start), Date.parse(seg.end)]),
  };
}
const recordsCache = new WeakMap<Event[], FocusRecord[]>();
/**
 * Все записи фокуса, новые первыми. Результат запоминается для массива событий: пока история
 * не изменилась, повторные вызовы (карточки задач, графики, фильтры) ничего не пересчитывают.
 */
export function focusRecords(state: Pick<GameState, 'events'>): FocusRecord[] {
  const cached = recordsCache.get(state.events);
  if (cached) return cached;
  const records: FocusRecord[] = [];
  for (const e of state.events) {
    const r = recordOf(e);
    if (r) records.push(r);
  }
  records.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || a.id.localeCompare(b.id));
  recordsCache.set(state.events, records);
  return records;
}

export type DaySeconds = { day: string; seconds: number };
const slicesCache = new WeakMap<FocusRecord, DaySeconds[]>();
/**
 * Время записи по календарным дням. Сессия через полночь делится между днями по фактическим
 * отрезкам работы (паузы не входят), а не относится целиком к дате начала (ТЗ, раздел 14).
 * Сумма по дням всегда точно равна времени записи.
 */
export function recordDays(record: FocusRecord): DaySeconds[] {
  const cached = slicesCache.get(record);
  if (cached) return cached;
  let result: DaySeconds[];
  if (!record.intervals.length) {
    result = [{ day: dateKey(new Date(record.endedAt)), seconds: record.seconds }];
  } else {
    const ms = new Map<string, number>();
    for (const [start, end] of record.intervals) {
      let cursor = start;
      while (cursor < end) {
        const d = new Date(cursor);
        const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        const stop = Math.min(end, midnight > cursor ? midnight : end);
        const key = dateKey(d);
        ms.set(key, (ms.get(key) ?? 0) + (stop - cursor));
        cursor = stop;
      }
    }
    // Целые секунды по дням методом наибольших остатков — чтобы сумма сошлась с записью до секунды.
    const total = [...ms.values()].reduce((a, b) => a + b, 0);
    const parts = [...ms.entries()].map(([day, value]) => {
      const exact = total ? (value / total) * record.seconds : 0;
      return { day, seconds: Math.floor(exact), rest: exact - Math.floor(exact) };
    });
    let left = record.seconds - parts.reduce((sum, p) => sum + p.seconds, 0);
    for (const p of [...parts].sort((a, b) => b.rest - a.rest)) {
      if (left <= 0) break;
      p.seconds += 1;
      left -= 1;
    }
    result = parts.filter((p) => p.seconds > 0).map(({ day, seconds }) => ({ day, seconds })).sort((a, b) => a.day.localeCompare(b.day));
    if (!result.length) result = [{ day: dateKey(new Date(record.endedAt)), seconds: record.seconds }];
  }
  slicesCache.set(record, result);
  return result;
}

// ───────────────────────── Выборки и суммы ─────────────────────────

export type FocusFilter = {
  sphere?: string;
  goalId?: string;
  stageId?: string;
  taskId?: string;
  /** Календарные дни 'YYYY-MM-DD', включительно. */
  from?: string;
  to?: string;
};
/** Часть записи, пришедшаяся на один день. Одна запись даёт по одному куску на каждый свой день. */
export type FocusSlice = { record: FocusRecord; day: string; seconds: number };

export function focusSlices(state: Pick<GameState, 'events'>, filter: FocusFilter = {}): FocusSlice[] {
  const out: FocusSlice[] = [];
  for (const record of focusRecords(state)) {
    if (filter.sphere !== undefined && record.sphere !== filter.sphere) continue;
    if (filter.goalId !== undefined && record.goalId !== filter.goalId) continue;
    if (filter.stageId !== undefined && record.stageId !== filter.stageId) continue;
    if (filter.taskId !== undefined && record.taskId !== filter.taskId) continue;
    for (const { day, seconds } of recordDays(record)) {
      if (filter.from !== undefined && day < filter.from) continue;
      if (filter.to !== undefined && day > filter.to) continue;
      out.push({ record, day, seconds });
    }
  }
  return out;
}
export type FocusTotals = {
  totalSeconds: number;
  /** Число сессий с ненулевым временем в выборке. Сессия через границу периода считается в каждом периоде, где у неё есть время. */
  sessions: number;
  activeDays: number;
  /** Суммарное время / число сессий; 0, если сессий нет. */
  averageSeconds: number;
};
export function focusTotals(slices: FocusSlice[]): FocusTotals {
  const ids = new Set<string>();
  const days = new Set<string>();
  let totalSeconds = 0;
  for (const s of slices) {
    totalSeconds += s.seconds;
    ids.add(s.record.id);
    days.add(s.day);
  }
  return { totalSeconds, sessions: ids.size, activeDays: days.size, averageSeconds: ids.size ? totalSeconds / ids.size : 0 };
}
export type FocusGroup = { key: string; seconds: number; sessions: number; /** Доля от суммы выборки, 0–1. */ share: number };
/** Суммы по ключу, от большего к меньшему. Каждый кусок попадает ровно в одну группу — сумма групп равна сумме выборки. */
export function groupFocus(slices: FocusSlice[], keyOf: (slice: FocusSlice) => string): FocusGroup[] {
  const map = new Map<string, { seconds: number; ids: Set<string> }>();
  let total = 0;
  for (const s of slices) {
    const key = keyOf(s);
    const g = map.get(key) ?? { seconds: 0, ids: new Set<string>() };
    g.seconds += s.seconds;
    g.ids.add(s.record.id);
    map.set(key, g);
    total += s.seconds;
  }
  return [...map.entries()]
    .map(([key, g]) => ({ key, seconds: g.seconds, sessions: g.ids.size, share: total ? g.seconds / total : 0 }))
    .sort((a, b) => b.seconds - a.seconds || a.key.localeCompare(b.key));
}

// ───────────────────────── Задача ─────────────────────────

const taskTotalsCache = new WeakMap<Event[], Map<string, number>>();
/** Суммарный фокус каждой задачи — один проход по истории на все карточки задач. */
export function focusByTask(state: Pick<GameState, 'events'>): Map<string, number> {
  const cached = taskTotalsCache.get(state.events);
  if (cached) return cached;
  const map = new Map<string, number>();
  for (const r of focusRecords(state)) map.set(r.taskId, (map.get(r.taskId) ?? 0) + r.seconds);
  taskTotalsCache.set(state.events, map);
  return map;
}
export function taskFocusSeconds(state: Pick<GameState, 'events'>, taskId: string): number {
  return focusByTask(state).get(taskId) ?? 0;
}
/** История сессий задачи, новые первыми. Сохраняется после выполнения, повторного открытия и переноса задачи. */
export function taskFocusHistory(state: Pick<GameState, 'events'>, taskId: string): FocusRecord[] {
  return focusRecords(state).filter((r) => r.taskId === taskId);
}

// ───────────────────────── Этап и проект ─────────────────────────

const NO_STAGE = '';
function taskName(state: Pick<GameState, 'quests'>, id: string) {
  return state.quests.find((q) => q.id === id)?.name ?? 'Удалённая задача';
}
function shiftDay(day: string, amount: number) {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + amount, 12));
}
export type NamedFocus = FocusGroup & { name: string };
export type StageFocus = FocusTotals & {
  last7Seconds: number;
  longestSeconds: number;
  /** Самая трудоёмкая задача этапа. */
  topTask?: NamedFocus;
  byTask: NamedFocus[];
  /** Только дни с фокусом, по возрастанию даты. */
  byDay: DaySeconds[];
};
/** Показатели фокуса этапа (ТЗ, раздел 6). Процент выполнения этапа от времени не зависит и здесь не считается. */
export function stageFocus(state: GameState, goalId: string, stageId: string, now = new Date()): StageFocus {
  const slices = focusSlices(state, { goalId, stageId });
  const today = dateKey(now);
  const weekStart = shiftDay(today, -6);
  const byTask = groupFocus(slices, (s) => s.record.taskId).map((g) => ({ ...g, name: taskName(state, g.key) }));
  const records = new Map(slices.map((s) => [s.record.id, s.record]));
  return {
    ...focusTotals(slices),
    last7Seconds: slices.filter((s) => s.day >= weekStart && s.day <= today).reduce((sum, s) => sum + s.seconds, 0),
    longestSeconds: Math.max(0, ...[...records.values()].map((r) => r.seconds)),
    topTask: byTask[0],
    byTask,
    byDay: groupFocus(slices, (s) => s.day).map((g) => ({ day: g.key, seconds: g.seconds })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}
export type ProjectFocus = FocusTotals & { byStage: NamedFocus[]; byTask: NamedFocus[]; byDay: DaySeconds[] };
/** Фокус проекта, при необходимости за период `from`–`to` (ТЗ, раздел 7). Сессии без этапа собраны в «Без этапа». */
export function projectFocus(state: GameState, goalId: string, period: Pick<FocusFilter, 'from' | 'to'> = {}): ProjectFocus {
  const slices = focusSlices(state, { goalId, ...period });
  const stages = state.goals.find((g) => g.id === goalId)?.stages ?? [];
  return {
    ...focusTotals(slices),
    byStage: groupFocus(slices, (s) => s.record.stageId ?? NO_STAGE).map((g) => ({
      ...g, name: g.key === NO_STAGE ? 'Без этапа' : stages.find((st) => st.id === g.key)?.name ?? 'Удалённый этап',
    })),
    byTask: groupFocus(slices, (s) => s.record.taskId).map((g) => ({ ...g, name: taskName(state, g.key) })),
    byDay: groupFocus(slices, (s) => s.day).map((g) => ({ day: g.key, seconds: g.seconds })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

// ───────────────────────── Фокус месяца ─────────────────────────

export type FocusComparison = {
  /** Сравниваемые периоды, дни включительно. */
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  /** true — месяц ещё идёт: прошедшие дни сравниваются с тем же числом дней прошлого месяца. */
  partial: boolean;
  currentSeconds: number;
  previousSeconds: number;
  deltaSeconds: number;
  /** null, если в прошлом периоде фокуса не было — процент не считается. */
  percent: number | null;
};
const pad = (n: number) => String(n).padStart(2, '0');
function monthDays(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return dateKey(new Date(y, m - 2, 1, 12)).slice(0, 7);
}
/**
 * Сравнение с предыдущим месяцем (ТЗ, раздел 11). Завершённый месяц — полный с полным.
 * Текущий — прошедшие дни с тем же интервалом прошлого месяца: 10 ноября сравнивается
 * с 1–10 октября. Если в прошлом месяце дней меньше, интервал обрезается его последним днём.
 */
export function focusComparison(state: Pick<GameState, 'events'>, month: string, filter: FocusFilter = {}, now = new Date()): FocusComparison {
  const today = dateKey(now);
  const partial = month === today.slice(0, 7);
  const prev = previousMonth(month);
  const lastDay = partial ? Number(today.slice(8, 10)) : monthDays(month);
  const range = { from: `${month}-01`, to: `${month}-${pad(lastDay)}` };
  const previousRange = { from: `${prev}-01`, to: `${prev}-${pad(partial ? Math.min(lastDay, monthDays(prev)) : monthDays(prev))}` };
  const sum = (r: { from: string; to: string }) => focusSlices(state, { ...filter, ...r }).reduce((total, s) => total + s.seconds, 0);
  const currentSeconds = sum(range);
  const previousSeconds = sum(previousRange);
  const deltaSeconds = currentSeconds - previousSeconds;
  return {
    range, previousRange, partial, currentSeconds, previousSeconds, deltaSeconds,
    percent: previousSeconds > 0 ? Math.round((deltaSeconds / previousSeconds) * 100) : null,
  };
}
/** Нейтральная формулировка сравнения: без оценок игрока (ТЗ, раздел 11.3). */
export function comparisonText(c: FocusComparison): string {
  if (c.previousSeconds === 0) return c.currentSeconds === 0 ? 'В обоих периодах фокуса пока нет' : 'Нет данных для процентного сравнения';
  if (c.deltaSeconds === 0) return 'Столько же фокуса, сколько в прошлом периоде';
  if (c.deltaSeconds > 0) return `+${c.percent}% времени фокуса · +${formatFocus(c.deltaSeconds)}`;
  return `В этом периоде фокуса на ${formatFocus(-c.deltaSeconds)} меньше`;
}

export type SphereFocus = { id: string; name: string; icon: string; color: string; seconds: number; sessions: number; share: number };
export type MonthDayFocus = { day: string; seconds: number; sessions: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };
export type MonthFocus = FocusTotals & {
  month: string;
  comparison: FocusComparison;
  /** Все сферы справочника (включая нулевые), от большего времени к меньшему; «Без сферы» — только если в ней есть время. */
  spheres: SphereFocus[];
  /** Каждый день месяца, включая дни без фокуса. */
  days: MonthDayFocus[];
  projects: NamedFocus[];
  tasks: NamedFocus[];
};
/**
 * «Фокус месяца» (ТЗ, разделы 8–12, 15). `filter` — выбранные сфера/проект/этап; месяц задаёт
 * период. Время сессии через границу месяца делится между месяцами. Сумма по сферам равна
 * общему времени: каждая сессия относится ровно к одной сфере или к «Без сферы».
 */
export function monthFocus(
  state: GameState,
  month: string,
  filter: Pick<FocusFilter, 'sphere' | 'goalId' | 'stageId'> = {},
  now = new Date(),
): MonthFocus {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Неверный месяц');
  const total = monthDays(month);
  const slices = focusSlices(state, { ...filter, from: `${month}-01`, to: `${month}-${pad(total)}` });
  const bySphere = new Map(groupFocus(slices, (s) => s.record.sphere).map((g) => [g.key, g]));
  const sphereRows: SphereFocus[] = spheres.map((s) => {
    const g = bySphere.get(s.id);
    return { id: s.id, name: s.name, icon: s.icon, color: s.color, seconds: g?.seconds ?? 0, sessions: g?.sessions ?? 0, share: g?.share ?? 0 };
  });
  const none = bySphere.get(NO_SPHERE);
  if (none) sphereRows.push({ id: NO_SPHERE, name: NO_SPHERE_NAME, icon: '◌', color: '#8b93a7', seconds: none.seconds, sessions: none.sessions, share: none.share });
  sphereRows.sort((a, b) => b.seconds - a.seconds);
  const byDay = new Map(groupFocus(slices, (s) => s.day).map((g) => [g.key, g]));
  const today = dateKey(now);
  const days: MonthDayFocus[] = [];
  for (let d = 1; d <= total; d += 1) {
    const day = `${month}-${pad(d)}`;
    const g = byDay.get(day);
    days.push({ day, seconds: g?.seconds ?? 0, sessions: g?.sessions ?? 0, level: focusHeatLevel(g?.seconds ?? 0), future: day > today });
  }
  return {
    month,
    ...focusTotals(slices),
    comparison: focusComparison(state, month, filter, now),
    spheres: sphereRows,
    days,
    projects: groupFocus(slices, (s) => s.record.goalId ?? '').map((g) => ({
      ...g, name: g.key ? state.goals.find((goal) => goal.id === g.key)?.name ?? 'Удалённый проект' : 'Без проекта',
    })),
    tasks: groupFocus(slices, (s) => s.record.taskId).map((g) => ({ ...g, name: taskName(state, g.key) })),
  };
}
export type DayFocus = FocusTotals & { day: string; projects: NamedFocus[]; tasks: NamedFocus[]; spheres: NamedFocus[] };
/** Детализация одного дня календаря (ТЗ, раздел 10.1). */
export function dayFocus(state: GameState, day: string, filter: Pick<FocusFilter, 'sphere' | 'goalId' | 'stageId'> = {}): DayFocus {
  const slices = focusSlices(state, { ...filter, from: day, to: day });
  return {
    day,
    ...focusTotals(slices),
    projects: groupFocus(slices, (s) => s.record.goalId ?? '').map((g) => ({
      ...g, name: g.key ? state.goals.find((goal) => goal.id === g.key)?.name ?? 'Удалённый проект' : 'Без проекта',
    })),
    tasks: groupFocus(slices, (s) => s.record.taskId).map((g) => ({ ...g, name: taskName(state, g.key) })),
    spheres: groupFocus(slices, (s) => s.record.sphere).map((g) => ({
      ...g, name: g.key === NO_SPHERE ? NO_SPHERE_NAME : spheres.find((s) => s.id === g.key)?.name ?? NO_SPHERE_NAME,
    })),
  };
}
