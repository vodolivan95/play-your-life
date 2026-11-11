/** This review flag must never enable the local game on production/main builds. */
export function taskReviewPreviewBuild(environment?: string, branch?: string) {
  return environment === "preview" && branch === "codex/task-neon-window";
}
export function taskReviewEnabled(
  development: boolean,
  reviewBuild: boolean,
  search: string,
) {
  return (
    (development || reviewBuild) &&
    new URLSearchParams(search).get("local-preview") === "1"
  );
}
export function isTaskReviewMode() {
  return taskReviewEnabled(
    import.meta.env.DEV,
    import.meta.env.TASK_REVIEW_PREVIEW === true,
    location.search,
  );
}
