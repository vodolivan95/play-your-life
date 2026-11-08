import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Quest } from '../game';
import { setTaskDependencies } from '../planner';
import { dependencyBlockers, dependentTasks, MAX_TASK_DEPENDENCIES } from '../taskDependencies';

export default function TaskDependencyFields({ state, task, onChange, notify, onOpen, ownerId }: {
  state: GameState; task: Quest; ownerId: string; onChange: Dispatch<SetStateAction<GameState>>; notify: (s: string) => void; onOpen: (id: string) => void;
}) {
  const [candidate, setCandidate] = useState('');
  const [error, setError] = useState('');
  const ids = task.planning?.dependencyIds ?? [];
  const blockers = dependencyBlockers(state.quests, task);
  const dependents = dependentTasks(state.quests, task.id);
  const options = state.quests.filter((q) => q.id !== task.id && !ids.includes(q.id) && !q.planning?.archivedAt && (!q.ownerId || q.ownerId === ownerId));
  function save(next: string[]) {
    setError('');
    onChange((s) => { try { return setTaskDependencies(s, task.id, next, ownerId); }
      catch (e) { queueMicrotask(() => { setError((e as Error).message); notify((e as Error).message); }); return s; } });
  }
  return <section aria-label="Зависимости задачи">
    <h4>Предшественники</h4>
    <p>Сначала заверши эти задачи. Связь блокирует выполнение, даты меняются только вручную.</p>
    {error && <p role="alert">{error}</p>}
    {!ids.length && <p>Предшественников нет.</p>}
    <ul>{ids.map((id) => {
      const q = state.quests.find((t) => t.id === id);
      return <li key={id}>{q ? <button type="button" className="text-button" onClick={() => onOpen(id)}>{q.name}</button> : <span>Удалённая задача ({id})</span>}
        {q?.done ? ' · Выполнена' : ' · Блокирует выполнение'}
        {!task.done && <button type="button" className="text-button" aria-label={`Убрать зависимость: ${q?.name ?? id}`} onClick={() => save(ids.filter((d) => d !== id))}>Убрать связь</button>}
      </li>;
    })}</ul>
    {!task.done && <div className="twin-inline">
      <select aria-label="Добавить предшественника" value={candidate} onChange={(e) => setCandidate(e.target.value)}>
        <option value="">Выбери задачу</option>{options.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
      </select>
      <button type="button" className="secondary-button" disabled={!candidate || ids.length >= MAX_TASK_DEPENDENCIES} onClick={() => { save([...ids, candidate]); setCandidate(''); }}>Добавить зависимость</button>
    </div>}
    {blockers.length > 0 && !task.done && <p role="status">Выполнение заблокировано: незавершённых предшественников — {blockers.length}.</p>}
    <h4>Зависимые задачи</h4>
    {dependents.length ? <><p>Перенос этой задачи может повлиять на следующие задачи. Их сроки автоматически не изменяются.</p><ul>{dependents.map((q) => <li key={q.id}><button type="button" className="text-button" onClick={() => onOpen(q.id)}>{q.name}</button></li>)}</ul></> : <p>Зависимых задач нет.</p>}
  </section>;
}
