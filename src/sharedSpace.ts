import { arrayUnion, collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { INVITE_DAYS, SPACE_MEMBER_LIMIT, isInviteCode, makeInviteCode, normalizeInviteCode } from './ourLife.ts';

/*
 * Общее пространство «Наша жизнь» (ТЗ 4, 12): один документ `spaces/{id}` на пару, участники — в `memberIds`.
 * Приглашение — документ `spaceInvites/{код}`. Права проверяет firestore.rules: читать и менять пространство
 * может только участник, вступить — только по действующему коду и пока есть место.
 */

export type SpaceMember = { name: string; joinedAt?: unknown };
export type Space = { id: string; name: string; ownerId: string; memberIds: string[]; members: Record<string, SpaceMember> };

/** Пространство, созданное пользователем, всегда имеет id `s_<uid>`: повторное создание не плодит копий. */
export const ownSpaceId = (uid: string) => `s_${uid}`;
const cleanName = (name: string) => name.trim().slice(0, 60) || 'Участник';

/** Выбирает основное пространство: где больше участников, при равенстве — созданное раньше всех (по id). */
export function pickSpace(spaces: Space[]): Space | null {
  return [...spaces].sort((a, b) => b.memberIds.length - a.memberIds.length || a.id.localeCompare(b.id))[0] ?? null;
}

export function toSpace(id: string, data: Record<string, unknown>): Space | null {
  const memberIds = Array.isArray(data.memberIds) ? data.memberIds.filter((x): x is string => typeof x === 'string') : [];
  if (!memberIds.length || typeof data.ownerId !== 'string') return null;
  const members: Record<string, SpaceMember> = {};
  const raw = (data.members && typeof data.members === 'object' ? data.members : {}) as Record<string, { name?: unknown; joinedAt?: unknown }>;
  for (const uid of memberIds) members[uid] = { name: typeof raw[uid]?.name === 'string' ? (raw[uid].name as string) : 'Участник', joinedAt: raw[uid]?.joinedAt };
  return { id, name: typeof data.name === 'string' ? data.name : 'Наша жизнь', ownerId: data.ownerId, memberIds, members };
}

/** Подписка на пространства пользователя в реальном времени. Возвращает функцию отписки. */
export function watchMySpace(db: Firestore, uid: string, onSpace: (space: Space | null) => void, onError: (message: string) => void) {
  return onSnapshot(
    query(collection(db, 'spaces'), where('memberIds', 'array-contains', uid)),
    (snap) => onSpace(pickSpace(snap.docs.map((d) => toSpace(d.id, d.data())).filter((s): s is Space => !!s))),
    (error) => onError(error.code === 'permission-denied' ? 'Сервер не пустил к общему пространству: правила доступа ещё не опубликованы.' : 'Не удалось связаться с облаком. Проверьте интернет.'),
  );
}

/** Создаёт пространство пользователя, если его ещё нет (транзакция — без дублей при двойном нажатии). */
export async function createSpace(db: Firestore, uid: string, name: string): Promise<string> {
  const ref = doc(db, 'spaces', ownSpaceId(uid));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (current.exists()) return;
    tx.set(ref, {
      name: 'Наша жизнь', ownerId: uid, memberIds: [uid],
      members: { [uid]: { name: cleanName(name), joinedAt: serverTimestamp() } },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
  return ref.id;
}

/** Создаёт код приглашения на INVITE_DAYS дней. */
export async function createInvite(db: Firestore, space: Space, uid: string): Promise<string> {
  if (space.memberIds.length >= SPACE_MEMBER_LIMIT) throw new Error('В пространстве уже все участники.');
  const code = makeInviteCode();
  await setDoc(doc(db, 'spaceInvites', code), {
    spaceId: space.id, createdBy: uid, createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_DAYS * 86_400_000),
  });
  return code;
}

/**
 * Вступление по коду. Если пользователь уже участник этого пространства — ничего не меняет
 * (повторное принятие не создаёт копию, ТЗ 4.3).
 */
export async function acceptInvite(db: Firestore, rawCode: string, uid: string, name: string, current: Space | null): Promise<'joined' | 'already'> {
  const code = normalizeInviteCode(rawCode);
  if (!isInviteCode(code)) throw new Error('Код приглашения — 10 букв и цифр.');
  const invite = await getDoc(doc(db, 'spaceInvites', code));
  if (!invite.exists()) throw new Error('Приглашение не найдено. Попросите новый код.');
  const { spaceId, expiresAt } = invite.data() as { spaceId: string; expiresAt: Timestamp };
  if (expiresAt.toMillis() < Date.now()) throw new Error('Срок приглашения истёк. Попросите новый код.');
  if (current?.id === spaceId) return 'already';
  if (current && current.memberIds.length > 1) throw new Error('Вы уже состоите в общем пространстве с другим участником.');
  try {
    await updateDoc(doc(db, 'spaces', spaceId), {
      memberIds: arrayUnion(uid),
      [`members.${uid}`]: { name: cleanName(name), joinedAt: serverTimestamp() },
      joinCode: code,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'permission-denied') throw new Error('Вступить не получилось: в пространстве уже нет мест, приглашение устарело или правила доступа не опубликованы.', { cause: error });
    throw new Error('Не удалось связаться с облаком. Проверьте интернет и повторите.', { cause: error });
  }
  return 'joined';
}

/** Обновляет своё имя в пространстве (видно второму участнику). */
export const renameMe = (db: Firestore, space: Space, uid: string, name: string) =>
  updateDoc(doc(db, 'spaces', space.id), { [`members.${uid}.name`]: cleanName(name), updatedAt: serverTimestamp() });
