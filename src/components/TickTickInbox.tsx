import './TickTickInbox.css';
import { useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import TaskCreationForm from './TaskCreationForm';
import { remoteFields } from '../ticktick';
import { TickTickContext } from '../tickTickContext';
import { formatIncomingDate, goalsForSphere, incomingForScope, openStages } from '../ticktickInbox';
import type { IncomingChoice, IncomingScope, IncomingTask } from '../ticktickInbox';

const pageSize = 20;
function Row({ item, state, onChange, busy, listName, scope, expand, onAccept, onDismiss, onDelete }: {
  item: IncomingTask; state: GameState; onChange: Dispatch<SetStateAction<GameState>>; busy: boolean;
  listName: string; scope?: IncomingScope; expand?: boolean;
  onAccept: (choice: IncomingChoice) => Promise<string>; onDismiss: () => Promise<void>; onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(expand ?? false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<unknown>) {
    try { setError(''); await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие.'); }
  }
  const sphere = scope?.sphereId ?? item.sphere;
  const goal = goalsForSphere(state, sphere).find(g => g.id === scope?.goalId);
  const stage = openStages(goal).find(s => s.id === scope?.stageId);
  return <li className="ticktick-inbox-item">
    <div className="ticktick-inbox-title"><strong>{item.remote.title}</strong>
      <div className="ticktick-inbox-meta"><span className="ticktick-pill">Список: {listName}</span>
        <span className="ticktick-pill">{formatIncomingDate(item.remote.dueDate) || 'Без срока'}</span></div>
    </div>
    <div className="ticktick-inbox-actions">
      <button className="ticktick-sort-button" disabled={busy} onClick={() => setOpen(true)}>Разобрать</button>
      <button className="text-button" disabled={busy} onClick={() => void run(onDismiss)}>Пропустить</button>
      <button className="text-button danger" disabled={busy} onClick={() => {
        if (window.confirm(`Удалить задачу «${item.remote.title}»? Она пропадёт и из TickTick.`)) void run(onDelete);
      }}>Удалить</button>
    </div>
    {open && <TaskCreationForm state={state} onGlobalChange={onChange} scopeSphere={scope?.sphereId}
      initial={{ ...remoteFields(item.remote), name: item.remote.title.slice(0, 100), sphere, difficulty: 'Medium', goalId: goal?.id, stageId: stage?.id, tickTickSharedAt: new Date().toISOString() }}
      taskLabels={state.taskLabels ?? []} submitLabel="Принять в игру" onClose={() => setOpen(false)} onSave={async (task, labels) => {
        await onAccept({ sphere: task.sphere, goalId: task.goalId ?? '', stageId: task.stageId, editor: task, labels });
      }} />}
    {error && <p className="transfer-message" role="alert">{error}</p>}
  </li>;
}
export default function TickTickInbox({ state, onChange, scope, focusRemoteId }: { state: GameState; onChange: Dispatch<SetStateAction<GameState>>; scope?: IncomingScope; focusRemoteId?: string | null }) {
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
  }, [active]);
  if (!manager || !active) return null;
  const names = new Map(manager.projects.map((p) => [p.id, p.name]));
  const items = incomingForScope(manager.incoming, manager.connection!, scope);
  const focusIndex = items.findIndex((item) => item.remote.id === focusRemoteId);
  const visibleItems = items.slice(0, Math.max(shown, focusIndex + 1));
  const mapped = !scope || Boolean(manager.connection?.sphereLists?.[scope.sphereId]);
  return <section className="ticktick-inbox" aria-label="Входящие из TickTick">
    <div className="ticktick-inbox-head">
      <h3>Входящие из TickTick{items.length > 0 && <span className="ticktick-badge-count" aria-label={`Задач: ${items.length}`}>{items.length}</span>}</h3>
      <span className="ticktick-inbox-note">Без ограничения по сроку{manager.inboxNew > 0 ? ` · новых: ${manager.inboxNew}` : ''}</span>
      <button className="ticktick-refresh" disabled={manager.busy} onClick={() => void manager.refreshAll()}>{manager.inboxBusy ? 'Проверяем…' : 'Обновить'}</button>
    </div>
    {manager.inboxError && <p className="transfer-message" role="alert">{manager.inboxError}</p>}
    {!mapped && <p className="empty">Сопоставь эту сферу со списком в настройках TickTick ниже и сохрани настройки.</p>}
    {mapped && !items.length && !manager.inboxError && <p className="empty">{manager.inboxBusy ? 'Загружаем входящие…' : scope ? 'Новых задач в списке этой сферы нет.' : 'Новых задач в сопоставленных списках нет.'}</p>}
      {items.length > 0 && <ul className="ticktick-inbox-list">
      {visibleItems.map((item) => <Row key={`${scope?.sphereId ?? ''}:${scope?.goalId ?? ''}:${scope?.stageId ?? ''}:${item.remote.id}`} item={item} state={state} onChange={onChange} busy={manager.busy} scope={scope} expand={item.remote.id === focusRemoteId}
        listName={names.get(item.projectId) ?? 'без названия'}
        onAccept={async (choice) => { const message = await manager.acceptIncoming(item.remote.id, choice); setNotice(message); return message; }}
        onDismiss={() => manager.dismissIncoming(item.remote.id)}
        onDelete={async () => { await manager.deleteIncoming(item.remote.id, item.projectId); setNotice(`Задача «${item.remote.title}» удалена из игры и из TickTick.`); }} />)}
    </ul>}
    {items.length > visibleItems.length && <button className="text-button" onClick={() => setShown((n) => Math.max(n, focusIndex + 1) + pageSize)}>Показать ещё ({items.length - visibleItems.length})</button>}
    {notice && <p className="transfer-message" role="status">{notice}</p>}
  </section>;
}
