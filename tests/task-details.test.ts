import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/game.ts";
import {
  taskGoalForecast,
  validTaskDetails,
  yandexRoute,
  safeWebUrl,
} from "../src/taskDetails.ts";
import { updateTaskSettings } from "../src/taskSettings.ts";
import { duplicateQuest } from "../src/personalQuests.ts";
import { validateState } from "../src/stateValidation.ts";
function setup() {
  const s = initialState();
  s.goals = [
    {
      id: "g",
      name: "Goal",
      sphere: "health",
      current: 0,
      target: 100,
      reward: 0,
      rewarded: false,
      created: "2026-01-01",
      progressMode: "tasks",
    },
  ];
  s.quests = [1, 2, 3].map((weight, i) => ({
    id: String(i),
    name: `Task ${i}`,
    sphere: "health",
    goalId: "g",
    difficulty: "Medium",
    xp: 20,
    done: i === 0,
    weight,
  }));
  return s;
}
test("weighted forecast, completed tasks, removed tasks, one task and no goal", () => {
  const s = setup();
  const f = taskGoalForecast(s, s.quests[1])!;
  assert.ok(Math.abs(f.progress - 100 / 6) < 0.0001);
  assert.ok(Math.abs(f.share - 100 / 3) < 0.0001);
  assert.equal(f.after, 50);
  assert.equal(taskGoalForecast(s, s.quests[0])!.after, f.progress);
  s.quests = [s.quests[1]];
  assert.equal(taskGoalForecast(s, s.quests[0])!.after, 100);
  s.quests[0].done = true;
  assert.equal(taskGoalForecast(s, s.quests[0])!.after, 100);
  s.goals = [];
  assert.equal(taskGoalForecast(s, s.quests[0]), null);
});
test("canonical stage and manual progress are preserved", () => {
  const s = setup();
  s.goals[0].stages = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  s.quests.forEach((q) => (q.stageId = "a"));
  assert.equal(taskGoalForecast(s, s.quests[1])!.after, 25);
  s.goals[0].progressMode = "manual";
  s.goals[0].current = 17;
  assert.equal(taskGoalForecast(s, s.quests[1])!.after, 17);
});
test("maps encode real destination; no address, invalid coordinates and unsafe URL", () => {
  assert.equal(yandexRoute(), null);
  assert.equal(yandexRoute({ address: " " }), null);
  assert.ok(
    yandexRoute({ address: "Москва, Красная площадь" })!.includes(
      encodeURIComponent("Москва, Красная площадь"),
    ),
  );
  assert.equal(
    new URL(
      yandexRoute({ latitude: 55.75, longitude: 37.62 })!,
    ).searchParams.get("rtext"),
    "~55.75,37.62",
  );
  assert.equal(yandexRoute({ latitude: 100, longitude: 37 }), null);
  assert.equal(safeWebUrl("javascript:alert(1)"), null);
  assert.equal(validTaskDetails({ tags: ["Дом", "дом"] }), false);
  assert.equal(
    validTaskDetails({
      attachments: [
        { id: "x", name: "x", type: "link", url: "javascript:alert(1)" },
      ],
    }),
    false,
  );
});
test("project change clears stage, details survive state validation, history has zero XP", () => {
  let s = setup();
  s.goals[0].stages = [{ id: "a", name: "A" }];
  s.quests[1].stageId = "a";
  s = updateTaskSettings(s, "1", {
    goalId: null,
    details: { address: "Москва, Красная площадь", tags: ["Дом"] },
  });
  assert.equal(s.quests[1].stageId, undefined);
  assert.equal(s.quests[1].goalId, undefined);
  validateState(JSON.parse(JSON.stringify(s)));
  assert.ok(
    s.events.filter((e) => e.sourceId === "1").every((e) => e.xp === 0),
  );
  assert.throws(() => updateTaskSettings(s, "1", { stageId: "missing" }));
  assert.throws(() => updateTaskSettings(s, "1", { weight: 0 }));
  const copied = duplicateQuest(s, "1", "local").quests.at(-1)!;
  assert.equal(copied.done, false);
  assert.equal(copied.rewardClaimed, false);
  assert.equal(copied.tickTickSharedAt, undefined);
});

test("duplicate keeps a maximum-length title valid and does not split emoji", () => {
  const s = initialState();
  s.quests[0].name = "Я".repeat(90) + "🧭".repeat(5);
  const next = duplicateQuest(s, s.quests[0].id, "local");
  const copy = next.quests.at(-1)!;
  assert.equal(copy.name, "Я".repeat(90) + "🧭 (копия)");
  assert.equal(copy.name.length, 100);
  assert.equal(s.quests[0].name.length, 100);
  validateState(JSON.parse(JSON.stringify(next)));
});
