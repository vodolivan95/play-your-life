/**
 * «Моё будущее», этап 2 (ТЗ, раздел 8): расчётный модуль по фактическому темпу.
 * Чистые функции без обращения к сохранениям: на вход — уже загруженные данные игры,
 * на выход — агрегаты и уровень достаточности данных. Сохранения этот модуль не меняет.
 *
 * Модель v1. Пороги выбраны осторожно и не выдают даты: без достаточной истории
 * раздел честно пишет «Недостаточно данных».
 */

export const FORECAST_MODEL_VERSION = 1;

export type ForecastWindow = 30 | 90 | 180;
export const FORECAST_WINDOWS: readonly ForecastWindow[] = [30, 90, 180];

export type PaceWindow = {
  windowDays: ForecastWindow;
  tasksDone: number;
  activeDays: number;
  habitDays: number;
  /** Среднее число выполненных задач в неделю за окно. */
  tasksPerWeek: number;
};

export type DataQuality = 'insufficient' | 'preliminary' | 'ready';

export type PaceSummary = {
  modelVersion: number;
  asOf: string;
  windows: Record<ForecastWindow, PaceWindow>;
  dataQuality: DataQuality;
  /** Человекочитаемые ограничения; пусто, если данных достаточно. */
  limitations: string[];
};

export type PaceSource = {
  quests: { done: boolean; completedAt?: string }[];
  activeDates: string[];
  habitCompletions?: { day: string; value: number }[];
};

const DAY_MS = 86_400_000;

/** Календарный день YYYY-MM-DD по UTC: сравнивается строкой, без часовых поясов. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Дата старта окна: сегодня минус windowDays + 1 (включая сегодня). */
export function windowStart(asOf: Date, windowDays: number): string {
  return dayKey(new Date(asOf.getTime() - (windowDays - 1) * DAY_MS));
}

function inWindow(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

export function summarizePace(source: PaceSource, asOf: Date): PaceSummary {
  const end = dayKey(asOf);
  const windows = {} as Record<ForecastWindow, PaceWindow>;

  for (const windowDays of FORECAST_WINDOWS) {
    const start = windowStart(asOf, windowDays);
    const tasksDone = source.quests.filter(
      (quest) => quest.done && quest.completedAt && inWindow(quest.completedAt.slice(0, 10), start, end),
    ).length;
    const activeDays = new Set(source.activeDates.filter((day) => inWindow(day, start, end))).size;
    const habitDays = new Set(
      (source.habitCompletions ?? []).filter((item) => item.value > 0 && inWindow(item.day, start, end)).map((item) => item.day),
    ).size;
    windows[windowDays] = {
      windowDays,
      tasksDone,
      activeDays,
      habitDays,
      tasksPerWeek: Math.round(((tasksDone / windowDays) * 7) * 10) / 10,
    };
  }

  const recent = windows[90];
  const limitations: string[] = [];
  let dataQuality: DataQuality = 'ready';

  if (recent.tasksDone === 0 && recent.habitDays === 0) {
    dataQuality = 'insufficient';
    limitations.push('За последние 90 дней нет выполненных задач и отметок привычек.');
  } else {
    if (recent.activeDays < 30) {
      dataQuality = 'preliminary';
      limitations.push(`Активных дней за 90 дней: ${recent.activeDays}. Для уверенного темпа нужно хотя бы 30.`);
    }
    if (recent.tasksDone < 10) {
      dataQuality = 'preliminary';
      limitations.push(`Выполненных задач за 90 дней: ${recent.tasksDone}. Для уверенного темпа нужно хотя бы 10.`);
    }
  }

  return {
    modelVersion: FORECAST_MODEL_VERSION,
    asOf: end,
    windows,
    dataQuality,
    limitations,
  };
}

/** Текст для раздела: без данных или при предварительной оценке — честная пометка, без дат. */
export function qualityMessage(quality: DataQuality): string {
  if (quality === 'insufficient') return 'Недостаточно данных для достоверного расчёта.';
  if (quality === 'preliminary') return 'Прогноз носит предварительный характер.';
  return 'Данных достаточно для расчёта темпа.';
}
