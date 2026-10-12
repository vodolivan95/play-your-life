import { dateKey, difficulties, questsForToday, streak } from './game.ts';
import type { GameState } from './game.ts';
import { sphereProgress } from './sphereProgress.ts';
import type { RoomId } from './roomEngine.ts';

/** Цифры для экрана и полки наград в 3D-комнате сферы — только из реальных данных игры. */
export function roomStats(state: GameState, roomId: RoomId, title: string, now = new Date()) {
  const progress = sphereProgress(state.spheres[roomId]?.xp ?? 0);
  const since = new Date(now); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0);
  const week = state.events.filter((e) => e.sphere === roomId && Date.parse(e.date) >= since.getTime() && Date.parse(e.date) <= now.getTime());
  const goals = state.goals.filter((g) => g.sphere === roomId);
  const trophies = goals.filter((g) => g.rewarded).length + goals.reduce((n, g) => n + (g.stages ?? []).filter((s) => s.status === 'completed').length, 0);
  const tasks = questsForToday(state, now)
    .filter((q) => q.sphere === roomId && !q.done)
    .slice(0, 3)
    .map((q) => ({ id: q.id, name: q.name, xp: q.sourceType === 'USER_CREATED' ? difficulties[q.difficulty as keyof typeof difficulties] ?? q.xp : q.xp }));
  return {
    title,
    level: progress.level,
    levelProgress: progress.progress,
    weekXp: week.reduce((sum, e) => sum + Math.max(0, e.xp), 0),
    weekDone: week.filter((e) => e.kind === 'quest' || e.kind === 'habit').length,
    streak: streak(state.activeDates, now),
    trophies,
    tasks,
    today: dateKey(now),
  };
}
