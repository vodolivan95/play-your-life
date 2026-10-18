import './TickTickInbox.css';
import { useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { saveGoal, saveStage } from '../planning';
import { TickTickContext } from '../tickTickContext';
import { goalsForSphere, openStages } from '../ticktickInbox';
import type { IncomingChoice, IncomingTask } from '../ticktickInbox';

const pageSize = 20;
function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function Row({ item, state, busy, listName, onAccept, onDismiss, onChange }: {
  item: IncomingTask;
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  busy: boolean;
  listName: string;
  onAccept: (choice: IncomingChoice) => Promise<string>;
  onDismiss: () => Promise<void>;
}) {
  const [sphere, setSphere] = useState(item.sphere);
  const [goalId, setGoalId] = useState('');
  const [stageId, setStageId] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [single, setSingle] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const goals = goalsForSphere(state, sphere);
  const canAccept = single || Boolean(goalId);
  const goal = goals.find((g) => g.id === goalId);
  const stages = openStages(goal);
  const start = formatDate(item.remote.startDate);
  const due = formatDate(item.remote.dueDate);
  async function run(action: () => Promise<unknown>) {
    try { setError(''); await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие.'); }
  }
  return <li className="ticktick-inbox-item">
    <div className="ticktick-inbox-title">
      <strong>{item.remote.title}</strong>
      <div className="ticktick-inbox-meta">
        <span className="ticktick-pill">Список: {listName}</span>
        <span className="ticktick-pill">{due ? `до ${due}` : start ? `с ${start}` : 'Без срока'}</span>
      </div>
    </div>
    {!open && <div className="ticktick-inbox-actions">
      <button className="ticktick-sort-button" disabled={busy} onClick={() => setOpen(true)}>Разобрать</button>
      <button className="text-button" disabled={busy} onClick={() => void run(onDismiss)}>Пропустить</button>
    </div>}
    {open && <div className="ticktick-inbox-choice">
      <span className="ticktick-inbox-label" id={`sphere-${item.remote.id}`}>Сфера</span>
      <div className="ticktick-inbox-chips" role="group" aria-labelledby={`sphere-${item.remote.id}`}>
        {spheres.map((s) => <button key={s.id} type="button" className="ticktick-chip" aria-pressed={sphere === s.id} disabled={busy}
          onClick={() => { setSphere(s.id); setGoalId(''); setStageId(''); setSingle(false); setAdding(false); }}>{s.icon} {s.name}</button>)}
      </div>
      <span className="ticktick-inbox-label" id={`goal-${item.remote.id}`}>Цель</span>
      <div className="ticktick-inbox-chips" role="group" aria-labelledby={`goal-${item.remote.id}`}>
        <button type="button" className="ticktick-chip" aria-pressed={single} disabled={busy}
          onClick={() => { setSingle(true); setGoalId(''); setStageId(''); setAdding(false); }}>Без цели</button>
        {goals.map((g) => <button key={g.id} type="button" className="ticktick-chip" aria-pressed={goalId === g.id} disabled={busy}
          onClick={() => { setSingle(false); setGoalId(g.id); setStageId(''); setAdding(false); }}>{g.name}</button>)}
        {!addingGoal && <button type="button" className="ticktick-chip ticktick-chip-add" disabled={busy} onClick={() => setAddingGoal(true)}>＋ Новая цель</button>}
        {addingGoal && <form className="ticktick-stage-form" onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const next = saveGoal(state, { name: goalDraft, sphere, target: 100, reward: 100, progressMode: 'tasks' });
            const created = next.goals.find((g) => !state.goals.some((o) => o.id === g.id));
            onChange(next);
            if (created) { setSingle(false); setGoalId(created.id); setStageId(''); }
            setGoalDraft(''); setAddingGoal(false);
          });
        }}>
          <input value={goalDraft} maxLength={100} autoFocus placeholder="Название цели" aria-label="Название новой цели" onChange={(e) => setGoalDraft(e.target.value)} />
          <button className="primary-button" type="submit" disabled={busy || !goalDraft.trim()}>Создать цель</button>
          <button className="text-button" type="button" onClick={() => { setAddingGoal(false); setGoalDraft(''); }}>Отмена</button>
        </form>}
      </div>
      {single && <p className="muted ticktick-inbox-hint">Одиночная задача без цели тоже синхронизируется с TickTick: название, срок, заметка, выполнение и удаление.</p>}
      {goal && <>
        <span className="ticktick-inbox-label" id={`stage-${item.remote.id}`}>Этап</span>
        <div className="ticktick-inbox-chips" role="group" aria-labelledby={`stage-${item.remote.id}`}>
          <button type="button" className="ticktick-chip" aria-pressed={!stageId} disabled={busy} onClick={() => setStageId('')}>Без этапа</button>
          {stages.map((s) => <button key={s.id} type="button" className="ticktick-chip" aria-pressed={stageId === s.id} disabled={busy} onClick={() => setStageId(s.id)}>{s.name}</button>)}
          {!adding && <button type="button" className="ticktick-chip ticktick-chip-add" disabled={busy} onClick={() => setAdding(true)}>＋ Новый этап</button>}
          {adding && <form className="ticktick-stage-form" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const next = saveStage(state, goal.id, { name: draft, status: 'active' });
              const created = next.goals.find((g) => g.id === goal.id)?.stages?.slice(-1)[0];
              onChange(next);
              if (created) setStageId(created.id);
              setDraft(''); setAdding(false);
            });
          }}>
            <input value={draft} maxLength={100} autoFocus placeholder="Название этапа" aria-label="Название нового этапа" onChange={(e) => setDraft(e.target.value)} />
            <button className="primary-button" type="submit" disabled={busy || !draft.trim()}>Создать этап</button>
            <button className="text-button" type="button" onClick={() => { setAdding(false); setDraft(''); }}>Отмена</button>
          </form>}
        </div>
      </>}
    </div>}
    {open && <>
    <p className="muted ticktick-inbox-hint">Награда придёт один раз — при выполнении задачи.</p>
    <div className="ticktick-inbox-actions">
      <button className="primary-button" disabled={busy || !canAccept} onClick={() => void run(() => onAccept({ sphere, goalId: single ? '' : goalId, stageId: stageId || undefined }))}>Принять в игру</button>
      <button className="text-button" disabled={busy} onClick={() => setOpen(false)}>Свернуть</button>
      <button className="text-button" disabled={busy} onClick={() => void run(onDismiss)}>Пропустить</button>
    </div></>}
    {error && <p className="transfer-message" role="alert">{error}</p>}
  </li>;
}
export default function TickTickInbox({ state, onChange }: { state: GameState; onChange: Dispatch<SetStateAction<GameState>> }) {
  const manager = useContext(TickTickContext);
  const [shown, setShown] = useState(pageSize);
  const [notice, setNotice] = useState('');
  const active = Boolean(manager?.connection && manager.connected && state.profile.mode !== 'demo');
  // Функции менеджера создаются заново при каждом рендере: берём свежую из ссылки, а таймер не пересоздаём.
  const load = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { if (manager) load.current = manager.loadIncoming; });
  useEffect(() => {
    if (!active) return;
    void load.current();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load.current(); }, 60000);
    return () => clearInterval(timer);
  }, [active]);
  if (!manager || !active) return null;
  const names = new Map(manager.projects.map((p) => [p.id, p.name]));
  const items = manager.incoming;
  return <section className="ticktick-inbox" aria-label="Входящие из TickTick">
    <div className="ticktick-inbox-head">
      <h3>Входящие из TickTick{items.length > 0 && <span className="ticktick-badge-count" aria-label={`Задач: ${items.length}`}>{items.length}</span>}</h3>
      <span className="ticktick-inbox-note">Задачи на ближайшие 4 месяца{manager.inboxNew > 0 ? ` · новых: ${manager.inboxNew}` : ''}</span>
      <button className="ticktick-refresh" disabled={manager.busy} onClick={() => void manager.refreshAll()}>{manager.inboxBusy ? 'Проверяем…' : 'Обновить'}</button>
    </div>
    {manager.inboxError && <p className="transfer-message" role="alert">{manager.inboxError}</p>}
    {!items.length && !manager.inboxError && <p className="empty">Новых задач в сопоставленных списках нет.</p>}
    {items.length > 0 && <ul className="ticktick-inbox-list">
      {items.slice(0, shown).map((item) => <Row key={item.remote.id} item={item} state={state} onChange={onChange} busy={manager.busy}
        listName={names.get(item.projectId) ?? 'без названия'}
        onAccept={async (choice) => { const message = await manager.acceptIncoming(item.remote.id, choice); setNotice(message); return message; }}
        onDismiss={() => manager.dismissIncoming(item.remote.id)} />)}
    </ul>}
    {items.length > shown && <button className="text-button" onClick={() => setShown((n) => n + pageSize)}>Показать ещё ({items.length - shown})</button>}
    {notice && <p className="transfer-message" role="status">{notice}</p>}
  </section>;
}
