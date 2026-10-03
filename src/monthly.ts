import { dateKey, spheres } from './game.ts';
import type { GameState, MonthReflection } from './game.ts';

export function monthKey(date = new Date()) {
  return dateKey(date).slice(0, 7);
}
export function validMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
export function moveMonth(month: string, amount: number) {
  const [year, number] = month.split('-').map(Number);
  return monthKey(new Date(year, number - 1 + amount, 1, 12));
}
export function monthLabel(month: string) {
  const [year, number] = month.split('-').map(Number);
  return new Date(year, number - 1, 1, 12)
    .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    .replace(' г.', '');
}
export function blankReflection(): MonthReflection {
  return {
    highlights: '',
    challenges: '',
    lessons: '',
    nextMonth: '',
    mood: null,
    status: 'draft',
    updatedAt: '',
  };
}
export function saveReflection(
  state: GameState,
  month: string,
  changes: Partial<Omit<MonthReflection, 'updatedAt'>>,
  now = new Date(),
): GameState {
  if (!validMonth(month) || month > monthKey(now)) return state;
  const previous = state.monthlyReflections?.[month] ?? blankReflection();
  const reflection = { ...previous, ...changes, updatedAt: now.toISOString() };
  for (const key of [
    'highlights',
    'challenges',
    'lessons',
    'nextMonth',
  ] as const)
    reflection[key] = reflection[key].slice(0, 2000);
  if (
    reflection.mood !== null &&
    (!Number.isInteger(reflection.mood) ||
      reflection.mood < 1 ||
      reflection.mood > 5)
  )
    return state;
  return {
    ...state,
    monthlyReflections: { ...state.monthlyReflections, [month]: reflection },
  };
}
export function monthlySummary(
  state: GameState,
  month: string,
  now = new Date(),
) {
  if (!validMonth(month)) throw new Error('Неверный месяц');
  const [year, number] = month.split('-').map(Number);
  const start = new Date(year, number - 1, 1);
  const end = new Date(year, number, 1);
  const events = state.events.filter((e) => {
    const date = new Date(e.date);
    return date >= start && date < end && date <= now;
  });
  const activeDates = [...new Set(state.activeDates)]
    .filter((date) => date.slice(0, 7) === month && date <= dateKey(now))
    .sort();
  let longest = 0;
  let chain = 0;
  let previous = '';
  for (const date of activeDates) {
    const day = new Date(`${date}T12:00:00`);
    day.setDate(day.getDate() - 1);
    chain = dateKey(day) === previous ? chain + 1 : 1;
    longest = Math.max(longest, chain);
    previous = date;
  }
  const tracking = state.monthlyTracking;
  const trackingDate = tracking ? new Date(tracking.since) : null;
  const scoresKnown = trackingDate !== null && trackingDate < end;
  const sphereResults = spheres.map((s) => {
    let before: number | null = scoresKnown ? tracking!.scores[s.id] : null;
    let after = before;
    if (scoresKnown) {
      const scoreEvents = [...state.events]
        .reverse()
        .filter(
          (e) =>
            e.sphere === s.id &&
            e.kind === 'score' &&
            typeof e.scoreAfter === 'number' &&
            new Date(e.date) >= trackingDate! &&
            new Date(e.date) < end &&
            new Date(e.date) <= now,
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      for (const event of scoreEvents) {
        after = event.scoreAfter!;
        if (new Date(event.date) < start) before = after;
      }
    }
    return {
      ...s,
      xp: events
        .filter((e) => e.sphere === s.id)
        .reduce((total, e) => total + e.xp, 0),
      before,
      after,
      delta: before === null || after === null ? null : after - before,
    };
  });
  const days = Array.from(
    { length: new Date(year, number, 0).getDate() },
    (_, i) => {
      const key = `${month}-${String(i + 1).padStart(2, '0')}`;
      const dayEvents = events.filter((e) => dateKey(new Date(e.date)) === key);
      return {
        key,
        number: i + 1,
        active: activeDates.includes(key),
        xp: dayEvents.reduce((total, e) => total + e.xp, 0),
        quests: dayEvents.filter((e) => e.kind === 'quest').length,
        future: key > dateKey(now),
      };
    },
  );
  const breakdown = [
    { kind: 'quest', label: 'Квесты', xp: 0 },
    { kind: 'score', label: 'Рост Life Score', xp: 0 },
    { kind: 'goal', label: 'Большие цели', xp: 0 },
    { kind: 'streak', label: 'Награды за серии', xp: 0 },
    { kind: 'legacy', label: 'Старые записи', xp: 0 },
  ].map((row) => ({
    ...row,
    xp: events
      .filter((e) => (e.kind ?? 'legacy') === row.kind)
      .reduce((total, e) => total + e.xp, 0),
  }));
  const xp = events.reduce((total, e) => total + e.xp, 0);
  const topSphere =
    sphereResults.filter((s) => s.xp > 0).sort((a, b) => b.xp - a.xp)[0] ??
    null;
  return {
    month,
    xp,
    quests: events.filter((e) => e.kind === 'quest').length,
    goals: events.filter((e) => e.kind === 'goal').length,
    activeDays: activeDates.length,
    longest,
    days,
    offset: (start.getDay() + 6) % 7,
    events,
    sphereResults,
    breakdown,
    topSphere,
    partial:
      !trackingDate || trackingDate > start || events.some((e) => !e.kind),
    trackingSince: tracking?.since ?? null,
    current: month === monthKey(now),
  };
}
