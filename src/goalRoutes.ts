/** Hash routes preserve direct links and reloads on static GitHub Pages. */
export function goalRoute(goalId: string, stageId?: string) {
  return `/goals/${encodeURIComponent(goalId)}${stageId ? `/stages/${encodeURIComponent(stageId)}` : ''}`;
}
export function readGoalRoute(
  hash = window.location.hash,
): { goalId: string; stageId?: string } | null {
  const match = /^#\/goals\/([^/]+)(?:\/stages\/([^/]+))?$/.exec(hash);
  if (!match) return null;
  try {
    return {
      goalId: decodeURIComponent(match[1]),
      ...(match[2] ? { stageId: decodeURIComponent(match[2]) } : {}),
    };
  } catch {
    return null;
  }
}
