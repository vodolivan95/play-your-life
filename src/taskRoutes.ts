/**
 * Хеш-роут для прямой ссылки на задачу (пункт «Копировать ссылку» в меню «⋯» задачи) —
 * по образцу `goalRoutes.ts`: сохраняет прямые ссылки и перезагрузку страницы на статичном
 * GitHub Pages.
 */
export function taskRoute(taskId: string) {
  return `/tasks/${encodeURIComponent(taskId)}`;
}
export function readTaskRoute(hash = window.location.hash): string | null {
  const match = /^#\/tasks\/([^/]+)$/.exec(hash);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
