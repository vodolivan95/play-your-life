import type { GameState } from './game.ts';
import type { MonthReview } from './keyResults.ts';
import { reviewOf, sphereReviewOf } from './keyResults.ts';
import { monthKey, monthLabel, moveMonth, validMonth } from './monthly.ts';

/** Победа новой формы приоритетнее старого achieved даже тогда, когда она намеренно пуста. */
export function victoryOf(review: MonthReview, sphere: string): string {
  const result = review.spheres[sphere];
  return result?.keyResult ?? result?.achieved ?? '';
}

export type PersonalMonth = {
  month: string;
  label: string;
  tasks: number | null;
  victory: string;
  evidence: string;
  current: boolean;
  future: boolean;
};

function personalMonthOf(state: GameState, month: string, sphere: string, now: Date): PersonalMonth {
  const currentMonth = monthKey(now);
  const current = month === currentMonth;
  const future = month > currentMonth;
  if (future) {
    return { month, label: monthLabel(month), tasks: null, victory: '', evidence: '', current: false, future: true };
  }
  const review = reviewOf(state, month);
  const sphereReview = sphereReviewOf(review, sphere);
  return {
    month,
    label: monthLabel(month),
    tasks: sphereReview.tasksDone ?? null,
    victory: victoryOf(review, sphere),
    evidence: sphereReview.resultEvidence ?? '',
    current,
    future: false,
  };
}

/**
 * Годовой срез одной сферы из ручных месячных итогов. Только завершённые месяцы
 * попадают в годовую сумму: показатели текущего месяца возвращаются отдельно.
 */
export function personalYear(
  state: GameState,
  year: number,
  sphere: string,
  now = new Date(),
): {
  months: PersonalMonth[];
  total: number;
  knownMonths: number;
  elapsedMonths: number;
  victories: number;
  currentTasks: number | null;
} {
  const months = Array.from({ length: 12 }, (_, index) =>
    personalMonthOf(state, `${year}-${String(index + 1).padStart(2, '0')}`, sphere, now),
  );
  const elapsed = months.filter((month) => month.month < monthKey(now));
  const known = elapsed.filter((month) => month.tasks !== null);
  const current = months.find((month) => month.current);
  return {
    months,
    total: known.reduce((total, month) => total + month.tasks!, 0),
    knownMonths: known.length,
    elapsedMonths: elapsed.length,
    victories: elapsed.filter((month) => month.victory.trim().length > 0).length,
    currentTasks: current?.tasks ?? null,
  };
}

/** Последние count месяцев до endMonth включительно, в хронологическом порядке. */
export function personalTimeline(
  state: GameState,
  endMonth: string,
  sphere: string,
  count = 12,
  now = new Date(),
): PersonalMonth[] {
  if (!validMonth(endMonth) || !Number.isSafeInteger(count) || count < 0) return [];
  return Array.from({ length: count }, (_, index) =>
    personalMonthOf(state, moveMonth(endMonth, index - count + 1), sphere, now),
  );
}
