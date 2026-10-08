import assert from "node:assert/strict";
import { firebaseSave } from "../src/firebaseSave.ts";
import { completeQuest } from "../src/game.ts";
import { test, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { newAccountGame } from "../src/accountGame.ts";
const env = await initializeTestEnvironment({
  projectId: "demo-play-your-life",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});
beforeEach(() => env.clearFirestore());
after(() => env.cleanup());
const save = (xp = 0, revision = 1) => ({
  state: { ...newAccountGame("Игрок"), xp },
  revision,
  updatedAt: serverTimestamp(),
});
test("владелец создаёт игру с 0 XP и обновляет только следующую версию", async () => {
  const db = env.authenticatedContext("alice").firestore(),
    ref = doc(db, "players", "alice");
  await assertSucceeds(setDoc(ref, save()));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, save(20, 2)));
  await assertFails(updateDoc(ref, save(50, 2)));
  await assertFails(setDoc(doc(db, "players", "other"), save()));
});
test("другой пользователь не читает и не меняет чужую игру", async () => {
  await assertSucceeds(
    setDoc(
      doc(env.authenticatedContext("alice").firestore(), "players", "alice"),
      save(),
    ),
  );
  const db = env.authenticatedContext("bob").firestore(),
    ref = doc(db, "players", "alice");
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, save(999, 2)));
  await assertFails(deleteDoc(ref));
  await assertSucceeds(setDoc(doc(db, "players", "bob"), save()));
  await assertFails(getDocs(collection(db, "players")));
});
test("анонимный доступ закрыт, демо XP и неверные версии при создании запрещены", async () => {
  const db = env.unauthenticatedContext().firestore(),
    ref = doc(db, "players", "alice");
  await assertFails(getDoc(ref));
  await assertFails(setDoc(ref, save()));
  const own = doc(
    env.authenticatedContext("alice").firestore(),
    "players",
    "alice",
  );
  await assertFails(setDoc(own, save(2450)));
  await assertFails(setDoc(own, save(0, 2)));
  await assertFails(
    setDoc(own, {
      ...save(),
      state: { ...newAccountGame("Игрок"), profile: { mode: "demo" } },
    }),
  );
  await assertFails(setDoc(own, { ...save(), unexpected: "field" }));
});

test("SDK сохраняет выполненный квест и XP между сессиями одного аккаунта", async () => {
  const alice = firebaseSave(
    env.authenticatedContext("alice").firestore(),
    "alice",
  );
  const fresh = await alice.create(newAccountGame("Алиса"));
  assert.equal(fresh.state.xp, 0);
  const withQuest = {
    ...fresh.state,
    quests: [
      {
        id: "read",
        name: "Читать",
        sphere: "growth",
        xp: 20,
        difficulty: "Simple",
        done: false,
      },
    ],
  };
  const planned = await alice.save(withQuest, fresh.revision);
  const completed = completeQuest(planned.state, "read");
  await alice.save(completed, planned.revision);
  const anotherSession = firebaseSave(
    env.authenticatedContext("alice").firestore(),
    "alice",
  );
  const loaded = await anotherSession.load();
  assert.equal(loaded.state.xp, 20);
  assert.equal(loaded.state.spheres.growth.xp, 20);
  assert.equal(loaded.state.quests[0].done, true);
  assert.equal(loaded.state.completed, 1);
  assert.ok(loaded.state.coins > 0);
  assert.equal(loaded.state.events.length, 1);
  assert.equal(await alice.save(withQuest, planned.revision), null);
  const bob = firebaseSave(env.authenticatedContext("bob").firestore(), "bob");
  const separate = await bob.create(newAccountGame("Боб"));
  assert.equal(separate.state.xp, 0);
  await assertFails(
    firebaseSave(env.authenticatedContext("bob").firestore(), "alice").load(),
  );
});

import {
  saveCustomQuest,
  saveHabit,
  completeHabit,
} from "../src/personalQuests.ts";
test("квест: транзакционный лимит, монеты и журнал, повтор и подделка баланса запрещены", async () => {
  const db = env.authenticatedContext("alice").firestore(),
    driver = firebaseSave(db, "alice");
  const fresh = await driver.create(newAccountGame("Алиса"));
  let s = saveCustomQuest(
    fresh.state,
    {
      name: "Личный квест",
      sphere: "sport",
      difficulty: "Medium",
      rewardCoins: 100,
      virtualRewardId: "cup_basic",
    },
    "alice",
  );
  let row = await driver.save(s, fresh.revision);
  row = await driver.save(
    completeQuest(row.state, s.quests[0].id),
    row.revision,
  );
  assert.equal(row.state.coins, 100);
  assert.equal(row.state.coinTransactions.length, 1);
  const same = await driver.save(
    completeQuest(row.state, s.quests[0].id),
    row.revision,
  );
  assert.equal(same.state.coins, 100);
  const ref = doc(db, "players", "alice"),
    data = (await getDoc(ref)).data();
  await assertFails(
    updateDoc(ref, {
      state: { ...data.state, coins: 999999 },
      recordChanges: [],
      revision: data.revision + 1,
      updatedAt: serverTimestamp(),
    }),
  );
  const id = `quest:${s.quests[0].id}`;
  await assertFails(
    updateDoc(ref, {
      economyRecords: {
        ...data.economyRecords,
        [id]: { ...data.economyRecords[id], coins: 101 },
      },
      recordChanges: [id],
      revision: data.revision + 1,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, {
      economyRecords: {
        ...data.economyRecords,
        [id]: { ...data.economyRecords[id], completed: false },
      },
      recordChanges: [id],
      revision: data.revision + 1,
      updatedAt: serverTimestamp(),
    }),
  );
  const bob = env.authenticatedContext("bob").firestore();
  await assertFails(getDoc(doc(bob, "players", "alice")));
});
test("привычка: только 0–10 монет, однократное выполнение, история не удаляется", async () => {
  const db = env.authenticatedContext("alice").firestore(),
    driver = firebaseSave(db, "alice");
  const fresh = await driver.create(newAccountGame("Алиса"));
  let s = saveHabit(
    fresh.state,
    {
      title: "Вода",
      sphere: "health",
      iconId: "water",
      targetValue: 2,
      unit: "литра",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      rewardCoins: 10,
    },
    "alice",
  );
  let row;
  await assert.doesNotReject(async () => {
    row = await driver.save(s, fresh.revision);
  }, "Регистрация привычки");
  const ref = doc(db, "players", "alice"),
    approved = (await getDoc(ref)).data(),
    id = `habit:${s.habits[0].id}`,
    completed = JSON.parse(
      JSON.stringify(completeHabit(row.state, s.habits[0].id, "alice")),
    ),
    day = String(completed.habitCompletions[0].dayOrdinal);
  const payout = {
    state: completed,
    economyRecords: {
      ...approved.economyRecords,
      [id]: {
        ...approved.economyRecords[id],
        locked: true,
        claims: { [day]: true },
      },
    },
    recordChanges: [id],
    rewardProofs: {
      [id]: {
        sourceIndex: 0,
        completionIndex: 0,
        receiptIndex: 0,
        claimDay: day,
      },
    },
    revision: approved.revision + 1,
    updatedAt: serverTimestamp(),
  };
  await assertFails(
    updateDoc(ref, {
      ...payout,
      state: { ...completed, coinTransactions: [] },
    }),
  );
  await assertFails(
    updateDoc(ref, {
      ...payout,
      state: {
        ...completed,
        habits: completed.habits.map((h) => ({ ...h, ownerId: "bob" })),
      },
    }),
  );
  await assertFails(
    updateDoc(ref, {
      ...payout,
      state: {
        ...completed,
        coins: 11,
        habits: completed.habits.map((h) => ({ ...h, rewardCoins: 11 })),
        coinTransactions: completed.coinTransactions.map((t) => ({
          ...t,
          amount: 11,
        })),
      },
      economyRecords: {
        ...payout.economyRecords,
        [id]: { ...payout.economyRecords[id], coins: 11 },
      },
    }),
  );
  const future = String(Number(day) + 1);
  await assertFails(
    updateDoc(ref, {
      ...payout,
      state: {
        ...completed,
        habitCompletions: completed.habitCompletions.map((c) => ({
          ...c,
          dayOrdinal: Number(future),
        })),
      },
      economyRecords: {
        ...payout.economyRecords,
        [id]: { ...payout.economyRecords[id], claims: { [future]: true } },
      },
      rewardProofs: { [id]: { ...payout.rewardProofs[id], claimDay: future } },
    }),
  );
  await assert.doesNotReject(async () => {
    row = await driver.save(
      completeHabit(row.state, s.habits[0].id, "alice"),
      row.revision,
    );
  }, "Ежедневная выплата привычки");
  assert.equal(row.state.coins, 10);
  assert.equal(row.state.habitCompletions.length, 1);
  const same = await driver.save(
    completeHabit(row.state, s.habits[0].id, "alice"),
    row.revision,
  );
  assert.equal(same.state.coins, 10);
  const data = (await getDoc(ref)).data();
  await assertFails(
    updateDoc(ref, {
      economyRecords: {
        ...data.economyRecords,
        [id]: { ...data.economyRecords[id], coins: 11 },
      },
      recordChanges: [id],
      revision: data.revision + 1,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, {
      economyRecords: {
        ...data.economyRecords,
        [id]: { ...data.economyRecords[id], claims: {} },
      },
      recordChanges: [id],
      revision: data.revision + 1,
      updatedAt: serverTimestamp(),
    }),
  );
});
test("быстрое создание и выполнение, серия из 12 квестов и устаревшая сессия", async () => {
  const driver = firebaseSave(
    env.authenticatedContext("alice").firestore(),
    "alice",
  );
  const fresh = await driver.create(newAccountGame("Алиса"));
  let s = fresh.state;
  for (let i = 0; i < 12; i++) {
    s = saveCustomQuest(
      s,
      {
        name: `Квест ${i}`,
        sphere: "growth",
        difficulty: "Simple",
        rewardCoins: 1,
      },
      "alice",
    );
    s = completeQuest(s, s.quests.at(-1).id);
  }
  const saved = await driver.save(s, fresh.revision);
  assert.equal(saved.state.coins, 12);
  assert.equal(saved.state.completed, 12);
  assert.equal(await driver.save(s, fresh.revision), null);
  const loaded = await driver.load();
  assert.equal(loaded.state.coinTransactions.length, 12);
  assert.equal(loaded.state.coins, 12);
});
test("начисление без журнала или с чужим ownerId запрещено на сервере", async () => {
  const db = env.authenticatedContext("alice").firestore(),
    driver = firebaseSave(db, "alice");
  const fresh = await driver.create(newAccountGame("A"));
  const s = saveCustomQuest(
    fresh.state,
    { name: "Квест", sphere: "health", difficulty: "Simple", rewardCoins: 10 },
    "alice",
  );
  const row = await driver.save(s, fresh.revision);
  const ref = doc(db, "players", "alice"),
    data = (await getDoc(ref)).data(),
    key = `quest:${s.quests[0].id}`;
  await assertFails(
    updateDoc(ref, {
      state: { ...data.state, coins: 10 },
      economyRecords: {
        ...data.economyRecords,
        [key]: { ...data.economyRecords[key], completed: true, locked: true },
      },
      recordChanges: [key],
      rewardProofs: {},
      revision: data.revision + 1,
      updatedAt: serverTimestamp(),
    }),
  );
  const stolen = {
    ...row.state,
    quests: row.state.quests.map((q) => ({ ...q, ownerId: "bob" })),
  };
  await assert.rejects(driver.save(stolen, row.revision));
});

test('SDK сохраняет цель, этапы, заметки, прогресс и однократные награды в той же игре', async () => {
  const { saveGoal, saveStage, saveTask, moveStage } = await import('../src/planning.ts');
  const { goalProgressValue } = await import('../src/goalWorkspace.ts');
  const driver = firebaseSave(env.authenticatedContext('alice').firestore(), 'alice');
  const fresh = await driver.create(newAccountGame('Алиса'));
  let state = saveGoal(fresh.state, { name: 'Личная цель', sphere: 'english', target: 100, reward: 200, progressMode: 'tasks', motivation: 'Моя мотивация' });
  const goalId = state.goals[0].id;
  state = saveStage(state, goalId, { name: 'Первый этап', notes: 'Мои заметки', status: 'active' });
  state = saveStage(state, goalId, { name: 'Второй этап', status: 'planned', completionMode: 'manual', startsAt: '2026-01-01T12:00:00Z', dueAt: '2027-12-31T12:00:00Z' });
  const [stageId, secondId] = state.goals[0].stages.map(s => s.id);
  state = saveTask(state, { name: 'Первый шаг', sphere: 'english', difficulty: 'Micro', goalId, stageId, required: true, weight: 2 });
  const taskId = state.quests[0].id;
  const planned = await driver.save(state, fresh.revision);
  assert.ok(planned);
  state = completeQuest(planned.state, taskId);
  state = moveStage(state, goalId, secondId, 0);
  const completed = await driver.save(state, planned.revision);
  const reopened = firebaseSave(env.authenticatedContext('alice').firestore(), 'alice');
  const loaded = await reopened.load();
  assert.equal(goalProgressValue(loaded.state, loaded.state.goals[0]), 100);
  assert.equal(loaded.state.goals[0].motivation, 'Моя мотивация');
  assert.equal(loaded.state.goals[0].stages[1].notes, 'Мои заметки');
  assert.equal(loaded.state.goals[0].stages[1].status, 'completed');
  assert.equal(loaded.state.quests[0].stageId, stageId);
  assert.equal(loaded.state.events.filter(e => e.goalId === goalId && e.kind === 'goal').length, 1);
  assert.deepEqual(completeQuest(loaded.state, taskId), loaded.state);
  assert.equal(await driver.save(state, planned.revision), null);
  assert.equal(loaded.revision, completed.revision);
  await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'players', 'alice')));
});
