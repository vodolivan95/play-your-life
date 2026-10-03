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
  difficulty: string;
};
export type Goal = {
  id: string;
  name: string;
  sphere: string;
  current: number;
  target: number;
  created: string;
  reward: number;
  rewarded: boolean;
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
};
export const avatars = [
  { icon: '🧑🏻‍🚀', name: 'Космонавт' },
  { icon: '👩🏻‍🚀', name: 'Космонавтка' },
  { icon: '🦊', name: 'Лиса' },
  { icon: '🐼', name: 'Панда' },
  { icon: '🦁', name: 'Лев' },
  { icon: '🦉', name: 'Сова' },
];
export type PlayerProfile = {
  name: string;
  avatar: string;
  mode: 'demo' | 'personal';
  onboardingComplete: boolean;
};
export const defaultProfile: PlayerProfile = {
  name: 'Игрок',
  avatar: avatars[0].icon,
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
export function initialState(): GameState {
  return {
    version: 1,
    profile: { ...defaultProfile },
    mainGoalId: 'b2',
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
      },
      ...state.events,
    ].slice(0, 200),
  };
}
export function completeQuest(state: GameState, id: string): GameState {
  const quest = state.quests.find((q) => q.id === id);
  if (!quest || quest.done) return state;
  let next = award(state, quest.sphere, quest.xp, quest.name);
  next = {
    ...next,
    completed: next.completed + 1,
    coins: next.coins + Math.ceil(quest.xp / 5),
    quests: next.quests.map((q) => (q.id === id ? { ...q, done: true } : q)),
  };
  const today = dateKey();
  if (!next.activeDates.includes(today))
    next.activeDates = [...next.activeDates, today];
  const count = streak(next.activeDates);
  const reward = streakRewards[count];
  const claim = `${today}:${count}`;
  if (reward && !next.streakClaims.includes(claim)) {
    next = award(next, quest.sphere, reward, `Серия ${count} дней`);
    next.streakClaims = [...next.streakClaims, claim];
  }
  return next;
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
  const next = award(state, id, xp, `Life Score: ${sphere.score} → ${score}`);
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
  if (!goal || !Number.isFinite(current)) return state;
  current = Math.max(0, Math.min(goal.target, current));
  const done = current >= goal.target;
  const next =
    done && !goal.rewarded
      ? award(state, goal.sphere, goal.reward, `Цель: ${goal.name}`)
      : { ...state };
  next.goals = next.goals.map((g) =>
    g.id === id ? { ...g, current, rewarded: g.rewarded || done } : g,
  );
  return next;
}
export function loadState(): GameState {
  try {
    const value = JSON.parse(
      localStorage.getItem('play-your-life-v1') || 'null',
    );
    if (
      value?.version === 1 &&
      typeof value.xp === 'number' &&
      Array.isArray(value.quests) &&
      Array.isArray(value.goals) &&
      Array.isArray(value.events) &&
      Array.isArray(value.activeDates) &&
      Array.isArray(value.streakClaims) &&
      spheres.every(
        (s) =>
          value.spheres?.[s.id] &&
          typeof value.spheres[s.id].highScore === 'number',
      )
    )
      return migrateState(value);
  } catch {
    /* Use a playable demo if storage is unavailable. */
  }
  return initialState();
}
export const achievements = [
  {
    name: 'Первый шаг',
    icon: '👟',
    description: 'Выполни свой первый квест',
    unlocked: (s: GameState) => s.completed >= 1,
  },
  {
    name: 'В ритме',
    icon: '🔥',
    description: 'Будь активен 3 дня подряд',
    unlocked: (s: GameState) => streak(s.activeDates) >= 3,
  },
  {
    name: 'На волне',
    icon: '⚡',
    description: 'Выполни 10 квестов',
    unlocked: (s: GameState) => s.completed >= 10,
  },
  {
    name: 'Новый горизонт',
    icon: '🏔️',
    description: 'Заверши большую цель',
    unlocked: (s: GameState) => s.goals.some((g) => g.rewarded),
  },
  {
    name: 'Стратег',
    icon: '♟️',
    description: 'Достигни 12 уровня',
    unlocked: (s: GameState) => playerProgress(s).level >= 12,
  },
  {
    name: 'Личный стандарт',
    icon: '💎',
    description: 'Достигни Life Score 9',
    unlocked: (s: GameState) =>
      Object.values(s.spheres).some((v) => v.score === 9),
  },
];
