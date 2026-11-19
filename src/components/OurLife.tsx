import { useCallback, useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, database } from '../firebaseClient';
import rulesText from '../../firestore.rules?raw';
import { menuIconSrc } from '../menuIcons';
import { INVITE_DAYS, SPACE_MEMBER_LIMIT, inviteLink, ourNavigation } from '../ourLife';
import type { OurPageId } from '../ourLife';
import { acceptInvite, createInvite, createSpace, ensurePairSpace, watchMySpace } from '../sharedSpace';
import type { Space } from '../sharedSpace';
import { ensureSystemGroups, forUser, isPairEmail, patch, watch, PAIR_SPACE_ID } from '../ourData';
import type { CalEvent, Ctx, Notice } from '../ourData';
import Ic from './KbIcons';
import { ourMenuIcon } from './ourIcons';
import OurChat from './our/OurChat';
import OurCalendar from './our/OurCalendar';
import { useEventReminders, useEvents } from './our/useEvents';
import OurPlaces from './our/OurPlaces';
import OurMeetings from './our/OurMeetings';
import { Avatar } from './our/OurUi';
import { fmtDateTime, fmtIso } from './our/ourFormat';
import './OurLife.css';

/* ---------- «Наша жизнь»: общее пространство и четыре сервиса (ТЗ 3.4–8) ---------- */

type Props = {
  page: OurPageId; userId?: string; userEmail?: string; userName: string; joinCode: string | null;
  onJoined: () => void; onNavigate: (page: string) => void; onAddTask: (title: string, day?: string) => boolean;
};

export default function OurLife({ page, userId: appUserId, userEmail: appEmail, userName, joinCode, onJoined, onNavigate, onAddTask }: Props) {
  const item = ourNavigation.find((x) => x.id === page)!;
  // В режиме без пароля личная игра остаётся в браузере, а для «Нашей жизни» можно войти прямо здесь.
  const [authUser, setAuthUser] = useState<User | null>(null);
  useEffect(() => (appUserId ? undefined : onAuthStateChanged(auth, setAuthUser)), [appUserId]);
  const userId = appUserId ?? authUser?.uid;
  const userEmail = appEmail ?? authUser?.email ?? undefined;
  const localLogin = !appUserId && !!authUser;
  const [space, setSpace] = useState<Space | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(joinCode ?? '');
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [focus, setFocus] = useState<{ page: string; id: string } | null>(null);
  const pair = isPairEmail(userEmail);

  useEffect(() => {
    if (!userId) return;
    return watchMySpace(database, userId, (s) => { setSpace(s); setError(''); }, (message) => { setError(message); setSpace(null); });
  }, [userId]);
  // Александр и Иван подключаются к общему пространству сами — без кода приглашения.
  useEffect(() => {
    if (!userId || !pair || space === undefined || space?.id === PAIR_SPACE_ID) return;
    ensurePairSpace(database, userId, userName).catch((e: { code?: string }) => setError(e?.code === 'permission-denied'
      ? 'Сервер не пускает в общее пространство: опубликуйте новые правила Firestore (firebase deploy --only firestore:rules).'
      : 'Не удалось подключить общее пространство. Проверьте интернет.'));
  }, [userId, pair, space, userName]);
  const ctx = useMemo<Ctx | null>(() => (space && userId ? { db: database, space, uid: userId, name: userName } : null), [space, userId, userName]);
  const spaceId = space?.id;
  useEffect(() => { if (ctx && spaceId) void ensureSystemGroups(ctx); }, [spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Что-то пошло не так. Повторите.'); } finally { setBusy(false); }
  };
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); window.setTimeout(() => setCopied(''), 2000); } catch { setCopied(''); }
  };
  const open = useCallback((target: string, id?: string) => { setFocus(id ? { page: target, id } : null); onNavigate(target); }, [onNavigate]);

  const head = (
    <header className="our-head">
      <img className="our-head-icon" src={menuIconSrc(ourMenuIcon[page])} alt="" width={56} height={56} />
      <div className="our-head-text"><small>НАША ЖИЗНЬ</small><h1>{item.label}</h1><p>{item.caption}</p></div>
      {space && ctx && (
        <div className="our-head-side">
          <div className="our-members compact">{space.memberIds.map((uid) => <span key={uid} className={`our-member${uid === userId ? ' me' : ''}`} title={space.members[uid]?.name}><Avatar name={space.members[uid]?.name ?? ''} me={uid === userId} size={30} />{space.members[uid]?.name ?? 'Участник'}</span>)}</div>
          <Bell ctx={ctx} onOpen={open} />
        </div>
      )}
    </header>
  );

  let gate = null;
  if (!userId) {
    gate = <SignIn />;
  } else if ((space === undefined || (pair && !space)) && !error) {
    gate = <section className="our-card our-loading" aria-busy="true">Подключаем общее пространство…</section>;
  } else if (!space) {
    gate = (
      <section className="our-setup">
        <div className="our-card">
          <h2><Ic n="users" size={22} /> Создать общее пространство</h2>
          <p>Вы станете первым участником и сможете пригласить второго по коду или ссылке.</p>
          <button type="button" className="our-primary" disabled={busy} onClick={() => run(() => createSpace(database, userId, userName))}>Создать пространство</button>
        </div>
        <form className="our-card" onSubmit={(e) => { e.preventDefault(); void run(async () => { await acceptInvite(database, code, userId, userName, null); onJoined(); }); }}>
          <h2><Ic n="link" size={22} /> У меня есть приглашение</h2>
          <p>Введите код из 10 символов, который прислал второй участник, или откройте его ссылку.</p>
          <div className="our-row">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Например, K7M2PQ9XRT" aria-label="Код приглашения" maxLength={16} autoCapitalize="characters" />
            <button type="submit" className="our-primary" disabled={busy || !code.trim()}>Присоединиться</button>
          </div>
        </form>
      </section>
    );
  }

  const rulesMissing = /правила|firestore/i.test(error);
  const full = !!space && space.memberIds.length >= SPACE_MEMBER_LIMIT;
  return (
    <div className="our-page">
      {head}
      {error && !rulesMissing && <p className="our-error" role="alert">{error}</p>}
      {rulesMissing && <RulesHelp onRetry={() => { setError(''); setSpace(undefined); window.location.reload(); }} />}
      {localLogin && <p className="our-signed">Общее пространство: вы вошли как <b>{authUser!.email}</b>. Личные разделы по-прежнему хранятся в этом браузере. <button type="button" className="o-link" onClick={() => void signOut(auth)}>Выйти</button></p>}
      {(!rulesMissing || !userId) && gate}
      {space && userId && !full && (
        <section className="our-card our-invite-card">
          <p><b>Пока вы здесь одни.</b> {pair ? 'Второй участник подключится сам, когда войдёт в свой аккаунт.' : `Пригласите второго участника — код действует ${INVITE_DAYS} дней.`}</p>
          {!pair && (invite ? (
            <div className="our-row">
              <code className="our-code">{invite}</code>
              <button type="button" onClick={() => void copy(invite, 'code')}>{copied === 'code' ? 'Скопировано' : 'Копировать код'}</button>
              <button type="button" onClick={() => void copy(inviteLink(invite), 'link')}>{copied === 'link' ? 'Скопировано' : 'Копировать ссылку'}</button>
            </div>
          ) : <button type="button" className="our-primary" disabled={busy} onClick={() => run(async () => setInvite(await createInvite(database, space, userId)))}><Ic n="plus" size={16} /> Пригласить участника</button>)}
        </section>
      )}
      {ctx && <Reminders ctx={ctx} onOpen={open} />}
      {ctx && page === 'our-chat' && <OurChat ctx={ctx} focusId={focus?.page === page ? focus.id : null} onOpenEvent={(id) => open('our-calendar', id)} />}
      {ctx && page === 'our-calendar' && <OurCalendar ctx={ctx} focusId={focus?.page === page ? focus.id : null} onOpen={open} />}
      {ctx && page === 'our-places' && <OurPlaces ctx={ctx} focusId={focus?.page === page ? focus.id : null} onOpen={open} />}
      {ctx && page === 'our-meetings' && <OurMeetings ctx={ctx} focusId={focus?.page === page ? focus.id : null} onOpen={open} onAddTask={onAddTask} />}
    </div>
  );
}

/** Уведомления внутри приложения (ТЗ 10): колокольчик со списком, переход к объекту, отметка «прочитано». */
function Bell({ ctx, onOpen }: { ctx: Ctx; onOpen: (page: string, id?: string) => void }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [openList, setOpenList] = useState(false);
  useEffect(() => watch<Notice>(ctx, 'notifications', forUser(ctx.uid), setItems, () => undefined), [ctx]);
  const unread = items.filter((n) => !n.read);
  const markAll = () => unread.forEach((n) => void patch(ctx, 'notifications', n.id, { read: true }).catch(() => undefined));
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  return (
    <span className="o-menu-wrap">
      <button type="button" className="our-bell" aria-label={`Уведомления: ${unread.length}`} aria-expanded={openList} onClick={() => setOpenList((v) => !v)}><Ic n="bell" size={20} />{unread.length > 0 && <em>{unread.length}</em>}</button>
      {openList && (
        <div className="o-menu our-notices" role="dialog" aria-label="Уведомления">
          <div className="our-notices-head"><strong>Уведомления</strong>{unread.length > 0 && <button type="button" className="o-link" onClick={markAll}>Прочитать все</button>}</div>
          {permission === 'default' && <button type="button" className="o-link" onClick={() => void Notification.requestPermission()}>Включить системные уведомления</button>}
          {items.length === 0 ? <p className="o-muted">Новых событий нет.</p> : items.slice(0, 30).map((n) => (
            <button key={n.id} type="button" className={`our-notice${n.read ? '' : ' unread'}`} onClick={() => { void patch(ctx, 'notifications', n.id, { read: true }).catch(() => undefined); setOpenList(false); onOpen(n.link.page, n.link.id); }}>
              <span>{n.text}</span><small>{fmtDateTime(n.at)}</small>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function Reminders({ ctx, onOpen }: { ctx: Ctx; onOpen: (page: string, id?: string) => void }) {
  const { events } = useEvents(ctx);
  const [shown, setShown] = useState<CalEvent | null>(null);
  useEventReminders(ctx, events, setShown);
  if (!shown) return null;
  return <div className="our-reminder" role="status"><Ic n="bell" size={18} /><span><b>Скоро:</b> {shown.title} · {fmtIso(shown.start)}</span><button type="button" className="o-link" onClick={() => { onOpen('our-calendar', shown.id); setShown(null); }}>Открыть</button><button type="button" className="o-icon" aria-label="Закрыть" onClick={() => setShown(null)}><Ic n="close" size={14} /></button></div>;
}

const authMessage = (code?: string) => ({
  'auth/invalid-credential': 'Неверная почта или пароль.', 'auth/wrong-password': 'Неверная почта или пароль.', 'auth/user-not-found': 'Такого аккаунта нет — зарегистрируйтесь.',
  'auth/email-already-in-use': 'Аккаунт с этой почтой уже есть — нажмите «Войти».', 'auth/weak-password': 'Пароль — не короче 6 символов.', 'auth/invalid-email': 'Проверьте адрес почты.',
  'auth/network-request-failed': 'Нет связи с сервером входа. Проверьте интернет.', 'auth/too-many-requests': 'Слишком много попыток. Подождите пару минут.',
  'auth/operation-not-allowed': 'Вход по почте выключен в настройках Firebase.',
} as Record<string, string>)[code ?? ''] ?? 'Не получилось войти. Проверьте интернет и повторите.';

/** Вход в аккаунт прямо в «Нашей жизни» — работает и в HTML-файле без пароля (ТЗ 4.1: у каждого свой аккаунт). */
function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) { setError(authMessage((e as { code?: string }).code)); } finally { setBusy(false); }
  };
  return (
    <form className="our-card our-gate our-signin" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <span className="our-gate-icon" aria-hidden="true"><Ic n="users" size={30} /></span>
      <h2>{mode === 'in' ? 'Войдите, чтобы открыть «Нашу жизнь»' : 'Регистрация'}</h2>
      <p>Общие группы, события, места и собрания хранятся в облаке и видны обоим участникам. Войдите своей почтой — аккаунты sanek.alex1995@yandex.ru и vodolivan195@gmail.com попадут в общее пространство сами.</p>
      <div className="our-signin-fields">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Почта" aria-label="Почта" autoComplete="email" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" aria-label="Пароль" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required />
        <button type="submit" className="our-primary" disabled={busy}>{busy ? 'Подождите…' : mode === 'in' ? 'Войти' : 'Зарегистрироваться'}</button>
      </div>
      {error && <p className="our-error" role="alert">{error}</p>}
      <button type="button" className="o-link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); }}>{mode === 'in' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}</button>
    </form>
  );
}

/** Подсказка, если облако не пускает к общим данным: правила доступа ещё не опубликованы в Firebase. */
function RulesHelp({ onRetry }: { onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="our-card our-rules">
      <h2><Ic n="lock" size={22} /> Нужно один раз опубликовать правила доступа</h2>
      <p>Вход прошёл, но облако Firebase пока не знает про «Нашу жизнь» и не пускает к общим данным. Это делается один раз владельцем проекта:</p>
      <ol>
        <li>Откройте <a href="https://console.firebase.google.com/project/play-your-life-872b1/firestore/rules" target="_blank" rel="noreferrer">Firebase → Firestore Database → Правила (Rules)</a>.</li>
        <li>Нажмите «Скопировать правила» ниже, удалите в редакторе старый текст и вставьте новый.</li>
        <li>Нажмите «Опубликовать» (Publish), подождите минуту и нажмите «Проверить снова».</li>
      </ol>
      <div className="our-row">
        <button type="button" className="our-primary" onClick={async () => { try { await navigator.clipboard.writeText(rulesText); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Скопировано ✓' : 'Скопировать правила'}</button>
        <button type="button" onClick={onRetry}>Проверить снова</button>
      </div>
      <p className="o-muted">Или в терминале проекта: <code>firebase deploy --only firestore:rules</code>.</p>
    </section>
  );
}
