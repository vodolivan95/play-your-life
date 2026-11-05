/** Интервал фонового опроса TickTick, пока сайт открыт. */
export const TICKTICK_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function isTickTickAutoSyncDue(lastAttemptAt: number, now: number): boolean {
  return !Number.isFinite(lastAttemptAt) || lastAttemptAt <= 0 || now - lastAttemptAt >= TICKTICK_AUTO_SYNC_INTERVAL_MS;
}
