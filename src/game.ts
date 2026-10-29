import { goalProgressValue, stageMetrics, stageAccess } from './goalWorkspace.ts';
import { SPHERE_PROGRESSION_MODEL, MAX_SPHERE_LEVEL, sphereProgress } from './sphereProgress.ts';
import { repairState, validateState } from './stateValidation.ts';
import { questCoins, recordQuestReward } from './personalQuests.ts';
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
  {
    id: 'psychology',
    name: 'Психология',
    icon: '🧠',
    coefficient: 12,
    color: '#6a4fd6',
    score: 4,
    xp: 260,
  },
];
export const difficulties = {
  Micro: 5,
  Simple: 10,
  Medium: 20,
  Hard: 40,
  'Very Hard': 80,
};
// До 0.29.0: «Сложная» — 35 XP, «Очень сложная» — 50 XP. Такие значения в старых сохранениях допустимы и приводятся к новым при загрузке.
export const legacyDifficultyXp: Record<string, number> = { Hard: 35, 'Very Hard': 50 };
export const streakRewards: Record<number, number> = {
  3: 10,
  7: 30,
  14: 50,
  30: 100,
  100: 300,
  365: 1000,
};
export type TaskLabel = { id: string; name: string };
export type Quest = {
  sourceType?: 'SYSTEM' | 'USER_CREATED';
  ownerId?: string;
  createdAt?: string;
  coverImage?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  rewardCoins?: number;
  virtualRewardId?: string;
  rewardClaimed?: boolean;
  rewardClaimedAt?: string;
  rewardLocked?: boolean;
  id: string;
  name: string;
  sphere: string;
  xp: number;
  done: boolean;
  completedAt?: string;
  difficulty: string;
  goalId?: string;
  stageId?: string;
  required?: boolean;
  weight?: number;
  startsAt?: string;
  dueAt?: string;
  /** Дедлайн игрока: только в игре, не синхронизируется с TickTick. Отдельно от startsAt/dueAt — плановой даты задачи. */
  deadlineAt?: string;
  estimateMinutes?: number;
  notes?: string;
  priority?: 'low' | 'normal' | 'high';
  labelId?: string;
  tickTickSharedAt?: string;
  tickTickSync?: false;
  repeat?: 'daily' | 'weekdays' | 'weekly' | 'monthly';
  subtasks?: { id: string; title: string; done: boolean }[];
};
export type GoalStage = {
  id: string;
  name: string;
  description?: string;
  notes?: string;
  status?: 'active' | 'planned' | 'paused' | 'locked' | 'completed';
  prerequisiteId?: string;
  completionMode?: 'tasks' | 'manual';
  completionCondition?: string;
  createdAt?: string;
  completedAt?: string;
  achievementTitle?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  startsAt?: string;
  dueAt?: string;
};
export type ProjectReview = {
  completedAt: string;
  skillNodeId: string;
  skillName: string;
  placement: 'continue' | 'branch' | 'new';
  whatWorked?: string;
  challenge?: string;
  takeaway?: string;
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
  motivation?: string;
  achievementTitle?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  startsAt?: string;
  dueAt?: string;
  progressMode?: 'manual' | 'tasks';
  manualProgress?: { current: number; target: number };
  stages?: GoalStage[];
  projectReview?: ProjectReview;
};
export type SphereState = {
  xp: number;
  score: number;
  highScore: number;
  previousScore: number;
};
export type Event = {
  sourceId?: string;
  goalId?: string;
  stageId?: string;
  goalProgress?: number;
  stageProgress?: number;
  id: string;
  sphere: string;
  title: string;
  xp: number;
  date: string;
  kind?: 'quest' | 'habit' | 'score' | 'goal' | 'streak' | 'planning';
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
  /** «Мои итоги» (0.35.0): итоги по сферам, планы, благодарность, фокусы. */
  review?: import('./keyResults').MonthReview;
};
export type GameState = {
  habits?: import('./personalQuests').Habit[];
  habitCompletions?: import('./personalQuests').HabitCompletion[];
  coinTransactions?: import('./personalQuests').CoinTransaction[];
  rewardInventory?: import('./personalQuests').RewardItem[];
  rooms?: Partial<Record<import('./roomEngine').RoomId, import('./roomEngine').RoomData>>;
  cityPurchases?: import('./city').CityPurchase[];
  sphereProgressionModel?: typeof SPHERE_PROGRESSION_MODEL;
  skillTrees?: import('./skillTree').SkillTrees;
  /** One-time reset of test skill trees for every account. */
  skillTreeResetVersion?: 1;
  practiceSessions?: import('./skillPractice.ts').SkillPracticeSession[];
  monthlyFocus?: import('./monthlyFocus').MonthlyFocus;
  keySpheres?: import('./lifePlanMap').KeySpheres;
  city?: import('./city').CityState;
  shop?: import('./shop').ShopState;
  version: 1;
  profile: PlayerProfile;
  mainGoalId: string | null;
  xp: number;
  coins: number;
  quests: Quest[];
  taskLabels?: TaskLabel[];
  /** Личный учёт трат и доходов (реальные деньги), вкладка «Финансы»: см. finance.ts. */
  financeTransactions?: import('./finance').FinanceTransaction[];
  financeCategories?: import('./finance').FinanceCategory[];
  financePayments?: import('./finance').PaymentEntry[];
  goals: Goal[];
  spheres: Record<string, SphereState>;
  events: Event[];
  activeDates: string[];
  streakClaims: string[];
  completed: number;
  hasCompletedGoal?: boolean;
  monthlyTracking?: { since: string; scores: Record<string, number> };
  monthlyReflections?: Record<string, MonthReflection>;
  /** Быстрые отметки «как ты сейчас»: дата → настроение и энергия 1–5. */
  /** Важность сфер 1–5, раз в квартал (отчёт месяца). */
  sphereImportance?: import('./monthReport').SphereImportance;
  moodCheckins?: Record<string, { mood: number; energy: number }>;
  /** Только в облачном документе: подписи архивных месяцев (см. cloudSplit.ts). */
  historyIndex?: Record<string, string>;
  /** Только в облачном документе: обложки, вынесенные в отдельные документы. */
  imageRefs?: Record<string, string>;
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
  /** Своё фото: маленький квадратный JPEG (data URL), см. projectImage.ts. */
  photo?: string;
  mode: 'demo' | 'personal';
  onboardingComplete: boolean;
};
export const defaultProfile: PlayerProfile = {
  name: 'Игрок',
  avatar: 'character',
  mode: 'demo',
  onboardingComplete: false,
};
export const MAX_PLAYER_LEVEL = 100;
export function playerProgress(state: GameState) {
  const personal = state.profile.mode === 'personal';
  const earnedLevel = personal
    ? 1 + Math.floor(state.xp / 200)
    : 12 + Math.floor(Math.max(0, state.xp - 2450) / 550);
  const level = Math.min(MAX_PLAYER_LEVEL, earnedLevel);
  const maxed = level === MAX_PLAYER_LEVEL;
  const nextXP = personal ? level * 200 : 3000 + (level - 12) * 550;
  const levelStart = personal ? (level - 1) * 200 : 2450 + (level - 12) * 550;
  const progress = maxed
    ? 100
    : Math.min(100, Math.max(0, ((state.xp - levelStart) / (nextXP - levelStart)) * 100));
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
  return { level, nextXP, progress, title, maxed };
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
  // Старые сохранения не знают о сферах, добавленных позже (например, «Психология», версия 0.53.0):
  // недостающие ключи дополняются чистым состоянием, иначе любое обращение к state.spheres[id] упадёт.
  const filledSpheres: Record<string, SphereState> = { ...state.spheres };
  for (const s of spheres)
    if (!filledSpheres[s.id])
      filledSpheres[s.id] = { xp: 0, score: 0, highScore: 0, previousScore: 0 };
  const resetOldSkillTrees = state.skillTreeResetVersion !== 1;
  return {
    ...state,
    spheres: filledSpheres,
    skillTreeResetVersion: 1,
    skillTrees: resetOldSkillTrees ? {} : (state.skillTrees ?? {}),
    practiceSessions: state.practiceSessions ?? [],
    sphereProgressionModel: SPHERE_PROGRESSION_MODEL,
    quests: state.quests.map((q) => q.sourceType === 'USER_CREATED' && !q.done && Object.hasOwn(difficulties, q.difficulty) && q.xp !== difficulties[q.difficulty as keyof typeof difficulties] ? { ...q, xp: difficulties[q.difficulty as keyof typeof difficulties] } : q),
    goals: state.goals.map(g => g.progressMode === 'tasks' && state.quests.some(q => q.goalId === g.id && q.required !== false) ? { ...g, current: goalProgressValue(state, g), target: 100 } : g),
    monthlyTracking: state.monthlyTracking
      ? {
          ...state.monthlyTracking,
          // Та же причина, что у filledSpheres выше: сфера, добавленная позже,
          // отсутствует и здесь у старых сохранений.
          scores: {
            ...state.monthlyTracking.scores,
            ...Object.fromEntries(
              spheres
                .filter((s) => state.monthlyTracking!.scores[s.id] === undefined)
                .map((s) => [s.id, filledSpheres[s.id].score]),
            ),
          },
        }
      : {
          since: new Date().toISOString(),
          scores: Object.fromEntries(
            spheres.map((s) => [s.id, filledSpheres[s.id].score]),
          ),
        },
    profile:
      profile &&
      profile.name?.trim() &&
      avatars.some((a) => a.icon === profile.avatar) &&
      (profile.mode === 'demo' || profile.mode === 'personal')
        ? {
            ...profile,
            // Не обрезать импортированные имена молча: миграция не должна терять данные.
            name: profile.name.trim(),
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
/** Срок только датой ('YYYY-MM-DD') действует до конца этого дня; со временем — до этого момента. */
export function isOverdue(dueAt: string | undefined, now = new Date()) {
  if (!dueAt) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return dueAt < dateKey(now);
  const time = new Date(dueAt).getTime();
  return Number.isFinite(time) && time < now.getTime();
}
/** У значения есть время суток, а не только дата. */
export function hasClockTime(value: string | undefined) {
  return !!value && !/^\d{4}-\d{2}-\d{2}$/.test(value);
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
    skillTreeResetVersion: 1,
    practiceSessions: [],
    skillTrees: {},
    sphereProgressionModel: SPHERE_PROGRESSION_MODEL,
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
    taskLabels: [],
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
  details: Pick<Event,
    'kind' | 'scoreBefore' | 'scoreAfter' | 'sourceId' | 'goalId' | 'stageId' | 'goalProgress' | 'stageProgress'
  > = {},
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
  const parentGoal = state.goals.find((g) => g.id === quest.goalId);
  const parentStage = parentGoal?.stages?.find((s) => s.id === quest.stageId);
  if (parentGoal && parentStage && (stageAccess(state, parentGoal, parentStage) || parentStage.status === 'paused')) return state;
  if (quest.sourceType === 'USER_CREATED' && quest.startsAt && new Date(quest.startsAt) > new Date()) return state;
  if (quest.rewardClaimed) {
    let next: GameState = {
      ...state,
      quests: state.quests.map((q) => q.id === id
        ? { ...q, done: true, currentValue: q.targetValue ?? 1, completedAt: new Date().toISOString(), rewardLocked: true }
        : q),
    };
    if (quest.goalId) next = syncGoalTasks(next, quest.goalId, true);
    return next;
  }
  const coins = questCoins(quest);
  const xp = quest.sourceType === 'USER_CREATED' ? difficulties[quest.difficulty as keyof typeof difficulties] : quest.xp;
  if (!Number.isFinite(xp) || xp < 0) throw new Error('Некорректная награда XP.');
  let next = award(state, quest.sphere, xp, quest.name, {
    kind: 'quest',
    sourceId: quest.id,
    ...(quest.goalId ? { goalId: quest.goalId } : {}),
    ...(quest.stageId ? { stageId: quest.stageId } : {}),
  });
  next = {
    ...next,
    completed: next.completed + 1,
    coins: next.coins + coins,
    quests: next.quests.map((q) =>
      q.id === id
        ? { ...q, done: true, currentValue: q.targetValue ?? 1, completedAt: new Date().toISOString(), rewardClaimed: true, rewardClaimedAt: new Date().toISOString(), rewardLocked: true }
        : q,
    ),
  };
  next = recordQuestReward(next, quest, coins);
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
  if (quest.goalId) {
    next = syncGoalTasks(next, quest.goalId, true);
    const goal = next.goals.find((g) => g.id === quest.goalId);
    if (goal) {
      next.events = next.events.map((e) => e.kind === 'quest' && e.sourceId === quest.id
        ? {
            ...e,
            goalProgress: goalProgressValue(next, goal),
            ...(parentStage ? { stageProgress: stageMetrics(next, goal, parentStage).progress } : {}),
          }
        : e);
    }
  }
  if (quest.repeat) {
    const day = nextRepeatDay(quest.dueAt?.slice(0, 10) ?? today, quest.repeat, today);
    const copy = Object.fromEntries(Object.entries({
      ...quest,
      id: crypto.randomUUID(),
      done: false,
      completedAt: undefined,
      currentValue: 0,
      rewardClaimed: false,
      rewardClaimedAt: undefined,
      rewardLocked: false,
      tickTickSharedAt: undefined,
      startsAt: undefined,
      dueAt: day,
      // Дедлайн относился к прошлому повтору — для нового переносить не нужно.
      deadlineAt: undefined,
      subtasks: quest.subtasks?.map((t) => ({ ...t, id: crypto.randomUUID(), done: false })),
    }).filter(([, v]) => v !== undefined)) as Quest;
    next = { ...next, quests: [...next.quests, copy] };
    if (quest.goalId) next = syncGoalTasks(next, quest.goalId);
  }
  return next;
}
export function reopenQuest(state: GameState, id: string): GameState {
  const quest = state.quests.find((q) => q.id === id);
  if (!quest?.done) return state;
  const next: GameState = {
    ...state,
    quests: state.quests.map((q) => {
      if (q.id !== id) return q;
      const reopened = {
        ...q,
        done: false,
        currentValue: 0,
        rewardClaimed: true,
        rewardClaimedAt: q.rewardClaimedAt ?? q.completedAt ?? new Date().toISOString(),
        rewardLocked: true,
      };
      delete reopened.completedAt;
      return reopened;
    }),
  };
  return quest.goalId ? syncGoalTasks(next, quest.goalId) : next;
}
export function nextRepeatDay(base: string, repeat: NonNullable<Quest['repeat']>, today: string): string {
  const date = new Date(`${base}T12:00:00`);
  let guard = 0;
  do {
    if (repeat === 'monthly') date.setMonth(date.getMonth() + 1);
    else if (repeat === 'weekly') date.setDate(date.getDate() + 7);
    else {
      date.setDate(date.getDate() + 1);
      if (repeat === 'weekdays') while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
    }
  } while (dateKey(date) <= today && ++guard < 400);
  return dateKey(date);
}
export function syncGoalTasks(
  state: GameState,
  goalId: string,
  reward = false,
): GameState {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return state;
  const tasks = state.quests.filter((q) => q.goalId === goalId);
  const required = tasks.filter((q) => q.required !== false);
  const current = goalProgressValue(state, goal);
  const timestamp = new Date().toISOString();
  const completedStages = (goal.stages ?? []).filter((stage) =>
    stage.status !== 'completed' && stage.completionMode !== 'manual' && stageMetrics(state, goal, stage).complete,
  );
  let next: GameState = {
    ...state,
    goals: state.goals.map((g) => g.id === goalId ? {
      ...g,
      ...(g.progressMode === 'tasks' ? { current, target: 100 } : {}),
      ...(g.stages ? { stages: g.stages.map((stage) => completedStages.some((s) => s.id === stage.id)
        ? { ...stage, status: 'completed' as const, completedAt: stage.completedAt ?? timestamp } : stage.status === 'completed' && stage.completionMode !== 'manual' && !stageMetrics(state, goal, stage).complete ? (() => { const { completedAt, ...rest } = stage; void completedAt; return { ...rest, status: 'planned' as const }; })() : stage) } : {}),
    } : g),
  };
  if (reward) {
    for (const stage of completedStages) next.events = [{
      id: crypto.randomUUID(), sphere: goal.sphere, title: `Завершён этап: ${stage.name}`,
      xp: 0, date: timestamp, kind: 'planning', goalId, stageId: stage.id, goalProgress: current,
    }, ...next.events];
    // Награда — только когда цель реально на 100% (goalProgressValue), а не просто
    // когда выполнены все задачи: с этапами 100% требует завершения и их тоже —
    // иначе цель засчитывалась бы готовой из-за одной выполненной задачи, даже
    // если в ней остались незавершённые (в т.ч. пустые, для планирования) этапы.
    if (goal.progressMode === 'tasks' && required.length > 0 && current === 100 && !goal.rewarded) {
      next = award(next, goal.sphere, goal.reward, `Цель: ${goal.name}`, {
        kind: 'goal', sourceId: goal.id, goalId, goalProgress: 100,
      });
      next.goals = next.goals.map((g) => g.id === goalId ? { ...g, rewarded: true } : g);
    }
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
  if (current === goal.current) return state;
  const done = current >= goal.target;
  const next =
    done && !goal.rewarded
      ? award(state, goal.sphere, goal.reward, `Цель: ${goal.name}`, {
          kind: 'goal', sourceId: goal.id, goalId: goal.id, goalProgress: 100,
        })
      : { ...state };
  next.goals = next.goals.map((g) =>
    g.id === id ? { ...g, current, rewarded: g.rewarded || done } : g,
  );
  if (!(done && !goal.rewarded)) next.events = [{ id: crypto.randomUUID(), sphere: goal.sphere, title: `Изменён результат цели: ${current} / ${goal.target}`, xp: 0, date: new Date().toISOString(), kind: 'planning', goalId: goal.id, goalProgress: current / goal.target * 100 }, ...next.events];
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
    repairState(value);
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
        const questEvent = (e: Event) => e.kind === 'quest' || e.kind === undefined;
        const completedAt =
          q.completedAt ??
          (state.events.find((e) => questEvent(e) && e.sourceId === q.id) ??
            // Старые сохранения без sourceId: поиск по названию.
            state.events.find(
              (e) =>
                questEvent(e) &&
                e.sourceId === undefined &&
                e.title === q.name &&
                e.sphere === q.sphere,
            ))?.date;
        return !!completedAt && dateKey(new Date(completedAt)) === today;
      }
      // Срок задачи (`dueAt`) — то, что реально определяет «пора сегодня/просрочено»:
      // так же эта дата показывается в карточке задачи (QuestRow). Раньше здесь
      // проверялся `startsAt` в приоритете: задача с ранним началом интервала
      // («с … до …») и далёким сроком показывалась на главной каждый день от
      // начала интервала до самого срока, а не только в день срока.
      const due = q.dueAt ?? q.startsAt;
      return !due || dateKey(new Date(due)) <= today;
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
/**
 * Достижение, уже полученное в прежних версиях действием «Life Score → 9», сохраняется.
 * Самооценка 9 при первом запуске (без такого события) достижение не открывает.
 */
function earnedPersonalStandard(s: GameState) {
  return s.events.some((e) => e.kind === 'score' && e.scoreAfter === 9);
}
/** Достижения (0.50.0): вспомогательные функции читают реальное состояние игры, ничего не придумывают. */
function p(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
function habitsOf(s: GameState) {
  return s.habits ?? [];
}
function bestHabitStreak(s: GameState) {
  return Math.max(0, ...habitsOf(s).map((h) => h.bestStreak));
}
function reflectionsOf(s: GameState) {
  return Object.values(s.monthlyReflections ?? {});
}
function sameDayDeadlines(s: GameState) {
  return s.quests.filter(
    (q) => q.done && q.completedAt && q.dueAt && q.completedAt.slice(0, 10) === q.dueAt.slice(0, 10),
  ).length;
}
function cityTier(s: GameState, sphereId: string) {
  return s.city?.buildings?.[sphereId]?.tier ?? 1;
}
function cityOwned(s: GameState, sphereId: string) {
  return s.city?.buildings?.[sphereId]?.owned ?? [];
}
function skillNodesOf(s: GameState, sphereId: string) {
  return s.skillTrees?.[sphereId]?.nodes ?? [];
}
function skillBranchesOf(s: GameState, sphereId: string) {
  return s.skillTrees?.[sphereId]?.branches ?? [];
}
function totalLearnedNodesOf(s: GameState, sphereId: string) {
  return skillNodesOf(s, sphereId).filter((n) => n.level > 0).length;
}
function totalLearnedNodes(s: GameState) {
  return spheres.reduce((sum, sp) => sum + totalLearnedNodesOf(s, sp.id), 0);
}
function completedStages(s: GameState) {
  return s.goals.reduce((sum, g) => sum + (g.stages ?? []).filter((st) => st.status === 'completed').length, 0);
}
function longestOpenGoalDays(s: GameState) {
  const now = Date.now();
  return Math.max(
    0,
    ...s.goals
      .filter((g) => !g.rewarded)
      .map((g) => {
        const created = Date.parse(g.created);
        return Number.isFinite(created) ? (now - created) / 86400000 : 0;
      }),
  );
}
function totalCoinsEarned(s: GameState) {
  return (s.coinTransactions ?? []).reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
}
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'special';
export type Achievement = {
  category: string;
  tier: AchievementTier;
  name: string;
  icon: string;
  description: string;
  unlocked: (s: GameState) => boolean;
  progress: (s: GameState) => number;
  insight?: string;
};
const baseAchievements: Achievement[] = [
  // ---- Первые шаги ----
  {
    category: 'Первые шаги',
    tier: 'bronze',
    name: 'Первый шаг',
    icon: '👟',
    description: 'Выполни свою первую задачу',
    unlocked: (s: GameState) => s.completed >= 1,
    progress: (s: GameState) => p(s.completed / 1),
  },
  {
    category: 'Первые шаги',
    tier: 'bronze',
    name: 'Добро пожаловать',
    icon: '🎉',
    description: 'Заверши настройку профиля',
    unlocked: (s: GameState) => Boolean(s.profile.onboardingComplete),
    progress: (s: GameState) => (s.profile.onboardingComplete ? 1 : 0),
  },
  {
    category: 'Первые шаги',
    tier: 'bronze',
    name: 'Первое вложение в город',
    icon: '🏙️',
    description: 'Купи первое улучшение в «Городе»',
    unlocked: (s: GameState) => (s.cityPurchases ?? []).length >= 1,
    progress: (s: GameState) => p((s.cityPurchases ?? []).length / 1),
  },
  {
    category: 'Первые шаги',
    tier: 'bronze',
    name: 'Новый жилец',
    icon: '🔥',
    description: 'Заведи свою первую привычку',
    unlocked: (s: GameState) => habitsOf(s).length >= 1,
    progress: (s: GameState) => p(habitsOf(s).length / 1),
  },
  {
    category: 'Первые шаги',
    tier: 'bronze',
    name: 'Цифровой след',
    icon: '🔑',
    description: 'Поделись задачей с TickTick',
    unlocked: (s: GameState) => s.quests.some((q) => Boolean(q.tickTickSharedAt)),
    progress: (s: GameState) => (s.quests.some((q) => Boolean(q.tickTickSharedAt)) ? 1 : 0),
  },

  // ---- Задачи ----
  {
    category: 'Задачи',
    tier: 'silver',
    name: 'На волне',
    icon: '⚡',
    description: 'Выполни 10 задач',
    unlocked: (s: GameState) => s.completed >= 10,
    progress: (s: GameState) => p(s.completed / 10),
  },
  {
    category: 'Задачи',
    tier: 'gold',
    name: 'Трудяга',
    icon: '💪',
    description: 'Выполни 50 задач',
    unlocked: (s: GameState) => s.completed >= 50,
    progress: (s: GameState) => p(s.completed / 50),
  },
  {
    category: 'Задачи',
    tier: 'gold',
    name: 'Марафонец задач',
    icon: '🏃‍♂️',
    description: 'Выполни 100 задач',
    unlocked: (s: GameState) => s.completed >= 100,
    progress: (s: GameState) => p(s.completed / 100),
  },
  {
    category: 'Задачи',
    tier: 'platinum',
    name: 'Легенда списка',
    icon: '📜',
    description: 'Выполни 250 задач',
    unlocked: (s: GameState) => s.completed >= 250,
    progress: (s: GameState) => p(s.completed / 250),
  },
  {
    category: 'Задачи',
    tier: 'special',
    name: 'Тысяча шагов',
    icon: '🗿',
    description: 'Выполни 1000 задач',
    unlocked: (s: GameState) => s.completed >= 1000,
    progress: (s: GameState) => p(s.completed / 1000),
  },
  {
    category: 'Задачи',
    tier: 'gold',
    name: 'Разбор завалов',
    icon: '📥',
    description: 'Поделись с TickTick 20 задачами',
    unlocked: (s: GameState) => s.quests.filter((q) => Boolean(q.tickTickSharedAt)).length >= 20,
    progress: (s: GameState) => p(s.quests.filter((q) => Boolean(q.tickTickSharedAt)).length / 20),
  },
  {
    category: 'Задачи',
    tier: 'bronze',
    name: 'Дедлайн под контролем',
    icon: '⏰',
    description: 'Поставь отдельный дедлайн у задачи',
    unlocked: (s: GameState) => s.quests.some((q) => Boolean(q.deadlineAt)),
    progress: (s: GameState) => (s.quests.some((q) => Boolean(q.deadlineAt)) ? 1 : 0),
  },
  {
    category: 'Задачи',
    tier: 'silver',
    name: 'В последний момент',
    icon: '🏁',
    description: 'Заверши 10 задач точно в день дедлайна',
    unlocked: (s: GameState) => sameDayDeadlines(s) >= 10,
    progress: (s: GameState) => p(sameDayDeadlines(s) / 10),
  },
  {
    category: 'Задачи',
    tier: 'gold',
    name: 'Без хвостов',
    icon: '🧹',
    description: 'Не допусти ни одной просроченной задачи',
    unlocked: (s: GameState) =>
      s.quests.some((q) => !q.done) &&
      s.quests.filter((q) => !q.done).every((q) => !isOverdue(q.dueAt)),
    progress: (s: GameState) =>
      s.quests.some((q) => !q.done) &&
      s.quests.filter((q) => !q.done).every((q) => !isOverdue(q.dueAt))
        ? 1
        : 0,
  },

  // ---- Привычки ----
  {
    category: 'Привычки',
    tier: 'bronze',
    name: 'Первые три дня',
    icon: '🔥',
    description: 'Держи привычку 3 дня подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 3,
    progress: (s: GameState) => p(bestHabitStreak(s) / 3),
  },
  {
    category: 'Привычки',
    tier: 'bronze',
    name: 'Неделя силы воли',
    icon: '🔥',
    description: 'Держи привычку 7 дней подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 7,
    progress: (s: GameState) => p(bestHabitStreak(s) / 7),
  },
  {
    category: 'Привычки',
    tier: 'silver',
    name: 'Критическая точка',
    icon: '🔥',
    description: 'Держи привычку 14 дней подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 14,
    progress: (s: GameState) => p(bestHabitStreak(s) / 14),
  },
  {
    category: 'Привычки',
    tier: 'gold',
    name: 'Привычка на 21 день',
    icon: '🔥',
    description: 'Держи привычку 21 день подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 21,
    progress: (s: GameState) => p(bestHabitStreak(s) / 21),
    insight:
      'первая веха правила «21–60–90»: 21 день нужен, чтобы привычка вообще прижилась и перестала требовать каждый раз уговаривать себя',
  },
  {
    category: 'Привычки',
    tier: 'gold',
    name: 'Месяц стойкости',
    icon: '🔥',
    description: 'Держи привычку 30 дней подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 30,
    progress: (s: GameState) => p(bestHabitStreak(s) / 30),
  },
  {
    category: 'Привычки',
    tier: 'gold',
    name: 'Автоматизм',
    icon: '🔥',
    description: 'Держи привычку 60 дней подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 60,
    progress: (s: GameState) => p(bestHabitStreak(s) / 60),
    insight:
      'вторая веха «21–60–90»: 60 дней — и привычка начинает получаться легче, срывы реже выбивают из колеи',
  },
  {
    category: 'Привычки',
    tier: 'platinum',
    name: 'Второе дыхание',
    icon: '🔥',
    description: 'Держи привычку 90 дней подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 90,
    progress: (s: GameState) => p(bestHabitStreak(s) / 90),
    insight:
      'финальная веха «21–60–90»: три месяца — и привычка уже не то, что ты делаешь, а то, какой ты человек',
  },
  {
    category: 'Привычки',
    tier: 'platinum',
    name: 'Полгода стабильности',
    icon: '🔥',
    description: 'Держи привычку 180 дней подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 180,
    progress: (s: GameState) => p(bestHabitStreak(s) / 180),
  },
  {
    category: 'Привычки',
    tier: 'special',
    name: 'Год дисциплины',
    icon: '🔥',
    description: 'Держи привычку 365 дней подряд',
    unlocked: (s: GameState) => bestHabitStreak(s) >= 365,
    progress: (s: GameState) => p(bestHabitStreak(s) / 365),
  },
  {
    category: 'Привычки',
    tier: 'silver',
    name: 'Коллекционер привычек',
    icon: '🗂️',
    description: 'Веди 5 активных привычек одновременно',
    unlocked: (s: GameState) => habitsOf(s).filter((h) => h.isActive).length >= 5,
    progress: (s: GameState) => p(habitsOf(s).filter((h) => h.isActive).length / 5),
  },
  {
    category: 'Привычки',
    tier: 'gold',
    name: 'Без срывов',
    icon: '🛡️',
    description: 'Доведи все активные привычки до серии от 30 дней',
    unlocked: (s: GameState) => {
      const active = habitsOf(s).filter((h) => h.isActive);
      return active.length >= 1 && active.every((h) => h.currentStreak >= 30);
    },
    progress: (s: GameState) => {
      const active = habitsOf(s).filter((h) => h.isActive);
      if (!active.length) return 0;
      return p(Math.min(...active.map((h) => h.currentStreak)) / 30);
    },
  },
  {
    category: 'Привычки',
    tier: 'silver',
    name: 'Двойная серия',
    icon: '🔥',
    description: 'Держи 2 привычки одновременно с серией от 21 дня',
    unlocked: (s: GameState) => habitsOf(s).filter((h) => h.currentStreak >= 21).length >= 2,
    progress: (s: GameState) => p(habitsOf(s).filter((h) => h.currentStreak >= 21).length / 2),
  },
  {
    category: 'Привычки',
    tier: 'special',
    name: 'Привычка-чемпион',
    icon: '🏆',
    description: 'Доведи одну привычку до 1000 выполнений',
    unlocked: (s: GameState) => habitsOf(s).some((h) => h.totalCompletions >= 1000),
    progress: (s: GameState) =>
      p(Math.max(0, ...habitsOf(s).map((h) => h.totalCompletions)) / 1000),
  },

  // ---- Психология ----
  {
    category: 'Психология',
    tier: 'bronze',
    name: 'Если — то',
    icon: '🧭',
    description: 'Заполни план «если — то» в «Моих итогах»',
    unlocked: (s: GameState) =>
      reflectionsOf(s).some((r) =>
        Object.values(r.review?.spheres ?? {}).some((sr) => Boolean(sr.ifThen?.trim())),
      ),
    progress: (s: GameState) =>
      reflectionsOf(s).some((r) =>
        Object.values(r.review?.spheres ?? {}).some((sr) => Boolean(sr.ifThen?.trim())),
      )
        ? 1
        : 0,
    insight:
      'конкретный план на случай препятствия (implementation intention) заметно повышает шанс довести начатое до конца',
  },
  {
    category: 'Психология',
    tier: 'bronze',
    name: 'Дневник благодарности',
    icon: '📔',
    description: 'Заполни все три пункта благодарности за месяц',
    unlocked: (s: GameState) =>
      reflectionsOf(s).some((r) => (r.review?.gratitude ?? []).filter((g) => g.trim()).length >= 3),
    progress: (s: GameState) =>
      p(
        Math.max(
          0,
          ...reflectionsOf(s).map((r) => (r.review?.gratitude ?? []).filter((g) => g.trim()).length),
        ) / 3,
      ),
    insight: 'регулярная фиксация благодарности связана с более высоким уровнем мотивации и удовлетворённости',
  },
  {
    category: 'Психология',
    tier: 'silver',
    name: 'Три фокуса',
    icon: '🎯',
    description: 'Выбери три главных фокуса месяца в «Моих итогах»',
    unlocked: (s: GameState) => reflectionsOf(s).some((r) => (r.review?.focuses ?? []).length >= 3),
    progress: (s: GameState) =>
      p(Math.max(0, ...reflectionsOf(s).map((r) => (r.review?.focuses ?? []).length)) / 3),
    insight: 'когда приоритетов мало, меньше усталости от принятия решений и больше энергии доходит до важного',
  },
  {
    category: 'Психология',
    tier: 'gold',
    name: 'Закрытый гештальт',
    icon: '✅',
    description: 'Отметь план прошлого месяца как выполненный',
    unlocked: (s: GameState) =>
      reflectionsOf(s).some((r) => Object.values(r.review?.plans ?? {}).includes('done')),
    progress: (s: GameState) =>
      reflectionsOf(s).some((r) => Object.values(r.review?.plans ?? {}).includes('done')) ? 1 : 0,
    insight: 'незавершённые дела отвлекают внимание сильнее завершённых — закрыть их полезно даже с опозданием',
  },
  {
    category: 'Психология',
    tier: 'silver',
    name: 'Отскок',
    icon: '🪃',
    description: 'Продолжи привычку после того, как серия уже прерывалась',
    unlocked: (s: GameState) =>
      habitsOf(s).some((h) => h.isActive && h.bestStreak > h.currentStreak && h.currentStreak >= 3),
    progress: (s: GameState) =>
      habitsOf(s).some((h) => h.isActive && h.bestStreak > h.currentStreak && h.currentStreak >= 3)
        ? 1
        : 0,
    insight: 'доброе отношение к себе после срыва предсказывает лучшее возвращение к привычке, чем чувство вины',
  },

  // ---- Цели ----
  {
    category: 'Цели',
    tier: 'gold',
    name: 'Новый горизонт',
    icon: '🏔️',
    description: 'Заверши большую цель',
    unlocked: (s: GameState) =>
      Boolean(s.hasCompletedGoal) || s.goals.some((g) => g.rewarded) || s.events.some((e) => e.kind === 'goal'),
    progress: (s: GameState) =>
      p(Math.max(0, ...s.goals.map((g) => (g.target ? g.current / g.target : 0)))),
  },
  {
    category: 'Цели',
    tier: 'silver',
    name: 'Стратег',
    icon: '♟️',
    description: 'Достигни 12 уровня',
    unlocked: (s: GameState) => playerProgress(s).level >= 12,
    progress: (s: GameState) => p(playerProgress(s).level / 12),
  },
  {
    category: 'Цели',
    tier: 'bronze',
    name: 'Вторая цель',
    icon: '🚩',
    description: 'Заведи вторую цель',
    unlocked: (s: GameState) => s.goals.length >= 2,
    progress: (s: GameState) => p(s.goals.length / 2),
  },
  {
    category: 'Цели',
    tier: 'gold',
    name: 'Целеустремлённый',
    icon: '🎯',
    description: 'Заверши 5 целей',
    unlocked: (s: GameState) => s.goals.filter((g) => g.rewarded).length >= 5,
    progress: (s: GameState) => p(s.goals.filter((g) => g.rewarded).length / 5),
  },
  {
    category: 'Цели',
    tier: 'platinum',
    name: 'Архитектор жизни',
    icon: '🏛️',
    description: 'Заверши 10 целей',
    unlocked: (s: GameState) => s.goals.filter((g) => g.rewarded).length >= 10,
    progress: (s: GameState) => p(s.goals.filter((g) => g.rewarded).length / 10),
  },
  {
    category: 'Цели',
    tier: 'bronze',
    name: 'Первый этап',
    icon: '🪜',
    description: 'Заверши первый этап цели',
    unlocked: (s: GameState) => completedStages(s) >= 1,
    progress: (s: GameState) => p(completedStages(s) / 1),
  },
  {
    category: 'Цели',
    tier: 'silver',
    name: 'Этап за этапом',
    icon: '🪜',
    description: 'Заверши 20 этапов целей',
    unlocked: (s: GameState) => completedStages(s) >= 20,
    progress: (s: GameState) => p(completedStages(s) / 20),
  },
  {
    category: 'Цели',
    tier: 'silver',
    name: 'Большая пятёрка',
    icon: '🗂️',
    description: 'Веди 5 целей одновременно',
    unlocked: (s: GameState) => s.goals.filter((g) => !g.rewarded).length >= 5,
    progress: (s: GameState) => p(s.goals.filter((g) => !g.rewarded).length / 5),
  },
  {
    category: 'Цели',
    tier: 'silver',
    name: 'Долгая игра',
    icon: '⏳',
    description: 'Веди одну цель дольше 6 месяцев',
    unlocked: (s: GameState) => longestOpenGoalDays(s) >= 180,
    progress: (s: GameState) => p(longestOpenGoalDays(s) / 180),
  },

  // ---- Сферы жизни ----
  {
    category: 'Сферы жизни',
    tier: 'platinum',
    name: 'Личный стандарт',
    icon: '💎',
    description: `Достигни ${MAX_SPHERE_LEVEL} уровня сферы`,
    unlocked: (s: GameState) =>
      earnedPersonalStandard(s) || Object.values(s.spheres).some((v) => sphereProgress(v.xp).maxed),
    progress: (s: GameState) =>
      earnedPersonalStandard(s)
        ? 1
        : p(Math.max(0, ...Object.values(s.spheres).map((sp) => sphereProgress(sp.xp).level)) / MAX_SPHERE_LEVEL),
  },
  {
    category: 'Сферы жизни',
    tier: 'gold',
    name: 'Баланс',
    icon: '⚖️',
    description: 'Прокачай все сферы хотя бы до 10 уровня',
    unlocked: (s: GameState) => Object.values(s.spheres).every((sp) => sphereProgress(sp.xp).level >= 10),
    progress: (s: GameState) =>
      p(Math.min(...Object.values(s.spheres).map((sp) => sphereProgress(sp.xp).level)) / 10),
  },
  {
    category: 'Сферы жизни',
    tier: 'gold',
    name: 'Специалист',
    icon: '🥇',
    description: 'Достигни 50 уровня в одной сфере',
    unlocked: (s: GameState) => Object.values(s.spheres).some((sp) => sphereProgress(sp.xp).level >= 50),
    progress: (s: GameState) =>
      p(Math.max(0, ...Object.values(s.spheres).map((sp) => sphereProgress(sp.xp).level)) / 50),
  },
  {
    category: 'Сферы жизни',
    tier: 'platinum',
    name: 'Мастер сферы',
    icon: '👑',
    description: `Достигни ${MAX_SPHERE_LEVEL} уровня в трёх сферах`,
    unlocked: (s: GameState) =>
      Object.values(s.spheres).filter((sp) => sphereProgress(sp.xp).level >= MAX_SPHERE_LEVEL).length >= 3,
    progress: (s: GameState) =>
      p(
        Object.values(s.spheres).filter((sp) => sphereProgress(sp.xp).level >= MAX_SPHERE_LEVEL).length / 3,
      ),
  },
  {
    category: 'Сферы жизни',
    tier: 'bronze',
    name: 'Полный круг',
    icon: '🌐',
    description: 'Получи хотя бы 1 уровень в каждой сфере',
    unlocked: (s: GameState) => Object.values(s.spheres).every((sp) => sphereProgress(sp.xp).level >= 1),
    progress: (s: GameState) =>
      p(Math.min(...Object.values(s.spheres).map((sp) => sphereProgress(sp.xp).level)) / 1),
  },
  {
    category: 'Сферы жизни',
    tier: 'platinum',
    name: 'Пять сотен',
    icon: '⭐',
    description: 'Набери суммарно 500 уровней по всем сферам',
    unlocked: (s: GameState) =>
      Object.values(s.spheres).reduce((sum, sp) => sum + sphereProgress(sp.xp).level, 0) >= 500,
    progress: (s: GameState) =>
      p(Object.values(s.spheres).reduce((sum, sp) => sum + sphereProgress(sp.xp).level, 0) / 500),
  },

  // ---- Город ----
  {
    category: 'Город',
    tier: 'bronze',
    name: 'Новосёл',
    icon: '🏘️',
    description: 'Купи первое улучшение здания в «Городе»',
    unlocked: (s: GameState) => (s.cityPurchases ?? []).length >= 1,
    progress: (s: GameState) => p((s.cityPurchases ?? []).length / 1),
  },
  {
    category: 'Город',
    tier: 'silver',
    name: 'Мэр',
    icon: '👔',
    description: 'Прокачай любое здание до максимума',
    unlocked: (s: GameState) => spheres.some((sp) => cityTier(s, sp.id) >= 3),
    progress: (s: GameState) => p(Math.max(0, ...spheres.map((sp) => cityTier(s, sp.id))) / 3),
  },
  {
    category: 'Город',
    tier: 'gold',
    name: 'Градостроитель',
    icon: '🏗️',
    description: 'Прокачай все здания минимум до 2 уровня',
    unlocked: (s: GameState) => spheres.every((sp) => cityTier(s, sp.id) >= 2),
    progress: (s: GameState) => p(Math.min(...spheres.map((sp) => cityTier(s, sp.id))) / 2),
  },
  {
    category: 'Город',
    tier: 'platinum',
    name: 'Мегаполис',
    icon: '🌆',
    description: 'Прокачай все здания до максимума',
    unlocked: (s: GameState) => spheres.every((sp) => cityTier(s, sp.id) >= 3),
    progress: (s: GameState) => p(Math.min(...spheres.map((sp) => cityTier(s, sp.id))) / 3),
  },
  {
    category: 'Город',
    tier: 'gold',
    name: 'Архитектор',
    icon: '🏛️',
    description: 'Укрась окружение каждого здания хотя бы одним предметом',
    unlocked: (s: GameState) => spheres.every((sp) => cityOwned(s, sp.id).length >= 1),
    progress: (s: GameState) => p(Math.min(...spheres.map((sp) => cityOwned(s, sp.id).length)) / 1),
  },
  {
    category: 'Город',
    tier: 'silver',
    name: 'Коллекционер декора',
    icon: '🌴',
    description: 'Купи 10 предметов окружения для города',
    unlocked: (s: GameState) => spheres.reduce((sum, sp) => sum + cityOwned(s, sp.id).length, 0) >= 10,
    progress: (s: GameState) =>
      p(spheres.reduce((sum, sp) => sum + cityOwned(s, sp.id).length, 0) / 10),
  },

  // ---- Дерево навыков ----
  {
    category: 'Дерево навыков',
    tier: 'bronze',
    name: 'Первая ветка',
    icon: '🌱',
    description: 'Открой первый навык в дереве',
    unlocked: (s: GameState) => totalLearnedNodes(s) >= 1,
    progress: (s: GameState) => p(totalLearnedNodes(s) / 1),
  },
  {
    category: 'Дерево навыков',
    tier: 'silver',
    name: 'Разветвление',
    icon: '🌿',
    description: 'Добавь боковую ветвь в дереве навыков',
    unlocked: (s: GameState) => spheres.some((sp) => skillBranchesOf(s, sp.id).length >= 2),
    progress: (s: GameState) => (spheres.some((sp) => skillBranchesOf(s, sp.id).length >= 2) ? 1 : 0),
  },
  {
    category: 'Дерево навыков',
    tier: 'gold',
    name: 'Крона знаний',
    icon: '🌳',
    description: 'Открой 25 навыков суммарно',
    unlocked: (s: GameState) => totalLearnedNodes(s) >= 25,
    progress: (s: GameState) => p(totalLearnedNodes(s) / 25),
  },
  {
    category: 'Дерево навыков',
    tier: 'platinum',
    name: 'Древо мудрости',
    icon: '🦉',
    description: 'Доведи все навыки одной сферы до максимума',
    unlocked: (s: GameState) =>
      spheres.some((sp) => {
        const nodes = skillNodesOf(s, sp.id);
        return nodes.length > 0 && nodes.every((n) => n.level >= n.levels);
      }),
    progress: (s: GameState) =>
      spheres.some((sp) => {
        const nodes = skillNodesOf(s, sp.id);
        return nodes.length > 0 && nodes.every((n) => n.level >= n.levels);
      })
        ? 1
        : 0,
  },
  {
    category: 'Дерево навыков',
    tier: 'gold',
    name: 'Специализация',
    icon: '🔬',
    description: 'Доведи один навык до максимального уровня',
    unlocked: (s: GameState) => spheres.some((sp) => skillNodesOf(s, sp.id).some((n) => n.level >= n.levels && n.levels > 0)),
    progress: (s: GameState) =>
      spheres.some((sp) => skillNodesOf(s, sp.id).some((n) => n.level >= n.levels && n.levels > 0)) ? 1 : 0,
  },
  {
    category: 'Дерево навыков',
    tier: 'platinum',
    name: 'Мастер веток',
    icon: '🌲',
    description: 'Создай 4 ветки навыков суммарно по всем сферам',
    unlocked: (s: GameState) => spheres.reduce((sum, sp) => sum + skillBranchesOf(s, sp.id).length, 0) >= 4,
    progress: (s: GameState) =>
      p(spheres.reduce((sum, sp) => sum + skillBranchesOf(s, sp.id).length, 0) / 4),
  },
  {
    category: 'Дерево навыков',
    tier: 'gold',
    name: 'Мультикласс',
    icon: '🧩',
    description: 'Открой навыки в 3 разных сферах',
    unlocked: (s: GameState) => spheres.filter((sp) => totalLearnedNodesOf(s, sp.id) >= 1).length >= 3,
    progress: (s: GameState) => p(spheres.filter((sp) => totalLearnedNodesOf(s, sp.id) >= 1).length / 3),
  },

  // ---- Серии ----
  {
    category: 'Серии',
    tier: 'bronze',
    name: 'В ритме',
    icon: '🔥',
    description: 'Будь активен 3 дня подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 3,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 3),
  },
  {
    category: 'Серии',
    tier: 'bronze',
    name: 'Неделя подряд',
    icon: '🔥',
    description: 'Будь активен 7 дней подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 7,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 7),
  },
  {
    category: 'Серии',
    tier: 'silver',
    name: 'Две недели',
    icon: '🔥',
    description: 'Будь активен 14 дней подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 14,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 14),
  },
  {
    category: 'Серии',
    tier: 'gold',
    name: 'Три недели в игре',
    icon: '⚡',
    description: 'Будь активен 21 день подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 21,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 21),
  },
  {
    category: 'Серии',
    tier: 'gold',
    name: 'Несгибаемый',
    icon: '⚡',
    description: 'Будь активен 30 дней подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 30,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 30),
  },
  {
    category: 'Серии',
    tier: 'platinum',
    name: 'Два месяца подряд',
    icon: '⚡',
    description: 'Будь активен 60 дней подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 60,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 60),
  },
  {
    category: 'Серии',
    tier: 'platinum',
    name: 'Железный человек',
    icon: '⚡',
    description: 'Будь активен 100 дней подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 100,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 100),
  },
  {
    category: 'Серии',
    tier: 'special',
    name: 'Полгода в игре',
    icon: '⚡',
    description: 'Будь активен 180 дней подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 180,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 180),
  },
  {
    category: 'Серии',
    tier: 'special',
    name: 'Всегда в игре',
    icon: '⚡',
    description: 'Будь активен 365 дней подряд',
    unlocked: (s: GameState) => longestStreak(s.activeDates) >= 365,
    progress: (s: GameState) => p(longestStreak(s.activeDates) / 365),
  },

  // ---- Профиль ----
  {
    category: 'Профиль',
    tier: 'bronze',
    name: 'Новичок',
    icon: '🌟',
    description: 'Достигни 5 уровня игрока',
    unlocked: (s: GameState) => playerProgress(s).level >= 5,
    progress: (s: GameState) => p(playerProgress(s).level / 5),
  },
  {
    category: 'Профиль',
    tier: 'silver',
    name: 'Опытный игрок',
    icon: '🌟',
    description: 'Достигни 25 уровня игрока',
    unlocked: (s: GameState) => playerProgress(s).level >= 25,
    progress: (s: GameState) => p(playerProgress(s).level / 25),
  },
  {
    category: 'Профиль',
    tier: 'gold',
    name: 'Середина пути',
    icon: '🌟',
    description: 'Достигни 50 уровня игрока',
    unlocked: (s: GameState) => playerProgress(s).level >= 50,
    progress: (s: GameState) => p(playerProgress(s).level / 50),
  },
  {
    category: 'Профиль',
    tier: 'platinum',
    name: 'Почти легенда',
    icon: '🌟',
    description: 'Достигни 75 уровня игрока',
    unlocked: (s: GameState) => playerProgress(s).level >= 75,
    progress: (s: GameState) => p(playerProgress(s).level / 75),
  },
  {
    category: 'Профиль',
    tier: 'special',
    name: 'Легенда PLAY YOUR LIFE',
    icon: '👑',
    description: `Достигни ${MAX_PLAYER_LEVEL} уровня игрока`,
    unlocked: (s: GameState) => playerProgress(s).level >= MAX_PLAYER_LEVEL,
    progress: (s: GameState) => p(playerProgress(s).level / MAX_PLAYER_LEVEL),
  },
  // ---- Магазин ----
  {
    category: 'Магазин',
    tier: 'bronze',
    name: 'Первая покупка',
    icon: '🎁',
    description: 'Купи первую награду в магазине',
    unlocked: (s: GameState) => (s.shop?.purchases ?? []).length >= 1,
    progress: (s: GameState) => p((s.shop?.purchases ?? []).length / 1),
  },
  {
    category: 'Магазин',
    tier: 'silver',
    name: 'Копилка',
    icon: '🪙',
    description: 'Заработай суммарно 500 лайфкоинов',
    unlocked: (s: GameState) => totalCoinsEarned(s) >= 500,
    progress: (s: GameState) => p(totalCoinsEarned(s) / 500),
  },
  {
    category: 'Магазин',
    tier: 'gold',
    name: 'Транжира',
    icon: '🪙',
    description: 'Потрать на одну покупку 1000 лайфкоинов',
    unlocked: (s: GameState) => (s.shop?.purchases ?? []).some((pu) => pu.price >= 1000),
    progress: (s: GameState) =>
      p(Math.max(0, ...(s.shop?.purchases ?? []).map((pu) => pu.price)) / 1000),
  },
  {
    category: 'Магазин',
    tier: 'platinum',
    name: 'Люкс',
    icon: '💠',
    description: 'Купи «Награду Люкс»',
    unlocked: (s: GameState) =>
      (s.shop?.purchases ?? []).some((pu) =>
        (s.shop?.customRewards ?? []).some((r) => r.id === pu.itemId && r.lux),
      ),
    progress: (s: GameState) =>
      (s.shop?.purchases ?? []).some((pu) =>
        (s.shop?.customRewards ?? []).some((r) => r.id === pu.itemId && r.lux),
      )
        ? 1
        : 0,
  },
  {
    category: 'Магазин',
    tier: 'gold',
    name: 'Витрина',
    icon: '🗃️',
    description: 'Добавь 5 своих наград в магазин',
    unlocked: (s: GameState) => (s.shop?.customRewards ?? []).length >= 5,
    progress: (s: GameState) => p((s.shop?.customRewards ?? []).length / 5),
  },

  // ---- Мои итоги ----
  {
    category: 'Мои итоги',
    tier: 'bronze',
    name: 'Первый отчёт',
    icon: '📔',
    description: 'Заверши «Мои итоги» в первый раз',
    unlocked: (s: GameState) => reflectionsOf(s).some((r) => r.status === 'completed'),
    progress: (s: GameState) => (reflectionsOf(s).some((r) => r.status === 'completed') ? 1 : 0),
  },
  {
    category: 'Мои итоги',
    tier: 'gold',
    name: 'Полная картина',
    icon: '🗺️',
    description: 'Заполни итоги по всем сферам за один месяц',
    unlocked: (s: GameState) => reflectionsOf(s).some((r) => Object.keys(r.review?.spheres ?? {}).length >= spheres.length),
    progress: (s: GameState) =>
      p(Math.max(0, ...reflectionsOf(s).map((r) => Object.keys(r.review?.spheres ?? {}).length)) / spheres.length),
  },
  {
    category: 'Мои итоги',
    tier: 'gold',
    name: 'Пятизвёздочный месяц',
    icon: '⭐',
    description: 'Поставь себе 5 звёзд за месяц',
    unlocked: (s: GameState) => reflectionsOf(s).some((r) => r.mood === 5),
    progress: (s: GameState) => p(Math.max(0, ...reflectionsOf(s).map((r) => r.mood ?? 0)) / 5),
  },
  {
    category: 'Мои итоги',
    tier: 'platinum',
    name: 'Три месяца',
    icon: '📅',
    description: 'Заверши «Мои итоги» 3 раза',
    unlocked: (s: GameState) => reflectionsOf(s).filter((r) => r.status === 'completed').length >= 3,
    progress: (s: GameState) => p(reflectionsOf(s).filter((r) => r.status === 'completed').length / 3),
  },
  {
    category: 'Мои итоги',
    tier: 'special',
    name: 'Год в датах',
    icon: '📅',
    description: 'Заверши «Мои итоги» 12 раз',
    unlocked: (s: GameState) => reflectionsOf(s).filter((r) => r.status === 'completed').length >= 12,
    progress: (s: GameState) => p(reflectionsOf(s).filter((r) => r.status === 'completed').length / 12),
  },
  {
    category: 'Мои итоги',
    tier: 'silver',
    name: 'План на будущее',
    icon: '🧭',
    description: 'Опиши план на следующий месяц хотя бы для одной сферы',
    unlocked: (s: GameState) =>
      reflectionsOf(s).some((r) => Object.values(r.review?.spheres ?? {}).some((sr) => Boolean(sr.next?.trim()))),
    progress: (s: GameState) =>
      reflectionsOf(s).some((r) => Object.values(r.review?.spheres ?? {}).some((sr) => Boolean(sr.next?.trim())))
        ? 1
        : 0,
  },

  // ---- Особые ----
  {
    category: 'Особые',
    tier: 'bronze',
    name: 'Полуночник',
    icon: '🌙',
    description: 'Соверши действие глубокой ночью',
    unlocked: (s: GameState) => s.events.some((e) => new Date(e.date).getHours() < 3),
    progress: (s: GameState) => (s.events.some((e) => new Date(e.date).getHours() < 3) ? 1 : 0),
  },
  {
    category: 'Особые',
    tier: 'bronze',
    name: 'Ранняя пташка',
    icon: '🌅',
    description: 'Соверши действие до 6 утра',
    unlocked: (s: GameState) => s.events.some((e) => new Date(e.date).getHours() < 6),
    progress: (s: GameState) => (s.events.some((e) => new Date(e.date).getHours() < 6) ? 1 : 0),
  },
  {
    category: 'Особые',
    tier: 'silver',
    name: 'Новый год',
    icon: '🎆',
    description: 'Зайди в игру 1 января',
    unlocked: (s: GameState) => s.events.some((e) => {
      const d = new Date(e.date);
      return d.getMonth() === 0 && d.getDate() === 1;
    }),
    progress: (s: GameState) =>
      s.events.some((e) => {
        const d = new Date(e.date);
        return d.getMonth() === 0 && d.getDate() === 1;
      })
        ? 1
        : 0,
  },
];
/**
 * Эти четыре достижения считают прогресс по всем «обычным» достижениям (baseAchievements), а не по
 * итоговому экспортируемому списку achievements — иначе их unlocked()/progress() вызывали бы сами себя
 * через achievements.filter(...) и приводили к бесконечной рекурсии (переполнению стека).
 */
const metaAchievements: Achievement[] = [
  {
    category: 'Профиль',
    tier: 'gold',
    name: 'Коллекционер наград',
    icon: '🏆',
    description: 'Получи 25 достижений',
    unlocked: (s: GameState) => baseAchievements.filter((a) => a.unlocked(s)).length >= 25,
    progress: (s: GameState) => p(baseAchievements.filter((a) => a.unlocked(s)).length / 25),
  },
  {
    category: 'Профиль',
    tier: 'special',
    name: 'Все значки',
    icon: '🏆',
    description: 'Получи все достижения игры',
    unlocked: (s: GameState) => baseAchievements.filter((a) => a.unlocked(s)).length >= baseAchievements.length,
    progress: (s: GameState) => p(baseAchievements.filter((a) => a.unlocked(s)).length / baseAchievements.length),
  },
  {
    category: 'Особые',
    tier: 'special',
    name: 'Путь легенды',
    icon: '🌈',
    description: 'Получи хотя бы одну награду каждой редкости',
    unlocked: (s: GameState) => {
      const tiers: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum', 'special'];
      const unlockedTiers = new Set(baseAchievements.filter((a) => a.unlocked(s)).map((a) => a.tier));
      return tiers.every((t) => unlockedTiers.has(t));
    },
    progress: (s: GameState) => {
      const tiers: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum', 'special'];
      const unlockedTiers = new Set(baseAchievements.filter((a) => a.unlocked(s)).map((a) => a.tier));
      return p(tiers.filter((t) => unlockedTiers.has(t)).length / tiers.length);
    },
  },
  {
    category: 'Особые',
    tier: 'special',
    name: 'Полный комплект',
    icon: '🎊',
    description: 'Получи хотя бы одно достижение в каждой категории',
    unlocked: (s: GameState) => {
      const cats = new Set(baseAchievements.map((a) => a.category));
      const unlockedCats = new Set(baseAchievements.filter((a) => a.unlocked(s)).map((a) => a.category));
      return [...cats].every((c) => unlockedCats.has(c));
    },
    progress: (s: GameState) => {
      const cats = new Set(baseAchievements.map((a) => a.category));
      const unlockedCats = new Set(baseAchievements.filter((a) => a.unlocked(s)).map((a) => a.category));
      return p([...cats].filter((c) => unlockedCats.has(c)).length / cats.size);
    },
  },
];
export const achievements: Achievement[] = [...baseAchievements, ...metaAchievements];
