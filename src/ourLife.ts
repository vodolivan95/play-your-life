/* PLAY YOUR LIFE 2.0 — пространство «Наша жизнь»: разделы, адреса, режим меню и коды приглашений (без Firebase). */

export type OurPageId = 'our-chat' | 'our-calendar' | 'our-places' | 'our-meetings';
export type LifeMode = 'my' | 'our';

/** Ровно четыре раздела «Нашей жизни» (ТЗ 3.4), в заданном порядке. */
export const ourNavigation: { id: OurPageId; slug: string; label: string; short: string; caption: string; stage: number }[] = [
  { id: 'our-chat', slug: 'chat', label: 'Центр общения', short: 'Общение', caption: 'Группы, сообщения, обсуждения', stage: 2 },
  { id: 'our-calendar', slug: 'calendar', label: 'Общий календарь', short: 'Календарь', caption: 'События и приглашения', stage: 3 },
  { id: 'our-places', slug: 'places', label: 'Наши места', short: 'Места', caption: 'Куда сходить и что посетить', stage: 4 },
  { id: 'our-meetings', slug: 'meetings', label: 'Общие собрания', short: 'Собрания', caption: 'Повестки, вопросы и решения', stage: 5 },
];
export const DEFAULT_OUR_PAGE: OurPageId = 'our-chat';
/** На первом этапе общее пространство — на двоих (Александр и Иван). Совпадает с проверкой в firestore.rules. */
export const SPACE_MEMBER_LIMIT = 2;
export const INVITE_DAYS = 7;

export const isOurPage = (page: string): page is OurPageId => ourNavigation.some((item) => item.id === page);
export const lifeModeOf = (page: string): LifeMode => (isOurPage(page) ? 'our' : 'my');
export const ourRoute = (page: OurPageId) => `#our/${ourNavigation.find((item) => item.id === page)!.slug}`;

/** Разбирает адрес вида `#our/chat` или `#our/join/КОД`. Чужие адреса — null. */
export function readOurRoute(hash: string): { page: OurPageId; joinCode: string | null } | null {
  const m = /^#our\/([a-z]+)(?:\/([A-Za-z0-9]{6,32}))?$/.exec(hash);
  if (!m) return null;
  if (m[1] === 'join') return { page: DEFAULT_OUR_PAGE, joinCode: m[2] ? normalizeInviteCode(m[2]) : null };
  const item = ourNavigation.find((x) => x.slug === m[1]);
  return item ? { page: item.id, joinCode: null } : null;
}

/* ---------- Запоминание пространства и последних разделов ---------- */
const MODE_KEY = 'play-your-life-life-mode';
const LAST_KEY = 'play-your-life-last-pages';
type Last = { my: string; our: OurPageId };
function readLast(): Last {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Partial<Last>;
    return { my: typeof raw.my === 'string' && !isOurPage(raw.my) ? raw.my : 'home', our: raw.our && isOurPage(raw.our) ? raw.our : DEFAULT_OUR_PAGE };
  } catch { return { my: 'home', our: DEFAULT_OUR_PAGE }; }
}
export function rememberPage(page: string) {
  try {
    const last = readLast();
    if (isOurPage(page)) last.our = page; else last.my = page;
    localStorage.setItem(LAST_KEY, JSON.stringify(last));
    localStorage.setItem(MODE_KEY, lifeModeOf(page));
  } catch { /* хранилище недоступно — пространство просто не запомнится */ }
}
export function storedMode(): LifeMode {
  try { return localStorage.getItem(MODE_KEY) === 'our' ? 'our' : 'my'; } catch { return 'my'; }
}
/** Раздел, который открывается при переключении на пространство: последний открытый в нём. */
export const lastPageOf = (mode: LifeMode): string => (mode === 'our' ? readLast().our : readLast().my);

/* ---------- Коды приглашений ---------- */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 10;
export function makeInviteCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(INVITE_CODE_LENGTH)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
/** Код из ссылки или введённый вручную: без пробелов и дефисов, заглавными. */
export const normalizeInviteCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isInviteCode = (code: string) => new RegExp(`^[${ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(code);
export const inviteLink = (code: string, base = `${location.origin}${location.pathname}`) => `${base}#our/join/${code}`;

/** Пара «Александр — Иван» (дублирует PAIR_EMAILS из ourData, чтобы не тянуть Firebase в основной код). */
export const isPairAccount = (email?: string | null) => !!email && ['sanek.alex1995@yandex.ru', 'vodolivan195@gmail.com'].includes(email.trim().toLowerCase());
