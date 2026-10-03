import type { GameState } from './game.ts';

type SavedState = Omit<GameState, 'profile' | 'mainGoalId'> &
  Partial<Pick<GameState, 'profile' | 'mainGoalId'>>;
const sphereIds = [
  'health',
  'sport',
  'growth',
  'english',
  'finance',
  'together',
  'driving',
  'tasks',
  'hobby',
];
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;
const text = (v: unknown) => typeof v === 'string';
const date = (v: unknown) =>
  text(v) && Number.isFinite(new Date(v as string).getTime());
const score = (v: unknown) =>
  number(v) && Number.isInteger(v) && (v as number) <= 9;
const optionalDate = (v: unknown) => v === undefined || date(v);
function list(v: unknown, check: (item: Record<string, unknown>) => boolean) {
  return (
    Array.isArray(v) &&
    v.every((item) => record(item) && check(item)) &&
    new Set(v.map((item) => item.id)).size === v.length
  );
}
export function validateState(value: unknown): asserts value is SavedState {
  const fail = () => {
    throw new Error(
      'Файл содержит повреждённые или неподдерживаемые данные PLAY YOUR LIFE. Текущая игра не изменена.',
    );
  };
  if (!record(value) || value.version !== 1) return fail();
  if (
    ![value.xp, value.coins, value.completed].every(number) ||
    !Number.isInteger(value.completed)
  )
    return fail();
  if (
    !record(value.spheres) ||
    !sphereIds.every((id) => {
      const s = (value.spheres as Record<string, unknown>)[id];
      return (
        record(s) &&
        number(s.xp) &&
        score(s.score) &&
        score(s.previousScore) &&
        score(s.highScore) &&
        (s.highScore as number) >= (s.score as number)
      );
    })
  )
    return fail();
  if (
    !list(
      value.quests,
      (q) =>
        text(q.id) &&
        !!q.id &&
        text(q.name) &&
        sphereIds.includes(q.sphere as string) &&
        number(q.xp) &&
        ['Micro', 'Simple', 'Medium', 'Hard', 'Very Hard'].includes(
          q.difficulty as string,
        ) &&
        (q.priority === undefined ||
          ['low', 'normal', 'high'].includes(q.priority as string)) &&
        typeof q.done === 'boolean' &&
        optionalDate(q.startsAt) &&
        optionalDate(q.dueAt) &&
        optionalDate(q.completedAt) &&
        (q.estimateMinutes === undefined ||
          (number(q.estimateMinutes) &&
            (q.estimateMinutes as number) > 0 &&
            (q.estimateMinutes as number) <= 43200)) &&
        (q.goalId === undefined || text(q.goalId)) &&
        (q.stageId === undefined || text(q.stageId)) &&
        (q.notes === undefined || text(q.notes)),
    )
  )
    return fail();
  if (
    !list(
      value.goals,
      (g) =>
        text(g.id) &&
        !!g.id &&
        text(g.name) &&
        sphereIds.includes(g.sphere as string) &&
        number(g.current) &&
        number(g.target) &&
        (g.target as number) > 0 &&
        number(g.reward) &&
        typeof g.rewarded === 'boolean' &&
        date(g.created) &&
        optionalDate(g.startsAt) &&
        optionalDate(g.dueAt) &&
        (g.description === undefined || text(g.description)) &&
        (g.manualProgress === undefined ||
          (record(g.manualProgress) &&
            number(g.manualProgress.current) &&
            number(g.manualProgress.target) &&
            (g.manualProgress.target as number) > 0)) &&
        (g.progressMode === undefined ||
          ['manual', 'tasks'].includes(g.progressMode as string)) &&
        (g.stages === undefined ||
          list(
            g.stages,
            (stage) =>
              text(stage.id) &&
              !!stage.id &&
              text(stage.name) &&
              optionalDate(stage.startsAt) &&
              optionalDate(stage.dueAt),
          )),
    )
  )
    return fail();
  if (
    !list(
      value.events,
      (e) =>
        text(e.id) &&
        !!e.id &&
        text(e.title) &&
        sphereIds.includes(e.sphere as string) &&
        number(e.xp) &&
        date(e.date),
    )
  )
    return fail();
  if (
    !Array.isArray(value.activeDates) ||
    !value.activeDates.every(date) ||
    !Array.isArray(value.streakClaims) ||
    !value.streakClaims.every(text)
  )
    return fail();
  if (
    value.profile !== undefined &&
    (!record(value.profile) ||
      !text(value.profile.name) ||
      !(value.profile.name as string).trim() ||
      !['character', '🧑🏻‍🚀', '👩🏻‍🚀', '🦊', '🐼', '🦁', '🦉'].includes(
        value.profile.avatar as string,
      ) ||
      !['demo', 'personal'].includes(value.profile.mode as string) ||
      (value.profile.onboardingComplete !== undefined &&
        typeof value.profile.onboardingComplete !== 'boolean'))
  )
    return fail();
  if (
    value.monthlyTracking !== undefined &&
    (!record(value.monthlyTracking) ||
      !date(value.monthlyTracking.since) ||
      !record(value.monthlyTracking.scores) ||
      !sphereIds.every((id) =>
        score(
          (value.monthlyTracking as { scores: Record<string, unknown> }).scores[
            id
          ],
        ),
      ))
  )
    return fail();
  if (
    value.monthlyReflections !== undefined &&
    (!record(value.monthlyReflections) ||
      !Object.entries(value.monthlyReflections).every(
        ([key, r]) =>
          /^\d{4}-\d{2}$/.test(key) &&
          record(r) &&
          [r.highlights, r.challenges, r.lessons, r.nextMonth].every(text) &&
          (r.mood === null ||
            (number(r.mood) &&
              Number.isInteger(r.mood) &&
              (r.mood as number) >= 1 &&
              (r.mood as number) <= 5)) &&
          ['draft', 'completed'].includes(r.status as string) &&
          date(r.updatedAt),
      ))
  )
    return fail();
}
