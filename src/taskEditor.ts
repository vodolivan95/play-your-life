import { completeQuest } from './game.ts';
import type { GameState, Quest } from './game.ts';
import { validTaskDetails } from './taskDetails.ts';
import { validProjectImage } from './projectImage.ts';

/** Shared validation for creation, inbox acceptance and editing; no new task records for checklist items. */
export function validateTaskEditorFields(task: Partial<Quest>, checkSchedule = true) {
  if (task.rewardCoins !== undefined && (!Number.isInteger(task.rewardCoins) || task.rewardCoins < 0 || task.rewardCoins > 100)) throw new Error('Лайфкоины: целое число от 0 до 100.');
  if (!validTaskDetails(task.details)) throw new Error('Проверь заметки, участников и вложения задачи.');
  if (!validProjectImage(task.coverImage)) throw new Error('Некорректная обложка.');
  for (const value of [task.startsAt, task.dueAt, task.deadlineAt]) {
    if (!value) continue;
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value) ||
        !Number.isFinite(Date.parse(value)) || new Date(`${value.slice(0, 10)}T12:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10))
      throw new Error('Проверь даты задачи.');
  }
  if (checkSchedule && task.startsAt && task.dueAt && Date.parse(task.startsAt) > Date.parse(task.dueAt))
    throw new Error('Окончание не может быть раньше начала.');
  const endOf = (v: string) => Date.parse(v.length === 10 ? `${v}T23:59:59.999` : v);
  if (checkSchedule && task.deadlineAt && [task.startsAt, task.dueAt].some(v => v && Date.parse(v) > endOf(task.deadlineAt!)))
    throw new Error('Начало и окончание не могут быть позже дедлайна.');
  if (task.repeat !== undefined && !['daily', 'weekdays', 'weekly', 'monthly'].includes(task.repeat))
    throw new Error('Выбери правило повторения.');
  if (task.subtasks !== undefined && (!Array.isArray(task.subtasks) || task.subtasks.length > 30 ||
      new Set(task.subtasks.map(s => s?.id)).size !== task.subtasks.length ||
      task.subtasks.some(s => !s || typeof s.id !== 'string' || !s.id || s.id.length > 100 ||
        typeof s.title !== 'string' || !s.title.trim() || s.title.length > 100 || typeof s.done !== 'boolean')))
    throw new Error('Проверь чек-лист: до 30 пунктов с непустым названием.');
}

/** Canonical completion enforces dependencies, project locks and exactly-once rewards. */
export function toggleTaskChecklist(state: GameState, id: string, itemId: string, done: boolean): GameState {
  const task = state.quests.find(q => q.id === id);
  if (!task || task.done) return state;
  const item = task.subtasks?.find(s => s.id === itemId);
  if (!item || item.done === done) return state;
  const subtasks = task.subtasks!.map(s => s.id === itemId ? { ...s, done } : s);
  const next = { ...state, quests: state.quests.map(q => q.id === id ? { ...q, subtasks } : q) };
  if (!done || !subtasks.every(s => s.done)) return next;
  const completed = completeQuest(next, id);
  if (!completed.quests.find(q => q.id === id)?.done)
    throw new Error('Задача пока недоступна для завершения: проверь начало, зависимости и статус проекта или этапа. Последний пункт не отмечен.');
  return completed;
}
