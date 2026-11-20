import { useMemo, useState } from 'react';
import { dayKey, now, eventCategories, eventColors, eventVisible, matches, newId, notify, occurrences, patch, put, rsvpLabels } from '../../ourData';
import type { CalEvent, Ctx } from '../../ourData';
import Ic from '../KbIcons';
import OurThread from './OurThread';
import { useEvents } from './useEvents';
import { Empty, Field, Linkify, Modal, Tabs } from './OurUi';
import { fmtIso, nameIn } from './ourFormat';

/* ---------- Общий календарь (ТЗ 6): одно событие — одна запись, у участников свои статусы ---------- */

type Mode = 'mine' | 'shared' | 'all';
type View = 'month' | 'week' | 'day' | 'list';
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const local = (iso: string) => { const d = new Date(iso); return { day: dayKey(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }; };

export type EventDraft = Partial<CalEvent> & { title?: string };

export default function OurCalendar({ ctx, focusId, onOpen }: { ctx: Ctx; focusId: string | null; onOpen: (page: string, id: string) => void }) {
  const who = nameIn(ctx.space);
  const { events, error } = useEvents(ctx);
  const [mode, setMode] = useState<Mode>('all');
  const [view, setView] = useState<View>(() => (window.innerWidth < 760 ? 'list' : 'month'));
  const [cursor, setCursor] = useState(() => new Date());
  const [category, setCategory] = useState<'any' | CalEvent['category']>('any');
  const [person, setPerson] = useState<'any' | string>('any');
  const [past, setPast] = useState(false);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [openId, setOpenId] = useState<string | null>(focusId);
  const [prevFocus, setPrevFocus] = useState(focusId);
  if (focusId !== prevFocus) { setPrevFocus(focusId); setOpenId(focusId); }

  const filtered = events.filter((e) => eventVisible(e, ctx.uid, mode) && (category === 'any' || e.category === category) && (person === 'any' || e.participants.includes(person)) && (matches(e.title, q) || matches(e.place, q)));
  const range = useMemo(() => {
    if (view === 'month') { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = mondayOf(first); return { from: start, days: 42 }; }
    if (view === 'week') return { from: mondayOf(cursor), days: 7 };
    if (view === 'day') return { from: new Date(cursor), days: 1 };
    return past ? { from: addDays(new Date(), -365), days: 366 } : { from: new Date(), days: 180 };
  }, [view, cursor, past]);
  const items = useMemo(() => {
    const out: { ev: CalEvent; start: string; end: string }[] = [];
    const from = dayKey(range.from), to = dayKey(addDays(range.from, range.days - 1));
    for (const ev of filtered) for (const o of occurrences(ev, from, to)) out.push({ ev, ...o });
    out.sort((a, b) => a.start.localeCompare(b.start));
    if (view === 'list') return past ? out.filter((x) => new Date(x.end).getTime() < now()).reverse() : out.filter((x) => new Date(x.end).getTime() >= now());
    return out;
  }, [filtered, range, view, past]);
  const byDay = (day: string) => items.filter((x) => local(x.start).day === day);
  const step = (dir: number) => setCursor((c) => (view === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (view === 'week' ? 7 : 1))));
  const today = dayKey(new Date());
  const open = events.find((e) => e.id === openId) ?? null;
  const invites = events.filter((e) => e.access === 'shared' && e.status !== 'cancelled' && e.rsvp?.[ctx.uid] === 'pending' && new Date(e.end || e.start).getTime() > now());
  const chip = (x: { ev: CalEvent; start: string }) => (
    <button key={`${x.ev.id}${x.start}`} type="button" className={`ok-chip${x.ev.status === 'cancelled' ? ' cancelled' : ''}${x.ev.access === 'personal' ? ' personal' : ''}`} style={{ ['--c' as string]: eventColors[x.ev.category] }} onClick={() => setOpenId(x.ev.id)} title={x.ev.title}>
      <b>{local(x.start).time}</b> {x.ev.title}
    </button>
  );
  const title = view === 'month' ? cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : view === 'week' ? `${range.from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(range.from, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : view === 'day' ? cursor.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) : past ? 'Прошедшие мероприятия' : 'Предстоящие мероприятия';

  return (
    <div className="ok">
      {error && <p className="o-err">{error}</p>}
      {invites.length > 0 && (
        <div className="ok-invites" role="status"><strong><Ic n="bell" size={15} /> Вас пригласили:</strong>{invites.map((e) => <button key={e.id} type="button" onClick={() => setOpenId(e.id)}>{e.title} · {fmtIso(e.start)}</button>)}</div>
      )}
      <div className="ok-bar">
        <Tabs value={mode} onChange={setMode} items={[['mine', '👤 Мой'], ['shared', '👥 Совместный'], ['all', '✨ Все']]} />
        <div className="ok-filters ok-one">
          <label className="o-search slim"><Ic n="search" size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" aria-label="Поиск мероприятий" /></label>
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Категория"><option value="any">Все категории</option>{Object.entries(eventCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Участник"><option value="any">Все участники</option>{ctx.space.memberIds.map((u) => <option key={u} value={u}>{who(u)}</option>)}</select>
        </div>
        <button type="button" className="o-primary" onClick={() => setDraft({ start: `${dayKey(view === 'list' ? new Date() : cursor)}T19:00`, access: 'shared' })}><Ic n="plus" size={15} /> Мероприятие</button>
      </div>
      <div className="ok-bar">
        <div className="ok-nav">
          {view !== 'list' && <><button type="button" className="o-icon" aria-label="Назад" onClick={() => step(-1)}>‹</button><button type="button" className="o-link" onClick={() => setCursor(new Date())}>Сегодня</button><button type="button" className="o-icon" aria-label="Вперёд" onClick={() => step(1)}>›</button></>}
          <h3>{title}</h3>
          <Tabs value={view} onChange={setView} items={[['month', '🗓️ Месяц'], ['week', '📆 Неделя'], ['day', '☀️ День'], ['list', '📋 Список']]} />
        </div>
      </div>
      {view === 'month' && (
        <div className="ok-month">
          {WD.map((d) => <div key={d} className="ok-wd">{d}</div>)}
          {Array.from({ length: 42 }, (_, i) => {
            const d = addDays(range.from, i), key = dayKey(d), list = byDay(key);
            return (
              <div key={key} className={`ok-cell${d.getMonth() !== cursor.getMonth() ? ' out' : ''}${key === today ? ' today' : ''}`} onDoubleClick={() => setDraft({ start: `${key}T19:00`, access: 'shared' })}>
                <button type="button" className="ok-num" onClick={() => { setCursor(d); setView('day'); }}>{d.getDate()}</button>
                {list.slice(0, 3).map(chip)}{list.length > 3 && <button type="button" className="o-link ok-more" onClick={() => { setCursor(d); setView('day'); }}>ещё {list.length - 3}</button>}
              </div>
            );
          })}
        </div>
      )}
      {(view === 'week' || view === 'day') && (
        <div className={`ok-week${view === 'day' ? ' one' : ''}`}>
          {Array.from({ length: range.days }, (_, i) => {
            const d = addDays(range.from, i), key = dayKey(d), list = byDay(key);
            return (
              <div key={key} className={`ok-col${key === today ? ' today' : ''}`}>
                <div className="ok-col-head"><b>{WD[(d.getDay() + 6) % 7]}</b> {d.getDate()}</div>
                {list.length === 0 ? <button type="button" className="ok-add" onClick={() => setDraft({ start: `${key}T19:00`, access: 'shared' })}>+</button> : list.map((x) => (
                  <button key={`${x.ev.id}${x.start}`} type="button" className={`ok-card${x.ev.status === 'cancelled' ? ' cancelled' : ''}`} style={{ ['--c' as string]: eventColors[x.ev.category] }} onClick={() => setOpenId(x.ev.id)}>
                    <b>{local(x.start).time}–{local(x.end).time}</b><strong>{x.ev.title}</strong>{x.ev.place && <small>{x.ev.place}</small>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {view === 'list' && (
        <>
          <div className="ok-bar"><label className="o-check"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} />История прошедших мероприятий</label></div>
          {items.length === 0 ? <Empty icon="calendar" title={past ? 'Прошедших мероприятий нет' : 'Предстоящих мероприятий нет'} text="Создайте мероприятие и пригласите второго участника." /> : (
            <ul className="ok-list">{items.map((x) => (
              <li key={`${x.ev.id}${x.start}`}><button type="button" className={`ok-row${x.ev.status === 'cancelled' ? ' cancelled' : ''}`} style={{ ['--c' as string]: eventColors[x.ev.category] }} onClick={() => setOpenId(x.ev.id)}>
                <span className="ok-date"><b>{new Date(x.start).getDate()}</b><small>{new Date(x.start).toLocaleDateString('ru-RU', { month: 'short' })}</small></span>
                <span className="ok-row-text"><strong>{x.ev.title}{x.ev.status === 'cancelled' ? ' — отменено' : ''}</strong><small>{local(x.start).time} · {eventCategories[x.ev.category]}{x.ev.place ? ` · ${x.ev.place}` : ''}{x.ev.access === 'personal' ? ' · личное' : ''}</small></span>
                <span className="ok-people">{x.ev.participants.map((u) => <span key={u} title={`${who(u)}: ${rsvpLabels[x.ev.rsvp?.[u] ?? 'pending']}`} className={`ok-rsvp r-${x.ev.rsvp?.[u] ?? 'pending'}`}>{who(u)[0]}</span>)}</span>
              </button></li>
            ))}</ul>
          )}
        </>
      )}
      {draft && <EventForm ctx={ctx} draft={draft} onClose={() => setDraft(null)} onSaved={(id) => { setDraft(null); setOpenId(id); }} />}
      {open && !draft && <EventCard ctx={ctx} ev={open} onClose={() => setOpenId(null)} onEdit={() => setDraft(open)} onOpen={onOpen} />}
    </div>
  );
}

/** Форма мероприятия; используется и из «Наших мест» и «Собраний» (ТЗ 7.7, 8.3). */
export function EventForm({ ctx, draft, onClose, onSaved }: { ctx: Ctx; draft: EventDraft; onClose: () => void; onSaved: (id: string) => void }) {
  const who = nameIn(ctx.space);
  const others = ctx.space.memberIds.filter((u) => u !== ctx.uid);
  const editing = !!draft.id;
  const s0 = draft.start ? local(draft.start.length <= 16 ? new Date(draft.start).toISOString() : draft.start) : { day: dayKey(new Date()), time: '19:00' };
  const e0 = draft.end ? local(draft.end) : { day: s0.day, time: `${String((Number(s0.time.slice(0, 2)) + 2) % 24).padStart(2, '0')}:${s0.time.slice(3)}` };
  const [f, setF] = useState({
    title: draft.title ?? '', description: draft.description ?? '', category: draft.category ?? 'fun', place: draft.place ?? '', address: draft.address ?? '', mapUrl: draft.mapUrl ?? '', links: draft.links ?? '',
    access: draft.access ?? 'shared', reminder: draft.reminder ?? 60, repeat: draft.repeat ?? 'none', sDay: s0.day, sTime: s0.time, eDay: e0.day, eTime: e0.time,
    invite: draft.participants ? others.filter((u) => draft.participants!.includes(u)) : others,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const idRef = useState(() => draft.id ?? newId(ctx, 'events'))[0];
  const set = (k: keyof typeof f, v: unknown) => setF({ ...f, [k]: v });
  const save = async () => {
    const start = new Date(`${f.sDay}T${f.sTime}`), end = new Date(`${f.eDay}T${f.eTime}`);
    if (!f.title.trim()) { setError('Введите название.'); return; }
    if (end < start) { setError('Окончание раньше начала.'); return; }
    setBusy(true);
    const participants = f.access === 'personal' ? [ctx.uid] : [draft.authorId ?? ctx.uid, ...f.invite.filter((u) => u !== (draft.authorId ?? ctx.uid))];
    const rsvp: Record<string, string> = {};
    for (const u of participants) rsvp[u] = draft.rsvp?.[u] ?? (u === (draft.authorId ?? ctx.uid) ? 'yes' : 'pending');
    const data = { title: f.title.trim().slice(0, 120), description: f.description.slice(0, 3000), category: f.category, start: start.toISOString(), end: end.toISOString(), place: f.place.slice(0, 120), address: f.address.slice(0, 200), mapUrl: f.mapUrl.slice(0, 500), links: f.links.slice(0, 1000), access: f.access, participants, rsvp, reminder: Number(f.reminder), repeat: f.repeat };
    try {
      if (editing) {
        await patch(ctx, 'events', idRef, data);
        if (data.access === 'shared' && (draft.start !== data.start || draft.place !== data.place || draft.address !== data.address)) void notify(ctx, `изменилось мероприятие «${data.title}»: ${fmtIso(data.start)}${data.place ? `, ${data.place}` : ''}`, { page: 'our-calendar', id: idRef });
      } else {
        await put(ctx, 'events', idRef, { ...data, status: 'active', meetingId: draft.meetingId ?? null, placeId: draft.placeId ?? null });
        if (data.access === 'shared' && participants.length > 1) void notify(ctx, `приглашает на «${data.title}» · ${fmtIso(data.start)}`, { page: 'our-calendar', id: idRef });
      }
      onSaved(idRef);
    } catch { setError('Не удалось сохранить. Проверьте интернет и повторите — дубля не будет.'); } finally { setBusy(false); }
  };
  return (
    <Modal title={editing ? 'Изменить мероприятие' : 'Новое мероприятие'} onClose={onClose} wide footer={<>{error && <span className="o-err inline">{error}</span>}<button type="button" onClick={onClose}>Отмена</button><button type="button" className="o-primary" disabled={busy} onClick={() => void save()}>{f.access === 'shared' && f.invite.length && !editing ? 'Сохранить и пригласить' : 'Сохранить'}</button></>}>
      <div className="of-grid">
        <Field label="Название" wide><input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={120} autoFocus /></Field>
        <Field label="Категория"><select value={f.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(eventCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Доступ"><select value={f.access} onChange={(e) => set('access', e.target.value)} disabled={editing && draft.authorId !== ctx.uid}><option value="shared">Совместное</option><option value="personal">Личное — видно только мне</option></select></Field>
        <Field label="Начало"><div className="of-pair"><input type="date" value={f.sDay} onChange={(e) => setF({ ...f, sDay: e.target.value, eDay: f.eDay < e.target.value ? e.target.value : f.eDay })} /><input type="time" value={f.sTime} onChange={(e) => set('sTime', e.target.value)} /></div></Field>
        <Field label="Окончание"><div className="of-pair"><input type="date" value={f.eDay} onChange={(e) => set('eDay', e.target.value)} /><input type="time" value={f.eTime} onChange={(e) => set('eTime', e.target.value)} /></div></Field>
        <Field label="Место"><input value={f.place} onChange={(e) => set('place', e.target.value)} placeholder="Кафе «…», парк, квартира" /></Field>
        <Field label="Адрес"><input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Ссылка на карту"><input value={f.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} placeholder="https://yandex.ru/maps/…" /></Field>
        <Field label="Напоминание"><select value={f.reminder} onChange={(e) => set('reminder', Number(e.target.value))}><option value={0}>Без напоминания</option><option value={15}>За 15 минут</option><option value={60}>За час</option><option value={180}>За 3 часа</option><option value={1440}>За день</option></select></Field>
        <Field label="Повтор"><select value={f.repeat} onChange={(e) => set('repeat', e.target.value)}><option value="none">Не повторять</option><option value="weekly">Каждую неделю</option><option value="monthly">Каждый месяц</option></select></Field>
        {f.access === 'shared' && others.length > 0 && <Field label="Пригласить"><div className="o-checks">{others.map((u) => <label key={u}><input type="checkbox" checked={f.invite.includes(u)} onChange={(e) => set('invite', e.target.checked ? [...f.invite, u] : f.invite.filter((x) => x !== u))} />{who(u)}</label>)}</div></Field>}
        <Field label="Описание" wide><textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Файлы и ссылки (по одной в строке)" wide><textarea rows={2} value={f.links} onChange={(e) => set('links', e.target.value)} placeholder="https://…" /></Field>
      </div>
    </Modal>
  );
}

function EventCard({ ctx, ev, onClose, onEdit, onOpen }: { ctx: Ctx; ev: CalEvent; onClose: () => void; onEdit: () => void; onOpen: (page: string, id: string) => void }) {
  const who = nameIn(ctx.space);
  const [tab, setTab] = useState<'info' | 'talk'>('info');
  const my = ev.rsvp?.[ctx.uid];
  const answer = async (v: 'yes' | 'maybe' | 'no') => {
    await patch(ctx, 'events', ev.id, { [`rsvp.${ctx.uid}`]: v });
    void notify(ctx, `${rsvpLabels[v].toLowerCase()} — «${ev.title}»`, { page: 'our-calendar', id: ev.id });
  };
  const cancel = async () => {
    if (!window.confirm(`Отменить «${ev.title}»? Участники получат уведомление.`)) return;
    await patch(ctx, 'events', ev.id, { status: 'cancelled' });
    if (ev.access === 'shared') void notify(ctx, `отменил(а) мероприятие «${ev.title}»`, { page: 'our-calendar', id: ev.id });
  };
  return (
    <Modal title={<span className="ok-card-title"><i style={{ background: eventColors[ev.category] }} />{ev.title}</span>} onClose={onClose} wide>
      <Tabs value={tab} onChange={setTab} items={[['info', 'Мероприятие'], ['talk', 'Обсуждение']]} />
      {tab === 'info' ? (
        <div className="ok-detail">
          {ev.status === 'cancelled' && <p className="o-err">Мероприятие отменено.</p>}
          <dl>
            <dt>Когда</dt><dd>{fmtIso(ev.start)} — {fmtIso(ev.end)}{ev.repeat !== 'none' ? ` · повтор ${ev.repeat === 'weekly' ? 'каждую неделю' : 'каждый месяц'}` : ''}</dd>
            <dt>Категория</dt><dd>{eventCategories[ev.category]} · {ev.access === 'personal' ? 'личное' : 'совместное'}</dd>
            {(ev.place || ev.address) && <><dt>Где</dt><dd>{ev.place}{ev.address ? `, ${ev.address}` : ''}{ev.mapUrl && <> · <a href={ev.mapUrl} target="_blank" rel="noreferrer">карта</a></>}</dd></>}
            <dt>Организатор</dt><dd>{who(ev.authorId)}</dd>
            <dt>Участники</dt><dd className="ok-rsvps">{ev.participants.map((u) => <span key={u} className={`ok-rsvp-line r-${ev.rsvp?.[u] ?? 'pending'}`}>{who(u)} — {rsvpLabels[ev.rsvp?.[u] ?? 'pending']}</span>)}</dd>
            {ev.reminder > 0 && <><dt>Напоминание</dt><dd>за {ev.reminder >= 1440 ? 'день' : ev.reminder >= 60 ? `${ev.reminder / 60} ч` : `${ev.reminder} мин`}</dd></>}
          </dl>
          {ev.description && <p className="ok-desc"><Linkify text={ev.description} /></p>}
          {ev.links && <div className="ok-links">{ev.links.split('\n').filter(Boolean).map((l) => <a key={l} href={l} target="_blank" rel="noreferrer">{l}</a>)}</div>}
          {ev.meetingId && <button type="button" className="o-link" onClick={() => onOpen('our-meetings', ev.meetingId!)}>Открыть собрание →</button>}
          {ev.placeId && <button type="button" className="o-link" onClick={() => onOpen('our-places', ev.placeId!)}>Открыть место →</button>}
          {ev.status !== 'cancelled' && ev.authorId !== ctx.uid && my && (
            <div className="ok-answer"><span>Ваш ответ:</span>{(['yes', 'maybe', 'no'] as const).map((v) => <button key={v} type="button" className={my === v ? 'on' : ''} onClick={() => void answer(v)}>{rsvpLabels[v]}</button>)}</div>
          )}
          <div className="ok-actions">
            {ev.status !== 'cancelled' && <button type="button" onClick={onEdit}><Ic n="pencil" size={15} /> Изменить или перенести</button>}
            {ev.status !== 'cancelled' && ev.authorId === ctx.uid && <button type="button" className="danger" onClick={() => void cancel()}>Отменить мероприятие</button>}
            {ev.status === 'cancelled' && ev.authorId === ctx.uid && <button type="button" onClick={() => void patch(ctx, 'events', ev.id, { status: 'active' })}>Вернуть мероприятие</button>}
          </div>
        </div>
      ) : <OurThread ctx={ctx} path={`events/${ev.id}`} onPosted={(t) => { if (ev.access === 'shared') void notify(ctx, `в обсуждении «${ev.title}»: ${t.slice(0, 60)}`, { page: 'our-calendar', id: ev.id }); }} />}
    </Modal>
  );
}
