/**
 * Таймер фактического времени задачи (ТЗ «Этап 2», раздел 7.3).
 *
 * Хранится только в localStorage этого устройства — не в GameState/Firestore. Это
 * сознательное упрощение первой версии: открытие той же задачи на другом устройстве не
 * покажет работающий таймер (ограничение описано в
 * docs/planning-system-2.0/STAGE2_IMPLEMENTATION.md). Корректное восстановление после
 * обновления страницы на том же устройстве обеспечивается тем, что здесь хранится
 * `startedAt`/`pausedAt` (моменты времени), а не истекающий интервал — прошедшее время
 * всегда пересчитывается от сохранённого момента, а не тикает в памяти вкладки.
 */
export type TaskTimer = {
  taskId: string;
  /** Когда таймер запущен/возобновлён последний раз (ISO); пока не на паузе. */
  runningSince?: string;
  /** Секунды, накопленные до текущего запуска (т.е. до runningSince), через предыдущие пары старт/пауза. */
  accumulatedSeconds: number;
};
const STORAGE_KEY = 'play-your-life-task-timer-v1';

function readAll(): Record<string, TaskTimer> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, TaskTimer>;
  } catch {
    // Приватный режим, заблокированное хранилище или повреждённые данные — таймер просто не восстановится.
    return {};
  }
}
function writeAll(all: Record<string, TaskTimer>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Хранилище недоступно — таймер продолжает работать в памяти текущей вкладки до перезагрузки.
  }
}
/** Текущий таймер задачи, если он запущен или стоит на паузе с накопленным временем. */
export function readTimer(taskId: string): TaskTimer | undefined {
  return readAll()[taskId];
}
export function startTimer(taskId: string, now = new Date()): TaskTimer {
  const timer: TaskTimer = { taskId, runningSince: now.toISOString(), accumulatedSeconds: 0 };
  const all = readAll(); all[taskId] = timer; writeAll(all);
  return timer;
}
export function pauseTimer(taskId: string, now = new Date()): TaskTimer | undefined {
  const all = readAll();
  const timer = all[taskId];
  if (!timer?.runningSince) return timer;
  const elapsed = Math.max(0, (now.getTime() - Date.parse(timer.runningSince)) / 1000);
  const next: TaskTimer = { taskId, accumulatedSeconds: timer.accumulatedSeconds + elapsed };
  all[taskId] = next; writeAll(all);
  return next;
}
export function resumeTimer(taskId: string, now = new Date()): TaskTimer | undefined {
  const all = readAll();
  const timer = all[taskId];
  if (!timer || timer.runningSince) return timer;
  const next: TaskTimer = { taskId, runningSince: now.toISOString(), accumulatedSeconds: timer.accumulatedSeconds };
  all[taskId] = next; writeAll(all);
  return next;
}
/** Останавливает и удаляет таймер, возвращая итоговые секунды (для учёта как фактического времени). */
export function finishTimer(taskId: string, now = new Date()): number {
  const all = readAll();
  const timer = all[taskId];
  if (!timer) return 0;
  const running = timer.runningSince ? Math.max(0, (now.getTime() - Date.parse(timer.runningSince)) / 1000) : 0;
  delete all[taskId]; writeAll(all);
  return timer.accumulatedSeconds + running;
}
/** Сбрасывает таймер без учёта накопленного времени (например, если задачу удалили). */
export function discardTimer(taskId: string) {
  const all = readAll(); delete all[taskId]; writeAll(all);
}
export function elapsedSeconds(timer: TaskTimer, now = new Date()): number {
  const running = timer.runningSince ? Math.max(0, (now.getTime() - Date.parse(timer.runningSince)) / 1000) : 0;
  return timer.accumulatedSeconds + running;
}
export function formatElapsed(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
