import type { GameState, Sphere, Difficulty } from "../types";
import { dayKey, previousDay } from "../utils/date";
export const difficultyXP: Record<Difficulty, number> = {
  Micro: 5,
  Simple: 10,
  Medium: 20,
  Hard: 35,
  "Very Hard": 50,
};
export const milestones: Record<number, number> = {
  3: 10,
  7: 30,
  14: 50,
  30: 100,
  100: 300,
  365: 1000,
};
export const achievementDefinitions = [
  {
    id: "first",
    icon: "🌱",
    title: "Первый шаг",
    description: "Выполнить первый квест",
  },
  {
    id: "week",
    icon: "🔥",
    title: "Неделя в игре",
    description: "Поддерживать серию 7 дней",
  },
  {
    id: "thousand",
    icon: "⚡",
    title: "1000 XP",
    description: "Получить 1000 общего XP",
  },
  {
    id: "athlete",
    icon: "🏅",
    title: "Спортсмен",
    description: "Достичь 5 уровня в Спорте",
  },
];
export function demoState(): GameState {
  const today = dayKey();
  const yesterday = previousDay(today);
  const rows: [Sphere["id"], string, string, number, number, number][] = [
    ["health", "Здоровье", "❤️", 20, 400, 6],
    ["sport", "Спорт", "🏃", 15, 620, 7],
    ["growth", "Саморазвитие", "📚", 12, 300, 5],
    ["english", "Английский", "🌍", 15, 480, 6],
    ["finance", "Финансы", "💰", 20, 150, 4],
    ["shared", "Совместные задачи", "🤝", 10, 100, 5],
    ["driving", "Вождение", "🚗", 8, 50, 3],
    ["tasks", "Задачи", "📝", 10, 250, 6],
    ["hobby", "Досуг и хобби", "🎭", 8, 100, 5],
  ];
  return {
    version: 1,
    name: "Игрок",
    xp: 2450,
    coins: 180,
    spheres: rows.map(([id, name, icon, coefficient, xp, score]) => ({
      id,
      name,
      icon,
      coefficient,
      xp,
      score,
      previous: score,
      best: score,
    })),
    quests: [
      {
        id: "q1",
        title: "Английский 30 минут",
        sphere: "english",
        xp: 20,
        difficulty: "Medium",
      },
      {
        id: "q2",
        title: "Тренировка",
        sphere: "sport",
        xp: 35,
        difficulty: "Hard",
      },
      {
        id: "q3",
        title: "Прочитать 20 страниц",
        sphere: "growth",
        xp: 20,
        difficulty: "Medium",
      },
      {
        id: "q4",
        title: "Финансовый учёт",
        sphere: "finance",
        xp: 10,
        difficulty: "Simple",
      },
    ],
    goals: [
      {
        id: "g1",
        title: "Английский — уровень B2",
        sphere: "english",
        current: 68,
        target: 100,
        createdAt: `${today}T12:00:00`,
        reward: 200,
        rewarded: false,
      },
      {
        id: "g2",
        title: "Пробежать 50 километров",
        sphere: "sport",
        current: 21,
        target: 50,
        createdAt: `${today}T12:00:00`,
        reward: 150,
        rewarded: false,
      },
    ],
    events: [],
    activityDays: [yesterday, previousDay(yesterday)],
    streakRewards: [],
    achievements: ["thousand"],
  };
}
