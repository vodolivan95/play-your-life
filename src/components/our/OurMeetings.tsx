import { useEffect, useMemo, useState } from 'react';
import {
  byTime, dayKey, now, decisionStatuses, matches, meetingProtocol, newId, notify, openQuestions, patch, priorities, put, questionCategories, questionStatuses,
  questionStatusesAfter, watch,
} from '../../ourData';
import type { Ctx, Decision, Meeting, Question } from '../../ourData';
import Ic from '../KbIcons';
import { Avatar, Empty, Field, Linkify, Modal, Tabs } from './OurUi';
import { fmtDateTime, fmtDay, nameIn } from './ourFormat';

/* ---------- Общие собрания (ТЗ 8): вопросы, повестка, заметки, решения, протокол, связь с календарём ---------- */

type Props = { ctx: Ctx; focusId: string | null; onOpen: (page: string, id: string) => void; onAddTask: (title: string, day?: string) => boolean };
const iso = (date: string, time: string) => new Date(`${date}T${time || '19:00'}`).toISOString();

export default function OurMeetings({ ctx, focusId, onOpen, onAddTask }: Props) {
  const who = nameIn(ctx.space);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Meeting | 'new' | null>(null);
  const [qForm, setQForm] = useState<Question | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(focusId);
  const [prevFocus, setPrevFocus] = useState(focusId);
  if (focusId !== prevFocus) { setPrevFocus(focusId); setOpenId(focusId); }
  useEffect(() => watch<Meeting>(ctx, 'meetings', byTime(300), setMeetings, setError), [ctx]);
  useEffect(() => watch<Question>(ctx, 'questions', byTime(500), setQuestions, setError), [ctx]);
  useEffect(() => watch<Decision>(ctx, 'decisions', byTime(500), setDecisions, setError), [ctx]);

  const upcoming = meetings.filter((m) => m.status === 'planned').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const done = meetings.filter((m) => m.status === 'done').sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
    .filter((m) => !q.trim() || matches(m.title, q) || matches(m.date, q) || matches(m.protocol, q) || m.agenda.some((a) => matches(questions.find((x) => x.id === a.questionId)?.title, q)) || decisions.some((d) => d.meetingId === m.id && matches(d.title, q)) || m.participants.some((u) => matches(who(u), q)));
  const open = meetings.find((m) => m.id === openId) ?? null;
  const next = upcoming[0];

  return (
    <div className="omt">
      {error && <p className="o-err">{error}</p>}
      <div className="ok-bar">
        <h3 className="omt-h">Собрания и вопросы</h3>
        <div className="ok-filters">
          <button type="button" onClick={() => setQForm('new')}><Ic n="chat" size={15} /> Предложить вопрос</button>
          <button type="button" className="o-primary" onClick={() => setForm('new')}><Ic n="plus" size={15} /> Создать собрание</button>
        </div>
      </div>
      <section className="our-card omt-next">
        <h4>Ближайшее собрание</h4>
        {next ? (() => {
          const d = new Date(`${next.date}T12:00`);
          return (
            <button type="button" className="omt-hero" onClick={() => setOpenId(next.id)}>
              <span className="omt-date"><b>{d.getDate()}</b><small>{d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}</small><small>{d.toLocaleDateString('ru-RU', { weekday: 'short' })}</small></span>
              <span className="omt-hero-main">
                <strong>{next.title}</strong>
                <span className="omt-chips">
                  <span>🕖 {next.time || 'время не указано'}</span>
                  <span>{next.format === 'online' ? '💻 онлайн' : `📍 ${next.location || 'лично'}`}</span>
                  <span>📋 в повестке: {next.agenda.length}</span>
                </span>
              </span>
              <span className="omt-hero-side">
                <span className="omt-people">{next.participants.map((u) => <Avatar key={u} name={who(u)} me={u === ctx.uid} size={34} />)}</span>
                <span className="omt-open">Открыть →</span>
              </span>
            </button>
          );
        })() : <p className="o-muted">Не назначено. Нажмите «Создать собрание».</p>}
        {upcoming.length > 1 && <><h4 className="omt-sub-h">Предстоящие</h4><ul className="omt-list">{upcoming.slice(1).map((m) => <li key={m.id}><button type="button" onClick={() => setOpenId(m.id)}><strong>{m.title}</strong><small>{fmtDay(m.date)} {m.time}</small></button></li>)}</ul></>}
      </section>
      <section className="our-card">
        <div className="ok-bar"><h4>История собраний</h4><label className="o-search slim"><Ic n="search" size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, дата, вопрос, решение, участник" aria-label="Поиск по собраниям" /></label></div>
        {done.length === 0 ? <p className="o-muted">{q ? 'Ничего не найдено.' : 'Проведённых собраний пока нет.'}</p> : <ul className="omt-list">{done.map((m) => <li key={m.id}><button type="button" onClick={() => setOpenId(m.id)}><strong>{m.title}</strong><small>{fmtDay(m.date)} · решений: {decisions.filter((d) => d.meetingId === m.id).length}</small></button></li>)}</ul>}
      </section>
      {form && <MeetingForm ctx={ctx} meeting={form === 'new' ? null : form} questions={openQuestions(questions)} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); setOpenId(id); }} />}
      {qForm && <QuestionForm ctx={ctx} question={qForm === 'new' ? null : qForm} meetings={upcoming} onClose={() => setQForm(null)} />}
      {open && !form && <MeetingCard ctx={ctx} m={open} meetings={upcoming} questions={questions} decisions={decisions} onClose={() => setOpenId(null)} onEdit={() => setForm(open)} onOpen={onOpen} onAddTask={onAddTask} />}
    </div>
  );
}

function QuestionForm({ ctx, question, meetings, onClose }: { ctx: Ctx; question: Question | null; meetings: Meeting[]; onClose: () => void }) {
  const who = nameIn(ctx.space);
  const [f, setF] = useState({ title: question?.title ?? '', description: question?.description ?? '', category: question?.category ?? 'other', priority: question?.priority ?? 'mid', status: question?.status ?? 'proposed' });
  const [comment, setComment] = useState('');
  const save = async () => {
    if (question) await patch(ctx, 'questions', question.id, f);
    else {
      await put(ctx, 'questions', newId(ctx, 'questions'), { ...f, title: f.title.trim().slice(0, 160), meetingId: null, comments: [] });
      void notify(ctx, `новый вопрос к собранию: «${f.title.trim().slice(0, 60)}»`, { page: 'our-meetings' });
    }
    onClose();
  };
  const addToMeeting = async (m: Meeting) => {
    if (!question || m.agenda.some((a) => a.questionId === question.id)) return;
    await patch(ctx, 'meetings', m.id, { agenda: [...m.agenda, { questionId: question.id, done: false }], history: [...m.history, { at: now(), by: ctx.uid, text: `Добавлен вопрос «${question.title}»` }] });
    await patch(ctx, 'questions', question.id, { status: 'agenda', meetingId: m.id });
    void notify(ctx, `повестка «${m.title}»: + «${question.title}»`, { page: 'our-meetings', id: m.id });
    onClose();
  };
  return (
    <Modal title={question ? 'Вопрос' : 'Предложить вопрос'} onClose={onClose} wide footer={<><button type="button" onClick={onClose}>Закрыть</button><button type="button" className="o-primary" disabled={!f.title.trim()} onClick={() => void save()}>Сохранить</button></>}>
      <div className="of-grid">
        <Field label="Вопрос" wide><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} autoFocus={!question} /></Field>
        <Field label="Категория"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Question['category'] })}>{Object.entries(questionCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Приоритет"><select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Question['priority'] })}>{Object.entries(priorities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {question && <Field label="Статус"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Question['status'] })}>{Object.entries(questionStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
        <Field label="Описание" wide><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      {question && (
        <>
          {meetings.length > 0 && question.status !== 'agenda' && <div className="o-pills"><span className="o-muted">В повестку:</span>{meetings.map((m) => <button key={m.id} type="button" onClick={() => void addToMeeting(m)}>{m.title} · {m.date}</button>)}</div>}
          <h4>Комментарии</h4>
          <ul className="omt-comments">{question.comments.map((c, i) => <li key={i}><strong>{who(c.by)}</strong> <small>{fmtDateTime(c.at)}</small><p>{c.text}</p></li>)}</ul>
          <form className="oth-form" onSubmit={async (e) => { e.preventDefault(); if (!comment.trim()) return; await patch(ctx, 'questions', question.id, { comments: [...question.comments, { by: ctx.uid, text: comment.trim().slice(0, 1000), at: now() }] }); setComment(''); }}>
            <textarea rows={1} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий к вопросу" aria-label="Комментарий" /><button type="submit" className="o-primary">Добавить</button>
          </form>
        </>
      )}
    </Modal>
  );
}

function MeetingForm({ ctx, meeting, questions, onClose, onSaved }: { ctx: Ctx; meeting: Meeting | null; questions: Question[]; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ title: meeting?.title ?? 'Общее собрание', description: meeting?.description ?? '', date: meeting?.date ?? dayKey(new Date(now() + 86400000 * 3)), time: meeting?.time ?? '19:00', format: meeting?.format ?? 'offline', location: meeting?.location ?? '', callUrl: meeting?.callUrl ?? '' });
  const [agenda, setAgenda] = useState<string[]>(meeting?.agenda.map((a) => a.questionId) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useState(() => meeting?.id ?? newId(ctx, 'meetings'))[0];
  const eventId = useState(() => meeting?.eventId ?? newId(ctx, 'events'))[0];
  const save = async () => {
    if (!f.title.trim() || !f.date) { setError('Нужны название и дата.'); return; }
    setBusy(true);
    const start = iso(f.date, f.time), end = new Date(new Date(start).getTime() + 90 * 60000).toISOString();
    const event = { title: `Собрание: ${f.title.trim()}`, description: f.description, category: 'meetings', start, end, place: f.format === 'online' ? 'Онлайн' : f.location, address: '', mapUrl: '', links: f.callUrl, access: 'shared', participants: ctx.space.memberIds, reminder: 60, repeat: 'none', meetingId: id };
    try {
      if (meeting) {
        const moved = meeting.date !== f.date || meeting.time !== f.time;
        await patch(ctx, 'meetings', id, { ...f, agenda: agenda.map((q) => meeting.agenda.find((a) => a.questionId === q) ?? { questionId: q, done: false }), history: [...meeting.history, { at: now(), by: ctx.uid, text: moved ? `Перенесено на ${f.date} ${f.time}` : 'Изменены данные собрания' }] });
        if (meeting.eventId) await patch(ctx, 'events', meeting.eventId, { title: event.title, description: event.description, start, end, place: event.place, links: event.links }).catch(() => undefined);
        if (moved) void notify(ctx, `собрание «${f.title}» перенесено на ${fmtDay(f.date)} ${f.time}`, { page: 'our-meetings', id });
      } else {
        const rsvp = Object.fromEntries(ctx.space.memberIds.map((u) => [u, u === ctx.uid ? 'yes' : 'pending']));
        await put(ctx, 'events', eventId, { ...event, rsvp, status: 'active', placeId: null });
        await put(ctx, 'meetings', id, { ...f, title: f.title.trim().slice(0, 120), participants: ctx.space.memberIds, agenda: agenda.map((q) => ({ questionId: q, done: false })), notes: '', status: 'planned', eventId, history: [{ at: now(), by: ctx.uid, text: 'Собрание создано' }] });
        await Promise.all(agenda.map((q) => patch(ctx, 'questions', q, { status: 'agenda', meetingId: id })));
        void notify(ctx, `приглашает на собрание «${f.title}» · ${fmtDay(f.date)} ${f.time}`, { page: 'our-meetings', id });
      }
      onSaved(id);
    } catch { setError('Не удалось сохранить. Проверьте интернет и повторите.'); } finally { setBusy(false); }
  };
  return (
    <Modal title={meeting ? 'Изменить собрание' : 'Новое собрание'} onClose={onClose} wide footer={<>{error && <span className="o-err inline">{error}</span>}<button type="button" onClick={onClose}>Отмена</button><button type="button" className="o-primary" disabled={busy} onClick={() => void save()}>Сохранить</button></>}>
      <div className="of-grid">
        <Field label="Название" wide><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} /></Field>
        <Field label="Дата"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Время"><input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Формат"><select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value as Meeting['format'] })}><option value="offline">Лично</option><option value="online">Онлайн</option></select></Field>
        {f.format === 'offline' ? <Field label="Место встречи"><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field> : <Field label="Ссылка на видеозвонок"><input value={f.callUrl} onChange={(e) => setF({ ...f, callUrl: e.target.value })} placeholder="https://telemost.yandex.ru/…" /></Field>}
        <Field label="Описание" wide><textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Повестка: выберите вопросы" wide>
          {questions.length === 0 ? <p className="o-muted">Открытых вопросов нет — предложите их на главной «Собраний».</p> : <div className="o-checks col">{questions.map((x) => <label key={x.id}><input type="checkbox" checked={agenda.includes(x.id)} onChange={(e) => setAgenda(e.target.checked ? [...agenda, x.id] : agenda.filter((y) => y !== x.id))} />{x.title} <small className="o-muted">· {priorities[x.priority]} · {questionStatuses[x.status]}</small></label>)}</div>}
        </Field>
      </div>
      {!meeting && <p className="o-muted">Собрание сразу появится в общем календаре и придёт приглашением второму участнику.</p>}
    </Modal>
  );
}

type CardProps = { ctx: Ctx; m: Meeting; meetings: Meeting[]; questions: Question[]; decisions: Decision[]; onClose: () => void; onEdit: () => void; onOpen: (page: string, id: string) => void; onAddTask: (title: string, day?: string) => boolean };

function MeetingCard({ ctx, m, meetings, questions, decisions, onClose, onEdit, onOpen, onAddTask }: CardProps) {
  const who = nameIn(ctx.space);
  const [tab, setTab] = useState<'agenda' | 'notes' | 'decisions' | 'history'>('agenda');
  const [notes, setNotes] = useState(m.notes);
  const [dForm, setDForm] = useState<Partial<Decision> | null>(null);
  const [copied, setCopied] = useState(false);
  const qOf = (id: string) => questions.find((x) => x.id === id);
  const mine = decisions.filter((d) => d.meetingId === m.id);
  const log = (text: string) => [...m.history, { at: now(), by: ctx.uid, text }];
  const setAgenda = (agenda: Meeting['agenda'], text: string) => patch(ctx, 'meetings', m.id, { agenda, history: log(text) });
  const protocol = useMemo(() => m.protocol || meetingProtocol(m, questions, decisions, who), [m, questions, decisions, who]);
  useEffect(() => {
    if (notes === m.notes) return;
    const t = window.setTimeout(() => void patch(ctx, 'meetings', m.id, { notes }), 700);
    return () => window.clearTimeout(t);
  }, [ctx, m.id, m.notes, notes]);
  const finish = async () => {
    if (!window.confirm('Завершить собрание и сохранить протокол? Нерассмотренные вопросы станут «Отложено».')) return;
    const statuses = questionStatusesAfter(m, decisions);
    await Promise.all(Object.entries(statuses).map(([qid, status]) => patch(ctx, 'questions', qid, { status, meetingId: status === 'postponed' ? null : m.id })));
    await patch(ctx, 'meetings', m.id, { status: 'done', notes, protocol: meetingProtocol({ ...m, notes }, questions, decisions, who), history: log('Собрание завершено, протокол сохранён') });
    void notify(ctx, `протокол собрания «${m.title}» сохранён`, { page: 'our-meetings', id: m.id });
  };
  return (
    <Modal title={m.title} onClose={onClose} wide>
      <p className="o-muted omt-sub">{fmtDay(m.date)}{m.time ? `, ${m.time}` : ''} · {m.format === 'online' ? 'онлайн' : m.location || 'лично'} · {m.participants.map(who).join(', ')}{m.callUrl && <> · <a href={m.callUrl} target="_blank" rel="noreferrer">видеозвонок</a></>}{m.status === 'done' ? ' · проведено' : ''}</p>
      {m.description && <p><Linkify text={m.description} /></p>}
      <Tabs value={tab} onChange={setTab} items={[['agenda', 'Повестка', m.agenda.length], ['notes', 'Заметки'], ['decisions', 'Решения', mine.length], ['history', 'История']]} />
      {tab === 'agenda' && (
        <div className="ok-detail">
          {m.agenda.length === 0 ? <p className="o-muted">Повестка пуста — добавьте вопросы.</p> : (
            <ol className="omt-agenda">{m.agenda.map((a, i) => {
              const x = qOf(a.questionId);
              return (
                <li key={a.questionId} className={a.done ? 'done' : ''}>
                  <label><input type="checkbox" checked={a.done} disabled={m.status === 'done'} onChange={(e) => void setAgenda(m.agenda.map((y) => (y.questionId === a.questionId ? { ...y, done: e.target.checked } : y)), `${e.target.checked ? 'Рассмотрен' : 'Снята отметка'}: «${x?.title ?? ''}»`)} /><strong>{x?.title ?? 'Вопрос удалён'}</strong></label>
                  <small>{x ? `${questionCategories[x.category]} · ${priorities[x.priority]}` : ''}</small>
                  {m.status !== 'done' && <span className="omt-row-actions">
                    <button type="button" className="o-icon" aria-label="Выше" disabled={i === 0} onClick={() => { const arr = [...m.agenda]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; void setAgenda(arr, 'Изменён порядок повестки'); }}>↑</button>
                    <button type="button" className="o-icon" aria-label="Ниже" disabled={i === m.agenda.length - 1} onClick={() => { const arr = [...m.agenda]; [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; void setAgenda(arr, 'Изменён порядок повестки'); }}>↓</button>
                    <select aria-label="Перенести на другое собрание" value="" onChange={async (e) => { const to = meetings.find((y) => y.id === e.target.value); if (!to) return; await setAgenda(m.agenda.filter((y) => y.questionId !== a.questionId), `Вопрос «${x?.title}» перенесён на «${to.title}»`); await patch(ctx, 'meetings', to.id, { agenda: [...to.agenda, { questionId: a.questionId, done: false }], history: [...to.history, { at: now(), by: ctx.uid, text: `Перенесён вопрос «${x?.title}» из «${m.title}»` }] }); await patch(ctx, 'questions', a.questionId, { meetingId: to.id }); }}>
                      <option value="">Перенести…</option>{meetings.filter((y) => y.id !== m.id).map((y) => <option key={y.id} value={y.id}>{y.title} · {y.date}</option>)}
                    </select>
                    <button type="button" className="o-icon" aria-label="Убрать из повестки" title="Убрать из повестки (вопрос сохранится)" onClick={() => { void setAgenda(m.agenda.filter((y) => y.questionId !== a.questionId), `Убран из повестки: «${x?.title}»`); void patch(ctx, 'questions', a.questionId, { status: 'proposed', meetingId: null }); }}><Ic n="close" size={14} /></button>
                    {x && <button type="button" className="o-link" onClick={() => setDForm({ questionId: x.id, title: x.title })}>+ решение</button>}
                  </span>}
                </li>
              );
            })}</ol>
          )}
          {m.status !== 'done' && (
            <div className="o-pills"><span className="o-muted">Добавить:</span>{openQuestions(questions).filter((x) => !m.agenda.some((a) => a.questionId === x.id)).slice(0, 12).map((x) => <button key={x.id} type="button" onClick={async () => { await setAgenda([...m.agenda, { questionId: x.id, done: false }], `Добавлен вопрос «${x.title}»`); await patch(ctx, 'questions', x.id, { status: 'agenda', meetingId: m.id }); void notify(ctx, `повестка «${m.title}»: + «${x.title}»`, { page: 'our-meetings', id: m.id }); }}>+ {x.title}</button>)}</div>
          )}
        </div>
      )}
      {tab === 'notes' && <div className="ok-detail"><textarea className="omt-notes" rows={10} value={notes} disabled={m.status === 'done'} onChange={(e) => setNotes(e.target.value)} placeholder="Общие записи во время встречи — сохраняются автоматически и видны обоим." /></div>}
      {tab === 'decisions' && (
        <div className="ok-detail">
          {mine.length === 0 ? <Empty icon="check" title="Решений пока нет" /> : <ul className="ocl-list">{mine.map((d) => (
            <li key={d.id} className="ocl-item">
              <div><strong>{d.title}</strong>{d.description && <p>{d.description}</p>}<small>{d.questionId ? `Вопрос: ${qOf(d.questionId)?.title ?? '—'} · ` : ''}ответственный: {who(d.responsible)}{d.due ? ` · срок ${fmtDay(d.due)}` : ''} · принято {fmtDay(d.date)}</small></div>
              <select value={d.status} onChange={(e) => void patch(ctx, 'decisions', d.id, { status: e.target.value })} aria-label="Статус решения">{Object.entries(decisionStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              {d.responsible === ctx.uid && !(d.taskCreatedBy ?? []).includes(ctx.uid) && <button type="button" className="o-link" title="Создать личную задачу в «Моих задачах»" onClick={() => { if (onAddTask(`${d.title} (решение собрания «${m.title}»)`, d.due || undefined)) void patch(ctx, 'decisions', d.id, { taskCreatedBy: [...(d.taskCreatedBy ?? []), ctx.uid] }); }}>→ в мои задачи</button>}
              {(d.taskCreatedBy ?? []).includes(ctx.uid) && <small className="o-muted">задача создана</small>}
            </li>
          ))}</ul>}
          <button type="button" className="o-primary" onClick={() => setDForm({})}><Ic n="plus" size={15} /> Решение</button>
        </div>
      )}
      {tab === 'history' && (
        <div className="ok-detail">
          <ul className="omt-history">{[...m.history].reverse().map((h, i) => <li key={i}><small>{fmtDateTime(h.at)} · {who(h.by)}</small> {h.text}</li>)}</ul>
          {m.status === 'done' && <><h4>Протокол</h4><pre className="omt-protocol">{protocol}</pre></>}
        </div>
      )}
      <div className="ok-actions">
        {m.status !== 'done' && <button type="button" onClick={onEdit}><Ic n="pencil" size={15} /> Изменить или перенести</button>}
        {m.eventId && <button type="button" onClick={() => onOpen('our-calendar', m.eventId!)}><Ic n="calendar" size={15} /> В календаре</button>}
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(protocol); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* буфер недоступен */ } }}><Ic n="copy" size={15} /> {copied ? 'Скопировано' : 'Копировать протокол'}</button>
        {m.status !== 'done' && <button type="button" className="o-primary" onClick={() => void finish()}>Завершить и сохранить протокол</button>}
      </div>
      {dForm && <DecisionForm ctx={ctx} meeting={m} questions={m.agenda.map((a) => qOf(a.questionId)).filter((x): x is Question => !!x)} draft={dForm} onClose={() => setDForm(null)} onSaved={(title) => void patch(ctx, 'meetings', m.id, { history: log(`Принято решение «${title}»`) })} />}
    </Modal>
  );
}

function DecisionForm({ ctx, meeting, questions, draft, onClose, onSaved }: { ctx: Ctx; meeting: Meeting; questions: Question[]; draft: Partial<Decision>; onClose: () => void; onSaved: (title: string) => void }) {
  const who = nameIn(ctx.space);
  const [f, setF] = useState({ title: draft.title ?? '', description: '', questionId: draft.questionId ?? '', responsible: ctx.uid, due: '', status: 'accepted' as Decision['status'] });
  const save = async () => {
    await put(ctx, 'decisions', newId(ctx, 'decisions'), { ...f, title: f.title.trim().slice(0, 160), questionId: f.questionId || null, date: dayKey(new Date()), meetingId: meeting.id, groupId: null, taskCreatedBy: [] });
    void notify(ctx, `решение собрания «${meeting.title}»: ${f.title.trim().slice(0, 60)}`, { page: 'our-meetings', id: meeting.id });
    onSaved(f.title.trim()); onClose();
  };
  return (
    <Modal title="Зафиксировать решение" onClose={onClose} footer={<><button type="button" onClick={onClose}>Отмена</button><button type="button" className="o-primary" disabled={!f.title.trim()} onClick={() => void save()}>Сохранить</button></>}>
      <Field label="Решение"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} autoFocus /></Field>
      <Field label="Описание"><textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="По вопросу"><select value={f.questionId} onChange={(e) => setF({ ...f, questionId: e.target.value })}><option value="">— без вопроса —</option>{questions.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
      <div className="of-row">
        <Field label="Ответственный"><select value={f.responsible} onChange={(e) => setF({ ...f, responsible: e.target.value })}>{ctx.space.memberIds.map((u) => <option key={u} value={u}>{who(u)}</option>)}</select></Field>
        <Field label="Срок"><input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="Статус"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Decision['status'] })}>{Object.entries(decisionStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
    </Modal>
  );
}
