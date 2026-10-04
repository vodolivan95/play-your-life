import {
  doc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { restoreBackup } from './backup.ts';
import type { GameState } from './game.ts';
import type { SaveDriver, SaveRow } from './accountPersistence.ts';
function decode(data: Record<string, unknown>): SaveRow {
  if (!Number.isSafeInteger(data.revision) || Number(data.revision) < 1)
    throw new Error('Некорректная версия сохранения.');
  const state = restoreBackup(JSON.stringify(data.state));
  if (state.profile.mode !== 'personal')
    throw new Error('Некорректный тип игры.');
  return { state, revision: Number(data.revision) };
}
function clean(state: GameState) {
  if (state.profile.mode !== 'personal')
    throw new Error('В аккаунте сохраняется только личная игра.');
  const result = JSON.parse(JSON.stringify(state));
  if (new TextEncoder().encode(JSON.stringify(result)).length > 800000)
    throw new Error('Сохранение слишком большое. Скачайте резервную копию.');
  return result;
}
export function firebaseSave(database: Firestore, userId: string): SaveDriver {
  const ref = doc(database, 'players', userId);
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
      return runTransaction(database, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists() || snapshot.data().revision !== revision)
          return null;
        const next = revision + 1;
        transaction.update(ref, {
          state: clean(state),
          revision: next,
          updatedAt: serverTimestamp(),
        });
        return { state, revision: next };
      });
    },
  };
}

