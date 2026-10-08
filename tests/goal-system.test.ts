import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/game.ts";
import { saveGoal, saveTask } from "../src/planning.ts";
import {
  completeStage,
  editStage,
  finishGoalTask,
  monthCells,
  stageLock,
  taskProgress,
  timeline,
  undoGoalTask,
  duplicateStage,
  planFact,
} from "../src/goalSystem.ts";
import { backupText, restoreBackup } from "../src/backup.ts";
import {
  economyRecords,
  recordIncome,
  stageRewards,
} from "../src/questEconomy.ts";
function fixture() {
  let s = saveGoal(initialState(), {
    name: "Настоящая цель",
    sphere: "english",
    target: 100,
    reward: 200,
    progressMode: "tasks",
  });
  const goal = s.goals.at(-1)!;
  s = editStage(s, goal.id, {
    name: "Этап",
    rewardXP: 35,
    rewardCoins: 10,
    startsAt: "2026-03-01",
    dueAt: "2026-12-31",
  });
  const stage = s.goals.at(-1)!.stages![0];
  s = saveTask(s, {
    name: "Разговор",
    sphere: "english",
    difficulty: "Medium",
    goalId: goal.id,
    stageId: stage.id,
  });
  return { s, goal, stage, task: s.quests.at(-1)! };
}
test("настоящие месяцы, понедельник, високосный год и граница года", () => {
  const march = monthCells(2026, 2);
  assert.equal(march[6], "2026-03-01");
  assert.equal(march.filter(Boolean).length, 31);
  assert.equal(monthCells(2028, 1).filter(Boolean).length, 29);
  assert.equal(monthCells(2027, 1).filter(Boolean).length, 28);
  assert.ok(monthCells(2026, 11).includes("2026-12-31"));
  assert.equal(taskProgress([]).percent, 0);
});
test("время отдельно от выполнения, будущий этап, просрочка и отсутствие срока", () => {
  const s = { id: "x", name: "x", startsAt: "2026-12-30", dueAt: "2027-01-02" };
  assert.equal(timeline(s, new Date("2026-12-29T12:00:00")).percent, 0);
  assert.ok(
    Math.abs(timeline(s, new Date("2027-01-01T12:00:00")).percent! - 200 / 3) <
      1e-9,
  );
  assert.equal(timeline(s, new Date("2027-01-04T12:00:00")).late, 2);
  assert.equal(timeline({ ...s, dueAt: undefined }).percent, undefined);
  assert.equal(timeline({ ...s, dueAt: undefined }).remaining, undefined);
});
test("задача, однократная награда, отмена с возвратом, повторный запрос и перезагрузка", () => {
  const { s, goal, stage, task } = fixture();
  const done = finishGoalTask(s, task.id);
  assert.equal(done.quests.at(-1)!.done, true);
  assert.strictEqual(finishGoalTask(done, task.id), done);
  const undone = undoGoalTask(done, task.id);
  assert.equal(undone.coins, done.coins - 4);
  assert.equal(undone.xp, done.xp - task.xp);
  assert.strictEqual(undoGoalTask(undone, task.id), undone);
  const redone = finishGoalTask(undone, task.id);
  assert.equal(redone.coins, done.coins);
  assert.equal(redone.xp, done.xp);
  assert.equal(
    taskProgress(redone.quests.filter((q) => q.stageId === stage.id)).percent,
    100,
  );
  assert.deepEqual(
    restoreBackup(backupText(redone)).goals.find((g) => g.id === goal.id)
      ?.history,
    redone.goals.find((g) => g.id === goal.id)?.history,
  );
});
test("награда этапа один раз, нельзя менять оплаченную награду, блокировка не обходится ID", () => {
  const { s, goal, stage, task } = fixture();
  assert.throws(() => completeStage(s, goal.id, stage.id));
  const done = finishGoalTask(s, task.id),
    complete = completeStage(done, goal.id, stage.id);
  assert.equal(complete.xp, done.xp + 35);
  assert.equal(complete.coins, done.coins + 10);
  assert.strictEqual(completeStage(complete, goal.id, stage.id), complete);
  assert.throws(() =>
    editStage(complete, goal.id, {
      ...complete.goals.at(-1)!.stages![0],
      rewardXP: 50,
    }),
  );
  const next = editStage(s, goal.id, {
    name: "Закрытый",
    requiresPrevious: true,
  });
  const locked = next.goals.at(-1)!.stages!.at(-1)!;
  assert.ok(stageLock(next.goals.at(-1)!, locked));
  assert.throws(() => completeStage(next, goal.id, locked.id));
});
test("данные аналитики реальные; пустая история не рисует случайный график", () => {
  const { s, goal, stage, task } = fixture();
  assert.deepEqual(planFact(s, goal, stage), []);
  const next = finishGoalTask(s, task.id);
  assert.ok(planFact(next, next.goals.at(-1)!, stage).length > 0);
});
test("определения наград и промежуточные атомарные снимки", () => {
  const { s, goal, stage, task } = fixture();
  const records = economyRecords(s),
    done = finishGoalTask(s, task.id),
    complete = completeStage(done, goal.id, stage.id),
    wanted = economyRecords(complete, records);
  const id = `stage:${goal.id}:${stage.id}`;
  assert.equal(recordIncome(records[id], wanted[id]), 10);
  const snapshot = stageRewards(complete, records, wanted);
  assert.equal(snapshot.coins, s.coins);
  const paidRecords = economyRecords(done, records),
    undone = undoGoalTask(done, task.id),
    refund = economyRecords(undone, paidRecords);
  assert.equal(
    recordIncome(paidRecords[`quest:${task.id}`], refund[`quest:${task.id}`]),
    -4,
  );
});

test("копия этапа содержит новые невыполненные задачи и не наследует награды", () => {
  const { s, goal, stage, task } = fixture();
  const paid = completeStage(finishGoalTask(s, task.id), goal.id, stage.id),
    copy = duplicateStage(paid, goal.id, stage.id),
    newStage = copy.goals.at(-1)!.stages!.at(-1)!;
  assert.notEqual(newStage.id, stage.id);
  assert.equal(newStage.rewardClaimed, false);
  const tasks = copy.quests.filter((q) => q.stageId === newStage.id);
  assert.equal(tasks.length, 1);
  assert.notEqual(tasks[0].id, task.id);
  assert.equal(tasks[0].done, false);
  assert.equal(tasks[0].rewardClaimed, false);
  assert.equal(copy.xp, paid.xp);
  assert.equal(copy.coins, paid.coins);
  restoreBackup(backupText(copy));
});
