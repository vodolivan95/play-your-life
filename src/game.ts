import { validateState } from './stateValidation.ts';
export const spheres = [
  {
    id: 'health',
    name: 'Здоровье',
    icon: '❤️',
    coefficient: 20,
    color: '#ef7188',
    score: 6,
    xp: 640,
  },
  {
    id: 'sport',
    name: 'Спорт',
    icon: '🏃',
    coefficient: 15,
    color: '#fb9c55',
    score: 4,
    xp: 420,
  },
  {
    id: 'growth',
    name: 'Саморазвитие',
    icon: '📚',
    coefficient: 12,
    color: '#9475e9',
    score: 7,
    xp: 780,
  },
  {
    id: 'english',
    name: 'Английский',
    icon: '🌍',
    coefficient: 15,
    color: '#528cf3',
    score: 6,
    xp: 680,
  },
  {
    id: 'finance',
    name: 'Финансы',
    icon: '💰',
    coefficient: 20,
    color: '#36b990',
    score: 5,
    xp: 510,
  },
  {
    id: 'together',
    name: 'Совместные задачи',
    icon: '🤝',
    coefficient: 10,
    color: '#eb8cba',
    score: 5,
    xp: 330,
  },
  {
    id: 'driving',
    name: 'Вождение',
    icon: '🚗',
    coefficient: 8,
    color: '#54b8ce',
    score: 3,
    xp: 180,
  },
  {
    id: 'tasks',
    name: 'Задачи',
    icon: '📝',
    coefficient: 10,
    color: '#778ae6',
    score: 6,
    xp: 550,
  },
  {
    id: 'hobby',
    name: 'Досуг и хобби',
    icon: '🎭',
    coefficient: 8,
    color: '#d29b53',
    score: 7,
    xp: 470,
  },
];
export const difficulties = {
  Micro: 5,
  Simple: 10,
  Medium: 20,
  Hard: 35,
  'Very Hard': 50,
};
export const streakRewards: Record<number, number> = {
  3: 10,
  7: 30,
  14: 50,
  30: 100,
  100: 300,
  365: 1000,
};
export type Quest = {
  id: string;
  name: string;
  sphere: string;
  xp: number;
  done: boolean;
  completedAt?: string;
  difficulty: string;
  goalId?: string;
  stageId?: string;
  startsAt?: string;
  dueAt?: string;
  estimateMinutes?: number;
  notes?: string;
  priority?: 'low' | 'normal' | 'high';
  tickTickSharedAt?: string;
};
export type GoalStage = {
  id: string;
  name: string;
  startsAt?: string;
  dueAt?: string;
};
export type Goal = {
  image?: string;
  id: string;
  name: string;
  sphere: string;
  current: number;
  target: number;
  created: string;
  reward: number;
  rewarded: boolean;
  description?: string;
  startsAt?: string;
  dueAt?: string;
  progressMode?: 'manual' | 'tasks';
  manualProgress?: { current: number; target: number };
  stages?: GoalStage[];
};
export type SphereState = {
  xp: number;
  score: number;
  highScore: number;
  previousScore: number;
};
export type Event = {
  id: string;
  sphere: string;
  title: string;
  xp: number;
  date: string;
  kind?: 'quest' | 'score' | 'goal' | 'streak';
  scoreBefore?: number;
  scoreAfter?: number;
};
export type MonthReflection = {
  highlights: string;
  challenges: string;
  lessons: string;
  nextMonth: string;
  mood: number | null;
  status: 'draft' | 'completed';
  updatedAt: string;
};
export type GameState = {
  version: 1;
  profile: PlayerProfile;
  mainGoalId: string | null;
  xp: number;
  coins: number;
  quests: Quest[];
  goals: Goal[];
  spheres: Record<string, SphereState>;
  events: Event[];
  activeDates: string[];
  streakClaims: string[];
  completed: number;
  hasCompletedGoal?: boolean;
  monthlyTracking?: { since: string; scores: Record<string, number> };
  monthlyReflections?: Record<string, MonthReflection>;
};
export const avatars = [
  { icon: '🧑🏻‍🚀', name: 'Космонавт' },
  { icon: '👩🏻‍🚀', name: 'Космонавтка' },
  { icon: '🦊', name: 'Лиса' },
  { icon: '🐼', name: 'Моё фото' },
  { icon: '🦁', name: 'Лев' },
  { icon: '🦉', name: 'Сова' },
  { icon: 'character', name: 'Мой персонаж' },
];
export type PlayerProfile = {
  name: string;
  avatar: string;
  mode: 'demo' | 'personal';
  onboardingComplete: boolean;
};
export const defaultProfile: PlayerProfile = {
  name: 'Игрок',
  avatar: 'character',
  mode: 'demo',
  onboardingComplete: false,
};
export function playerProgress(state: GameState) {
  const personal = state.profile.mode === 'personal';
  const level = personal
    ? 1 + Math.floor(state.xp / 200)
    : 12 + Math.floor(Math.max(0, state.xp - 2450) / 550);
  const nextXP = personal ? level * 200 : 3000 + (level - 12) * 550;
  const progress = personal ? (state.xp % 200) / 2 : (state.xp / nextXP) * 100;
  const title =
    level < 4
      ? 'Новичок'
      : level < 8
        ? 'Исследователь'
        : level < 12
          ? 'Созидатель'
          : level < 15
            ? 'Стратег'
            : 'Мастер';
  return { level, nextXP, progress, title };
}
export function personalState(
  profile: Pick<PlayerProfile, 'name' | 'avatar'>,
  scores: Record<string, number>,
  goal: Pick<Goal, 'name' | 'sphere' | 'target'>,
): GameState {
  const name = profile.name.trim();
  if (
    !name ||
    name.length > 30 ||
    !avatars.some((a) => a.icon === profile.avatar) ||
    !goal.name.trim() ||
    goal.name.trim().length > 100 ||
    !spheres.some((s) => s.id === goal.sphere) ||
    !Number.isInteger(goal.target) ||
    goal.target < 1 ||
    goal.target > 1000000 ||
    !spheres.every(
      (s) =>
        Number.isInteger(scores[s.id]) &&
        scores[s.id] >= 0 &&
        scores[s.id] <= 9,
    )
  )
    throw new Error('Проверь имя, цель и оценки сфер.');
  const id = crypto.randomUUID();
  return {
    ...initialState(),
    xp: 0,
    coins: 0,
    quests: [],
    monthlyTracking: { since: new Date().toISOString(), scores: { ...scores } },
    profile: { ...profile, name, mode: 'personal', onboardingComplete: true },
    spheres: Object.fromEntries(
      spheres.map((s) => [
        s.id,
        {
          xp: 0,
          score: scores[s.id],
          highScore: scores[s.id],
          previousScore: scores[s.id],
        },
      ]),
    ),
    mainGoalId: id,
    goals: [
      {
        id,
        ...goal,
        name: goal.name.trim(),
        current: 0,
        created: dateKey(),
        reward: 200,
        rewarded: false,
      },
    ],
  };
}
export function migrateState(
  state: Omit<GameState, 'profile' | 'mainGoalId'> &
    Partial<Pick<GameState, 'profile' | 'mainGoalId'>>,
): GameState {
  const profile = state.profile;
  return {
    ...state,
    monthlyTracking: state.monthlyTracking ?? {
      since: new Date().toISOString(),
      scores: Object.fromEntries(
        spheres.map((s) => [s.id, state.spheres[s.id].score]),
      ),
    },
    profile:
      profile &&
      profile.name?.trim() &&
      avatars.some((a) => a.icon === profile.avatar) &&
      (profile.mode === 'demo' || profile.mode === 'personal')
        ? {
            ...profile,
            name: profile.name.trim().slice(0, 30),
            onboardingComplete: profile.onboardingComplete ?? true,
          }
        : { ...defaultProfile, onboardingComplete: true },
    mainGoalId: state.goals.some((g) => g.id === state.mainGoalId)
      ? (state.mainGoalId ?? null)
      : (state.goals.find((g) => !g.rewarded)?.id ?? null),
  };
}
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function streak(dates: string[], now = new Date()) {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!dates.includes(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.includes(dateKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
export function longestStreak(dates: string[], now = new Date()) {
  const days = [...new Set(dates)].filter((day) => day <= dateKey(now)).sort();
  let best = 0,
    count = 0,
    previous = '';
  for (const day of days) {
    const next = new Date(`${previous}T12:00:00`);
    next.setDate(next.getDate() + 1);
    count = previous && dateKey(next) === day ? count + 1 : 1;
    best = Math.max(best, count);
    previous = day;
  }
  return best;
}
export function initialState(): GameState {
  return {
    version: 1,
    profile: { ...defaultProfile },
    mainGoalId: 'b2',
    monthlyTracking: {
      since: new Date().toISOString(),
      scores: Object.fromEntries(spheres.map((s) => [s.id, s.score])),
    },
    monthlyReflections: {},
    xp: 2450,
    coins: 120,
    completed: 0,
    activeDates: [],
    streakClaims: [],
    events: [],
    spheres: Object.fromEntries(
      spheres.map((s) => [
        s.id,
        {
          xp: s.xp,
          score: s.score,
          highScore: s.score,
          previousScore: s.score,
        },
      ]),
    ),
    quests: [
      {
        id: 'english-1',
        name: 'Английский 30 минут',
        sphere: 'english',
        xp: 20,
        difficulty: 'Medium',
        done: false,
      },
      {
        id: 'sport-1',
        name: 'Тренировка',
        sphere: 'sport',
        xp: 35,
        difficulty: 'Hard',
        done: false,
      },
      {
        id: 'growth-1',
        name: 'Прочитать 20 страниц',
        sphere: 'growth',
        xp: 20,
        difficulty: 'Medium',
        done: false,
      },
      {
        id: 'finance-1',
        name: 'Финансовый учёт',
        sphere: 'finance',
        xp: 10,
        difficulty: 'Simple',
        done: false,
      },
    ],
    goals: [
      {
        id: 'b2',
        name: 'Английский — уровень B2',
        sphere: 'english',
        current: 68,
        target: 100,
        created: dateKey(),
        reward: 200,
        rewarded: false,
      },
    ],
  };
}
export function award(
  state: GameState,
  sphere: string,
  xp: number,
  title: string,
  details: Pick<Event, 'kind' | 'scoreBefore' | 'scoreAfter'> = {},
): GameState {
  return {
    ...state,
    xp: state.xp + xp,
    spheres: {
      ...state.spheres,
      [sphere]: { ...state.spheres[sphere], xp: state.spheres[sphere].xp + xp },
    },
    events: [
      {
        id: crypto.randomUUID(),
        sphere,
        xp,
        title,
        date: new Date().toISOString(),
        ...details,
      },
      ...state.events,
    ],
  };
}
export function completeQuest(state: GameState, id: string): GameState {
  const quest = state.quests.find((q) => q.id === id);
  if (!quest || quest.done) return state;
  let next = award(state, quest.sphere, quest.xp, quest.name, {
    kind: 'quest',
  });
  next = {
    ...next,
    completed: next.completed + 1,
    coins: next.coins + Math.ceil(quest.xp / 5),
    quests: next.quests.map((q) =>
      q.id === id
        ? { ...q, done: true, completedAt: new Date().toISOString() }
        : q,
    ),
  };
  const today = dateKey();
  if (!next.activeDates.includes(today))
    next.activeDates = [...next.activeDates, today];
  const count = streak(next.activeDates);
  const reward = streakRewards[count];
  const claim = `${today}:${count}`;
  if (reward && !next.streakClaims.includes(claim)) {
    next = award(next, quest.sphere, reward, `Серия ${count} дней`, {
      kind: 'streak',
    });
    next.streakClaims = [...next.streakClaims, claim];
  }
  if (quest.goalId) next = syncGoalTasks(next, quest.goalId, true);
  return next;
}
export function syncGoalTasks(
  state: GameState,
  goalId: string,
  reward = false,
): GameState {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal || goal.progressMode !== 'tasks') return state;
  const tasks = state.quests.filter((q) => q.goalId === goalId);
  const done = tasks.filter((q) => q.done).length;
  const current = tasks.length ? (done / tasks.length) * 100 : 0;
  let next = {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId ? { ...g, current, target: 100 } : g,
    ),
  };
  if (reward && tasks.length > 0 && done === tasks.length && !goal.rewarded) {
    next = award(next, goal.sphere, goal.reward, `Цель: ${goal.name}`, {
      kind: 'goal',
    });
    next.goals = next.goals.map((g) =>
      g.id === goalId ? { ...g, rewarded: true } : g,
    );
  }
  return next;
}
export function removeQuest(state: GameState, id: string): GameState {
  const quest = state.quests.find((q) => q.id === id);
  if (!quest) return state;
  const next = { ...state, quests: state.quests.filter((q) => q.id !== id) };
  return quest.goalId ? syncGoalTasks(next, quest.goalId) : next;
}
export function changeScore(
  state: GameState,
  id: string,
  score: number,
): GameState {
  if (!Number.isInteger(score) || score < 0 || score > 9) return state;
  const sphere = state.spheres[id];
  if (score === sphere.score) return state;
  const coefficient = spheres.find((s) => s.id === id)!.coefficient;
  const xp = Math.max(0, score - sphere.highScore) * coefficient;
  const next = award(state, id, xp, `Life Score: ${sphere.score} → ${score}`, {
    kind: 'score',
    scoreBefore: sphere.score,
    scoreAfter: score,
  });
  next.spheres[id] = {
    ...next.spheres[id],
    score,
    previousScore: sphere.score,
    highScore: Math.max(score, sphere.highScore),
  };
  return next;
}
export function updateGoal(
  state: GameState,
  id: string,
  current: number,
): GameState {
  const goal = state.goals.find((g) => g.id === id);
  if (!goal || goal.progressMode === 'tasks' || !Number.isFinite(current))
    return state;
  current = Math.max(0, Math.min(goal.target, current));
  const done = current >= goal.target;
  const next =
    done && !goal.rewarded
      ? award(state, goal.sphere, goal.reward, `Цель: ${goal.name}`, {
          kind: 'goal',
        })
      : { ...state };
  next.goals = next.goals.map((g) =>
    g.id === id ? { ...g, current, rewarded: g.rewarded || done } : g,
  );
  return next;
}
let storageProblem = '';
let recoveryRaw = '';
export function getStorageProblem() {
  return storageProblem;
}
export function getRecoveryRaw() {
  return recoveryRaw;
}
export function clearStorageProblem() {
  storageProblem = '';
  recoveryRaw = '';
}
export function loadState(): GameState {
  storageProblem = '';
  recoveryRaw = '';
  try {
    const raw = localStorage.getItem('play-your-life-v1');
    if (!raw) return initialState();
    recoveryRaw = raw;
    const value: unknown = JSON.parse(raw);
    validateState(value);
    recoveryRaw = '';
    return migrateState(value);
  } catch {
    if (recoveryRaw) {
      storageProblem =
        'Сохранённую игру не удалось прочитать. Исходные данные не перезаписаны. Открой профиль, чтобы скачать их или восстановить резервную копию.';
    }
  }
  const fallback = initialState();
  if (storageProblem) fallback.profile.onboardingComplete = true;
  return fallback;
}
export function questsForToday(state: GameState, now = new Date()): Quest[] {
  const today = dateKey(now);
  return state.quests
    .filter((q) => {
      if (q.done) {
        const completedAt =
          q.completedAt ??
          state.events.find(
            (e) =>
              (e.kind === 'quest' || e.kind === undefined) &&
              e.title === q.name &&
              e.sphere === q.sphere,
          )?.date;
        return !!completedAt && dateKey(new Date(completedAt)) === today;
      }
      const start = q.startsAt ?? q.dueAt;
      return !start || dateKey(new Date(start)) <= today;
    })
    .sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      const priority = { high: 0, normal: 1, low: 2 };
      const diff =
        priority[a.priority ?? 'normal'] - priority[b.priority ?? 'normal'];
      if (diff) return diff;
      return (a.dueAt ?? a.startsAt ?? '9999').localeCompare(
        b.dueAt ?? b.startsAt ?? '9999',
      );
    });
}
export const achievements = [
  {
    name: 'Первый шаг',
    icon: '👟',
    description: 'Выполни свой первый квест',
    unlocked: (s: GameState) => s.completed >= 1,
    progress: (s: GameState) => Math.min(1, s.completed),
  },
  {
    name: 'В ритме',
    icon: '🔥',
    description: 'Будь активен 3 дня подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 3,
    progress: (s: GameState) => Math.min(1, longestStreak(s.activeDates) / 3),
  },
  {
    name: 'На волне',
    icon: '⚡',
    description: 'Выполни 10 квестов',
    unlocked: (s: GameState) => s.completed >= 10,
    progress: (s: GameState) => Math.min(1, s.completed / 10),
  },
  {
    progress: (s: GameState) =>
      Math.min(1, Math.max(0, ...s.goals.map((g) => g.current / g.target))),
    name: 'Новый горизонт',
    icon: '🏔️',
    description: 'Заверши большую цель',
    unlocked: (s: GameState) =>
      Boolean(s.hasCompletedGoal) ||
      s.goals.some((g) => g.rewarded) ||
      s.events.some((e) => e.kind === 'goal'),
  },
  {
    name: 'Стратег',
    icon: '♟️',
    description: 'Достигни 12 уровня',
    unlocked: (s: GameState) => playerProgress(s).level >= 12,
    progress: (s: GameState) => Math.min(1, playerProgress(s).level / 12),
  },
  {
    progress: (s: GameState) =>
      Math.min(
        1,
        Math.max(0, ...Object.values(s.spheres).map((sp) => sp.highScore)) / 9,
      ),
    name: 'Личный стандарт',
    icon: '💎',
    description: 'Достигни Life Score 9',
    unlocked: (s: GameState) =>
      Object.values(s.spheres).some((v) => v.highScore === 9),
  },
];
