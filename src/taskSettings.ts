import { difficulties } from './game.ts';
import type { GameState, Quest } from './game.ts';
import { questCoins } from './personalQuests.ts';
import { addDays, mondayOf } from './tasksCalendar.ts';

export type TaskPatch = {
  name?: string;
  notes?: string;
  difficulty?: string;
  dueAt?: string | null;
  stageId?: string | null;
  sync?: boolean;
  repeat?: Quest['repeat'] | null;
  subtasks?: NonNullable<Quest['subtasks']>;
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
export function canChangeDifficulty(q: Quest) {
  return q.sourceType === 'USER_CREATED' && !q.rewardLocked && !(q.currentValue ?? 0);
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
  const old = state.quests.find((q) => q.id === id);
  if (!old) throw new Error('Задача не найдена.');
  if (old.done) throw new Error('Выполненную задачу нельзя менять.');
  const q: Quest = { ...old };
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
    if (!canChangeDifficulty(old)) throw new Error('Сложность этой задачи изменить нельзя.');
    if (!Object.hasOwn(difficulties, patch.difficulty)) throw new Error('Выбери сложность.');
    q.difficulty = patch.difficulty;
    q.xp = difficulties[patch.difficulty as keyof typeof difficulties];
  }
  if (patch.dueAt !== undefined) {
    if (patch.dueAt === null) q.dueAt = undefined;
    else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.dueAt) || !Number.isFinite(Date.parse(patch.dueAt))) throw new Error('Проверь дату.');
      if (old.startsAt && patch.dueAt < old.startsAt.slice(0, 10)) throw new Error('Срок не может быть раньше начала.');
      q.dueAt = patch.dueAt;
    }
  }
  if (patch.stageId !== undefined) {
    if (patch.stageId === null) q.stageId = undefined;
    else {
      const goal = state.goals.find((g) => g.id === old.goalId);
      if (!goal?.stages?.some((s) => s.id === patch.stageId)) throw new Error('Этап не найден в цели задачи.');
      q.stageId = patch.stageId;
    }
  }
  if (patch.sync !== undefined) {
    q.tickTickSync = patch.sync ? undefined : false;
  }
  if (patch.repeat !== undefined) q.repeat = patch.repeat ?? undefined;
  if (patch.subtasks !== undefined) {
    if (patch.subtasks.length > 30 || patch.subtasks.some((t) => !t.title.trim() || t.title.length > 100))
      throw new Error('Проверь подзадачи: не больше 30, название до 100 символов.');
    q.subtasks = patch.subtasks.length ? patch.subtasks.map((t) => ({ ...t, title: t.title.trim() })) : undefined;
  }
  const clean = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) as Quest;
  return { ...state, quests: state.quests.map((item) => (item.id === id ? clean : item)) };
}
