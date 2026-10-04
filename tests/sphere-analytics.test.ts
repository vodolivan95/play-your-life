import { test } from "node:test";
import assert from "node:assert/strict";
import { newAccountGame } from "../src/accountGame.ts";
import {
  sphereMetrics,
  filteredSpheres,
  demoSphereRecommendation,
} from "../src/sphereAnalytics.ts";
import { spheres } from "../src/game.ts";
test("аналитика считает среднее, разрыв и отставание из девяти реальных сфер", () => {
  const state = newAccountGame("Игрок");
  spheres.forEach((s, i) => {
    state.spheres[s.id].score = i + 1;
  });
  const m = sphereMetrics(state);
  assert.equal(m.average, 5);
  assert.equal(m.gap, 8);
  assert.equal(m.deficit, 4);
  assert.equal(m.strongest.id, "hobby");
  assert.equal(m.weakest.id, "health");
  state.spheres.health.score = 9;
  state.spheres.hobby.score = 0;
  assert.equal(sphereMetrics(state).weakest.id, "hobby");
});
test("нулевая новая игра имеет равный баланс без фиктивных проектов и задач", () => {
  const state = newAccountGame("Игрок"),
    m = sphereMetrics(state);
  assert.equal(m.average, 0);
  assert.equal(m.gap, 0);
  assert.equal(m.deficit, 0);
  assert(m.equal);
  assert.equal(filteredSpheres(state, "all").length, 9);
  for (const filter of ["active", "working", "completed"] as const)
    assert.equal(filteredSpheres(state, filter).length, 0);
  assert(m.rows.every((r) => r.projects === 0 && r.tasks === 0));
});
test("фильтры и счётчики берут проекты и квесты только своей сферы", () => {
  const state = newAccountGame("Игрок");
  state.goals.push({
    id: "a",
    name: "Сон",
    sphere: "health",
    current: 0,
    target: 100,
    created: "2026-10-05",
    reward: 0,
    rewarded: false,
  });
  state.quests.push({
    id: "b",
    name: "Книга",
    sphere: "growth",
    xp: 20,
    done: true,
    difficulty: "Simple",
  });
  assert.deepEqual(
    filteredSpheres(state, "working").map((r) => r.id),
    ["health"],
  );
  assert.deepEqual(
    filteredSpheres(state, "completed").map((r) => r.id),
    ["growth"],
  );
  assert.deepEqual(
    filteredSpheres(state, "active").map((r) => r.id),
    ["health", "growth"],
  );
  assert.equal(
    sphereMetrics(state).rows.find((r) => r.id === "health")!.projects,
    1,
  );
  assert.equal(
    sphereMetrics(state).rows.find((r) => r.id === "health")!.tasks,
    0,
  );
});
test("демо-рекомендация соответствует выбранной сфере и допускает будущий AI источник", () => {
  for (const sphere of spheres) {
    const idea = demoSphereRecommendation(sphere.id);
    assert.equal(idea.sphereId, sphere.id);
    assert(idea.title);
    assert.equal(idea.source, "demo");
  }
});
