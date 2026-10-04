import assert from 'node:assert/strict';
import { firebaseSave } from '../src/firebaseSave.ts';
import { completeQuest } from '../src/game.ts';
import { test, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { newAccountGame } from '../src/accountGame.ts';
const env = await initializeTestEnvironment({
  projectId: 'demo-play-your-life',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
beforeEach(() => env.clearFirestore());
after(() => env.cleanup());
const save = (xp = 0, revision = 1) => ({
  state: { ...newAccountGame('Игрок'), xp },
  revision,
  updatedAt: serverTimestamp(),
});
test('владелец создаёт игру с 0 XP и обновляет только следующую версию', async () => {
  const db = env.authenticatedContext('alice').firestore(),
    ref = doc(db, 'players', 'alice');
  await assertSucceeds(setDoc(ref, save()));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, save(20, 2)));
  await assertFails(updateDoc(ref, save(50, 2)));
  await assertFails(setDoc(doc(db, 'players', 'other'), save()));
});
test('другой пользователь не читает и не меняет чужую игру', async () => {
  await assertSucceeds(
    setDoc(
      doc(env.authenticatedContext('alice').firestore(), 'players', 'alice'),
      save(),
    ),
  );
  const db = env.authenticatedContext('bob').firestore(),
    ref = doc(db, 'players', 'alice');
  await assertFails(getDoc(ref));
  await assertFails(updateDoc(ref, save(999, 2)));
  await assertFails(deleteDoc(ref));
  await assertSucceeds(setDoc(doc(db, 'players', 'bob'), save()));
  await assertFails(getDocs(collection(db, 'players')));
});
test('анонимный доступ закрыт, демо XP и неверные версии при создании запрещены', async () => {
  const db = env.unauthenticatedContext().firestore(),
    ref = doc(db, 'players', 'alice');
  await assertFails(getDoc(ref));
  await assertFails(setDoc(ref, save()));
  const own = doc(
    env.authenticatedContext('alice').firestore(),
    'players',
    'alice',
  );
  await assertFails(setDoc(own, save(2450)));
  await assertFails(setDoc(own, save(0, 2)));
  await assertFails(
    setDoc(own, {
      ...save(),
      state: { ...newAccountGame('Игрок'), profile: { mode: 'demo' } },
    }),
  );
  await assertFails(setDoc(own, { ...save(), unexpected: 'field' }));
});

test('SDK сохраняет выполненный квест и XP между сессиями одного аккаунта', async () => {
  const alice = firebaseSave(env.authenticatedContext('alice').firestore(), 'alice');
  const fresh = await alice.create(newAccountGame('Алиса'));
  assert.equal(fresh.state.xp, 0);
  const withQuest = { ...fresh.state, quests: [{ id: 'read', name: 'Читать', sphere: 'growth', xp: 20, difficulty: 'Simple', done: false }] };
  const planned = await alice.save(withQuest, fresh.revision);
  const completed = completeQuest(planned.state, 'read');
  await alice.save(completed, planned.revision);
  const anotherSession = firebaseSave(env.authenticatedContext('alice').firestore(), 'alice');
  const loaded = await anotherSession.load();
  assert.equal(loaded.state.xp, 20); assert.equal(loaded.state.spheres.growth.xp, 20);
  assert.equal(loaded.state.quests[0].done, true); assert.equal(loaded.state.completed, 1);
  assert.ok(loaded.state.coins > 0); assert.equal(loaded.state.events.length, 1);
  assert.equal(await alice.save(withQuest, planned.revision), null);
  const bob = firebaseSave(env.authenticatedContext('bob').firestore(), 'bob');
  const separate = await bob.create(newAccountGame('Боб')); assert.equal(separate.state.xp, 0);
  await assertFails(firebaseSave(env.authenticatedContext('bob').firestore(), 'alice').load());
});

