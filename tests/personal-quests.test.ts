import { test } from "node:test";
import assert from "node:assert/strict";
import { newAccountGame } from "../src/accountGame.ts";
import { completeQuest } from "../src/game.ts";
import { backupText, restoreBackup } from "../src/backup.ts";
import {
  checkCoins,
  completeHabit,
  habitDay,
  habitStreak,
  progressQuest,
  putRewardInSport,
  saveCustomQuest,
  saveHabit,
} from "../src/personalQuests.ts";
import {
  economyRecords,
  recordIncome,
  stageRewards,
  validateIncome,
} from "../src/questEconomy.ts";
const owner = "alice";
const quest = (coins = 75) =>
  saveCustomQuest(
    newAccountGame("Алиса"),
    {
      name: "Пробежать",
      sphere: "sport",
      difficulty: "Medium",
      targetValue: 10,
      unit: "км",
      rewardCoins: coins,
      virtualRewardId: "plant_basic",
    },
    owner,
  );
test("персональный квест, цель, независимые XP/coins, однократный журнал и предмет", () => {
  const s = quest(),
    q = s.quests[0];
  assert.equal(q.xp, 20);
  assert.equal(q.rewardCoins, 75);
  const partial = progressQuest(s, q.id, 3, owner);
  assert.equal(partial.coins, 0);
  assert.equal(partial.quests[0].rewardLocked, true);
  assert.throws(() =>
    saveCustomQuest(partial, { ...partial.quests[0], rewardCoins: 100 }, owner),
  );
  assert.throws(() =>
    saveCustomQuest(
      partial,
      { ...partial.quests[0], difficulty: "Hard" },
      owner,
    ),
  );
  assert.throws(() => progressQuest(partial, q.id, 1, owner));
  assert.throws(() => progressQuest(s, q.id, 5, "bob"));
  const done = progressQuest(partial, q.id, 10, owner);
  assert.equal(done.coins, 75);
  assert.equal(done.xp, 20);
  assert.equal(done.spheres.sport.xp, 20);
  assert.equal(done.completed, 1);
  assert.equal(done.coinTransactions!.length, 1);
  assert.equal(done.rewardInventory![0].itemId, "plant_basic");
  assert.equal(completeQuest(done, q.id), done);
  assert.deepEqual(
    restoreBackup(backupText(done)),
    JSON.parse(JSON.stringify(done)),
  );
  const placed = putRewardInSport(done, done.rewardInventory![0].id);
  assert.ok(placed.rooms!.sport!.purchased.includes("plant"));
});
test("границы Coins, произвольные XP, предметы, ownership и испорченные копии", () => {
  assert.equal(Object.is(checkCoins(-0, 100), -0), false);
  for (const coins of [-1, 101, 1.5, NaN, Infinity])
    assert.throws(() => quest(coins));
  for (const coins of [0, 100])
    assert.equal(quest(coins).quests[0].rewardCoins, coins);
  const s = quest();
  assert.throws(() =>
    saveCustomQuest(s, { ...s.quests[0], name: "Чужой" }, "bob"),
  );
  const fixed = saveCustomQuest(
    newAccountGame("A"),
    {
      name: "XP",
      sphere: "health",
      difficulty: "Simple",
      xp: 999999,
      rewardCoins: 0,
    },
    owner,
  );
  assert.equal(fixed.quests[0].xp, 10);
  assert.throws(() =>
    saveCustomQuest(s, { ...s.quests[0], virtualRewardId: "legendary" }, owner),
  );
  const corrupt = structuredClone(s);
  corrupt.quests[0].rewardCoins = 101;
  assert.throws(() => restoreBackup(backupText(corrupt)));
});
function habit() {
  const s = saveHabit(
    newAccountGame("A"),
    {
      title: "Вода",
      sphere: "health",
      iconId: "water",
      targetValue: 2,
      unit: "литра",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      rewardCoins: 10,
    },
    owner,
  );
  s.habits![0].createdAt = "2026-10-01T00:00:00Z";
  s.habits![0].timezoneMinutes = 180;
  return s;
}
test("привычки: даты, полночь в закреплённом часовом поясе, пропуск, история и серии", () => {
  let s = habit();
  const id = s.habits![0].id;
  s = completeHabit(s, id, owner, new Date("2026-10-04T20:59:00Z"));
  assert.equal(s.habitCompletions![0].day, "2026-10-04");
  assert.equal(s.coins, 10);
  assert.equal(
    completeHabit(s, id, owner, new Date("2026-10-04T20:59:30Z")),
    s,
  );
  s = completeHabit(s, id, owner, new Date("2026-10-04T21:01:00Z"));
  assert.equal(s.coins, 20);
  assert.equal(s.habits![0].currentStreak, 2);
  assert.equal(
    habitDay(s.habits![0], new Date("2026-10-04T21:01:00Z")),
    "2026-10-05",
  );
  assert.equal(
    habitStreak(
      s.habits![0],
      s.habitCompletions!,
      new Date("2026-10-07T12:00:00Z"),
    ),
    0,
  );
  s = completeHabit(s, id, owner, new Date("2026-10-07T12:00:00Z"));
  assert.equal(s.habits![0].currentStreak, 1);
  assert.equal(s.habits![0].bestStreak, 2);
  assert.equal(s.habits![0].totalCompletions, 3);
  assert.equal(s.habitCompletions!.length, 3);
  assert.throws(() => completeHabit(s, id, "bob"));
  assert.throws(() => saveHabit(s, { ...s.habits![0], rewardCoins: 9 }, owner));
  assert.deepEqual(
    restoreBackup(backupText(s)).habitCompletions,
    s.habitCompletions,
  );
});
test("привычка: максимум 10, иконка, запланированные дни, выходные не рвут streak", () => {
  const s = habit(),
    h = s.habits![0];
  assert.throws(() => saveHabit(s, { ...h, rewardCoins: 11 }, owner));
  assert.throws(() => saveHabit(s, { ...h, iconId: "unknown" }, owner));
  h.weekdays = [1, 2, 3, 4, 5];
  const friday = completeHabit(
    s,
    h.id,
    owner,
    new Date("2026-10-02T12:00:00Z"),
  );
  assert.throws(() =>
    completeHabit(friday, h.id, owner, new Date("2026-10-03T12:00:00Z")),
  );
  const monday = completeHabit(
    friday,
    h.id,
    owner,
    new Date("2026-10-05T12:00:00Z"),
  );
  assert.equal(monday.habits![0].currentStreak, 2);
});
test("зафиксированные определения и баланс проверяются по предыдущему состоянию", () => {
  const s = quest(),
    records = economyRecords(s),
    done = completeQuest(s, s.quests[0].id);
  const wanted = validateIncome(s, done, records);
  assert.equal(
    recordIncome(
      records[`quest:${s.quests[0].id}`],
      wanted[`quest:${s.quests[0].id}`],
    ),
    75,
  );
  assert.throws(() => validateIncome(s, { ...done, coins: 1000 }, records));
  const paid = economyRecords(done, records);
  assert.equal(
    recordIncome(
      paid[`quest:${s.quests[0].id}`],
      paid[`quest:${s.quests[0].id}`],
    ),
    0,
  );
  assert.throws(() => economyRecords(s, paid));
  const staged = stageRewards(done, records, wanted);
  assert.equal(staged.coins, 0);
  assert.equal(staged.quests[0].done, false);
  assert.equal(staged.coinTransactions!.length, 0);
  assert.equal(stageRewards(done, wanted, wanted).coins, 75);
});
