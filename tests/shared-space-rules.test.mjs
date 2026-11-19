// PLAY YOUR LIFE 2.0: права на общее пространство «Наша жизнь». Запускается в CI с эмулятором Firestore.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, deleteDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-play-your-life', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
beforeEach(() => env.clearFirestore());
after(() => env.cleanup());
const db = (uid) => env.authenticatedContext(uid).firestore();
const space = (uid, name = 'Александр') => ({
  name: 'Наша жизнь', ownerId: uid, memberIds: [uid],
  members: { [uid]: { name, joinedAt: serverTimestamp() } }, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});
const CODE = 'ABCDEFGH23';
const invite = (spaceId, uid, days = 7) => ({ spaceId, createdBy: uid, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + days * 86400000) });
const join = (uid, code = CODE, name = 'Иван') => ({ memberIds: arrayUnion(uid), [`members.${uid}`]: { name, joinedAt: serverTimestamp() }, joinCode: code, updatedAt: serverTimestamp() });

async function alexWithInvite() {
  await assertSucceeds(setDoc(doc(db('alex'), 'spaces', 's_alex'), space('alex')));
  await assertSucceeds(setDoc(doc(db('alex'), 'spaceInvites', CODE), invite('s_alex', 'alex')));
}

test('пространство создаётся только своё, с собой единственным участником', async () => {
  await assertSucceeds(setDoc(doc(db('alex'), 'spaces', 's_alex'), space('alex')));
  await assertFails(setDoc(doc(db('ivan'), 'spaces', 's_alex2'), space('ivan')));
  await assertFails(setDoc(doc(db('ivan'), 'spaces', 's_ivan'), { ...space('ivan'), memberIds: ['ivan', 'alex'] }));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'spaces', 's_x'), space('x')));
});

test('чужой не читает пространство; по коду вступает второй участник, третий — нет', async () => {
  await alexWithInvite();
  await assertFails(getDoc(doc(db('ivan'), 'spaces', 's_alex')));
  await assertSucceeds(getDoc(doc(db('ivan'), 'spaceInvites', CODE)));
  await assertFails(getDocs(collection(db('ivan'), 'spaceInvites')));
  await assertFails(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), join('ivan', 'ZZZZZZZZZZ')));
  await assertSucceeds(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), join('ivan')));
  await assertSucceeds(getDoc(doc(db('ivan'), 'spaces', 's_alex')));
  const mine = await getDocs(query(collection(db('ivan'), 'spaces'), where('memberIds', 'array-contains', 'ivan')));
  assert.equal(mine.size, 1);
  await assertFails(updateDoc(doc(db('petr'), 'spaces', 's_alex'), join('petr')));
  await assertFails(getDoc(doc(db('petr'), 'spaces', 's_alex')));
});

test('просроченное приглашение не работает, создать его может только участник', async () => {
  await assertSucceeds(setDoc(doc(db('alex'), 'spaces', 's_alex'), space('alex')));
  await assertFails(setDoc(doc(db('ivan'), 'spaceInvites', CODE), invite('s_alex', 'ivan')));
  await assertFails(setDoc(doc(db('alex'), 'spaceInvites', CODE), invite('s_alex', 'alex', 30)));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'spaceInvites', CODE), { spaceId: 's_alex', createdBy: 'alex', createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  });
  await assertFails(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), join('ivan')));
});

test('участник меняет только своё имя; удалить пространство или выгнать другого нельзя', async () => {
  await alexWithInvite();
  await assertSucceeds(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), join('ivan')));
  await assertSucceeds(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), { 'members.ivan.name': 'Ваня', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), { 'members.alex.name': 'Взлом', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), { memberIds: ['ivan'], updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), { ownerId: 'ivan', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db('alex'), 'spaces', 's_alex')));
});

test('личный документ игрока второму участнику по-прежнему закрыт', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'players', 'alex'), { secret: true }); });
  await alexWithInvite();
  await assertSucceeds(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), join('ivan')));
  await assertFails(getDoc(doc(db('ivan'), 'players', 'alex')));
});
