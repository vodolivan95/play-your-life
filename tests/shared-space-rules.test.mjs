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

const dbMail = (uid, email) => env.authenticatedContext(uid, { email }).firestore();
const PAIR = 'pair-alexander-ivan';

test('пара Александр — Иван: общее пространство по почте, без кода; чужая почта не входит', async () => {
  const alex = dbMail('alex', 'Sanek.alex1995@yandex.ru'), ivan = dbMail('ivan', 'vodolivan195@gmail.com'), petr = dbMail('petr', 'petr@mail.ru');
  await assertFails(setDoc(doc(petr, 'spaces', PAIR), space('petr')));
  await assertSucceeds(setDoc(doc(alex, 'spaces', PAIR), space('alex')));
  await assertFails(updateDoc(doc(petr, 'spaces', PAIR), { memberIds: arrayUnion('petr'), 'members.petr': { name: 'Пётр', joinedAt: serverTimestamp() }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(ivan, 'spaces', PAIR), { memberIds: arrayUnion('ivan'), 'members.ivan': { name: 'Иван', joinedAt: serverTimestamp() }, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(ivan, 'spaces', PAIR)));
});

test('общие объекты: участники читают и пишут, чужой — нет; автор не подменяется; чужие сообщения только реакции', async () => {
  await alexWithInvite();
  await assertSucceeds(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), join('ivan')));
  const g = (uid) => doc(db(uid), 'spaces', 's_alex', 'groups', 'general');
  await assertSucceeds(setDoc(g('alex'), { name: 'Общие вопросы', system: true, authorId: 'alex', at: 1, count: 0 }));
  await assertSucceeds(getDoc(g('ivan')));
  await assertFails(getDoc(g('petr')));
  await assertSucceeds(updateDoc(g('ivan'), { count: 1, lastText: 'Привет' }));
  await assertFails(updateDoc(g('ivan'), { authorId: 'ivan' }));
  await assertFails(deleteDoc(g('alex')));
  const m = (uid) => doc(db(uid), 'spaces', 's_alex', 'groups', 'general', 'messages', 'm1');
  await assertFails(setDoc(m('ivan'), { authorId: 'alex', text: 'подделка', at: 1 }));
  await assertSucceeds(setDoc(m('alex'), { authorId: 'alex', text: 'Привет', at: 1, reactions: {}, pinned: false }));
  await assertSucceeds(updateDoc(m('ivan'), { reactions: { '👍': ['ivan'] } }));
  await assertFails(updateDoc(m('ivan'), { text: 'исправил чужое' }));
  await assertFails(deleteDoc(m('ivan')));
  await assertSucceeds(updateDoc(m('alex'), { text: 'Привет!' }));
  await assertFails(setDoc(doc(db('petr'), 'spaces', 's_alex', 'groups', 'general', 'messages', 'm2'), { authorId: 'petr', text: 'x', at: 1 }));
});

test('личные события и чужие уведомления не видны второму участнику', async () => {
  await alexWithInvite();
  await assertSucceeds(updateDoc(doc(db('ivan'), 'spaces', 's_alex'), join('ivan')));
  const ev = (uid, id) => doc(db(uid), 'spaces', 's_alex', 'events', id);
  await assertSucceeds(setDoc(ev('alex', 'p1'), { authorId: 'alex', at: 1, access: 'personal', title: 'Врач' }));
  await assertSucceeds(setDoc(ev('alex', 's1'), { authorId: 'alex', at: 1, access: 'shared', title: 'Кино', rsvp: { alex: 'yes', ivan: 'pending' } }));
  await assertFails(getDoc(ev('ivan', 'p1')));
  await assertSucceeds(getDoc(ev('ivan', 's1')));
  await assertSucceeds(updateDoc(ev('ivan', 's1'), { 'rsvp.ivan': 'yes' }));
  await assertSucceeds(getDocs(query(collection(db('ivan'), 'spaces', 's_alex', 'events'), where('access', '==', 'shared'))));
  const n = (uid) => doc(db(uid), 'spaces', 's_alex', 'notifications', 'n1');
  await assertSucceeds(setDoc(n('alex'), { authorId: 'alex', at: 1, to: 'ivan', read: false, text: 'Приглашение' }));
  await assertFails(getDoc(n('alex')));
  await assertSucceeds(getDoc(n('ivan')));
  await assertSucceeds(updateDoc(n('ivan'), { read: true }));
  await assertFails(setDoc(doc(db('alex'), 'spaces', 's_alex', 'notifications', 'n2'), { authorId: 'alex', at: 1, to: 'petr', read: false }));
});
