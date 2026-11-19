import type { GameState, Goal, GoalStage, Quest } from './game.ts';
import { completeQuest, difficulties } from './game.ts';

/**
 * Загрузка личного плана (проекты → этапы → задачи) из файла `pyl-plan` в текущий аккаунт.
 * Файл собирается из таблицы владельца вне приложения; в публичном коде плана нет.
 * Повторная загрузка не создаёт дублей: проекты, этапы и задачи имеют постоянные id `pi-…`.
 * Задачи с `done: true` закрываются обычным путём `completeQuest` (XP и лайфкоины — как за выполнение).
 */
export type PlanFile = {
  format: 'pyl-plan';
  version: 1;
  title?: string;
  projects: PlanProject[];
};
export type PlanProject = {
  id: string;
  name: string;
  sphere: string;
  description?: string;
  stages?: { id: string; name: string }[];
  tasks: PlanTask[];
};
export type PlanTask = {
  id: string;
  name: string;
  difficulty: keyof typeof difficulties;
  stageId?: string;
  notes?: string;
  dueAt?: string;
  done?: boolean;
};

const ID = /^pi-[a-z0-9-]{1,60}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) ? v : undefined);

export function parsePlanFile(raw: string, sphereIds: string[]): PlanFile {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error('Файл не похож на план: это не JSON.'); }
  if (!isRecord(data) || data.format !== 'pyl-plan' || !Array.isArray(data.projects)) throw new Error('Это не файл плана PLAY YOUR LIFE.');
  const projects: PlanProject[] = [];
  for (const p of data.projects as unknown[]) {
    if (!isRecord(p) || typeof p.id !== 'string' || !ID.test(p.id) || !str(p.name, 100) || typeof p.sphere !== 'string' || !sphereIds.includes(p.sphere) || !Array.isArray(p.tasks)) continue;
    const stages = (Array.isArray(p.stages) ? p.stages : [])
      .filter((s): s is { id: string; name: string } => isRecord(s) && typeof s.id === 'string' && ID.test(s.id) && !!str(s.name, 100))
      .map((s) => ({ id: s.id, name: s.name.trim() }));
    const stageIds = new Set(stages.map((s) => s.id));
    const tasks = (p.tasks as unknown[])
      .filter((t): t is Record<string, unknown> => isRecord(t) && typeof t.id === 'string' && ID.test(t.id) && !!str(t.name, 100) && typeof t.difficulty === 'string' && Object.hasOwn(difficulties, t.difficulty))
      .map<PlanTask>((t) => ({
        id: t.id as string,
        name: (t.name as string).trim(),
        difficulty: t.difficulty as PlanTask['difficulty'],
        ...(typeof t.stageId === 'string' && stageIds.has(t.stageId) ? { stageId: t.stageId } : {}),
        ...(str(t.notes, 2000) ? { notes: str(t.notes, 2000)! } : {}),
        ...(day(t.dueAt) ? { dueAt: day(t.dueAt) } : {}),
        done: t.done === true,
      }));
    if (!tasks.length) continue;
    projects.push({ id: p.id, name: (p.name as string).trim(), sphere: p.sphere, ...(str(p.description, 2000) ? { description: str(p.description, 2000)! } : {}), stages, tasks });
  }
  if (!projects.length) throw new Error('В файле нет проектов для загрузки.');
  return { format: 'pyl-plan', version: 1, title: typeof data.title === 'string' ? data.title : undefined, projects };
}

export type PlanImportResult = { state: GameState; projects: number; tasks: number; completed: number; skipped: number };

/** Добавляет проекты, этапы и задачи плана. Уже загруженные (те же id) пропускаются; существующие данные игрока не меняются. */
export function importPlan(state: GameState, plan: PlanFile, ownerId: string, now = new Date()): PlanImportResult {
  const created = now.toISOString();
  const today = created.slice(0, 10);
  let next = state;
  let projects = 0;
  let tasks = 0;
  let skipped = 0;
  const toComplete: string[] = [];
  for (const p of plan.projects) {
    if (!next.spheres[p.sphere]) continue;
    if (!next.goals.some((g) => g.id === p.id)) {
      const stages: GoalStage[] = (p.stages ?? []).map((s) => ({ id: s.id, name: s.name, status: 'active', completionMode: 'tasks', createdAt: created }));
      const goal: Goal = {
        id: p.id,
        name: p.name,
        sphere: p.sphere,
        current: 0,
        target: 100,
        created: today,
        reward: 200,
        rewarded: false,
        progressMode: 'tasks',
        ...(p.description ? { description: p.description } : {}),
        ...(stages.length ? { stages } : {}),
      };
      next = { ...next, goals: [...next.goals, goal] };
      projects += 1;
    }
    const goal = next.goals.find((g) => g.id === p.id)!;
    const newTasks: Quest[] = [];
    for (const t of p.tasks) {
      if (next.quests.some((q) => q.id === t.id)) { skipped += 1; continue; }
      newTasks.push({
        id: t.id,
        name: t.name,
        sphere: goal.sphere,
        xp: difficulties[t.difficulty],
        difficulty: t.difficulty,
        done: false,
        goalId: goal.id,
        ...(t.stageId && goal.stages?.some((s) => s.id === t.stageId) ? { stageId: t.stageId } : {}),
        ...(t.notes ? { notes: t.notes } : {}),
        ...(t.dueAt && t.dueAt >= today ? { dueAt: t.dueAt } : {}),
        ownerId,
        sourceType: 'USER_CREATED',
        createdAt: created,
        targetValue: 1,
        currentValue: 0,
        rewardCoins: 0,
      });
      if (t.done) toComplete.push(t.id);
    }
    next = { ...next, quests: [...next.quests, ...newTasks] };
    tasks += newTasks.length;
  }
  let completed = 0;
  for (const id of toComplete) {
    const before = next;
    next = completeQuest(next, id);
    if (next !== before && next.quests.find((q) => q.id === id)?.done) completed += 1;
  }
  return { state: next, projects, tasks, completed, skipped };
}
