import { useEffect, useState } from 'react';
import { database } from '../firebaseClient';
import { INVITE_DAYS, SPACE_MEMBER_LIMIT, inviteLink, ourNavigation } from '../ourLife';
import type { OurPageId } from '../ourLife';
import { acceptInvite, createInvite, createSpace, watchMySpace } from '../sharedSpace';
import type { Space } from '../sharedSpace';
import Ic from './KbIcons';
import { ourIcons } from './ourIcons';
import './OurLife.css';

/* ---------- «Наша жизнь»: подключение общего пространства и разделы (ТЗ 3.4, 4) ---------- */

const plans: Record<OurPageId, string[]> = {
  'our-chat': ['Шесть тематических групп: общие вопросы, квартиры, семья, работа и бизнес, отдых, идеи и планы', 'Сообщения в реальном времени, ответы, реакции, закрепление и поиск', 'Фото, файлы и голосовые, сохранение договорённостей и итоги обсуждений'],
  'our-calendar': ['Мой, совместный и общий режимы: месяц, неделя, день, список', 'Приглашения со статусами «Приму участие / Возможно / Не смогу»', 'У каждого мероприятия — своё обсуждение'],
  'our-places': ['Каталог мест по категориям и предложения «куда сходить»', 'Комментарии и статусы предложений', 'Кнопка «Запланировать» создаёт событие в общем календаре'],
  'our-meetings': ['Вопросы к собранию и повестка', 'Заметки, решения с ответственными и сроками, протокол', 'Собрание автоматически попадает в общий календарь'],
};
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '·';

type Props = { page: OurPageId; userId?: string; userName: string; joinCode: string | null; onJoined: () => void };

export default function OurLife({ page, userId, userName, joinCode, onJoined }: Props) {
  const item = ourNavigation.find((x) => x.id === page)!;
  const [space, setSpace] = useState<Space | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(joinCode ?? '');
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!userId) return;
    return watchMySpace(database, userId, (s) => { setSpace(s); setError(''); }, (message) => { setError(message); setSpace(null); });
  }, [userId]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Что-то пошло не так. Повторите.'); } finally { setBusy(false); }
  };
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); window.setTimeout(() => setCopied(''), 2000); } catch { setCopied(''); }
  };

  const head = (
    <header className="our-head">
      <span className="our-head-icon" aria-hidden="true"><Ic n={ourIcons[page]} size={26} /></span>
      <div><small>НАША ЖИЗНЬ</small><h1>{item.label}</h1><p>{item.caption}</p></div>
    </header>
  );

  let spaceBlock;
  if (!userId) {
    spaceBlock = (
      <section className="our-card our-gate">
        <span className="our-gate-icon" aria-hidden="true"><Ic n="lock" size={30} /></span>
        <h2>Войдите в свой аккаунт</h2>
        <p>«Наша жизнь» — общее пространство двух аккаунтов: у Александра и Ивана свои входы, а группы, события, места и собрания общие и синхронизируются в облаке. Без входа в аккаунт общее пространство недоступно, личные разделы работают как раньше.</p>
      </section>
    );
  } else if (space === undefined && !error) {
    spaceBlock = <section className="our-card our-loading" aria-busy="true">Подключаем общее пространство…</section>;
  } else if (!space) {
    spaceBlock = (
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
  } else {
    const full = space.memberIds.length >= SPACE_MEMBER_LIMIT;
    spaceBlock = (
      <section className="our-card our-space">
        <div className="our-members">
          {space.memberIds.map((uid) => (
            <span key={uid} className={`our-member${uid === userId ? ' me' : ''}`}>
              <i aria-hidden="true">{initials(space.members[uid]?.name ?? '')}</i>
              {space.members[uid]?.name ?? 'Участник'}{uid === userId && <small> · вы</small>}
            </span>
          ))}
          {!full && <span className="our-member empty"><i aria-hidden="true">+</i>Ждём второго участника</span>}
        </div>
        {joinCode && space.memberIds.includes(userId) && <p className="our-ok">Вы уже участник этого пространства — повторно вступать не нужно.</p>}
        {!full && (
          <div className="our-invite">
            {invite ? (
              <>
                <p>Отправьте код или ссылку второму участнику. Действует {INVITE_DAYS} дней.</p>
                <div className="our-row">
                  <code className="our-code">{invite}</code>
                  <button type="button" onClick={() => void copy(invite, 'code')}>{copied === 'code' ? 'Скопировано' : 'Копировать код'}</button>
                  <button type="button" onClick={() => void copy(inviteLink(invite), 'link')}>{copied === 'link' ? 'Скопировано' : 'Копировать ссылку'}</button>
                </div>
              </>
            ) : <button type="button" className="our-primary" disabled={busy} onClick={() => run(async () => setInvite(await createInvite(database, space, userId)))}><Ic n="plus" size={16} /> Пригласить участника</button>}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="our-page">
      {head}
      {error && <p className="our-error" role="alert">{error}</p>}
      {spaceBlock}
      <section className="our-card our-soon">
        <h2>Что будет в разделе «{item.label}»</h2>
        <ul>{plans[page].map((p) => <li key={p}><Ic n="check" size={16} />{p}</li>)}</ul>
        <p className="our-stage">Раздел появится на этапе {item.stage} из 5 по ТЗ PLAY YOUR LIFE 2.0. Сейчас готово общее пространство: участники, приглашение и права доступа.</p>
      </section>
    </div>
  );
}
