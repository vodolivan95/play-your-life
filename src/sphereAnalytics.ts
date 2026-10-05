import { sphereProgress } from './sphereProgress.ts';
import { spheres } from "./game.ts";
import type { GameState } from "./game.ts";
export type SphereFilter = "all" | "active" | "working" | "completed";
export type SphereRecommendation = {
  sphereId: string;
  title: string;
  description: string;
  source: "demo" | "ai";
};
export function sphereMetrics(state: GameState) {
  const rows = spheres.map((info) => {
    const projects = state.goals.filter((g) => g.sphere === info.id);
    const tasks = state.quests.filter((q) => q.sphere === info.id);
    const working =
      projects.some((g) => g.current < g.target) || tasks.some((q) => !q.done);
    const completed =
      projects.some((g) => g.current >= g.target) || tasks.some((q) => q.done);
    return {
      ...info,
      ...sphereProgress(state.spheres[info.id].xp),
      projects: projects.length,
      tasks: tasks.length,
      working,
      completed,
      active:
        state.spheres[info.id].xp > 0 ||
        
        projects.length > 0 ||
        tasks.length > 0,
    };
  });
  const active = rows.filter(row => row.active);
  const pool = active.length ? active : rows;
  const average = active.length ? active.reduce((sum, row) => sum + row.level, 0) / active.length : 0;
  const strongest = pool.reduce((best, row) =>
    row.level > best.level ? row : best,
  );
  const weakest = pool.reduce((best, row) =>
    row.level < best.level ? row : best,
  );
  const gap = strongest.level - weakest.level;
  return {
    rows,
    average,
    activeCount: active.length,
    strongest,
    weakest,
    gap,
    deficit: average - weakest.level,
    equal: gap === 0,
  };
}
export function filteredSpheres(state: GameState, filter: SphereFilter) {
  return sphereMetrics(state).rows.filter(
    (row) =>
      filter === "all" || (filter === "working" ? row.working : row[filter]),
  );
}
const ideas: Record<string, string> = {
  health: "Наладить режим сна за месяц",
  sport: "Две тренировки в неделю",
  growth: "Прочитать одну книгу за месяц",
  english: "Практиковать английский 15 минут в день",
  finance: "Вести личный бюджет в течение месяца",
  together: "Запланировать один совместный проект",
  driving: "Две практические поездки в неделю",
  tasks: "Разобрать накопившиеся дела за неделю",
  hobby: "Два полноценных дня отдыха в месяц",
};
export function demoSphereRecommendation(
  sphereId: string,
): SphereRecommendation {
  return {
    sphereId,
    title: ideas[sphereId],
    description:
      "Начни с небольших шагов. Добавь этапы и задачи в проект и выбери удобные сроки.",
    source: "demo",
  };
}

export function sphereCount(value: number, kind: "projects" | "tasks") {
  const words =
    kind === "projects"
      ? ["проект", "проекта", "проектов"]
      : ["задача", "задачи", "задач"];
  const last = value % 10,
    hundred = value % 100;
  return (
    value +
    " " +
    words[
      hundred >= 11 && hundred <= 14
        ? 2
        : last === 1
          ? 0
          : last >= 2 && last <= 4
            ? 1
            : 2
    ]
  );
}
