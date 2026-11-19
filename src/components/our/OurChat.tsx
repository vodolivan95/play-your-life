import { useEffect, useMemo, useRef, useState } from 'react';
import { orderBy, where } from 'firebase/firestore';
import {
  agreementStatuses, byTime, dayKey, fileAttachment, markRead, matches, newId, notify, now, patch, put, reactionSet, remove,
  sendMessage, setMuted, sortGroups, toggleReaction, unreadOf, voiceAttachment, watch, MAX_VOICE_SECONDS,
} from '../../ourData';
import type { Agreement, Attachment, CalEvent, Ctx, Group, Message, Reads, Summary } from '../../ourData';
import Ic from '../KbIcons';
import { AttachmentView, Avatar, Empty, Field, Linkify, Modal, Tabs } from './OurUi';
import { fmtDate, fmtDateTime, fmtIso, fmtTime, nameIn } from './ourFormat';

/* ---------- Центр общения (ТЗ 5): тематические группы, сообщения, договорённости, итоги ---------- */

type Props = { ctx: Ctx; focusId: string | null; onOpenEvent: (id: string) => void };
type Tab = 'messages' | 'agreements' | 'summaries';
const PAGE = 60;

export default function OurChat({ ctx, focusId, onOpenEvent }: Props) {
  const who = nameIn(ctx.space);
  const [groups, setGroups] = useState<Group[]>([]);
  const [reads, setReads] = useState<Reads | null>(null);
  const [error, setError] = useState('');
  const [groupId, setGroupId] = useState<string>(focusId ?? 'general');
  const [showArchive, setShowArchive] = useState(false);
  const [listQuery, setListQuery] = useState('');
  const [tab, setTab] = useState<Tab>('messages');
  const [mobileThread, setMobileThread] = useState(!!focusId);
  const [creating, setCreating] = useState(false);
  useEffect(() => watch<Group>(ctx, 'groups', [orderBy('order', 'asc')], setGroups, setError), [ctx]);
  useEffect(() => watch<Reads & { id: string }>(ctx, 'reads', [where('authorId', '==', ctx.uid)], (rows) => setReads(rows[0] ?? null), () => undefined), [ctx]);
  const [prevFocus, setPrevFocus] = useState(focusId);
  if (focusId !== prevFocus) { setPrevFocus(focusId); if (focusId) { setGroupId(focusId); setMobileThread(true); setTab('messages'); } }

  const visible = useMemo(() => sortGroups(groups.filter((g) => g.archived === showArchive && (matches(g.name, listQuery) || matches(g.lastText, listQuery)))), [groups, showArchive, listQuery]);
  const group = groups.find((g) => g.id === groupId);
  const totalUnread = groups.reduce((s, g) => s + (g.archived || reads?.muted?.[g.id] ? 0 : unreadOf(g, reads)), 0);

  const move = async (g: Group, dir: -1 | 1) => {
    const list = sortGroups(groups.filter((x) => !x.archived && x.pinned === g.pinned));
    const i = list.findIndex((x) => x.id === g.id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    await Promise.all([patch(ctx, 'groups', g.id, { order: list[j].order }), patch(ctx, 'groups', list[j].id, { order: g.order })]);
  };

  return (
    <div className={`oc${mobileThread ? ' thread-open' : ''}`}>
      <aside className="oc-side">
        <div className="oc-side-head">
          <label className="o-search"><Ic n="search" size={16} /><input type="search" value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Поиск групп и сообщений" aria-label="Поиск групп" /></label>
          <button type="button" className="o-icon o-blue" aria-label="Создать группу" title="Создать группу" onClick={() => setCreating(true)}><Ic n="plus" size={18} /></button>
        </div>
        {error && <p className="o-err">{error}</p>}
        {groups.length === 0 && !error && <p className="o-muted o-pad">Готовим группы…</p>}
        <ul className="oc-groups">
          {visible.map((g) => {
            const unread = unreadOf(g, reads);
            const muted = !!reads?.muted?.[g.id];
            return (
              <li key={g.id}>
                <button type="button" className={`oc-group${g.id === groupId ? ' on' : ''}`} onClick={() => { setGroupId(g.id); setTab('messages'); setMobileThread(true); }}>
                  <span className="oc-gicon" aria-hidden="true">{g.icon}</span>
                  <span className="oc-gtext">
                    <span className="oc-gtop"><strong>{g.name}</strong>{g.lastAt ? <small>{dayKey(new Date(g.lastAt)) === dayKey(new Date()) ? fmtTime(g.lastAt) : fmtDate(g.lastAt)}</small> : null}</span>
                    <span className="oc-glast">{g.lastText ? `${g.lastBy === ctx.uid ? 'Вы: ' : g.lastBy ? `${who(g.lastBy)}: ` : ''}${g.lastText}` : g.caption ?? 'Пока нет сообщений'}</span>
                  </span>
                  <span className="oc-gbadges">{g.pinned && <Ic n="pin" size={13} />}{muted && <span title="Уведомления выключены">🔕</span>}{unread > 0 && <em className={muted ? 'muted' : ''}>{unread}</em>}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="oc-side-foot">
          <button type="button" className="o-link" onClick={() => setShowArchive((v) => !v)}>{showArchive ? '← Активные группы' : `Архив групп (${groups.filter((g) => g.archived).length})`}</button>
          <div className="oc-projects">
            <strong><Ic n="book" size={15} /> Обсуждения проектов</strong>
            <p>Появятся, когда у проектов из «Моей жизни» будет общий доступ. Личные проекты второму участнику не открываются и не копируются.</p>
          </div>
        </div>
        {totalUnread > 0 && <p className="oc-total">Непрочитанных: {totalUnread}</p>}
      </aside>
      <section className="oc-main">
        {group ? (
          <GroupView key={group.id} ctx={ctx} group={group} groups={groups} reads={reads} tab={tab} setTab={setTab} onBack={() => setMobileThread(false)} onMove={move} onOpenEvent={onOpenEvent} onArchived={() => setGroupId('general')} />
        ) : <Empty icon="chat" title="Выберите группу" />}
      </section>
      {creating && <GroupForm onClose={() => setCreating(false)} onSave={async (name, icon) => {
        const id = newId(ctx, 'groups');
        await put(ctx, 'groups', id, { name, icon, caption: '', order: Math.max(0, ...groups.map((g) => g.order)) + 1, system: false, archived: false, pinned: false, count: 0 });
        setGroupId(id); setCreating(false); setMobileThread(true);
      }} />}
    </div>
  );
}

function GroupForm({ group, onClose, onSave }: { group?: Group; onClose: () => void; onSave: (name: string, icon: string) => Promise<void> }) {
  const [name, setName] = useState(group?.name ?? '');
  const [icon, setIcon] = useState(group?.icon ?? '💬');
  return (
    <Modal title={group ? 'Группа' : 'Новая группа'} onClose={onClose} footer={<><button type="button" onClick={onClose}>Отмена</button><button type="button" className="o-primary" disabled={!name.trim()} onClick={() => void onSave(name.trim().slice(0, 60), icon)}>Сохранить</button></>}>
      <Field label="Название"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus /></Field>
      <Field label="Значок"><div className="o-emojis">{['💬', '🏠', '👨‍👩‍👧', '💼', '🎉', '💡', '🚗', '💰', '🏋️', '🎁', '📚', '✈️'].map((e) => <button key={e} type="button" className={icon === e ? 'on' : ''} onClick={() => setIcon(e)}>{e}</button>)}</div></Field>
    </Modal>
  );
}

type GroupViewProps = { ctx: Ctx; group: Group; groups: Group[]; reads: Reads | null; tab: Tab; setTab: (t: Tab) => void; onBack: () => void; onMove: (g: Group, d: -1 | 1) => Promise<void>; onOpenEvent: (id: string) => void; onArchived: () => void };

function GroupView({ ctx, group, groups, reads, tab, setTab, onBack, onMove, onOpenEvent, onArchived }: GroupViewProps) {
  const who = nameIn(ctx.space);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [count, setCount] = useState(PAGE);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [agreementFrom, setAgreementFrom] = useState<Message | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const muted = !!reads?.muted?.[group.id];
  const path = `groups/${group.id}/messages`;
  useEffect(() => watch<Message>(ctx, path, byTime(count), (rows) => setMessages(rows.reverse()), setError), [ctx, path, count]);
  useEffect(() => watch<Agreement>(ctx, 'agreements', byTime(300), setAgreements, () => undefined), [ctx]);
  useEffect(() => watch<Summary>(ctx, 'summaries', [where('groupId', '==', group.id)], (rows) => setSummaries(rows.sort((a, b) => b.at - a.at)), () => undefined), [ctx, group.id]);
  useEffect(() => {
    if (group.id !== 'fun') return;
    return watch<CalEvent>(ctx, 'events', [where('access', '==', 'shared')], setEvents, () => undefined);
  }, [ctx, group.id]);
  // Прочитано всё, что видно: счётчик группы запоминается в своём документе прочтений.
  useEffect(() => { if (tab === 'messages' && (reads?.counts?.[group.id] ?? 0) < group.count) void markRead(ctx, group.id, group.count).catch(() => undefined); }, [ctx, group.id, group.count, tab, reads]);

  const upcoming = events.filter((e) => e.category === 'fun' && e.status !== 'cancelled' && new Date(e.end || e.start).getTime() >= now()).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  const pinned = messages.filter((m) => m.pinned && !m.deleted);
  const shown = messages.filter((m) => matches(m.text, query) || matches(m.attachment?.name, query));
  const groupAgreements = agreements.filter((a) => a.groupId === group.id);

  return (
    <div className="ocg">
      <header className="ocg-head">
        <button type="button" className="o-icon oc-back" aria-label="К списку групп" onClick={onBack}><Ic n="collapse" size={18} /></button>
        <span className="oc-gicon big" aria-hidden="true">{group.icon}</span>
        <div className="ocg-title"><h2>{group.name}</h2><small>{group.caption || `${group.count} сообщений`}{group.archived ? ' · в архиве' : ''}</small></div>
        <label className="o-search slim"><Ic n="search" size={15} /><input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setTab('messages'); }} placeholder="Поиск в переписке" aria-label="Поиск в переписке" /></label>
        <span className="o-menu-wrap">
          <button type="button" className="o-icon" aria-label="Настройки группы" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Ic n="more" size={18} /></button>
          {menu && (
            <div className="o-menu" role="menu" onClick={() => setMenu(false)}>
              <button type="button" onClick={() => setRenaming(true)}><Ic n="pencil" size={15} />Переименовать</button>
              <button type="button" onClick={() => void patch(ctx, 'groups', group.id, { pinned: !group.pinned })}><Ic n="pin" size={15} />{group.pinned ? 'Открепить группу' : 'Закрепить группу'}</button>
              <button type="button" onClick={() => void onMove(group, -1)}><Ic n="chevD" size={15} />Выше в списке</button>
              <button type="button" onClick={() => void onMove(group, 1)}><Ic n="chevD" size={15} />Ниже в списке</button>
              <button type="button" onClick={() => void setMuted(ctx, group.id, !muted)}><Ic n="bell" size={15} />{muted ? 'Включить уведомления' : 'Выключить уведомления'}</button>
              <button type="button" onClick={() => { if (group.archived || window.confirm(`Отправить «${group.name}» в архив? История сохранится.`)) { void patch(ctx, 'groups', group.id, { archived: !group.archived }); if (!group.archived) onArchived(); } }}><Ic n="archive" size={15} />{group.archived ? 'Восстановить из архива' : 'В архив'}</button>
              {!group.system && group.authorId === ctx.uid && <button type="button" className="danger" onClick={() => { if (window.confirm(`Удалить группу «${group.name}»? Это нельзя отменить; лучше отправить в архив.`) && window.confirm('Точно удалить?')) { void remove(ctx, 'groups', group.id); onArchived(); } }}><Ic n="trash" size={15} />Удалить группу</button>}
            </div>
          )}
        </span>
      </header>
      <Tabs value={tab} onChange={setTab} items={[['messages', 'Сообщения'], ['agreements', 'Договорённости', groupAgreements.filter((a) => a.status === 'active').length], ['summaries', 'Итоги', summaries.length]]} />
      {error && <p className="o-err">{error}</p>}
      {tab === 'messages' && (
        <>
          {upcoming.length > 0 && (
            <div className="ocg-events">
              <strong><Ic n="calendar" size={15} /> Предстоящие мероприятия</strong>
              <div>{upcoming.map((e) => (
                <button key={e.id} type="button" onClick={() => onOpenEvent(e.id)}>
                  <b>{e.title}</b><small>{fmtIso(e.start)}</small>
                  <small>{e.participants.map((u) => `${who(u)}: ${e.rsvp[u] === 'yes' ? '✓' : e.rsvp[u] === 'maybe' ? '?' : e.rsvp[u] === 'no' ? '✕' : '…'}`).join(' · ')}</small>
                </button>
              ))}</div>
            </div>
          )}
          {pinned.length > 0 && <div className="ocg-pinned"><Ic n="pin" size={14} /> {pinned.slice(-1)[0].text.slice(0, 120) || 'Вложение'}{pinned.length > 1 && <em> и ещё {pinned.length - 1}</em>}</div>}
          <Messages ctx={ctx} group={group} messages={shown} hasMore={messages.length >= count} onMore={() => setCount((c) => c + PAGE)} onAgreement={(m) => setAgreementFrom(m)} searching={!!query.trim()} />
          {!group.archived ? <Composer ctx={ctx} group={group} muted={muted} /> : <p className="o-muted o-pad">Группа в архиве — история сохранена. Восстановите её, чтобы писать.</p>}
        </>
      )}
      {tab === 'agreements' && <Agreements ctx={ctx} groups={groups} groupId={group.id} agreements={agreements} onNew={() => setAgreementFrom('new')} />}
      {tab === 'summaries' && <Summaries ctx={ctx} groupId={group.id} summaries={summaries} />}
      {renaming && <GroupForm group={group} onClose={() => setRenaming(false)} onSave={async (name, icon) => { await patch(ctx, 'groups', group.id, { name, icon }); setRenaming(false); }} />}
      {agreementFrom && <AgreementForm ctx={ctx} groupId={group.id} from={agreementFrom === 'new' ? null : agreementFrom} onClose={() => setAgreementFrom(null)} />}
    </div>
  );
}

function Messages({ ctx, group, messages, hasMore, onMore, onAgreement, searching }: { ctx: Ctx; group: Group; messages: Message[]; hasMore: boolean; onMore: () => void; onAgreement: (m: Message) => void; searching: boolean }) {
  const who = nameIn(ctx.space);
  const endRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [react, setReact] = useState<string | null>(null);
  const last = messages[messages.length - 1]?.id;
  useEffect(() => { if (!searching) endRef.current?.scrollIntoView?.({ block: 'end' }); }, [last, searching]);
  const path = `groups/${group.id}/messages`;
  return (
    <div className="ocm" onClick={(e) => { if (!(e.target as HTMLElement).closest('.ocm-msg')) { setActive(null); setReact(null); } }}>
      {hasMore && <button type="button" className="o-link ocm-more" onClick={onMore}>Загрузить более ранние сообщения</button>}
      {messages.length === 0 && <Empty icon="chat" title={searching ? 'Ничего не найдено' : 'Здесь пока тихо'} text={searching ? 'Поиск идёт по загруженным сообщениям — загрузите более ранние, чтобы искать дальше.' : 'Напишите первое сообщение в группе.'} />}
      {messages.map((m, i) => {
        const day = dayKey(new Date(m.at));
        const sep = i === 0 || dayKey(new Date(messages[i - 1].at)) !== day ? <div className="ocm-day" key={`d${day}`}>{new Date(m.at).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div> : null;
        const mine = m.authorId === ctx.uid;
        return [sep, (
          <div key={m.id} id={`msg-${m.id}`} className={`ocm-msg${mine ? ' mine' : ''}${active === m.id ? ' active' : ''}`} onClick={() => setActive(m.id)}>
            {!mine && <Avatar name={who(m.authorId)} size={32} />}
            <div className="ocm-bubble">
              {!mine && <strong className="ocm-author">{who(m.authorId)}</strong>}
              {m.replyTo && <button type="button" className="o-quote" onClick={() => document.getElementById(`msg-${m.replyTo!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>↩ {who(m.replyTo.authorId)}: {m.replyTo.text || 'вложение'}</button>}
              {m.deleted ? <p className="o-muted"><i>Сообщение удалено</i></p> : <>
                {m.text && <p><Linkify text={m.text} /></p>}
                {m.attachment && <AttachmentView a={m.attachment} />}
              </>}
              <span className="ocm-time">{m.pinned && '📌 '}{m.editedAt ? 'изменено · ' : ''}{fmtTime(m.at)}{m.pending ? ' · ⏳' : mine ? ' · ✓' : ''}</span>
              {Object.keys(m.reactions ?? {}).length > 0 && (
                <div className="ocm-reactions">{Object.entries(m.reactions).map(([emo, users]) => (
                  <button key={emo} type="button" className={users.includes(ctx.uid) ? 'on' : ''} title={users.map(who).join(', ')} onClick={(e) => { e.stopPropagation(); void patch(ctx, path, m.id, { reactions: toggleReaction(m.reactions, emo, ctx.uid) }); }}>{emo} {users.length}</button>
                ))}</div>
              )}
              {active === m.id && !m.deleted && (
                <div className="ocm-tools" onClick={(e) => e.stopPropagation()}>
                  <button type="button" title="Ответить" onClick={() => { window.dispatchEvent(new CustomEvent('our-reply', { detail: m })); setActive(null); }}>↩</button>
                  <button type="button" title="Реакция" onClick={() => setReact(react === m.id ? null : m.id)}>🙂</button>
                  {m.text && <button type="button" title="Копировать текст" onClick={() => { void navigator.clipboard?.writeText(m.text); setActive(null); }}><Ic n="copy" size={15} /></button>}
                  <button type="button" title={m.pinned ? 'Открепить' : 'Закрепить'} onClick={() => { void patch(ctx, path, m.id, { pinned: !m.pinned }); setActive(null); }}><Ic n="pin" size={15} /></button>
                  <button type="button" title="Сохранить договорённость" onClick={() => { onAgreement(m); setActive(null); }}>🤝</button>
                  {mine && m.text && <button type="button" title="Редактировать" onClick={() => { window.dispatchEvent(new CustomEvent('our-edit', { detail: m })); setActive(null); }}><Ic n="pencil" size={15} /></button>}
                  {mine && <button type="button" title="Удалить" onClick={() => { if (window.confirm('Удалить сообщение?')) void patch(ctx, path, m.id, { deleted: true, text: '', attachment: null }); setActive(null); }}><Ic n="trash" size={15} /></button>}
                  {react === m.id && <div className="ocm-react-pop">{reactionSet.map((e) => <button key={e} type="button" onClick={() => { void patch(ctx, path, m.id, { reactions: toggleReaction(m.reactions ?? {}, e, ctx.uid) }); setReact(null); setActive(null); }}>{e}</button>)}</div>}
                </div>
              )}
            </div>
          </div>
        )];
      })}
      <div ref={endRef} />
    </div>
  );
}

function Composer({ ctx, group, muted }: { ctx: Ctx; group: Group; muted: boolean }) {
  const who = nameIn(ctx.space);
  const [text, setText] = useState('');
  const [att, setAtt] = useState<Attachment | null>(null);
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<{ rec: MediaRecorder; started: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendingId = useRef<string | null>(null);
  useEffect(() => {
    const onReply = (e: Event) => { setReply((e as CustomEvent<Message>).detail); setEditing(null); };
    const onEdit = (e: Event) => { const m = (e as CustomEvent<Message>).detail; setEditing(m); setText(m.text); setReply(null); };
    window.addEventListener('our-reply', onReply); window.addEventListener('our-edit', onEdit);
    return () => { window.removeEventListener('our-reply', onReply); window.removeEventListener('our-edit', onEdit); };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      const s = (now() - recording.started) / 1000;
      setSeconds(Math.floor(s));
      if (s >= MAX_VOICE_SECONDS) recording.rec.stop();
    }, 250);
    return () => window.clearInterval(t);
  }, [recording]);

  const send = async (attachment: Attachment | null = att) => {
    if (editing) {
      if (!text.trim()) return;
      await patch(ctx, `groups/${group.id}/messages`, editing.id, { text: text.trim().slice(0, 4000), editedAt: now() });
      setEditing(null); setText(''); return;
    }
    if (!text.trim() && !attachment) return;
    // Один id на одну попытку отправки: при сетевом сбое повтор перезапишет тот же документ, а не создаст дубль.
    const id = sendingId.current ?? newId(ctx, `groups/${group.id}/messages`);
    sendingId.current = id;
    const body = { text, attachment, replyTo: reply ? { id: reply.id, text: (reply.text || 'вложение').slice(0, 120), authorId: reply.authorId } : null };
    setText(''); setAtt(null); setReply(null);
    try {
      await sendMessage(ctx, group.id, body, id);
      sendingId.current = null; setError('');
      void notify(ctx, `${group.name}: ${body.text.trim().slice(0, 80) || (attachment?.kind === 'voice' ? 'голосовое' : 'вложение')}`, { page: 'our-chat', id: group.id }, group.id);
    } catch {
      setText(body.text); setAtt(attachment); setError('Сообщение не отправилось. Проверьте интернет и нажмите «Отправить» ещё раз — дубля не будет.');
    }
  };
  const record = async () => {
    if (recording) { recording.rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
      const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 24000 });
      const chunks: Blob[] = [];
      const started = now();
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(null); setSeconds(0);
        const duration = (now() - started) / 1000;
        if (duration < 1) return;
        try { await send(await voiceAttachment(new Blob(chunks, { type: rec.mimeType }), duration)); } catch (e) { setError((e as Error).message); }
      };
      rec.start(); setRecording({ rec, started }); setError('');
    } catch { setError('Нет доступа к микрофону. Разрешите его в браузере.'); }
  };

  return (
    <div className="occ">
      {error && <p className="o-err">{error}</p>}
      {muted && <p className="o-muted occ-muted">Уведомления этой группы выключены у вас.</p>}
      {reply && <div className="o-replybar">↩ Ответ {who(reply.authorId)}: {(reply.text || 'вложение').slice(0, 80)} <button type="button" aria-label="Отменить ответ" onClick={() => setReply(null)}><Ic n="close" size={14} /></button></div>}
      {editing && <div className="o-replybar">✏️ Редактирование сообщения <button type="button" aria-label="Отменить редактирование" onClick={() => { setEditing(null); setText(''); }}><Ic n="close" size={14} /></button></div>}
      {att && <div className="o-replybar">{att.kind === 'image' ? <img src={att.data} alt="" className="occ-thumb" /> : '📎'} {att.kind === 'image' ? 'Фото' : att.name} <button type="button" aria-label="Убрать вложение" onClick={() => setAtt(null)}><Ic n="close" size={14} /></button></div>}
      <form className="occ-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <button type="button" className="o-icon" aria-label="Прикрепить фото или файл" title="Фото или файл" disabled={!!editing || !!recording} onClick={() => fileRef.current?.click()}><Ic n="upload" size={19} /></button>
        <input ref={fileRef} type="file" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setAtt(await fileAttachment(f)); setError(''); } catch (er) { setError((er as Error).message); } }} />
        {recording
          ? <div className="occ-rec" role="status">● Запись {seconds} с из {MAX_VOICE_SECONDS}</div>
          : <textarea value={text} rows={1} onChange={(e) => setText(e.target.value)} placeholder={`Сообщение в «${group.name}»`} aria-label="Сообщение" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />}
        {!text.trim() && !att && !editing
          ? <button type="button" className={`o-icon${recording ? ' o-rec' : ' o-blue'}`} aria-label={recording ? 'Остановить и отправить' : 'Записать голосовое'} title={recording ? 'Остановить и отправить' : 'Голосовое сообщение'} onClick={() => void record()}>{recording ? '■' : '🎤'}</button>
          : <button type="submit" className="o-primary">{editing ? 'Сохранить' : 'Отправить'}</button>}
      </form>
    </div>
  );
}

function AgreementForm({ ctx, groupId, from, agreement, onClose }: { ctx: Ctx; groupId: string; from: Message | null; agreement?: Agreement; onClose: () => void }) {
  const [title, setTitle] = useState(agreement?.title ?? from?.text.slice(0, 80) ?? '');
  const [description, setDescription] = useState(agreement?.description ?? from?.text ?? '');
  const [date, setDate] = useState(agreement?.date ?? dayKey(new Date()));
  const [participants, setParticipants] = useState<string[]>(agreement?.participants ?? ctx.space.memberIds);
  const who = nameIn(ctx.space);
  const save = async () => {
    if (agreement) await patch(ctx, 'agreements', agreement.id, { title, description, date, participants });
    else {
      await put(ctx, 'agreements', newId(ctx, 'agreements'), { title: title.trim().slice(0, 120), description: description.slice(0, 2000), date, groupId, messageId: from?.id ?? null, participants, status: 'active' });
      void notify(ctx, `договорённость «${title.trim().slice(0, 60)}»`, { page: 'our-chat', id: groupId }, groupId);
    }
    onClose();
  };
  return (
    <Modal title={agreement ? 'Договорённость' : 'Сохранить договорённость'} onClose={onClose} footer={<><button type="button" onClick={onClose}>Отмена</button><button type="button" className="o-primary" disabled={!title.trim()} onClick={() => void save()}>Сохранить</button></>}>
      <Field label="Название"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus /></Field>
      <Field label="Описание"><textarea value={description} rows={3} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="of-row"><Field label="Дата"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Участники"><div className="o-checks">{ctx.space.memberIds.map((u) => <label key={u}><input type="checkbox" checked={participants.includes(u)} onChange={(e) => setParticipants(e.target.checked ? [...participants, u] : participants.filter((x) => x !== u))} />{who(u)}</label>)}</div></Field></div>
      {from && <p className="o-muted">Из сообщения {who(from.authorId)} от {fmtDateTime(from.at)} — ссылка сохранится.</p>}
    </Modal>
  );
}

function Agreements({ ctx, groups, groupId, agreements, onNew }: { ctx: Ctx; groups: Group[]; groupId: string; agreements: Agreement[]; onNew: () => void }) {
  const who = nameIn(ctx.space);
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'any' | Agreement['status']>('any');
  const [edit, setEdit] = useState<Agreement | null>(null);
  const list = agreements.filter((a) => (all || a.groupId === groupId) && (status === 'any' || a.status === status) && (matches(a.title, q) || matches(a.description, q)));
  return (
    <div className="ocl">
      <div className="ocl-bar">
        <label className="o-search slim"><Ic n="search" size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по договорённостям" aria-label="Поиск по договорённостям" /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Статус"><option value="any">Все статусы</option>{Object.entries(agreementStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="o-check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Все группы</label>
        <button type="button" className="o-primary" onClick={onNew}><Ic n="plus" size={15} /> Договорённость</button>
      </div>
      {list.length === 0 ? <Empty icon="check" title="Договорённостей пока нет" text="Откройте меню сообщения и выберите «Сохранить договорённость» (🤝)." /> : (
        <ul className="ocl-list">{list.map((a) => (
          <li key={a.id} className={`ocl-item s-${a.status}`}>
            <div>
              <strong>{a.title}</strong>
              {a.description && <p>{a.description}</p>}
              <small>{a.date} · {who(a.authorId)} · {a.participants.map(who).join(', ')}{all ? ` · ${groups.find((g) => g.id === a.groupId)?.name ?? ''}` : ''}{a.messageId ? <> · <button type="button" className="o-link" onClick={() => document.getElementById(`msg-${a.messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>к сообщению</button></> : null}</small>
            </div>
            <select value={a.status} onChange={(e) => void patch(ctx, 'agreements', a.id, { status: e.target.value })} aria-label="Статус договорённости">{Object.entries(agreementStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button type="button" className="o-icon" aria-label="Изменить" onClick={() => setEdit(a)}><Ic n="pencil" size={15} /></button>
          </li>
        ))}</ul>
      )}
      {edit && <AgreementForm ctx={ctx} groupId={edit.groupId} from={null} agreement={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Summaries({ ctx, groupId, summaries }: { ctx: Ctx; groupId: string; summaries: Summary[] }) {
  const who = nameIn(ctx.space);
  const [form, setForm] = useState<null | { discussed: string; decided: string; open: string; actions: string }>(null);
  return (
    <div className="ocl">
      <div className="ocl-bar"><p className="o-muted">Краткие итоги обсуждения — что обсуждали, к чему пришли, что осталось решить. Позже их сможет готовить ИИ.</p><button type="button" className="o-primary" onClick={() => setForm({ discussed: '', decided: '', open: '', actions: '' })}><Ic n="plus" size={15} /> Итоги</button></div>
      {summaries.length === 0 ? <Empty icon="outline" title="Итогов пока нет" /> : (
        <ul className="ocl-list">{summaries.map((s) => (
          <li key={s.id} className="ocs-item">
            <small>{fmtDateTime(s.at)} · {who(s.authorId)}</small>
            {([['Что обсуждали', s.discussed], ['К чему пришли', s.decided], ['Что осталось решить', s.open], ['Запланированные действия', s.actions]] as const).filter(([, v]) => v).map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}
          </li>
        ))}</ul>
      )}
      {form && (
        <Modal title="Итоги обсуждения" onClose={() => setForm(null)} footer={<><button type="button" onClick={() => setForm(null)}>Отмена</button><button type="button" className="o-primary" disabled={!Object.values(form).some((v) => v.trim())} onClick={async () => { await put(ctx, 'summaries', newId(ctx, 'summaries'), { groupId, ...form }); setForm(null); }}>Сохранить</button></>}>
          {([['discussed', 'Что обсуждали'], ['decided', 'К чему пришли'], ['open', 'Что осталось решить'], ['actions', 'Какие действия запланированы']] as const).map(([k, l]) => (
            <Field key={k} label={l}><textarea rows={2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>
          ))}
        </Modal>
      )}
    </div>
  );
}

