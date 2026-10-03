export type SphereId =
  | "health"
  | "sport"
  | "growth"
  | "english"
  | "finance"
  | "shared"
  | "driving"
  | "tasks"
  | "hobby";
export type Difficulty = "Micro" | "Simple" | "Medium" | "Hard" | "Very Hard";
export interface Sphere {
  id: SphereId;
  name: string;
  icon: string;
  coefficient: number;
  xp: number;
  score: number;
  previous: number;
  best: number;
}
export interface Quest {
  id: string;
  title: string;
  sphere: SphereId;
  xp: number;
  difficulty: Difficulty;
  completedAt?: string;
}
export interface Goal {
  id: string;
  title: string;
  sphere: SphereId;
  current: number;
  target: number;
  createdAt: string;
  reward: number;
  rewarded: boolean;
}
export interface Event {
  id: string;
  title: string;
  sphere?: SphereId;
  xp: number;
  date: string;
  kind: "action" | "score" | "streak" | "goal";
}
export interface GameState {
  version: 1;
  name: string;
  xp: number;
  coins: number;
  spheres: Sphere[];
  quests: Quest[];
  goals: Goal[];
  events: Event[];
  activityDays: string[];
  streakRewards: string[];
  achievements: string[];
}
export type Page =
  | "home"
  | "goals"
  | "quests"
  | "stats"
  | "profile"
  | "tree"
  | "achievements"
  | "sphere";
