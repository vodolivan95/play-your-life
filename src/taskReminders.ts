import type { Quest } from './game.ts';
export function dueTaskReminders(tasks: Quest[], now: number) {
  return tasks.filter(q => !q.done && !q.wontDo && !q.planning?.archivedAt).flatMap(q => {
    const base = q.startsAt || q.dueAt;
    if (!base) return [];
    const at = Date.parse(base.length === 10 ? `${base}T09:00:00` : base);
    return (q.details?.reminders ?? []).flatMap(minutes => {
      const when = at - minutes * 60000;
      // Catch up after a short background pause, without firing months-old reminders on login.
      return when <= now && when > now - 300000 ? [{ key: `${q.id}:${base}:${minutes}`, taskId: q.id, name: q.name }] : [];
    });
  });
}
