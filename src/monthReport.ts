import { dateKey, spheres } from './game.ts';
import type { GameState } from './game.ts';
import { monthKey, monthLabel, monthlySummary, moveMonth, validMonth } from './monthly.ts';
import { reviewOf, filledSpheres } from './keyResults.ts';

/** «Ключевые итоги → Отчёт месяца» (0.37.0). Всё считается по сохранённой истории, ничего не выдумывается. */

/** Важность сферы: раз в квартал, 1–5 на сферу. Ключ квартала — `2026-Q4`. */
export type SphereImportance = { quarter: string; values: Record<string, number> };

export function quarterKey(now = new Date()) {
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}
export function validImportance(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.quarter !== 'string' || !/^\d{4}-Q[1-4]$/.test(v.quarter)) return false;
  if (typeof v.values !== 'object' || v.values === null || Array.isArray(v.values)) return false;
  const ids = spheres.map((s) => s.id);
  return Object.entries(v.values as Record<string, unknown>).every(
    ([id, n]) => ids.includes(id) && typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5,
  );
}
export function setImportance(state: GameState, sphere: string, value: number, now = new Date()): GameState {
  if (!spheres.some((s) => s.id === sphere) || !Number.isInteger(value) || value < 1 || value > 5) return state;
  const quarter = quarterKey(now);
  const current = state.sphereImportance?.quarter === quarter ? state.sphereImportance.values : {};
  return { ...state, sphereImportance: { quarter, values: { ...current, [sphere]: value } } };
}

export function percentChange(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}
const average = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/** Привычки месяца: плановые дни до сегодня, выполнено / пропущено / ещё впереди. */
export function habitsReport(state: GameState, month: string, now = new Date()) {
  const today = dateKey(now);
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const habits = (state.habits ?? []).filter((h) => h.isActive);
  const rows = habits.map((h) => {
    const done = new Set(
      (state.habitCompletions ?? []).filter((c) => c.habitId === h.id && c.rewardClaimed && c.day.slice(0, 7) === month).map((c) => c.day),
    );
    const created = h.createdAt.slice(0, 10);
    const cells: ('done' | 'missed' | 'future')[] = [];
    for (let d = 1; d <= days; d += 1) {
      const key = `${month}-${String(d).padStart(2, '0')}`;
      const weekday = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, d, 12).getDay();
      if (!h.weekdays.includes(weekday) || key < created) continue;
      cells.push(done.has(key) ? 'done' : key > today ? 'future' : key === today ? 'future' : 'missed');
    }
    const due = cells.filter((c) => c !== 'future').length;
    const made = cells.filter((c) => c === 'done').length;
    return { id: h.id, name: h.title, cells, made, due, rate: due ? Math.round((made / due) * 100) : null, streak: h.currentStreak, best: h.bestStreak };
  });
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  const totalMade = rows.reduce((s, r) => s + r.made, 0);
  return { rows, rate: totalDue ? Math.round((totalMade / totalDue) * 100) : null, totalDue, totalMade };
}

export function monthReport(state: GameState, month: string, now = new Date()) {
  if (!validMonth(month)) throw new Error('Неверный месяц');
  const summary = monthlySummary(state, month, now);
  const previous = monthlySummary(state, moveMonth(month, -1), now);
  const current = month === monthKey(now);
  const daysTotal = summary.days.length;
  const daysPassed = summary.days.filter((d) => !d.future).length;
  const xpChange = percentChange(summary.xp, previous.xp);

  const scored = summary.sphereResults.filter((s) => s.before !== null && s.after !== null);
  const balance =
    scored.length === spheres.length
      ? { before: average(scored.map((s) => s.before as number)), after: average(scored.map((s) => s.after as number)) }
      : null;
  const growth = scored
    .filter((s) => (s.delta ?? 0) > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0];

  const pastDays = summary.days.filter((d) => !d.future);
  const bestDay = [...pastDays].sort((a, b) => b.xp - a.xp)[0];
  const emptyDays = pastDays.filter((d) => d.quests === 0 && d.xp === 0).length;
  const maxDayXp = Math.max(1, ...summary.days.map((d) => d.xp));

  // Шесть месяцев подряд.
  const months = Array.from({ length: 6 }, (_, i) => {
    const key = moveMonth(month, i - 5);
    const s = monthlySummary(state, key, now);
    return { key, label: monthLabel(key).split(' ')[0].slice(0, 3), xp: s.xp, current: key === monthKey(now) };
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.xp));
  const bestMonth = [...months].sort((a, b) => b.xp - a.xp)[0];

  // Лучший день недели по XP за выбранный месяц.
  const weekdayNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
  const byWeekday = Array(7).fill(0) as number[];
  for (const d of summary.days) {
    byWeekday[new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, d.number, 12).getDay()] += d.xp;
  }
  const bestWeekdayXp = Math.max(...byWeekday);
  const insights: { label: string; value: string }[] = [];
  if (bestMonth.xp > 0) insights.push({ label: 'Лучший из шести месяцев', value: `${monthLabel(bestMonth.key).split(' ')[0]} · ${bestMonth.xp} XP` });
  if (bestWeekdayXp > 0) insights.push({ label: 'Самый продуктивный день недели', value: `${weekdayNames[byWeekday.indexOf(bestWeekdayXp)]} · ${bestWeekdayXp} XP` });
  if (summary.topSphere) insights.push({ label: 'Больше всего XP', value: `${summary.topSphere.name} · ${summary.topSphere.xp} XP` });

  // Сферы и статус итога.
  const review = reviewOf(state, month);
  const totalSphereXp = summary.sphereResults.reduce((s, r) => s + r.xp, 0);
  const sphereRows = summary.sphereResults.map((s) => {
    const r = review.spheres[s.id];
    const text = r ? (r.achieved.trim() || r.next.trim() || r.failed.trim()) : '';
    const done = !!r && !!r.achieved.trim() && (!!r.next.trim() || !!r.failed.trim());
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      xp: s.xp,
      share: totalSphereXp ? Math.round((s.xp / totalSphereXp) * 100) : 0,
      levels: s.levelBefore !== null && s.levelAfter !== null ? (s.levelBefore === s.levelAfter ? `Уровень ${s.levelAfter}` : `Уровень ${s.levelBefore} → ${s.levelAfter}`) : 'Учёт уровней ещё не начат',
      before: s.before,
      after: s.after,
      status: text ? (done ? ('done' as const) : ('draft' as const)) : ('none' as const),
      result: r?.achieved.trim().slice(0, 90) ?? '',
    };
  });

  // Главные цели: цели месяца, иначе ближайшие к завершению.
  const focusIds = state.monthlyFocus?.month === month ? state.monthlyFocus.goalIds : [];
  const goalPool = state.goals.filter((g) => g.target > 0);
  const chosen = (focusIds.length ? focusIds.map((id) => goalPool.find((g) => g.id === id)).filter((g) => !!g) : goalPool.filter((g) => g.current < g.target).sort((a, b) => b.current / b.target - a.current / a.target)).slice(0, 3);
  const goals = chosen.map((g) => ({ id: g!.id, name: g!.name, percent: Math.min(100, Math.round((g!.current / g!.target) * 100)), text: `${g!.current} из ${g!.target}` }));

  // Достижения месяца — достигнутые цели из истории.
  const achievements = summary.events
    .filter((e) => e.kind === 'goal')
    .map((e) => ({ name: e.title, date: new Date(e.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) }))
    .slice(0, 5);

  // Важное и усилия.
  const importance = state.sphereImportance;
  const importanceFresh = importance?.quarter === quarterKey(now);
  const values = spheres.map((s) => {
    const row = sphereRows.find((r) => r.id === s.id)!;
    const imp = importance?.values[s.id] ?? 0;
    let flag: 'focus' | 'overload' | 'ok' | 'none' = 'none';
    if (imp > 0) flag = imp >= 4 && row.share < 10 ? 'focus' : imp <= 3 && row.share >= 15 ? 'overload' : 'ok';
    return { id: s.id, name: s.name, color: s.color, importance: imp, share: row.share, flag };
  });
  const focusNames = values.filter((v) => v.flag === 'focus').map((v) => `«${v.name}»`);

  return {
    month,
    current,
    summary,
    daysTotal,
    daysPassed,
    daysLeft: daysTotal - daysPassed,
    xpChange,
    previousXp: previous.xp,
    previousQuests: previous.quests,
    balance,
    growth: growth ? { name: growth.name, before: growth.before as number, after: growth.after as number } : null,
    bestDay: bestDay && bestDay.xp > 0 ? bestDay : null,
    emptyDays,
    maxDayXp,
    months,
    maxMonth,
    insights,
    sphereRows,
    habits: habitsReport(state, month, now),
    goals,
    achievements,
    values,
    importanceFresh,
    focusNote: focusNames.length ? `${focusNames.join(' и ')} важны для тебя, но получили мало усилий. Хочешь взять одну из них в фокус на следующий месяц?` : '',
    rating: state.monthlyReflections?.[month]?.mood ?? null,
    filled: filledSpheres(review),
    review,
  };
}
