import { useSyncExternalStore } from "react";
export type GoalRoute = {
  goalId?: string;
  stageId?: string;
  taskId?: string;
};
export function goalPath(route: GoalRoute) {
  return (
    "/goals" +
    (route.goalId ? "/" + encodeURIComponent(route.goalId) : "") +
    (route.stageId ? "/stages/" + encodeURIComponent(route.stageId) : "") +
    (route.taskId ? "/tasks/" + encodeURIComponent(route.taskId) : "")
  );
}
export function readGoalRoute(): GoalRoute | null {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let path = location.hash.startsWith("#/goals")
    ? location.hash.slice(1)
    : location.pathname.slice(base.length);
  const recovery = new URLSearchParams(location.search).get("goalRoute");
  if (recovery) path = recovery;
  const match = path.match(
    /^\/goals(?:\/([^/]+))?(?:\/stages\/([^/]+))?(?:\/tasks\/([^/]+))?\/?$/,
  );
  if (!match) return null;
  try {
    return {
      goalId: match[1] && decodeURIComponent(match[1]),
      stageId: match[2] && decodeURIComponent(match[2]),
      taskId: match[3] && decodeURIComponent(match[3]),
    };
  } catch {
    return null;
  }
}
export function navigateGoal(route: GoalRoute) {
  history.pushState(
    null,
    "",
    import.meta.env.BASE_URL.replace(/\/$/, "") + goalPath(route),
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}
export function useGoalRoute() {
  const path = useSyncExternalStore(
    subscribe,
    () => location.pathname + location.hash + location.search,
  );
  void path;
  return readGoalRoute();
}
