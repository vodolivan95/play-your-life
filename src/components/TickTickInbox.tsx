import { useContext, useEffect, useRef, useState } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { TickTickContext } from '../tickTickContext';
import { goalsForSphere, openStages } from '../ticktickInbox';
import type { IncomingChoice, IncomingTask } from '../ticktickInbox';

const pageSize = 20;
function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU');
}
function Row({ item, state, busy, listName, onAccept, onDismiss }: {
  item: IncomingTask;
  state: GameState;
  busy: boolean;
  listName: string;
  onAccept: (choice: IncomingChoice) => Promise<string>;
  onDismiss: () => Promise<void>;
}) {
  const [sphere, setSphere] = useState(item.sphere);
  const [goalId, setGoalId] = useState('');
  const [stageId, setStageId] = useState('');
  const [error, setError] = useState('');
  const goals = goalsForSphere(state, sphere);
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
      <small>Список TickTick: {listName}{start ? ` · начало ${start}` : ''}{due ? ` · срок ${due}` : ''}</small>
    </div>
    <div className="ticktick-inbox-choice">
      <label>Сфера
        <select value={sphere} disabled={busy} onChange={(e) => { setSphere(e.target.value); setGoalId(''); setStageId(''); }}>
          {spheres.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
      </label>
      <label>Цель
        <select value={goalId} disabled={busy || !goals.length} onChange={(e) => { setGoalId(e.target.value); setStageId(''); }}>
          <option value="">{goals.length ? 'Выберите цель' : 'В этой сфере нет целей'}</option>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <label>Этап
        <select value={stageId} disabled={busy || !goal} onChange={(e) => setStageId(e.target.value)}>
          <option value="">Без этапа</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
    </div>
    {!goals.length && <p className="score-note">Задача из TickTick добавляется в цель. Создайте цель в этой сфере или выберите другую сферу.</p>}
    <div className="ticktick-inbox-actions">
      <button className="primary-button" disabled={busy || !goalId} onClick={() => void run(() => onAccept({ sphere, goalId, stageId: stageId || undefined }))}>Принять в игру</button>
      <button className="text-button" disabled={busy} onClick={() => void run(onDismiss)}>Пропустить</button>
    </div>
    {error && <p className="transfer-message" role="alert">{error}</p>}
  </li>;
}
export default function TickTickInbox({ state }: { state: GameState }) {
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
    <div className="ticktick-heading">
      <div><div className="eyebrow">TICKTICK</div><h3>Входящие из TickTick</h3></div>
      <button className="secondary-button" disabled={manager.busy} onClick={() => void manager.loadIncoming()}>{manager.inboxBusy ? 'Проверяем…' : 'Обновить'}</button>
    </div>
    <p className="muted">Новые задачи из ваших списков TickTick. В игру они попадают только после выбора сферы, цели и этапа; дальше синхронизируются как обычные задачи цели.</p>
    {manager.inboxError && <p className="transfer-message" role="alert">{manager.inboxError}</p>}
    {!items.length && !manager.inboxError && <p className="empty">Новых задач в сопоставленных списках нет.</p>}
    {items.length > 0 && <ul className="ticktick-inbox-list">
      {items.slice(0, shown).map((item) => <Row key={item.remote.id} item={item} state={state} busy={manager.busy}
        listName={names.get(item.projectId) ?? 'без названия'}
        onAccept={async (choice) => { const message = await manager.acceptIncoming(item.remote.id, choice); setNotice(message); return message; }}
        onDismiss={() => manager.dismissIncoming(item.remote.id)} />)}
    </ul>}
    {items.length > shown && <button className="text-button" onClick={() => setShown((n) => n + pageSize)}>Показать ещё ({items.length - shown})</button>}
    {notice && <p className="transfer-message" role="status">{notice}</p>}
  </section>;
}
