import {
  doc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { restoreBackup } from "./backup.ts";
import type { GameState } from "./game.ts";
import {
  economyRecords,
  recordChanges,
  recordIncome,
  stageRewards,
} from "./questEconomy.ts";
import type { EconomyRecords } from "./questEconomy.ts";
import { validateState } from "./stateValidation.ts";
import type { SaveDriver, SaveRow } from "./accountPersistence.ts";
function decode(data: Record<string, unknown>): SaveRow {
  if (!Number.isSafeInteger(data.revision) || Number(data.revision) < 1)
    throw new Error("Некорректная версия сохранения.");
  const state = restoreBackup(JSON.stringify(data.state));
  if (state.profile.mode !== "personal")
    throw new Error("Некорректный тип игры.");
  return { state, revision: Number(data.revision) };
}
function clean(state: GameState) {
  if (state.profile.mode !== "personal")
    throw new Error("В аккаунте сохраняется только личная игра.");
  validateState(state);
  const result = JSON.parse(JSON.stringify(state));
  if (new TextEncoder().encode(JSON.stringify(result)).length > 800000)
    throw new Error("Сохранение слишком большое. Скачайте резервную копию.");
  return result;
}
export function firebaseSave(database: Firestore, userId: string): SaveDriver {
  const ref = doc(database, "players", userId);
  return {
    async load() {
      const snapshot = await getDocFromServer(ref);
      return snapshot.exists() ? decode(snapshot.data()) : null;
    },
    async create(state) {
      return runTransaction(database, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists()) return decode(snapshot.data());
        transaction.set(ref, {
          state: clean(state),
          revision: 1,
          updatedAt: serverTimestamp(),
        });
        return { state, revision: 1 };
      });
    },
    async save(state, revision) {
      state = {
        ...state,
        quests: state.quests.map((q) => ({
          ...q,
          ownerId: q.ownerId === "local" || !q.ownerId ? userId : q.ownerId,
        })),
        habits: state.habits?.map((h) => ({
          ...h,
          ownerId: h.ownerId === "local" ? userId : h.ownerId,
        })),
        habitCompletions: state.habitCompletions?.map((c) => ({
          ...c,
          ownerId: c.ownerId === "local" ? userId : c.ownerId,
        })),
        coinTransactions: state.coinTransactions?.map((t) => ({
          ...t,
          userId: t.userId === "local" || !t.userId ? userId : t.userId,
        })),
      };
      clean(state);
      for (const q of state.quests)
        if (q.ownerId && q.ownerId !== userId)
          throw new Error("Квест принадлежит другому пользователю.");
      for (const h of state.habits ?? [])
        if (h.ownerId !== userId)
          throw new Error("Привычка принадлежит другому пользователю.");
      const initial = await getDocFromServer(ref);
      if (!initial.exists() || initial.data().revision !== revision)
        return null;
      const before = decode(initial.data()).state;
      let records: EconomyRecords = initial.data().economyRecords ?? {};
      let currentRevision = revision;
      let lastCommittedState: GameState | null = null;
      const active = structuredClone(state);
      active.quests = active.quests.map((q) => {
        const old = before.quests.find((item) => item.id === q.id);
        return records[`quest:${q.id}`]
          ? q
          : (old ?? {
              ...q,
              done: false,
              rewardClaimed: false,
              rewardClaimedAt: undefined,
              completedAt: undefined,
              currentValue: 0,
              rewardLocked: false,
            });
      });
      active.habitCompletions = active.habitCompletions?.filter(
        (c) => !!records[`habit:${c.habitId}`],
      );
      active.habits = active.habits?.map((h) =>
        records[`habit:${h.id}`] ? h : { ...h, rewardLocked: false },
      );
      const definitions = economyRecords(active, records);
      const seed = { ...records };
      for (const [id, definition] of Object.entries(definitions))
        if (!records[id]) seed[id] = definition;
      async function commit(
        nextRecords: EconomyRecords,
        savedState: GameState,
      ) {
        const expected = currentRevision;
        const changes = recordChanges(records, nextRecords);
        const rewardProofs: Record<
          string,
          {
            sourceIndex: number;
            receiptIndex: number;
            completionIndex?: number;
            claimDay?: string;
          }
        > = {};
        for (const id of changes) {
          const old = records[id],
            next = nextRecords[id];
          if (!old) continue;
          if (next.type === "quest" && !old.completed && next.completed) {
            rewardProofs[id] = {
              sourceIndex: savedState.quests.findIndex(
                (q) => `quest:${q.id}` === id,
              ),
              receiptIndex: (savedState.coinTransactions ?? []).findIndex(
                (t) => t.transactionId === id,
              ),
            };
          }
          if (next.type === "habit") {
            const day = Object.keys(next.claims).find(
              (day) => !old.claims[day],
            );
            if (day !== undefined) {
              const completionIndex = (
                savedState.habitCompletions ?? []
              ).findIndex(
                (c) =>
                  `habit:${c.habitId}` === id && c.dayOrdinal === Number(day),
              );
              const completion = savedState.habitCompletions?.[completionIndex];
              rewardProofs[id] = {
                sourceIndex: (savedState.habits ?? []).findIndex(
                  (h) => `habit:${h.id}` === id,
                ),
                completionIndex,
                claimDay: day,
                receiptIndex: (savedState.coinTransactions ?? []).findIndex(
                  (t) => t.transactionId === completion?.id,
                ),
              };
            }
          }
        }
        const row = await runTransaction(database, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists() || snapshot.data().revision !== expected)
            return null;
          transaction.update(ref, {
            state: clean(savedState),
            rewardProofs,
            economyRecords: nextRecords,
            recordChanges: changes,
            revision: expected + 1,
            updatedAt: serverTimestamp(),
          });
          return expected + 1;
        });
        if (row === null) return false;
        currentRevision = row;
        records = nextRecords;
        lastCommittedState = savedState;
        return true;
      }
      // Keep each reward transaction within the Security Rules expression limit.
      // Split migration and offline queues without dropping any queued action.
      const seeds = recordChanges(records, seed);
      for (let i = 0; i < seeds.length; i += 1) {
        const chunk = { ...records };
        for (const id of seeds.slice(i, i + 1)) chunk[id] = seed[id];
        if (!(await commit(chunk, before))) return null;
      }
      const wanted = economyRecords(state, records);
      // An unlocked reward can be edited before its first completion; approve the new definition first.
      const edits = Object.keys(wanted).filter(
        (id) =>
          records[id] &&
          !records[id].locked &&
          (wanted[id].coins !== records[id].coins ||
            wanted[id].xp !== records[id].xp ||
            wanted[id].sphere !== records[id].sphere ||
            wanted[id].item !== records[id].item),
      );
      for (let i = 0; i < edits.length; i += 1) {
        const chunk = { ...records };
        for (const id of edits.slice(i, i + 1))
          chunk[id] = {
            ...records[id],
            coins: wanted[id].coins,
            xp: wanted[id].xp,
            sphere: wanted[id].sphere,
            item: wanted[id].item,
          };
        if (!(await commit(chunk, before))) return null;
      }
      const approvedIncome = Object.entries(wanted).reduce(
        (sum, [id, r]) => sum + recordIncome(records[id], r),
        0,
      );
      if (state.coins > before.coins + approvedIncome)
        throw new Error("Баланс не соответствует однократным наградам.");
      let changes = recordChanges(records, wanted);
      while (changes.length) {
        const chunk = { ...records };
        for (const id of changes.slice(0, 1)) {
          const old = records[id],
            next = wanted[id];
          if (next.type === "habit") {
            const added = Object.keys(next.claims).filter(
              (day) => !old.claims[day],
            );
            const claims = { ...old.claims };
            if (added.length) claims[added[0]] = true;
            chunk[id] = { ...next, claims };
          } else chunk[id] = next;
        }
        if (!(await commit(chunk, stageRewards(state, chunk, wanted))))
          return null;
        changes = recordChanges(records, wanted);
      }
      // Also save non-economic changes (planning, rooms, profile) when no record changed.
      if (
        JSON.stringify(lastCommittedState) !== JSON.stringify(state) &&
        !(await commit(records, state))
      )
        return null;
      return { state, revision: currentRevision };
    },
  };
}
