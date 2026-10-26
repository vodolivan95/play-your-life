import type { GameState, Goal, Quest } from './game.ts';
import { goalProgressValue } from './goalWorkspace.ts';
import { addAcquiredSkill } from './skillTree.ts';

export type PracticeStep = { id: string; title: string; done: boolean };
export type SkillPracticeSession = {
  id: string;
  goalId: string;
  sourceTaskId: string;
  skillNodeId: string;
  sphere: string;
  taskName: string;
  subtasks: PracticeStep[];
  createdAt: string;
  completedAt?: string;
};

export type ProjectReviewInput = {
  whatWorked?: string;
  challenge?: string;
  takeaway?: string;
  skillName: string;
  placement: 'continue' | 'branch' | 'new';
  parentNodeId?: string;
  branchName?: string;
};

export function completedPracticeCount(state: Pick<GameState, 'practiceSessions'>, skillNodeId: string) {
  return (state.practiceSessions ?? []).filter(
    (session) => session.skillNodeId === skillNodeId && !!session.completedAt,
  ).length;
}

/** Finish a completed project once, save the reflection and add its acquired skill atomically. */
export function completeProjectReview(
  state: GameState,
  goalId: string,
  input: ProjectReviewInput,
  now = new Date().toISOString(),
): GameState {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) throw new Error('Проект не найден.');
  if (goal.projectReview) throw new Error('Итоги этого проекта уже сохранены.');
  if (goalProgressValue(state, goal) < 100)
    throw new Error('Сначала доведи проект до 100%, затем подведи итоги.');
  const skillName = input.skillName.trim().replace(/\s+/g, ' ');
  if (!skillName) throw new Error('Напиши, какой навык ты приобрёл.');
  if (skillName.length > 40) throw new Error('Название навыка — не длиннее 40 символов.');
  const whatWorked = input.whatWorked?.trim().slice(0, 500) || undefined;
  const challenge = input.challenge?.trim().slice(0, 500) || undefined;
  const takeaway = input.takeaway?.trim().slice(0, 500) || undefined;
  const acquired = addAcquiredSkill(state, goal.sphere, {
    goalId: goal.id,
    name: skillName,
    placement: input.placement,
    parentNodeId: input.parentNodeId,
    branchName: input.branchName,
  });
  return {
    ...acquired.state,
    goals: acquired.state.goals.map((item) =>
      item.id === goalId
        ? {
            ...item,
            projectReview: {
              completedAt: now,
              skillNodeId: acquired.nodeId,
              skillName,
              placement: input.placement,
              ...(whatWorked ? { whatWorked } : {}),
              ...(challenge ? { challenge } : {}),
              ...(takeaway ? { takeaway } : {}),
            },
          }
        : item,
    ),
  };
}

function taskForPractice(state: GameState, goal: Goal, taskId: string): Quest {
  const task = state.quests.find((item) => item.id === taskId && item.goalId === goal.id);
  if (!task) throw new Error('Задача этого проекта не найдена.');
  if (!task.done) throw new Error('Повторять можно уже выполненную задачу проекта.');
  return task;
}

/** A practice run is separate from Quest: it never earns XP/coins or changes project progress. */
export function startPracticeSession(
  state: GameState,
  goalId: string,
  taskId: string,
  now = new Date().toISOString(),
): GameState {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal?.projectReview) throw new Error('Сначала заверши проект и подведи итоги.');
  const task = taskForPractice(state, goal, taskId);
  const sessions = state.practiceSessions ?? [];
  if (sessions.some((session) => session.sourceTaskId === taskId && session.goalId === goalId && !session.completedAt))
    throw new Error('Эта практика уже начата — продолжи её ниже.');
  if (sessions.length >= 500) throw new Error('История практики достигла лимита в 500 повторов.');
  return {
    ...state,
    practiceSessions: [
      ...sessions,
      {
        id: crypto.randomUUID(),
        goalId,
        sourceTaskId: task.id,
        skillNodeId: goal.projectReview.skillNodeId,
        sphere: goal.sphere,
        taskName: task.name,
        subtasks: (task.subtasks ?? []).map((step) => ({
          id: crypto.randomUUID(),
          title: step.title,
          done: false,
        })),
        createdAt: now,
      },
    ],
  };
}

export function togglePracticeStep(
  state: GameState,
  sessionId: string,
  stepId: string,
): GameState {
  const session = state.practiceSessions?.find((item) => item.id === sessionId);
  if (!session) throw new Error('Практика не найдена.');
  if (session.completedAt) throw new Error('Завершённую практику нельзя менять.');
  if (!session.subtasks.some((step) => step.id === stepId)) throw new Error('Шаг практики не найден.');
  return {
    ...state,
    practiceSessions: state.practiceSessions!.map((item) =>
      item.id === sessionId
        ? { ...item, subtasks: item.subtasks.map((step) => step.id === stepId ? { ...step, done: !step.done } : step) }
        : item,
    ),
  };
}

export function completePracticeSession(
  state: GameState,
  sessionId: string,
  now = new Date().toISOString(),
): GameState {
  const session = state.practiceSessions?.find((item) => item.id === sessionId);
  if (!session) throw new Error('Практика не найдена.');
  if (session.completedAt) throw new Error('Эта практика уже завершена.');
  if (session.subtasks.some((step) => !step.done)) throw new Error('Сначала заверши все шаги повтора.');
  return {
    ...state,
    practiceSessions: state.practiceSessions!.map((item) =>
      item.id === sessionId ? { ...item, completedAt: now } : item,
    ),
  };
}
