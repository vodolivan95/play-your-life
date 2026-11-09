/**
 * Таймер фактического времени задачи (ТЗ «Этап 2», раздел 7.3; надёжность — ТЗ «0.76.0», раздел 3).
 *
 * Хранится только в localStorage этого устройства — не в GameState/Firestore. Это
 * сознательное упрощение: открытие той же задачи на другом устройстве не покажет работающий
 * таймер (ограничение описано в docs/planning-system-2.0/STAGE2_IMPLEMENTATION.md). Корректное
 * восстановление после обновления страницы на том же устройстве обеспечивается тем, что здесь
 * хранится `runningSince` (момент времени), а не истекающий интервал — прошедшее время всегда
 * пересчитывается от сохранённого момента, а не тикает в памяти вкладки.
 *
 * Три дополнительных гарантии (0.76.0, раздел 3 — исправление ошибок Этапа 2):
 * - 3.1 Безопасный порядок: таймер НЕ удаляется из хранилища вызовом `peekFinish` — только
 *   `commitFinish`, который вызывающая сторона (TaskPlanningFields.tsx) должна вызвать лишь
 *   после подтверждённо успешного сохранения времени в GameState. `actionId` сохраняется на всю
 *   сессию таймера, поэтому повторная попытка «Завершить» после сбоя переиспользует тот же id и
 *   не задвоит время (addPlanningEvent отбрасывает повтор события с уже использованным id).
 * - 3.2 Один активный таймер на пользователя: `startTimer`/`resumeTimer` отказывают, если у
 *   этого владельца уже идёт (не на паузе) таймер другой задачи — вызывающая сторона показывает
 *   предупреждение и предлагает сначала завершить или поставить первый на паузу.
 * - 3.3 Изоляция по владельцу: ключ localStorage включает `ownerId`, поэтому два аккаунта на
 *   одном устройстве/браузере не видят и не могут случайно завершить таймер друг друга.
 * - 3.4 Повреждённое хранилище не теряет время незаметно: `isTimerStorageCorrupted` отличает
 *   «данные повреждены» от «таймеров нет», чтобы вызывающая сторона могла явно сообщить об этом.
 */
export type TaskTimer = {
  taskId: string;
  /**
   * Идентификатор события «фактическое время», присваиваемый один раз при старте и сохраняемый
   * через все последующие паузы/продолжения той же сессии таймера. Опционален в типе ради
   * обратной совместимости с таймером, сохранённым версией до 0.76.0 (раздел 3.1) — такой
   * таймер получает id лениво при первом вызове `peekFinish` (см. ниже).
   */
  actionId?: string;
  /** Когда таймер запущен/возобновлён последний раз (ISO); пусто, если стоит на паузе. */
  runningSince?: string;
  /** Секунды, накопленные до текущего запуска (т.е. до runningSince), через предыдущие пары старт/пауза. */
  accumulatedSeconds: number;
};

type StoredTimers = Record<string, TaskTimer>;

function storageKey(ownerId: string): string {
  // Изоляция по владельцу (3.3): без суффикса таймер одного аккаунта был бы виден и доступен
  // другому аккаунту, вошедшему на том же устройстве/браузере.
  return `play-your-life-task-timer-v1:${ownerId || 'anon'}`;
}

function readAll(ownerId: string): { timers: StoredTimers; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return { timers: {}, corrupted: false };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { timers: {}, corrupted: true };
    return { timers: parsed as StoredTimers, corrupted: false };
  } catch {
    // Невалидный JSON — отличаем от «пусто» (3.4), чтобы вызывающая сторона могла явно
    // сообщить о повреждении, а не тихо продолжить как будто таймеров никогда не было.
    return { timers: {}, corrupted: true };
  }
}
function writeAll(ownerId: string, all: StoredTimers) {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify(all));
  } catch {
    // Хранилище недоступно (приватный режим/квота) — таймер продолжает работать в памяти
    // текущей вкладки до перезагрузки; восстановления после перезагрузки в этом случае не будет.
  }
}

/**
 * true, если сохранённые данные таймеров этого владельца повреждены (не валидный JSON или не
 * объект) — вызывающая сторона должна явно сообщить об этом пользователю (3.4), а не молча
 * продолжить так, будто у него никогда не было запущенного таймера.
 */
export function isTimerStorageCorrupted(ownerId: string): boolean {
  return readAll(ownerId).corrupted;
}

/** Текущий таймер задачи, если он запущен или стоит на паузе с накопленным временем. */
export function readTimer(ownerId: string, taskId: string): TaskTimer | undefined {
  return readAll(ownerId).timers[taskId];
}

/**
 * Любой ДРУГОЙ запущенный (не на паузе) таймер этого владельца — используется для проверки
 * «один активный таймер на пользователя» (3.2) перед стартом/продолжением нового, и может
 * использоваться интерфейсом, чтобы заранее показать предупреждение с названием другой задачи.
 */
export function activeTimer(ownerId: string, excludeTaskId?: string): TaskTimer | undefined {
  const { timers } = readAll(ownerId);
  return Object.values(timers).find((t) => t.runningSince && t.taskId !== excludeTaskId);
}

function ensureNoOtherActive(ownerId: string, taskId: string) {
  const other = activeTimer(ownerId, taskId);
  if (other) {
    throw new Error('У вас уже идёт отсчёт времени другой задачи. Поставьте его на паузу или завершите, прежде чем начать этот.');
  }
}

export function startTimer(ownerId: string, taskId: string, now = new Date()): TaskTimer {
  ensureNoOtherActive(ownerId, taskId);
  const timer: TaskTimer = { taskId, actionId: crypto.randomUUID(), runningSince: now.toISOString(), accumulatedSeconds: 0 };
  const { timers } = readAll(ownerId); timers[taskId] = timer; writeAll(ownerId, timers);
  return timer;
}
export function pauseTimer(ownerId: string, taskId: string, now = new Date()): TaskTimer | undefined {
  const { timers } = readAll(ownerId);
  const timer = timers[taskId];
  if (!timer?.runningSince) return timer;
  const elapsed = Math.max(0, (now.getTime() - Date.parse(timer.runningSince)) / 1000);
  const next: TaskTimer = { taskId, actionId: timer.actionId, accumulatedSeconds: timer.accumulatedSeconds + elapsed };
  timers[taskId] = next; writeAll(ownerId, timers);
  return next;
}
export function resumeTimer(ownerId: string, taskId: string, now = new Date()): TaskTimer | undefined {
  const { timers } = readAll(ownerId);
  const timer = timers[taskId];
  if (!timer || timer.runningSince) return timer;
  ensureNoOtherActive(ownerId, taskId);
  const next: TaskTimer = { taskId, actionId: timer.actionId, runningSince: now.toISOString(), accumulatedSeconds: timer.accumulatedSeconds };
  timers[taskId] = next; writeAll(ownerId, timers);
  return next;
}
/**
 * Секунды, накопленные к данному моменту, И НЕ УДАЛЯЕТ таймер (3.1: безопасный порядок).
 * Вызывающая сторона сперва пытается сохранить это время как факт в GameState и только при
 * подтверждённом успехе вызывает `commitFinish` — при сбое таймер остаётся в хранилище для
 * повторной попытки с тем же `actionId`, не теряя и не задваивая накопленное время.
 */
export function peekFinish(ownerId: string, taskId: string, now = new Date()): { seconds: number; actionId: string } | undefined {
  const { timers } = readAll(ownerId);
  const timer = timers[taskId];
  if (!timer) return undefined;
  let actionId = timer.actionId;
  if (!actionId) {
    // Таймер сохранён версией до 0.76.0 (раздел 3.1), ещё без actionId — присваиваем и
    // сохраняем сейчас, чтобы повторная попытка «Завершить» не создала второе событие.
    actionId = crypto.randomUUID();
    timers[taskId] = { ...timer, actionId };
    writeAll(ownerId, timers);
  }
  return { seconds: elapsedSeconds(timer, now), actionId };
}
/** Удаляет таймер — вызывать только после подтверждённо успешного сохранения его времени. */
export function commitFinish(ownerId: string, taskId: string) {
  const { timers } = readAll(ownerId); delete timers[taskId]; writeAll(ownerId, timers);
}
/**
 * Сбрасывает таймер без учёта накопленного времени — например, сессия короче 30 секунд (3.5)
 * или задача удалена. В отличие от `commitFinish`, это осознанный отказ от времени, а не
 * удаление после его сохранения.
 */
export function discardTimer(ownerId: string, taskId: string) {
  const { timers } = readAll(ownerId); delete timers[taskId]; writeAll(ownerId, timers);
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
