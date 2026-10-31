import type { GameState, Goal, Quest } from './game.ts';
import {
  activeGoalStage,
  goalProgressValue,
  nextGoalTask,
  stageMetrics,
} from './goalWorkspace.ts';
import { monthlyFocusGoals } from './monthlyFocus.ts';

/**
 * «Следующая вершина» главной: ближайшая достижимая цель игрока.
 * Всё считается по существующим данным (цели, этапы, задачи), собственного хранилища нет.
 */
export type NextPeak = {
  goalId: string;
  goalName: string;
  stageId?: string;
  stageName?: string;
  /** Что нужно сделать: условие этапа или «Заверши этап…». */
  headline: string;
  /** Пояснение: цель и сколько осталось. */
  detail: string;
  /** Выполнено и всего задач (0 / 0, если у этапа нет задач). */
  done: number;
  total: number;
  /** Реальный прогресс этапа или цели, 0–100. */
  percent: number;
  /** Текст счётчика: «3/10», а без задач — процент. */
  counter: string;
  /** Задача, которую открывает «Показать задачу». */
  taskId?: string;
};

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10,
    mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function remainingText(required: Quest[]) {
  const left = required.filter((q) => !q.done).length;
  return left > 0
    ? `осталось ${left} ${plural(left, 'задача', 'задачи', 'задач')}`
    : '';
}

export function goalPeak(state: GameState, goal: Goal, now: Date = new Date()): NextPeak {
  const stage = activeGoalStage(state, goal, now);
  if (stage) {
    const m = stageMetrics(state, goal, stage);
    const task =
      nextGoalTask(state, goal, now)?.stageId === stage.id
        ? nextGoalTask(state, goal, now)
        : m.tasks.find((q) => !q.done && !q.rewardClaimed);
    const left = remainingText(m.required);
    return {
      goalId: goal.id,
      goalName: goal.name,
      stageId: stage.id,
      stageName: stage.name,
      headline: stage.completionCondition?.trim() || `Заверши этап «${stage.name}»`,
      detail: [`Проект «${goal.name}»`, left].filter(Boolean).join(' · '),
      done: m.done,
      total: m.total,
      percent: Math.round(m.progress),
      counter: m.total > 0 ? `${m.done}/${m.total}` : `${Math.round(m.progress)}%`,
      taskId: task?.id ?? nextGoalTask(state, goal, now)?.id,
    };
  }
  const tasks = state.quests.filter((q) => q.goalId === goal.id);
  const done = tasks.filter((q) => q.done).length;
  const percent = Math.round(goalProgressValue(state, goal));
  const required = tasks.filter((q) => q.required !== false);
  const left = remainingText(required);
  return {
    goalId: goal.id,
    goalName: goal.name,
    headline: `Продвинься к проекту «${goal.name}»`,
    detail: left || 'Открой проект и добавь следующий шаг',
    done,
    total: tasks.length,
    percent,
    counter: tasks.length > 0 ? `${done}/${tasks.length}` : `${percent}%`,
    taskId: nextGoalTask(state, goal, now)?.id,
  };
}

/** Следующая вершина или `null`, если нет ни одной незавершённой цели. */
export function nextPeak(state: GameState, now = new Date()): NextPeak | null {
  const focus = new Set(monthlyFocusGoals(state, now).map((g) => g.id));
  const open = state.goals.filter((g) => !g.rewarded);
  if (!open.length) return null;
  return open
    .map((goal) => ({ goal, peak: goalPeak(state, goal, now) }))
    .sort(
      (a, b) =>
        Number(focus.has(b.goal.id)) - Number(focus.has(a.goal.id)) ||
        b.peak.percent - a.peak.percent ||
        (a.goal.dueAt ? Date.parse(a.goal.dueAt) : Infinity) -
          (b.goal.dueAt ? Date.parse(b.goal.dueAt) : Infinity) ||
        a.goal.created.localeCompare(b.goal.created),
    )[0].peak;
}
