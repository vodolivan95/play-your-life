import { dateKey, reopenQuest, syncGoalTasks } from './game.ts';
import type { GameState, Quest } from './game.ts';
import { progressQuest, saveCustomQuest } from './personalQuests.ts';
import { updateTaskSettings } from './taskSettings.ts';
import type { TaskPatch } from './taskSettings.ts';
import { addDays, mondayOf } from './tasksCalendar.ts';
import { addPlanningEvent, planningDay, planningMetrics, planningSettings, validDay, validPlanningSettings, validTaskPlanning } from './planningData.ts';
import type { PlanningSettings, TaskPlanning, PostponeReasonCode } from './planningData.ts';
import { fingerprint } from './stateFingerprint.ts';
import { dependencyBlockMessage, dependencyBlockers, validDependencyGraph, validDependencyIds } from './taskDependencies.ts';
import { goalProgressValue } from './goalWorkspace.ts';

export function visiblePlanningTask(q: Quest): boolean { return !q.planning?.archivedAt && !q.wontDo; }
export function inboxTask(q: Quest): boolean {
  return visiblePlanningTask(q) && !q.done && (q.planning?.inbox ?? (!q.goalId && !q.dueAt && !q.startsAt));
}
export function taskDay(q: Quest): string | undefined { return planningDay(q.dueAt ?? q.startsAt); }
function owned(state: GameState, id: string, ownerId: string): Quest {
  const q = state.quests.find((t) => t.id === id);
  if (!q) throw new Error('Задача не найдена.');
  if (q.ownerId && q.ownerId !== ownerId) throw new Error('Это задача другого пользователя.');
  return q;
}
export function changeTaskPlanning(state: GameState, id: string, patch: Partial<TaskPlanning>, ownerId: string): GameState {
  const q = owned(state, id, ownerId);
  const planning = Object.fromEntries(Object.entries({ ...q.planning, ...patch }).filter(([, v]) => v !== undefined));
  if (!validTaskPlanning(planning)) throw new Error('Проверь планирование задачи.');
  const next = { ...state, quests: state.quests.map((t) => t.id === id ? { ...t, planning } : t) };
  if (patch.dependencyIds !== undefined && !validDependencyGraph(next.quests)) throw new Error('Связь создаёт цикл зависимостей.');
  return next;
}
export function setTaskDependencies(state: GameState, id: string, ids: string[], ownerId: string): GameState {
  const q = owned(state, id, ownerId);
  if (q.done) throw new Error('Сначала отмени выполнение задачи, чтобы изменить её зависимости.');
  if (!validDependencyIds(ids) || ids.includes(id)) throw new Error('Выбери до 50 разных предшественников, без самой задачи.');
  for (const dep of ids) {
    const target = state.quests.find((t) => t.id === dep);
    if (!target && q.planning?.dependencyIds?.includes(dep)) continue;
    owned(state, dep, ownerId);
  }
  return changeTaskPlanning(state, id, { dependencyIds: [...ids] }, ownerId);
}
export function savePlanningSettings(state: GameState, settings: PlanningSettings): GameState {
  if (!validPlanningSettings(settings)) throw new Error('Проверь настройки планирования.');
  return { ...state, planningSettings: { ...settings, weekdays: [...settings.weekdays] } };
}
export function quickPlanningTask(state: GameState, title: string, ownerId: string, day?: string): GameState {
  if (day && !validDay(day)) throw new Error('Выбери дату.');
  const next = saveCustomQuest(state, { name: title, sphere: 'tasks', difficulty: 'Simple', ...(day ? { dueAt: day } : {}) }, ownerId);
  const q = next.quests[next.quests.length - 1];
  return changeTaskPlanning(next, q.id, { inbox: !day, workflow: day ? 'ready' : 'planned' }, ownerId);
}
export function moveTaskToDay(state: GameState, id: string, day: string | null, ownerId: string, reason?: string, actionId?: string, reasonCode?: PostponeReasonCode): GameState {
  const q = owned(state, id, ownerId);
  if (actionId && state.events.some((e) => e.id === actionId)) return state;
  const from = taskDay(q);
  let patch: TaskPatch;
  if (day === null) patch = { startsAt: null, dueAt: null };
  else {
    if (!validDay(day)) throw new Error('Выбери дату.');
    if (from === day) return changeTaskPlanning(state, id, { inbox: false }, ownerId);
    patch = from ? { shiftDays: Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) } : { dueAt: day };
  }
  const next = updateTaskSettings(state, id, { ...patch, moveReason: reason, actionId, moveReasonCode: reasonCode });
  return changeTaskPlanning(next, id, { inbox: day === null }, ownerId);
}
export function setTaskWorkflow(state: GameState, id: string, workflow: NonNullable<TaskPlanning['workflow']> | 'done', ownerId: string): GameState {
  const q = owned(state, id, ownerId);
  if (workflow === 'doing') {
    const blocked = dependencyBlockMessage(state.quests, q);
    if (blocked) throw new Error(blocked);
  }
  if (workflow === 'done') return progressQuest(state, id, q.targetValue ?? 1, ownerId);
  const next = q.done ? reopenQuest(state, id) : state;
  return changeTaskPlanning(next, id, { workflow, inbox: false }, ownerId);
}
export function setTaskProject(state: GameState, id: string, goalId: string | null, ownerId: string): GameState {
  const q = owned(state, id, ownerId);
  if (q.done) throw new Error('Сначала отмени выполнение задачи.');
  const g = state.goals.find((g) => g.id === goalId);
  if (goalId && !g) throw new Error('Проект не найден.');
  if (g && g.sphere !== q.sphere) throw new Error('Выбери проект той же сферы. Сменить сферу можно в расширенной форме задачи.');
  const next: GameState = { ...state, quests: state.quests.map((t) => {
    if (t.id !== id) return t;
    const copy = { ...t, planning: { ...t.planning, inbox: false } };
    delete copy.goalId; delete copy.stageId;
    return g ? { ...copy, goalId: g.id } : copy;
  }) };
  let result = q.goalId ? syncGoalTasks(next, q.goalId) : next;
  if (g) result = syncGoalTasks(result, g.id);
  return result;
}
export function logTaskTime(state: GameState, id: string, minutes: number, ownerId: string, actionId?: string): GameState {
  const q = owned(state, id, ownerId);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 43200) throw new Error('Укажи от 1 до 43200 целых минут.');
  return addPlanningEvent(state, q, { type: 'time', minutes }, actionId);
}
export function availableMinutes(state: GameState, day: string): number {
  const s = planningSettings(state);
  return s.weekdays.includes(new Date(`${day}T12:00:00`).getDay()) ? Math.floor(s.dailyMinutes * (100 - s.reservePercent) / 100) : 0;
}
export function planningSummary(state: GameState, quests: Quest[], metrics = planningMetrics(state)) {
  const active = quests.filter(visiblePlanningTask);
  const plan = active.reduce((sum, q) => sum + (q.estimateMinutes ?? 0), 0);
  const remaining = active.filter((q) => !q.done).reduce((sum, q) => sum + (q.estimateMinutes ?? 0), 0);
  const fact = active.reduce((sum, q) => sum + (metrics.get(q.id)?.minutes ?? 0), 0);
  const done = active.filter((q) => q.done).length;
  return { count: active.length, done, percent: active.length ? Math.round(done / active.length * 100) : 0,
    plan, remaining, fact, unknown: active.filter((q) => !q.done && !q.estimateMinutes).length };
}
export type ExecutionOverview = {
  totalActive: number; plannedToday: number; doneToday: number; overdue: number;
  oftenPostponed: number; blocked: number; noDate: number; inActiveProjects: number;
};
/**
 * Компактная сводка «Контроль выполнения» (ТЗ «Этап 3», раздел 2.1). Использует только уже
 * существующие данные GameState/planningMetrics — новых полей и новой страницы не создаёт.
 * `quests` — список задач, по которому считается сводка (обычно все задачи владельца, не
 * отфильтрованные текущим видом «Моего плана» — сводка должна отражать весь план целиком).
 */
export function executionOverview(state: GameState, quests: Quest[], today: string, settings: PlanningSettings, metrics = planningMetrics(state)): ExecutionOverview {
  const active = quests.filter((q) => visiblePlanningTask(q) && !q.done);
  const doneToday = quests.filter((q) => visiblePlanningTask(q) && q.done && planningDay(q.completedAt) === today).length;
  let plannedToday = 0, overdue = 0, oftenPostponed = 0, blocked = 0, noDate = 0, inActiveProjects = 0;
  for (const q of active) {
    const d = taskDay(q);
    if (d === today) plannedToday++;
    if (d && d < today) overdue++;
    if ((metrics.get(q.id)?.moves ?? 0) >= settings.moveWarning) oftenPostponed++;
    if (dependencyBlockers(quests, q).length > 0) blocked++;
    if (!d) noDate++;
    const goal = q.goalId ? state.goals.find((g) => g.id === q.goalId) : undefined;
    if (goal && !goal.paused && goalProgressValue(state, goal) < 100) inActiveProjects++;
  }
  return { totalActive: active.length, plannedToday, doneToday, overdue, oftenPostponed, blocked, noDate, inActiveProjects };
}
export type WeekProposal = { anchor: string; revision: number; assignments: { id: string; day: string; original?: string; originalStart?: string }[]; unplaced: string[] };
const planRevision = (state: GameState) => fingerprint({ quests: state.quests, settings: planningSettings(state), day: dateKey() });
/** Предложение не меняет состояние. Уже занятые оценки уменьшают доступную ёмкость. */
export function proposeWeek(state: GameState, ids: string[], anchor: string, ownerId: string): WeekProposal {
  if (!validDay(anchor)) throw new Error('Выбери неделю.');
  const monday = mondayOf(anchor);
  const today = dateKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d >= today);
  const selected = new Set(ids);
  const capacity = new Map(days.map((d) => [d, availableMinutes(state, d) - state.quests
    .filter((q) => visiblePlanningTask(q) && !q.done && taskDay(q) === d)
    .reduce((sum, q) => sum + (q.estimateMinutes ?? 0), 0)]));
  const proposal: WeekProposal = { anchor, revision: planRevision(state), assignments: [], unplaced: [] };
  for (const id of selected) {
    const q = owned(state, id, ownerId);
    if (q.done || !visiblePlanningTask(q)) continue;
    if (state.goals.some((g) => g.id === q.goalId && g.paused)) { proposal.unplaced.push(id); continue; }
    // Старый интервал освобождается только если задача действительно распределена.
    const oldDay = taskDay(q);
    const day = q.estimateMinutes ? days.find((d) => capacity.get(d)! + (d === oldDay ? q.estimateMinutes! : 0) >= q.estimateMinutes!) : undefined;
    if (!day) { proposal.unplaced.push(id); continue; }
    if (oldDay && capacity.has(oldDay)) capacity.set(oldDay, capacity.get(oldDay)! + q.estimateMinutes!);
    capacity.set(day, capacity.get(day)! - q.estimateMinutes!);
    proposal.assignments.push({ id, day, original: q.dueAt, originalStart: q.startsAt });
  }
  return proposal;
}
export function applyWeekProposal(state: GameState, proposal: WeekProposal, ownerId: string): GameState {
  if (proposal.revision !== planRevision(state)) throw new Error('План изменился. Сформируй предложение заново.');
  for (const a of proposal.assignments) {
    const q = owned(state, a.id, ownerId);
    if (q.dueAt !== a.original || q.startsAt !== a.originalStart || q.done || !visiblePlanningTask(q)) throw new Error('План изменился. Сформируй предложение заново.');
  }
  return proposal.assignments.reduce((s, a) => moveTaskToDay(s, a.id, a.day, ownerId, 'Планирование недели'), state);
}

/** Только реальные интервалы с обеими временными границами; соседние интервалы не конфликтуют. */
export function planningConflicts(quests: Quest[]): [Quest, Quest][] {
  const timed = quests.filter((q) => visiblePlanningTask(q) && !q.done && q.startsAt?.includes('T') && q.dueAt?.includes('T')
    && Date.parse(q.startsAt) < Date.parse(q.dueAt));
  const pairs: [Quest, Quest][] = [];
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
    const a = timed[i], b = timed[j];
    if (Date.parse(a.startsAt!) < Date.parse(b.dueAt!) && Date.parse(b.startsAt!) < Date.parse(a.dueAt!)) pairs.push([a, b]);
  }
  return pairs;
}
