import assert from "node:assert/strict";
import { buildSync } from "esbuild";
function moduleOf(path) {
  const code = buildSync({
    entryPoints: [path],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  }).outputFiles[0].text;
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
}
const { reduceGame, level } = await moduleOf("src/engine/game.ts");
const { demoState } = await moduleOf("src/data/demo.ts");
const { streak, dayKey, previousDay } = await moduleOf("src/utils/date.ts");
const now = new Date("2026-10-03T12:00:00");
let s = demoState();
s.activityDays = [];
const original = s;
s = reduceGame(s, { type: "complete", id: "q1" }, now);
assert.equal(s.xp, 2470);
assert.equal(
  s.spheres.find((x) => x.id === "english").xp,
  original.spheres.find((x) => x.id === "english").xp + 20,
);
assert.equal(original.xp, 2450);
assert(s.achievements.includes("first"));
assert.strictEqual(reduceGame(s, { type: "complete", id: "q1" }, now), s);
let score = reduceGame(
  original,
  { type: "score", id: "finance", score: 7 },
  now,
);
assert.equal(score.xp, 2510);
score = reduceGame(score, { type: "score", id: "finance", score: 3 }, now);
assert.equal(score.xp, 2510);
score = reduceGame(score, { type: "score", id: "finance", score: 7 }, now);
assert.equal(score.xp, 2510);
score = reduceGame(score, { type: "score", id: "finance", score: 8 }, now);
assert.equal(score.xp, 2530);
assert.strictEqual(
  reduceGame(score, { type: "score", id: "finance", score: 10 }, now),
  score,
);
let goal = reduceGame(
  original,
  { type: "goalProgress", id: "g1", current: 100 },
  now,
);
assert.equal(goal.xp, 2650);
goal = reduceGame(goal, { type: "goalProgress", id: "g1", current: 0 }, now);
goal = reduceGame(goal, { type: "goalProgress", id: "g1", current: 100 }, now);
assert.equal(goal.xp, 2650);
let series = demoState();
series.activityDays = [
  previousDay(dayKey(now)),
  previousDay(previousDay(dayKey(now))),
];
series = reduceGame(series, { type: "complete", id: "q1" }, now);
assert.equal(series.xp, 2480);
series = reduceGame(series, { type: "complete", id: "q2" }, now);
assert.equal(series.xp, 2515);
assert.equal(series.events.filter((e) => e.kind === "streak").length, 1);
assert.equal(streak(series.activityDays, dayKey(now)), 3);
assert.equal(streak(series.activityDays, "2026-10-05"), 0);
assert.equal(level(199), 1);
assert.equal(level(200), 2);
const roundTrip = JSON.parse(JSON.stringify(series));
assert.deepEqual(roundTrip, series);
console.log(
  "PASS: quest idempotence, dual XP, immutable state, score anti-farm, goal anti-farm, streak rewards, day gaps, level boundaries, JSON round trip",
);
