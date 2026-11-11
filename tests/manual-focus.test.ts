import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/game.ts";
import { dateKey } from "../src/game.ts";
import {
  saveManualFocus,
  removeManualFocus,
  manualFocusVersion,
} from "../src/manualFocus.ts";
import {
  startStopwatch,
  finishFocus,
  taskFocusHistory,
  taskFocusSeconds,
} from "../src/focusSessions.ts";
import { actualMinutes, validPlanningEvent } from "../src/planningData.ts";
import { validateState } from "../src/stateValidation.ts";
const at = new Date("2026-11-11T10:30:00");
const input = {
  id: "manual-1",
  taskId: "english-1",
  minutes: 45,
  day: dateKey(at),
  comment: "Согласование схемы",
};
test("ручное время и таймер имеют один факт, без XP и повторного сохранения", () => {
  let s = initialState();
  const before = s;
  s = saveManualFocus(s, input, at);
  assert.equal(taskFocusSeconds(s, input.taskId), 2700);
  assert.equal(actualMinutes(s, input.taskId), 45);
  assert.equal(taskFocusHistory(s, input.taskId)[0].result, input.comment);
  assert.equal(saveManualFocus(s, input, at), s);
  s = startStopwatch(s, { taskId: input.taskId }, at, "clock");
  s = finishFocus(s, {}, new Date(at.getTime() + 25 * 60000));
  assert.equal(taskFocusSeconds(s, input.taskId), 70 * 60);
  assert.equal(actualMinutes(s, input.taskId), 70);
  assert.deepEqual(s.spheres, before.spheres);
  assert.equal(s.xp, before.xp);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
});
test("редактирование заменяет минуты, удаление исключает из факта и оставляет аудит", () => {
  let s = saveManualFocus(initialState(), input, at);
  const old = s.events[0];
  s = saveManualFocus(
    s,
    {
      ...input,
      editing: true,
      expected: manualFocusVersion(old),
      minutes: 30,
      day: "2026-11-10",
      comment: "Исправлено",
    },
    at,
    "audit-1",
  );
  assert.equal(taskFocusSeconds(s, input.taskId), 1800);
  assert.equal(actualMinutes(s, input.taskId), 30);
  assert.equal(taskFocusHistory(s, input.taskId)[0].result, "Исправлено");
  assert.equal(
    dateKey(new Date(taskFocusHistory(s, input.taskId)[0].startedAt)),
    "2026-11-10",
  );
  assert.throws(
    () =>
      saveManualFocus(
        s,
        { ...input, editing: true, expected: manualFocusVersion(old) },
        at,
      ),
    /изменилась/,
  );
  s = removeManualFocus(s, input.taskId, input.id);
  assert.equal(taskFocusSeconds(s, input.taskId), 0);
  assert.equal(actualMinutes(s, input.taskId), 0);
  assert.ok(s.events.find((e) => e.id === input.id)?.title.includes("Удалена"));
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
  assert.throws(
    () => saveManualFocus(s, { ...input, editing: true }, at),
    /удалена/,
  );
});
test("ручная запись проверяет минуты, дату, комментарий и не переписывает таймер", () => {
  const s = initialState();
  for (const patch of [
    { minutes: 0 },
    { minutes: 1441 },
    { minutes: 1.5 },
    { day: "2026-02-30" },
    { day: "2026-11-12" },
    { comment: "x".repeat(301) },
    { taskId: "missing" },
  ])
    assert.throws(() => saveManualFocus(s, { ...input, ...patch }, at));
  const running = startStopwatch(s, { taskId: input.taskId }, at, "run");
  const saved = saveManualFocus(running, input, at);
  assert.deepEqual(saved.focusSession, running.focusSession);
  const finished = finishFocus(running, {}, new Date(at.getTime() + 60000));
  assert.throws(
    () => removeManualFocus(finished, input.taskId, "focus-run"),
    /Ручная/,
  );
  assert.equal(
    validPlanningEvent({
      kind: "planning",
      xp: 0,
      sourceId: input.taskId,
      planningChange: { type: "time", minutes: 3, comment: "x".repeat(301) },
    }),
    false,
  );
});
