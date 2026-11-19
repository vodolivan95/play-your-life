/* PLAY YOUR LIFE 2.0 — общие данные «Нашей жизни»: справочники, чистые правила и операции Firestore.
 * Все общие объекты лежат внутри `spaces/{spaceId}/…`: один объект — один документ с одним id (ТЗ 12.3). */
import {
  collection, doc, increment, limit as qLimit, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, deleteDoc, where,
} from './ourStore.ts';
import type { Firestore, QueryConstraint } from 'firebase/firestore';
import type { Space } from './sharedSpace.ts';

/* ---------- Пара Александр — Иван: общее пространство без приглашения ---------- */
/** Аккаунты, которые автоматически попадают в одно общее пространство (проверяется и в firestore.rules). */
export const PAIR_EMAILS = ['sanek.alex1995@yandex.ru', 'vodolivan195@gmail.com'];
export const PAIR_SPACE_ID = 'pair-alexander-ivan';
export const isPairEmail = (email?: string | null) => !!email && PAIR_EMAILS.includes(email.trim().toLowerCase());

/* ---------- Справочники ---------- */
export type GroupId = string;
export const systemGroups: { id: string; name: string; caption: string; icon: string }[] = [
  { id: 'general', name: 'Общие вопросы', caption: 'Повседневные обсуждения', icon: '💬' },
  { id: 'flats', name: 'Наши квартиры', caption: 'Ремонт, мебель, техника, быт', icon: '🏠' },
  { id: 'family', name: 'Семья', caption: 'Родители, родственники, семейные планы', icon: '👨‍👩‍👧' },
  { id: 'work', name: 'Работа и бизнес', caption: 'Карьера, работа, бизнес-идеи', icon: '💼' },
  { id: 'fun', name: 'Отдых и развлечения', caption: 'Встречи, прогулки, поездки', icon: '🎉' },
  { id: 'ideas', name: 'Идеи и планы', caption: 'Будущие проекты и предложения', icon: '💡' },
];
export const reactionSet = ['👍', '❤️', '😂', '🔥', '✅', '🙏'];
export const agreementStatuses = { active: 'Актуальна', done: 'Выполнена', cancelled: 'Отменена' } as const;
export const eventCategories = { personal: 'Личные дела', family: 'Семья', fun: 'Отдых и развлечения', work: 'Работа', trips: 'Поездки', holidays: 'Праздники', meetings: 'Общие собрания', other: 'Другое' } as const;
export const eventColors: Record<keyof typeof eventCategories, string> = { personal: '#8a94a8', family: '#e0679a', fun: '#f39a3d', work: '#2f6cf0', trips: '#1fa8a0', holidays: '#e5484d', meetings: '#7a4fd6', other: '#6a7a99' };
export const rsvpLabels = { yes: 'Приму участие', maybe: 'Возможно', no: 'Не смогу', pending: 'Ждёт ответа' } as const;
export const placeCategories = { food: 'Рестораны и кафе', cinema: 'Кино и театры', concerts: 'Концерты', parks: 'Парки и прогулки', fun: 'Развлечения', trips: 'Путешествия', sights: 'Интересные места', other: 'Другое' } as const;
export const placeStatuses = { want: 'Хотим посетить', planned: 'Запланировано', visited: 'Посетили' } as const;
export const proposalStatuses = { proposed: 'Предложено', discussing: 'Обсуждаем', agreed: 'Согласовано', declined: 'Отклонено', done: 'Реализовано' } as const;
export const questionCategories = { flats: 'Квартиры', family: 'Семья', work: 'Работа и бизнес', rest: 'Отдых', finance: 'Финансы', ideas: 'Идеи и планы', other: 'Другое' } as const;
export const questionStatuses = { proposed: 'Предложено', agenda: 'В повестке', discussed: 'Обсуждено', solved: 'Решено', postponed: 'Отложено' } as const;
export const priorities = { low: 'Низкий', mid: 'Средний', high: 'Высокий' } as const;
export const decisionStatuses = { accepted: 'Принято', progress: 'В работе', done: 'Выполнено', cancelled: 'Отменено' } as const;

/* ---------- Типы общих объектов ---------- */
type Base = { id: string; authorId: string; at: number; updatedAt?: number };
export type Group = Base & { name: string; caption?: string; icon: string; order: number; system: boolean; archived: boolean; pinned: boolean; count: number; lastText?: string; lastAt?: number; lastBy?: string };
export type Attachment = { kind: 'image' | 'file' | 'voice'; data: string; name?: string; size?: number; duration?: number };
export type Message = Base & { text: string; attachment?: Attachment | null; replyTo?: { id: string; text: string; authorId: string } | null; reactions: Record<string, string[]>; pinned: boolean; editedAt?: number | null; deleted?: boolean; pending?: boolean };
export type Agreement = Base & { title: string; description: string; date: string; groupId: string; messageId?: string | null; participants: string[]; status: keyof typeof agreementStatuses };
export type Summary = Base & { groupId: string; discussed: string; decided: string; open: string; actions: string };
export type Reads = { authorId: string; counts: Record<string, number>; muted: Record<string, boolean>; at: number };
export type CalEvent = Base & {
  title: string; description: string; category: keyof typeof eventCategories; start: string; end: string; allDay?: boolean;
  place: string; address: string; mapUrl: string; links: string; access: 'personal' | 'shared'; participants: string[];
  rsvp: Record<string, keyof typeof rsvpLabels>; reminder: number; repeat: 'none' | 'weekly' | 'monthly'; status: 'active' | 'cancelled';
  meetingId?: string | null; placeId?: string | null;
};
export type Comment = Base & { pending?: boolean; text: string; attachment?: Attachment | null; replyTo?: { id: string; text: string; authorId: string } | null };
export type Visit = { date: string; rating: number; comment: string; photo?: string; by: string };
export type Place = Base & {
  kind: 'place' | 'proposal'; title: string; description: string; category: keyof typeof placeCategories; address: string; mapUrl: string; site: string; eventUrl: string;
  budget: string; photos: string[]; status: keyof typeof placeStatuses; proposalStatus: keyof typeof proposalStatuses; eventId?: string | null; visits: Visit[]; commentsCount: number;
};
export type Question = Base & { title: string; description: string; category: keyof typeof questionCategories; priority: keyof typeof priorities; status: keyof typeof questionStatuses; meetingId?: string | null; comments: { by: string; text: string; at: number }[] };
export type AgendaItem = { questionId: string; done: boolean };
export type Meeting = Base & {
  title: string; description: string; date: string; time: string; format: 'online' | 'offline'; location: string; callUrl: string; participants: string[];
  agenda: AgendaItem[]; notes: string; status: 'planned' | 'done'; eventId?: string | null; protocol?: string; history: { at: number; by: string; text: string }[];
};
export type Decision = Base & { title: string; description: string; date: string; meetingId: string; questionId?: string | null; responsible: string; due: string; status: keyof typeof decisionStatuses; groupId?: string | null; taskCreatedBy?: string[] };
export type Notice = Base & { to: string; text: string; link: { page: string; id?: string }; read: boolean; groupId?: string | null };

/* ---------- Чистые правила (тестируются без Firebase) ---------- */
export const unreadOf = (group: Pick<Group, 'id' | 'count'>, reads?: Pick<Reads, 'counts'> | null) => Math.max(0, (group.count ?? 0) - (reads?.counts?.[group.id] ?? 0));
/** Порядок групп: закреплённые, затем по номеру; архив отдельно. */
export const sortGroups = (groups: Group[]) => [...groups].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order || a.at - b.at);
export const toggleReaction = (reactions: Record<string, string[]>, emoji: string, uid: string) => {
  const list = reactions[emoji] ?? [];
  const nextList = list.includes(uid) ? list.filter((x) => x !== uid) : [...list, uid];
  const next = { ...reactions };
  if (nextList.length) next[emoji] = nextList; else delete next[emoji];
  return next;
};
/** Повторы события в диапазоне дат (YYYY-MM-DD). Отменённые не показываются как предстоящие, но остаются в истории. */
export function occurrences(ev: Pick<CalEvent, 'start' | 'end' | 'repeat'>, from: string, to: string): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  const s = new Date(ev.start), e = new Date(ev.end || ev.start);
  const len = Math.max(0, e.getTime() - s.getTime());
  const fromT = new Date(`${from}T00:00:00`).getTime(), toT = new Date(`${to}T23:59:59`).getTime();
  for (let i = 0, cur = new Date(s); i < 400; i++) {
    const t = cur.getTime();
    if (t > toT) break;
    if (t + len >= fromT) out.push({ start: cur.toISOString(), end: new Date(t + len).toISOString() });
    if (ev.repeat === 'weekly') cur.setDate(cur.getDate() + 7);
    else if (ev.repeat === 'monthly') cur.setMonth(cur.getMonth() + 1);
    else break;
  }
  return out;
}
/** Видимость события в режиме календаря (ТЗ 6.2): личные чужие не видны никогда. */
export function eventVisible(ev: Pick<CalEvent, 'access' | 'authorId' | 'rsvp'>, uid: string, mode: 'mine' | 'shared' | 'all') {
  if (ev.access === 'personal') return ev.authorId === uid && mode !== 'shared';
  if (mode === 'shared' || mode === 'all') return true;
  return ev.authorId === uid || ev.rsvp?.[uid] === 'yes' || ev.rsvp?.[uid] === 'maybe';
}
/** Протокол собрания (ТЗ 8.8) — обычный текст для копирования. */
export function meetingProtocol(m: Meeting, questions: Question[], decisions: Decision[], nameOf: (uid: string) => string): string {
  const q = (id: string) => questions.find((x) => x.id === id);
  const lines = [`ПРОТОКОЛ: ${m.title}`, `Дата: ${m.date}${m.time ? ` ${m.time}` : ''} · ${m.format === 'online' ? 'онлайн' : `лично${m.location ? `, ${m.location}` : ''}`}`, `Участники: ${m.participants.map(nameOf).join(', ')}`, ''];
  lines.push('Рассмотренные вопросы:');
  const done = m.agenda.filter((a) => a.done);
  if (!done.length) lines.push('— нет');
  done.forEach((a, i) => lines.push(`${i + 1}. ${q(a.questionId)?.title ?? 'Вопрос'}`));
  lines.push('', 'Принятые решения:');
  const ds = decisions.filter((d) => d.meetingId === m.id);
  if (!ds.length) lines.push('— нет');
  ds.forEach((d, i) => lines.push(`${i + 1}. ${d.title}${d.description ? ` — ${d.description}` : ''} · ответственный: ${nameOf(d.responsible)}${d.due ? ` · срок: ${d.due}` : ''} · ${decisionStatuses[d.status]}`));
  const postponed = m.agenda.filter((a) => !a.done);
  lines.push('', 'Отложенные вопросы:');
  if (!postponed.length) lines.push('— нет');
  postponed.forEach((a, i) => lines.push(`${i + 1}. ${q(a.questionId)?.title ?? 'Вопрос'}`));
  if (m.notes.trim()) lines.push('', 'Заметки:', m.notes.trim());
  return lines.join('\n');
}
/** Статусы вопросов после завершения собрания (ТЗ 8.9): нерассмотренные — «Отложено», с решением — «Решено». */
export function questionStatusesAfter(m: Meeting, decisions: Decision[]): Record<string, keyof typeof questionStatuses> {
  const out: Record<string, keyof typeof questionStatuses> = {};
  for (const a of m.agenda) out[a.questionId] = !a.done ? 'postponed' : decisions.some((d) => d.meetingId === m.id && d.questionId === a.questionId) ? 'solved' : 'discussed';
  return out;
}
export const openQuestions = (questions: Question[]) => questions.filter((q) => q.status === 'postponed' || q.status === 'proposed' || q.status === 'discussed');
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const matches = (text: string | undefined, q: string) => !q.trim() || (text ?? '').toLowerCase().includes(q.trim().toLowerCase());

/* ---------- Вложения: сжатие прямо в браузере (решение — хранить в Firestore, без Storage) ---------- */
export const MAX_IMAGE_BYTES = 260_000;
export const MAX_FILE_BYTES = 600_000;
export const MAX_VOICE_SECONDS = 90;
const readAsDataUrl = (blob: Blob) => new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => fail(r.error); r.readAsDataURL(blob); });
/** Сжимает фото до ширины 1280 px в WebP/JPEG, уменьшая качество, пока не влезет в лимит. */
export async function compressImage(file: Blob, maxSide = 1280, maxBytes = MAX_IMAGE_BYTES): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('Не удалось открыть картинку.')); i.src = url; });
    let side = maxSide;
    for (let attempt = 0; attempt < 6; attempt++) {
      const k = Math.min(1, side / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      for (const q of [0.78, 0.62, 0.48]) {
        const data = c.toDataURL('image/webp', q).startsWith('data:image/webp') ? c.toDataURL('image/webp', q) : c.toDataURL('image/jpeg', q);
        if (data.length <= maxBytes) return data;
      }
      side = Math.round(side * 0.72);
    }
    throw new Error('Картинка слишком большая даже после сжатия.');
  } finally { URL.revokeObjectURL(url); }
}
export async function fileAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith('image/')) return { kind: 'image', data: await compressImage(file), name: file.name };
  if (file.size > MAX_FILE_BYTES) throw new Error(`Файл больше ${Math.round(MAX_FILE_BYTES / 1000)} КБ. Без хранилища файлов отправляются только небольшие файлы.`);
  return { kind: 'file', data: await readAsDataUrl(file), name: file.name.slice(0, 120), size: file.size };
}
export const voiceAttachment = async (blob: Blob, duration: number): Promise<Attachment> => {
  const data = await readAsDataUrl(blob);
  if (data.length > MAX_FILE_BYTES * 1.4) throw new Error('Голосовое слишком длинное.');
  return { kind: 'voice', data, duration: Math.round(duration) };
};

/* ---------- Операции Firestore ---------- */
export type Ctx = { db: Firestore; space: Space; uid: string; name: string };
const col = (ctx: Ctx, path: string) => collection(ctx.db, 'spaces', ctx.space.id, ...path.split('/'));
export const newId = (ctx: Ctx, path: string) => doc(col(ctx, path)).id;
export const now = () => Date.now();

/** Подписка на коллекцию в реальном времени; ошибки превращаются в понятный текст. */
export function watch<T>(ctx: Ctx, path: string, constraints: QueryConstraint[], onData: (rows: T[]) => void, onError: (msg: string) => void) {
  return onSnapshot(query(col(ctx, path), ...constraints), { includeMetadataChanges: true }, (snap) => {
    onData(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id, pending: d.metadata.hasPendingWrites }) as T));
  }, (e) => onError(e.code === 'permission-denied' ? 'Нет доступа к общим данным: опубликуйте новые правила Firestore.' : 'Связь с облаком прервалась — данные обновятся, когда появится интернет.'));
}
/** Создание с заранее выбранным id: повторная отправка при сбое сети не создаёт дубль (ТЗ 5.5). */
export const put = <T extends object>(ctx: Ctx, path: string, id: string, data: T) => setDoc(doc(col(ctx, path), id), { ...data, authorId: ctx.uid, at: (data as { at?: number }).at ?? now(), updatedAt: now() });
export const patch = (ctx: Ctx, path: string, id: string, data: Record<string, unknown>) => updateDoc(doc(col(ctx, path), id), { ...data, updatedAt: now() });
export const remove = (ctx: Ctx, path: string, id: string) => deleteDoc(doc(col(ctx, path), id));
export const byTime = (n = 300) => [orderBy('at', 'desc'), qLimit(n)];
export const forUser = (uid: string) => [where('to', '==', uid), orderBy('at', 'desc'), qLimit(60)];

/** Шесть тематических групп создаются один раз; если группа уже есть — не трогаем. */
export async function ensureSystemGroups(ctx: Ctx) {
  await Promise.all(systemGroups.map((g, i) => runTransaction(ctx.db, async (tx) => {
    const ref = doc(col(ctx, 'groups'), g.id);
    if ((await tx.get(ref)).exists()) return;
    tx.set(ref, { name: g.name, caption: g.caption, icon: g.icon, order: i + 1, system: true, archived: false, pinned: false, count: 0, authorId: ctx.uid, at: i, updatedAt: now() });
  }).catch(() => undefined)));
}
/** Отправка сообщения: документ сообщения + счётчик и «последнее сообщение» группы. */
export async function sendMessage(ctx: Ctx, groupId: string, msg: Pick<Message, 'text' | 'attachment' | 'replyTo'>, id = newId(ctx, `groups/${groupId}/messages`)) {
  const preview = msg.text.trim() || (msg.attachment?.kind === 'image' ? '📷 Фото' : msg.attachment?.kind === 'voice' ? '🎤 Голосовое' : msg.attachment ? `📎 ${msg.attachment.name ?? 'Файл'}` : '');
  await put(ctx, `groups/${groupId}/messages`, id, { text: msg.text.trim().slice(0, 4000), attachment: msg.attachment ?? null, replyTo: msg.replyTo ?? null, reactions: {}, pinned: false, editedAt: null, deleted: false });
  await patch(ctx, 'groups', groupId, { count: increment(1), lastText: preview.slice(0, 140), lastAt: now(), lastBy: ctx.uid });
  return id;
}
export const markRead = (ctx: Ctx, groupId: string, count: number) =>
  setDoc(doc(col(ctx, 'reads'), ctx.uid), { authorId: ctx.uid, at: now(), counts: { [groupId]: count } }, { merge: true });
export const setMuted = (ctx: Ctx, groupId: string, muted: boolean) =>
  setDoc(doc(col(ctx, 'reads'), ctx.uid), { authorId: ctx.uid, at: now(), muted: { [groupId]: muted } }, { merge: true });
/** Уведомление второму участнику (внутри приложения, ТЗ 10). */
export async function notify(ctx: Ctx, text: string, link: Notice['link'], groupId: string | null = null) {
  await Promise.all(ctx.space.memberIds.filter((m) => m !== ctx.uid).map((to) => put(ctx, 'notifications', newId(ctx, 'notifications'), { to, text: `${ctx.name}: ${text}`.slice(0, 200), link, read: false, groupId }).catch(() => undefined)));
}
