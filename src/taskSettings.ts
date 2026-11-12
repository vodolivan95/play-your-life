import { validateTaskEditorFields } from './taskEditor.ts';
import { validProjectImage } from './projectImage.ts';
import { validTaskDetails } from './taskDetails.ts';
import { saveTask } from './planning.ts';
import { recordTaskSchedule, validTaskPlanning } from './planningData.ts';
import type { PostponeReasonCode } from './planningData.ts';
import { validDependencyGraph } from './taskDependencies.ts';
import { difficulties, syncGoalTasks } from './game.ts';
import type { GameState, Quest } from './game.ts';
import { questCoins } from './personalQuests.ts';
import { addDays, mondayOf } from './tasksCalendar.ts';

export type TaskPatch = {
  goalId?: string | null;
  sphere?: string;
  weight?: number;
  coverImage?: string | null;
  details?: Quest['details'];
  planning?: Quest['planning'];
  estimateMinutes?: number | null;
  priority?: Quest['priority'];
  moveReason?: string;
  /** Категория причины переноса (необязательна); свободный текст moveReason остаётся отдельно. */
  moveReasonCode?: PostponeReasonCode;
  actionId?: string;
  name?: string;
  notes?: string;
  difficulty?: string;
  dueAt?: string | null;
  /** Начало интервала выполнения (вместе с dueAt — «с … до …»); без времени смысла не имеет. */
  startsAt?: string | null;
  deadlineAt?: string | null;
  /** Перенос задачи в календаре перетаскиванием: сдвигает срок (и начало, если есть) на столько дней, время суток сохраняется. */
  shiftDays?: number;
  stageId?: string | null;
  sync?: boolean;
  repeat?: Quest['repeat'] | null;
  subtasks?: NonNullable<Quest['subtasks']>;
  pinned?: boolean;
  wontDo?: boolean;
};
export const repeatLabels: [Quest['repeat'] | null, string][] = [
  [null, 'Не повторять'],
  ['daily', 'Каждый день'],
  ['weekdays', 'По будням'],
  ['weekly', 'Каждую неделю'],
  ['monthly', 'Каждый месяц'],
];
export const difficultyLabels: Record<string, string> = {
  Micro: 'Микро',
  Simple: 'Лёгкая',
  Medium: 'Средняя',
  Hard: 'Сложная',
  'Very Hard': 'Очень сложная',
};
export type DuePreset = 'today' | 'tomorrow' | 'week' | 'none' | 'date';
export function dueFor(preset: Exclude<DuePreset, 'date'>, today: string): string | null {
  if (preset === 'none') return null;
  if (preset === 'today') return today;
  if (preset === 'tomorrow') return addDays(today, 1);
  return addDays(mondayOf(today), 6);
}
export function duePreset(dueAt: string | undefined, today: string): DuePreset {
  const day = dueAt?.slice(0, 10);
  if (!day) return 'none';
  if (day === today) return 'today';
  if (day === addDays(today, 1)) return 'tomorrow';
  if (day === addDays(mondayOf(today), 6)) return 'week';
  return 'date';
}
/** Сдвигает дату (обычную 'YYYY-MM-DD' или ISO со временем) на N дней, сохраняя время суток. */
function shiftDate(value: string, days: number): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return addDays(value, days);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
export function difficultyLockReason(q: Quest): string | undefined {
  if (q.done) return 'Задача выполнена: сложность зафиксирована.';
  if (q.rewardLocked || (q.currentValue ?? 0) > 0)
    return 'Прогресс уже начат: сложность и награда зафиксированы.';
  if (q.sourceType === 'SYSTEM') return 'Сложность системной задачи задана приложением.';
  return undefined;
}
export function canChangeDifficulty(q: Quest) {
  // Legacy and starter tasks can lack sourceType; absence is not an explicit SYSTEM lock.
  return difficultyLockReason(q) === undefined;
}
export function taskContribution(state: GameState, q: Quest) {
  const xp = q.sourceType === 'USER_CREATED' ? difficulties[q.difficulty as keyof typeof difficulties] ?? q.xp : q.xp;
  const goal = state.goals.find((g) => g.id === q.goalId);
  const stage = goal?.stages?.find((s) => s.id === q.stageId);
  const pool = goal ? state.quests.filter((t) => t.goalId === goal.id && t.required !== false) : [];
  const total = pool.reduce((sum, t) => sum + (t.weight ?? 1), 0);
  const share = goal && q.required !== false && total ? Math.round(((q.weight ?? 1) / total) * 100) : 0;
  const stagePool = stage ? pool.filter((t) => t.stageId === stage.id) : [];
  return { xp, coins: questCoins(q), goal, stage, goalShare: share, stageTasks: stagePool.length };
}
export function updateTaskSettings(state: GameState, id: string, patch: TaskPatch): GameState {
  if (patch.actionId && state.events.some((e) => e.id === patch.actionId)) return state;
  const old = state.quests.find((q) => q.id === id);
  if (!old) throw new Error('Задача не найдена.');
  if (old.done) throw new Error('Выполненную задачу нельзя менять.');
  validateTaskEditorFields({ startsAt: patch.startsAt ?? undefined, dueAt: patch.dueAt ?? undefined, deadlineAt: patch.deadlineAt ?? undefined }, false);
  const q: Quest = { ...old };
  if (patch.details !== undefined) {
    if (!validTaskDetails(patch.details)) throw new Error('Проверь дополнительные поля задачи.');
    q.details = patch.details;
  }
  if (patch.coverImage !== undefined) {
    if (!validProjectImage(patch.coverImage ?? undefined)) throw new Error('Некорректная обложка.');
    q.coverImage = patch.coverImage ?? undefined;
  }
  if (patch.weight !== undefined) {
    if (!Number.isFinite(patch.weight) || patch.weight <= 0 || patch.weight > 1000) throw new Error('Вес: больше 0 и не более 1000.');
    q.weight = patch.weight;
  }
  if (patch.goalId !== undefined || patch.sphere !== undefined) {
    q.goalId = patch.goalId === null ? undefined : patch.goalId ?? old.goalId;
    q.stageId = q.goalId === old.goalId ? old.stageId : undefined;
    q.sphere = patch.sphere ?? old.sphere;
    // Existing service enforces project/sphere/reward locks and parent ranges.
    saveTask(state, q);
    q.sphere = state.goals.find(g => g.id === q.goalId)?.sphere ?? q.sphere;
  }
  if (patch.planning !== undefined) {
    if (!validTaskPlanning(patch.planning)) throw new Error('Проверь настройки задачи.');
    q.planning = patch.planning;
  }
  if (patch.priority !== undefined) {
    if (!['low', 'normal', 'high'].includes(patch.priority)) throw new Error('Выбери приоритет.');
    q.priority = patch.priority;
  }
  if (patch.estimateMinutes !== undefined) {
    if (patch.estimateMinutes !== null && (!Number.isFinite(patch.estimateMinutes) || patch.estimateMinutes < 1 || patch.estimateMinutes > 43200)) throw new Error('Оценка времени: от 1 до 43200 минут.');
    q.estimateMinutes = patch.estimateMinutes ?? undefined;
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name || name.length > 100) throw new Error('Проверь название задачи.');
    q.name = name;
  }
  if (patch.notes !== undefined) {
    if (patch.notes.length > 2000) throw new Error('Заметка слишком длинная.');
    q.notes = patch.notes.trim() || undefined;
  }
  if (patch.difficulty !== undefined && patch.difficulty !== old.difficulty) {
    if (!canChangeDifficulty(old)) throw new Error(difficultyLockReason(old));
    if (!Object.hasOwn(difficulties, patch.difficulty)) throw new Error('Выбери сложность.');
    q.difficulty = patch.difficulty;
    q.xp = difficulties[patch.difficulty as keyof typeof difficulties];
  }
  if (patch.dueAt !== undefined) {
    if (patch.dueAt === null) q.dueAt = undefined;
    else {
      // Срок — обычная дата 'YYYY-MM-DD' (без времени) или локальное время 'YYYY-MM-DDTЧЧ:ММ'
      // (так отдаёт поле <input type="time"> в окне задачи) — тогда задача получает конкретное
      // время выполнения: подтягивается из TickTick, переносится туда же и показывается в
      // календаре интервалом, а не плашкой на весь день.
      const bare = /^\d{4}-\d{2}-\d{2}$/.test(patch.dueAt);
      const timed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(patch.dueAt);
      if ((!bare && !timed) || !Number.isFinite(Date.parse(patch.dueAt))) throw new Error('Проверь дату.');
      const due = bare ? patch.dueAt : new Date(patch.dueAt).toISOString();
      q.dueAt = due;
    }
  }
  if (patch.startsAt !== undefined) {
    if (patch.startsAt === null) q.startsAt = undefined;
    else {
      // Начало интервала — тот же формат, что и у срока: обычная дата или локальное время.
      const bare = /^\d{4}-\d{2}-\d{2}$/.test(patch.startsAt);
      const timed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(patch.startsAt);
      if ((!bare && !timed) || !Number.isFinite(Date.parse(patch.startsAt))) throw new Error('Проверь начало.');
      const starts = bare ? patch.startsAt : new Date(patch.startsAt).toISOString();
      q.startsAt = starts;
    }
  }
  if (patch.shiftDays !== undefined) {
    // Перенос в календаре игры теперь и для связанных с TickTick задач — новая дата уходит
    // туда же обычным обменом (localChanged), как и любое другое изменение связанной задачи.
    if (!old.dueAt && !old.startsAt) throw new Error('У задачи нет срока, которую можно перенести.');
    if (!Number.isInteger(patch.shiftDays) || !patch.shiftDays) throw new Error('Нечего переносить.');
    if (old.dueAt) q.dueAt = shiftDate(old.dueAt, patch.shiftDays);
    if (old.startsAt) q.startsAt = shiftDate(old.startsAt, patch.shiftDays);
  }
  // Проверяем итоговый интервал: начало и конец могут меняться одним действием.
  if ((patch.startsAt !== undefined || patch.dueAt !== undefined || patch.shiftDays !== undefined)
    && q.startsAt && q.dueAt && new Date(q.startsAt) > new Date(q.dueAt)) {
    throw new Error(patch.startsAt !== undefined ? 'Начало не может быть позже срока.' : 'Срок не может быть раньше начала.');
  }
  if (patch.deadlineAt !== undefined) {
    if (patch.deadlineAt === null) q.deadlineAt = undefined;
    else {
      if (!Number.isFinite(Date.parse(patch.deadlineAt))) throw new Error('Проверь дату дедлайна.');
      q.deadlineAt = patch.deadlineAt.includes('T') ? new Date(patch.deadlineAt).toISOString() : patch.deadlineAt;
    }
  }
  if (patch.stageId !== undefined) {
    if (patch.stageId === null) q.stageId = undefined;
    else {
      const goal = state.goals.find((g) => g.id === q.goalId);
      if (!goal?.stages?.some((s) => s.id === patch.stageId)) throw new Error('Этап не найден в проекте задачи.');
      q.stageId = patch.stageId;
    }
  }
  if (patch.sync !== undefined) {
    q.tickTickSync = patch.sync ? undefined : false;
  }
  if (patch.repeat && old.tickTickRepeatFlag) throw new Error('Повтор уже настроен в TickTick. Измените его там, чтобы не создавать дубликаты.');
  if (patch.repeat !== undefined) q.repeat = patch.repeat ?? undefined;
  if (patch.subtasks !== undefined) {
    if (patch.subtasks.length > 30 || patch.subtasks.some((t) => !t.title.trim() || t.title.length > 100))
      throw new Error('Проверь подзадачи: не больше 30, название до 100 символов.');
    q.subtasks = patch.subtasks.length ? patch.subtasks.map((t) => ({ ...t, title: t.title.trim() })) : undefined;
  }
  if (patch.pinned !== undefined) q.pinned = patch.pinned || undefined;
  if (patch.wontDo !== undefined) q.wontDo = patch.wontDo || undefined;
  validateTaskEditorFields(q, [patch.startsAt, patch.dueAt, patch.deadlineAt, patch.shiftDays].some(v => v !== undefined));
  const clean = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) as Quest;
  let next = { ...state, quests: state.quests.map((item) => (item.id === id ? clean : item)) };
  if (patch.goalId !== undefined || patch.weight !== undefined) {
    if (old.goalId) next = syncGoalTasks(next, old.goalId);
    if (q.goalId && q.goalId !== old.goalId) next = syncGoalTasks(next, q.goalId);
  }
  if (patch.planning !== undefined && !validDependencyGraph(next.quests)) throw new Error('Связь создаёт цикл зависимостей.');
  const recorded = recordTaskSchedule(next, old, clean, patch.moveReason, patch.actionId, patch.moveReasonCode);
  if (JSON.stringify(old) === JSON.stringify(clean)) return state;
  const labels: Record<string, string> = { name: 'название', notes: 'описание', priority: 'приоритет', difficulty: 'сложность', goalId: 'проект', stageId: 'этап', sphere: 'сфера', weight: 'вес', planning: 'статус и планирование', subtasks: 'чек-лист', coverImage: 'обложка', details: 'дополнительные данные', repeat: 'повтор', estimateMinutes: 'оценка времени', pinned: 'избранное', sync: 'синхронизация' };
  const changed = Object.keys(patch).filter(k => labels[k]).map(k => labels[k]);
  return changed.length ? { ...recorded, events: [...recorded.events, { id: patch.actionId && !recorded.events.some(e => e.id === patch.actionId) ? patch.actionId : crypto.randomUUID(), sourceId: id, sphere: q.sphere, title: `Изменено: ${changed.join(', ')}`, xp: 0, kind: 'planning', date: new Date().toISOString() }] } : recorded;
}
