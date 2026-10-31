import { dateKey, spheres } from './game.ts';
import type { GameState, MonthReflection } from './game.ts';
import { blankReflection, monthKey, monthlySummary, moveMonth, validMonth } from './monthly.ts';
import { saveCustomQuest } from './personalQuests.ts';

/** «Ключевые итоги → Мои итоги» (0.35.0). За итоги XP, серии и штрафы не начисляются. */
export type PlanOutcome = 'done' | 'part' | 'no';
export type SphereTrend = 'up' | 'stable' | 'down';
export type PlannedTask = { title: string; confidence: number; questId?: string };
export type SphereReview = {
  achieved: string;
  /** Явно записанная ключевая победа; пустая строка намеренно отличается от отсутствующего поля. */
  keyResult?: string;
  /** Список отдельных побед месяца. Присутствие поля (даже пустого массива) отключает чтение keyResult/achieved. */
  keyResults?: string[];
  /** Необязательное подтверждение ключевой победы. */
  resultEvidence?: string;
  failed: string;
  next: string;
  ifWhen: string;
  ifThen: string;
  score: number | null;
  trend: SphereTrend | null;
  task: PlannedTask | null;
  /** Сколько задач закрыто за месяц в этой сфере: вписывает сам игрок (например, по TickTick), в игре не считается. */
  tasksDone: number | null;
};
export type ReviewPlan = { id: string; title: string; sphere?: string };
export type ReviewPlanCheck = {
  sourceMonth: string;
  sourceText: string;
  sphere?: string;
  outcome: 'done' | 'part' | 'no' | 'custom';
  comment: string;
};
export type CarryPlan = { id: string; sourceMonth: string; text: string; sphere?: string };
export type MonthReview = {
  /** Как вышли планы прошлого месяца: id сферы → исход. */
  plans: Record<string, PlanOutcome>;
  wins: string[];
  spheres: Record<string, SphereReview>;
  gratitude: string[];
  /** Не больше трёх фокусов: id сфер. */
  focuses: string[];
  /** Мягкий режим для тяжёлого месяца. */
  soft: boolean;
  softHelped: string;
  softStep: string;
  /** Задача из мягкого режима, когда она уже создана. */
  softQuestId?: string;
  /** Общий вывод по месяцу. */
  conclusion?: string;
  /** Обстоятельства, которые стоит помнить при чтении итога. */
  context?: string;
  /** Новые планы. Само присутствие пустого массива отключает чтение старых полей next. */
  nextPlans?: ReviewPlan[];
  /** Ответы по перенесённым планам, с независимым снимком исходного текста. */
  planChecks?: Record<string, ReviewPlanCheck>;
};

export const MAX_FOCUSES = 3;
export const CONFIDENCE_OK = 7;
const TEXT_LIMIT = 2000;
const SHORT_LIMIT = 200;
const PLAN_ID_LIMIT = 120;
export const MAX_NEXT_PLANS = 40;
export const MAX_PLAN_CHECKS = 80;
/** Не больше 12 отдельных побед на сферу за месяц — столько же, сколько у общих wins. */
export const MAX_KEY_RESULTS = 12;
export const KEY_RESULT_LIMIT = 300;
// Список сфер читается лениво: game.ts и stateValidation.ts импортируют друг друга.
const sphereIds = () => spheres.map((s) => s.id);

export function blankSphereReview(): SphereReview {
  return { achieved: '', failed: '', next: '', ifWhen: '', ifThen: '', score: null, trend: null, task: null, tasksDone: null };
}
/** Верхняя граница для ручного ввода числа задач за месяц: защита от опечаток, не экономический лимит. */
export const TASKS_DONE_MAX = 999;
export function blankReview(): MonthReview {
  return {
    plans: {},
    wins: [],
    spheres: {},
    gratitude: ['', '', ''],
    focuses: [],
    soft: false,
    softHelped: '',
    softStep: '',
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function str(value: unknown, max: number) {
  return typeof value === 'string' && value.length <= max;
}

export function validPlannedTask(value: unknown): boolean {
  return (
    record(value) &&
    str(value.title, 100) &&
    typeof value.confidence === 'number' &&
    Number.isInteger(value.confidence) &&
    value.confidence >= 1 &&
    value.confidence <= 10 &&
    (value.questId === undefined || str(value.questId, 120))
  );
}
function validReviewPlan(value: unknown): value is ReviewPlan {
  return (
    record(value) &&
    str(value.id, PLAN_ID_LIMIT) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    str(value.title, TEXT_LIMIT) &&
    // Пустая строка — допустимый черновик после «Добавить план».
    // carriedPlans отдельно исключает незаполненные строки из будущей проверки.
    (value.sphere === undefined || (typeof value.sphere === 'string' && str(value.sphere, PLAN_ID_LIMIT) && sphereIds().includes(value.sphere)))
  );
}
function validReviewPlanCheck(value: unknown): value is ReviewPlanCheck {
  return (
    record(value) &&
    typeof value.sourceMonth === 'string' &&
    validMonth(value.sourceMonth) &&
    str(value.sourceText, TEXT_LIMIT) &&
    typeof value.sourceText === 'string' &&
    value.sourceText.trim().length > 0 &&
    (value.sphere === undefined || (typeof value.sphere === 'string' && str(value.sphere, PLAN_ID_LIMIT) && sphereIds().includes(value.sphere))) &&
    ['done', 'part', 'no', 'custom'].includes(value.outcome as string) &&
    str(value.comment, TEXT_LIMIT)
  );
}
export function validSphereReview(value: unknown): boolean {
  return (
    record(value) &&
    [value.achieved, value.failed, value.next].every((t) => str(t, TEXT_LIMIT)) &&
    (value.keyResult === undefined || str(value.keyResult, TEXT_LIMIT)) &&
    (value.keyResults === undefined ||
      (Array.isArray(value.keyResults) &&
        value.keyResults.length <= MAX_KEY_RESULTS &&
        value.keyResults.every((t) => str(t, KEY_RESULT_LIMIT)))) &&
    (value.resultEvidence === undefined || str(value.resultEvidence, TEXT_LIMIT)) &&
    [value.ifWhen, value.ifThen].every((t) => str(t, SHORT_LIMIT)) &&
    (value.score === null || (typeof value.score === 'number' && Number.isInteger(value.score) && value.score >= 1 && value.score <= 10)) &&
    (value.trend === null || ['up', 'stable', 'down'].includes(value.trend as string)) &&
    (value.task === null || validPlannedTask(value.task)) &&
    (value.tasksDone === null || value.tasksDone === undefined || (typeof value.tasksDone === 'number' && Number.isInteger(value.tasksDone) && value.tasksDone >= 0 && value.tasksDone <= TASKS_DONE_MAX))
  );
}
export function validReview(value: unknown): boolean {
  if (!record(value)) return false;
  if (!record(value.plans) || !Object.entries(value.plans).every(([id, o]) => sphereIds().includes(id) && ['done', 'part', 'no'].includes(o as string))) return false;
  if (!Array.isArray(value.wins) || value.wins.length > 12 || !value.wins.every((w) => str(w, SHORT_LIMIT))) return false;
  if (!record(value.spheres) || !Object.entries(value.spheres).every(([id, r]) => sphereIds().includes(id) && validSphereReview(r))) return false;
  if (!Array.isArray(value.gratitude) || value.gratitude.length !== 3 || !value.gratitude.every((g) => str(g, SHORT_LIMIT))) return false;
  if (!Array.isArray(value.focuses) || value.focuses.length > MAX_FOCUSES || new Set(value.focuses).size !== value.focuses.length || !value.focuses.every((f) => sphereIds().includes(f as string))) return false;
  if (value.conclusion !== undefined && !str(value.conclusion, TEXT_LIMIT)) return false;
  if (value.context !== undefined && !str(value.context, TEXT_LIMIT)) return false;
  if (
    value.nextPlans !== undefined &&
    (!Array.isArray(value.nextPlans) ||
      value.nextPlans.length > MAX_NEXT_PLANS ||
      new Set(value.nextPlans.map((plan) => record(plan) ? plan.id : undefined)).size !== value.nextPlans.length ||
      !value.nextPlans.every(validReviewPlan))
  )
    return false;
  if (
    value.planChecks !== undefined &&
    (!record(value.planChecks) ||
      Object.keys(value.planChecks).length > MAX_PLAN_CHECKS ||
      !Object.entries(value.planChecks).every(([id, check]) => id.length > 0 && id.length <= PLAN_ID_LIMIT && validReviewPlanCheck(check)))
  )
    return false;
  return typeof value.soft === 'boolean' && str(value.softHelped, SHORT_LIMIT) && str(value.softStep, SHORT_LIMIT) && (value.softQuestId === undefined || str(value.softQuestId, 120));
}
export function validMoodCheckins(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 800) return false;
  return entries.every(([day, c]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !record(c)) return false;
    return [c.mood, c.energy].every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5);
  });
}

export function reviewOf(state: GameState, month: string): MonthReview {
  const saved = state.monthlyReflections?.[month]?.review;
  if (!saved) return blankReview();
  return {
    ...blankReview(),
    ...saved,
    plans: { ...saved.plans },
    wins: [...saved.wins],
    spheres: Object.fromEntries(
      Object.entries(saved.spheres).map(([id, review]) => [
        id,
        {
          ...review,
          task: review.task ? { ...review.task } : review.task,
          ...(review.keyResults === undefined ? {} : { keyResults: [...review.keyResults] }),
        },
      ]),
    ),
    gratitude: [...saved.gratitude],
    focuses: [...saved.focuses],
    ...(saved.nextPlans === undefined ? {} : { nextPlans: saved.nextPlans.map((plan) => ({ ...plan })) }),
    ...(saved.planChecks === undefined
      ? {}
      : { planChecks: Object.fromEntries(Object.entries(saved.planChecks).map(([id, check]) => [id, { ...check }])) }),
  };
}
export function sphereReviewOf(review: MonthReview, sphere: string): SphereReview {
  const saved = review.spheres[sphere];
  return saved
    ? {
        ...saved,
        task: saved.task ? { ...saved.task } : saved.task,
        ...(saved.keyResults === undefined ? {} : { keyResults: [...saved.keyResults] }),
      }
    : blankSphereReview();
}

function clipped(value: unknown, max: number): unknown {
  return typeof value === 'string' ? value.slice(0, max) : value;
}
function cleanPlan(value: unknown): unknown {
  if (!record(value)) return value;
  const { sphere, ...plan } = value;
  return {
    ...plan,
    id: clipped(value.id, PLAN_ID_LIMIT),
    title: clipped(value.title, TEXT_LIMIT),
    ...(sphere === undefined ? {} : { sphere }),
  };
}
function cleanPlanCheck(value: unknown): unknown {
  if (!record(value)) return value;
  const { sphere, ...check } = value;
  return {
    ...check,
    sourceText: clipped(value.sourceText, TEXT_LIMIT),
    comment: clipped(value.comment, TEXT_LIMIT),
    ...(sphere === undefined ? {} : { sphere }),
  };
}
function clean(review: MonthReview): MonthReview {
  const next: MonthReview = { ...review, spheres: {} };
  next.wins = review.wins.slice(0, 12).map((w) => w.slice(0, SHORT_LIMIT));
  next.gratitude = [0, 1, 2].map((i) => (review.gratitude[i] ?? '').slice(0, SHORT_LIMIT));
  next.focuses = [...new Set(review.focuses)].filter((f) => sphereIds().includes(f)).slice(0, MAX_FOCUSES);
  next.softHelped = review.softHelped.slice(0, SHORT_LIMIT);
  next.softStep = review.softStep.slice(0, SHORT_LIMIT);
  if (review.conclusion === undefined) delete next.conclusion;
  else next.conclusion = clipped(review.conclusion, TEXT_LIMIT) as string;
  if (review.context === undefined) delete next.context;
  else next.context = clipped(review.context, TEXT_LIMIT) as string;
  if (review.nextPlans !== undefined) {
    next.nextPlans = Array.isArray(review.nextPlans)
      ? review.nextPlans.slice(0, MAX_NEXT_PLANS).map(cleanPlan) as ReviewPlan[]
      : review.nextPlans;
  } else delete next.nextPlans;
  if (review.planChecks !== undefined) {
    next.planChecks = record(review.planChecks)
      ? Object.fromEntries(Object.entries(review.planChecks).slice(0, MAX_PLAN_CHECKS).map(([id, check]) => [id, cleanPlanCheck(check)])) as Record<string, ReviewPlanCheck>
      : review.planChecks;
  } else delete next.planChecks;
  for (const [id, r] of Object.entries(review.spheres)) {
    if (!sphereIds().includes(id)) continue;
    const { keyResult, keyResults, resultEvidence, ...oldFields } = r;
    next.spheres[id] = {
      ...oldFields,
      achieved: r.achieved.slice(0, TEXT_LIMIT),
      ...(keyResult === undefined ? {} : { keyResult: clipped(keyResult, TEXT_LIMIT) as string }),
      ...(keyResults === undefined
        ? {}
        : {
            keyResults: (Array.isArray(keyResults)
              ? keyResults.slice(0, MAX_KEY_RESULTS).map((t) => clipped(t, KEY_RESULT_LIMIT))
              : keyResults) as string[],
          }),
      ...(resultEvidence === undefined ? {} : { resultEvidence: clipped(resultEvidence, TEXT_LIMIT) as string }),
      failed: r.failed.slice(0, TEXT_LIMIT),
      next: r.next.slice(0, TEXT_LIMIT),
      ifWhen: r.ifWhen.slice(0, SHORT_LIMIT),
      ifThen: r.ifThen.slice(0, SHORT_LIMIT),
      task: r.task ? { ...r.task, title: r.task.title.slice(0, 100) } : null,
      // Как и score: не подчищаем значение здесь — неверное (дробное, отрицательное, слишком большое)
      // отклоняет validSphereReview, и saveReview вернёт состояние без изменений.
      tasksDone: r.tasksDone ?? null,
    };
  }
  return next;
}

/** Сохраняет итоги месяца как черновик. Будущий месяц и неверные значения игнорируются. */
export function saveReview(
  state: GameState,
  month: string,
  patch: Partial<MonthReview>,
  now = new Date(),
  status: MonthReflection['status'] = 'draft',
): GameState {
  if (!validMonth(month) || month > monthKey(now)) return state;
  const review = clean({ ...reviewOf(state, month), ...patch });
  if (!validReview(review)) return state;
  const previous = state.monthlyReflections?.[month] ?? blankReflection();
  const reflection: MonthReflection = { ...previous, review, status, updatedAt: now.toISOString() };
  return { ...state, monthlyReflections: { ...state.monthlyReflections, [month]: reflection } };
}
export function patchSphereReview(
  state: GameState,
  month: string,
  sphere: string,
  patch: Partial<SphereReview>,
  now = new Date(),
): GameState {
  if (!sphereIds().includes(sphere)) return state;
  const review = reviewOf(state, month);
  const current = sphereReviewOf(review, sphere);
  return saveReview(state, month, { spheres: { ...review.spheres, [sphere]: { ...current, ...patch } } }, now);
}
export function setMonthRating(state: GameState, month: string, mood: number | null, now = new Date()): GameState {
  if (!validMonth(month) || month > monthKey(now)) return state;
  if (mood !== null && (!Number.isInteger(mood) || mood < 1 || mood > 5)) return state;
  const previous = state.monthlyReflections?.[month] ?? blankReflection();
  const reflection: MonthReflection = { ...previous, mood, status: 'draft', updatedAt: now.toISOString() };
  return { ...state, monthlyReflections: { ...state.monthlyReflections, [month]: reflection } };
}

/** Мягкий режим предлагается при оценке месяца в 1–2 звезды. */
export function softModeSuggested(mood: number | null) {
  return mood !== null && mood <= 2;
}

/** Предложение шага поменьше, если уверенность ниже порога. */
export function smallerStep(title: string): string {
  const text = title.trim();
  if (!text) return 'половину запланированного';
  const km = text.match(/(\d+(?:[.,]\d+)?)\s*км/i);
  if (km) {
    const value = Number(km[1].replace(',', '.'));
    const half = Math.max(1, Math.round(value * 0.6));
    return text.replace(km[0], `${half} км`);
  }
  const times = text.match(/(\d+)\s*(раз|раза|дней|дня|день|уроков|страниц)/i);
  if (times) {
    const value = Number(times[1]);
    const half = Math.max(1, Math.round(value * 0.6));
    return text.replace(times[1], String(half));
  }
  return `${text} (в два раза меньше)`;
}
export function needsSmallerStep(task: PlannedTask | null) {
  return !!task && task.confidence < CONFIDENCE_OK;
}

/** Планы прошлого месяца: то, что пользователь сам записал в «Что будет в следующем месяце». */
export function previousPlans(state: GameState, month: string) {
  const previous = moveMonth(month, -1);
  const review = state.monthlyReflections?.[previous]?.review;
  if (!review) return [];
  return spheres
    .map((s) => ({ sphere: s.id, name: s.name, color: s.color, text: (review.spheres[s.id]?.next ?? '').trim() }))
    .filter((p) => p.text);
}

/** Детерминированный короткий id для строки из старого поля next. */
function legacyPlanId(sourceMonth: string, sphere: string | undefined, index: number, text: string) {
  const source = [sourceMonth, sphere ?? '', String(index), text].join('\u001f');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy:${sourceMonth}:${sphere ?? 'general'}:${index}:${(hash >>> 0).toString(36)}`;
}
function linesOf(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
/**
 * Планы, перенесённые в month из предыдущего месяца.
 * Старый формат разбирается построчно, пока nextPlans отсутствует. Снимки уже
 * отвеченных планов дополняют список и всегда имеют приоритет над изменённым
 * исходником: исторический ответ не теряет свой исходный текст.
 */
export function carriedPlans(state: GameState, month: string): CarryPlan[] {
  if (!validMonth(month)) return [];
  const sourceMonth = moveMonth(month, -1);
  const sourceReflection = state.monthlyReflections?.[sourceMonth];
  const sourceReview = sourceReflection?.review;
  const currentChecks = state.monthlyReflections?.[month]?.review?.planChecks ?? {};
  const plans: CarryPlan[] = [];

  if (sourceReview?.nextPlans !== undefined) {
    for (const plan of sourceReview.nextPlans) {
      const text = plan.title.trim();
      if (!text) continue;
      plans.push({
        id: plan.id,
        sourceMonth,
        text,
        ...(plan.sphere === undefined ? {} : { sphere: plan.sphere }),
      });
    }
  } else if (sourceReview || sourceReflection) {
    for (const sphere of spheres) {
      const text = sourceReview?.spheres[sphere.id]?.next ?? '';
      linesOf(text).forEach((line, index) => {
        plans.push({ id: legacyPlanId(sourceMonth, sphere.id, index, line), sourceMonth, text: line, sphere: sphere.id });
      });
    }
    linesOf(sourceReflection?.nextMonth ?? '').forEach((line, index) => {
      plans.push({ id: legacyPlanId(sourceMonth, undefined, index, line), sourceMonth, text: line });
    });
  }

  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  for (const [id, check] of Object.entries(currentChecks)) {
    // validReview гарантирует форму в обычных сохранениях; эта защита оставляет
    // чистую функцию устойчивой и к ещё не проверенному локальному черновику.
    if (!validReviewPlanCheck(check)) continue;
    byId.set(id, {
      id,
      sourceMonth: check.sourceMonth,
      text: check.sourceText,
      ...(check.sphere === undefined ? {} : { sphere: check.sphere }),
    });
  }
  return [...byId.values()];
}

function validCarryPlan(value: unknown): value is CarryPlan {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    str(value.id, PLAN_ID_LIMIT) &&
    value.id.trim().length > 0 &&
    typeof value.sourceMonth === 'string' &&
    validMonth(value.sourceMonth) &&
    typeof value.text === 'string' &&
    str(value.text, TEXT_LIMIT) &&
    value.text.trim().length > 0 &&
    (value.sphere === undefined || (typeof value.sphere === 'string' && sphereIds().includes(value.sphere)))
  );
}

/** Сохраняет только ответ на один переносимый план; XP, задачи и исходный месяц не меняются. */
export function savePlanCheck(
  state: GameState,
  month: string,
  plan: CarryPlan,
  outcome: ReviewPlanCheck['outcome'],
  comment = '',
  now = new Date(),
): GameState {
  if (
    !validMonth(month) ||
    month > monthKey(now) ||
    !validCarryPlan(plan) ||
    !validReviewPlanCheck({
      sourceMonth: plan.sourceMonth,
      sourceText: plan.text,
      ...(plan.sphere === undefined ? {} : { sphere: plan.sphere }),
      outcome,
      comment,
    })
  )
    return state;
  const review = reviewOf(state, month);
  const status = state.monthlyReflections?.[month]?.status ?? 'draft';
  return saveReview(
    state,
    month,
    {
      planChecks: {
        ...review.planChecks,
        [plan.id]: {
          sourceMonth: plan.sourceMonth,
          sourceText: plan.text,
          ...(plan.sphere === undefined ? {} : { sphere: plan.sphere }),
          outcome,
          comment,
        },
      },
    },
    now,
    status,
  );
}

/** Маленькие победы месяца, найденные по сохранённой истории. Ничего не выдумывается. */
export function winSuggestions(state: GameState, month: string, now = new Date()): string[] {
  const summary = monthlySummary(state, month, now);
  const wins: string[] = [];
  if (summary.longest >= 3) wins.push(`Серия ${summary.longest} дн. подряд`);
  if (summary.activeDays >= 5) wins.push(`${summary.activeDays} дн. с выполненной задачей`);
  if (summary.quests >= 5) wins.push(`Выполнено задач: ${summary.quests}`);
  if (summary.goals > 0) wins.push(`Достигнуто проектов: ${summary.goals}`);
  for (const s of summary.sphereResults) {
    if (s.levelDelta !== null && s.levelDelta > 0) wins.push(`Уровень ${s.levelAfter} в сфере «${s.name}»`);
  }
  const previous = monthlySummary(state, moveMonth(month, -1), now);
  if (previous.xp > 0 && summary.xp > previous.xp) wins.push(`XP выше прошлого месяца на ${Math.round(((summary.xp - previous.xp) / previous.xp) * 100)}%`);
  return wins.slice(0, 8);
}

/** Шаги «Мои итоги»: сколько сфер заполнено. */
export function filledSpheres(review: MonthReview) {
  return sphereIds().filter((id) => {
    const r = review.spheres[id];
    return r && (r.achieved.trim() || r.failed.trim() || r.next.trim());
  }).length;
}

/** Превращает планы сфер в задачи на первое число следующего месяца. Повторно не создаёт. */
export function createPlanTasks(state: GameState, month: string, ownerId: string, now = new Date()): { state: GameState; created: number } {
  if (!validMonth(month) || month > monthKey(now)) return { state, created: 0 };
  const [year, number] = moveMonth(month, 1).split('-').map(Number);
  const dueAt = new Date(year, number - 1, 1, 12).toISOString();
  let next = state;
  let created = 0;
  const review = reviewOf(state, month);
  const updated: Record<string, SphereReview> = { ...review.spheres };
  for (const id of sphereIds()) {
    const r = review.spheres[id];
    if (!r?.task || r.task.questId || !r.task.title.trim()) continue;
    const questId = crypto.randomUUID();
    next = saveCustomQuest(next, { id: undefined, name: r.task.title.trim(), sphere: id, difficulty: 'Hard', dueAt }, ownerId);
    const quest = next.quests[next.quests.length - 1];
    updated[id] = { ...r, task: { ...r.task, questId: quest?.id ?? questId } };
    created += 1;
  }
  let softQuestId = review.softQuestId;
  if (review.soft && review.softStep.trim() && !softQuestId) {
    const sphere = review.focuses[0] ?? 'health';
    next = saveCustomQuest(next, { id: undefined, name: review.softStep.trim().slice(0, 100), sphere, difficulty: 'Simple', dueAt }, ownerId);
    softQuestId = next.quests[next.quests.length - 1]?.id;
    created += 1;
  }
  if (created === 0) return { state, created: 0 };
  return { state: saveReview(next, month, { spheres: updated, softQuestId }, now), created };
}

/** Завершает итоги месяца. Мягкий режим завершает их без заполнения всех шагов. */
export function finishReview(state: GameState, month: string, now = new Date()): GameState {
  return saveReview(state, month, reviewOf(state, month), now, 'completed');
}

/* ---------- Настроение и энергия ---------- */
export function addMoodCheckin(state: GameState, mood: number, energy: number, now = new Date()): GameState {
  if (![mood, energy].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) return state;
  return { ...state, moodCheckins: { ...state.moodCheckins, [dateKey(now)]: { mood, energy } } };
}
export function moodSeries(state: GameState, month: string) {
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const points: { day: number; mood: number; energy: number }[] = [];
  for (let day = 1; day <= days; day += 1) {
    const c = state.moodCheckins?.[`${month}-${String(day).padStart(2, '0')}`];
    if (c) points.push({ day, mood: c.mood, energy: c.energy });
  }
  return { days, points };
}
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
/** Наблюдения по отметкам. Нужны минимум 6 отметок; это связь, а не причина. */
export function moodInsights(state: GameState, month: string): { tag: string; text: string }[] {
  const { points } = moodSeries(state, month);
  if (points.length < 6) return [];
  const result: { tag: string; text: string }[] = [];
  const active = new Set(state.activeDates);
  const withTask = points.filter((p) => active.has(`${month}-${String(p.day).padStart(2, '0')}`));
  const without = points.filter((p) => !active.has(`${month}-${String(p.day).padStart(2, '0')}`));
  if (withTask.length >= 3 && without.length >= 3) {
    const diff = average(withTask.map((p) => p.energy)) - average(without.map((p) => p.energy));
    if (Math.abs(diff) >= 0.5) {
      result.push({
        tag: 'СВЯЗЬ',
        text: diff > 0
          ? `В дни с выполненной задачей энергия выше на ${Math.abs(diff).toFixed(1).replace('.', ',')} балла в среднем.`
          : `В дни с выполненной задачей энергия ниже на ${Math.abs(diff).toFixed(1).replace('.', ',')} балла: возможно, ты берёшь слишком много.`,
      });
    }
  }
  const worst = [...points].sort((a, b) => a.mood + a.energy - (b.mood + b.energy))[0];
  result.push({ tag: 'ПРОСАДКА', text: `Самый тяжёлый день — ${worst.day}-е число. Вспомни, что тогда происходило.` });
  const best = [...points].sort((a, b) => b.mood + b.energy - (a.mood + a.energy))[0];
  result.push({ tag: 'ПОВТОРИТЬ', text: `Лучший день — ${best.day}-е число. Что в нём было особенного?` });
  return result;
}
