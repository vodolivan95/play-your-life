import { test } from "node:test";
import assert from "node:assert/strict";
import {
  taskReviewEnabled,
  taskReviewPreviewBuild,
} from "../src/taskReviewMode.ts";
test("only this task preview branch can enable the review build", () => {
  assert.equal(
    taskReviewPreviewBuild("preview", "codex/task-neon-window"),
    true,
  );
  for (const environment of ["production", "development", undefined])
    assert.equal(
      taskReviewPreviewBuild(environment, "codex/task-neon-window"),
      false,
    );
  for (const branch of ["main", "other-branch", undefined])
    assert.equal(taskReviewPreviewBuild("preview", branch), false);
});
test("query cannot bypass production login; local game requires DEV or scoped preview build", () => {
  assert.equal(taskReviewEnabled(false, false, "?local-preview=1"), false);
  assert.equal(taskReviewEnabled(true, false, "?local-preview=1"), true);
  assert.equal(taskReviewEnabled(false, true, "?local-preview=1"), true);
  assert.equal(taskReviewEnabled(false, true, "?local-preview=0"), false);
  assert.equal(taskReviewEnabled(false, true, ""), false);
});
