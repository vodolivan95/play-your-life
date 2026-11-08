import type { Quest } from './game.ts';

export const MAX_TASK_DEPENDENCIES = 50;
export function validDependencyIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_TASK_DEPENDENCIES
    && value.every((id) => typeof id === 'string' && !!id.trim() && id.length <= 200)
    && new Set(value).size === value.length;
}

/** Итеративная проверка графа: импорт длинной цепочки не переполняет стек. */
export function validDependencyGraph(quests: readonly Quest[]): boolean {
  const byId = new Map(quests.map((q) => [q.id, q]));
  const colors = new Map<string, number>();
  for (const root of quests) {
    if (colors.get(root.id) === 2) continue;
    const stack: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    colors.set(root.id, 1);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const deps = byId.get(frame.id)?.planning?.dependencyIds ?? [];
      if (frame.next >= deps.length) { colors.set(frame.id, 2); stack.pop(); continue; }
      const id = deps[frame.next++];
      if (!byId.has(id)) continue; // Удалённая задача остаётся явной незакрытой зависимостью.
      if (colors.get(id) === 1) return false;
      if (colors.get(id) === 2) continue;
      colors.set(id, 1); stack.push({ id, next: 0 });
    }
  }
  return true;
}

export function dependencyBlockers(quests: readonly Quest[], task: Quest): { id: string; name: string; missing: boolean }[] {
  if (!task.planning?.dependencyIds?.length) return [];
  const byId = new Map(quests.map((q) => [q.id, q]));
  return task.planning.dependencyIds.flatMap((id) => {
    const q = byId.get(id);
    return q?.done ? [] : [{ id, name: q?.name ?? `Удалённая задача (${id})`, missing: !q }];
  });
}
export function dependencyBlockMessage(quests: readonly Quest[], task: Quest): string | undefined {
  const blockers = dependencyBlockers(quests, task);
  if (!blockers.length) return undefined;
  return `Сначала заверши задачи-предшественники: ${blockers.slice(0, 3).map((q) => q.name).join(', ')}${blockers.length > 3 ? ` и ещё ${blockers.length - 3}` : ''}. Удалённую зависимость можно убрать в окне задачи.`;
}
export function dependentTasks(quests: readonly Quest[], id: string): Quest[] {
  return quests.filter((q) => q.planning?.dependencyIds?.includes(id));
}
