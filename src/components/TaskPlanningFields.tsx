import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Quest } from '../game';
import { actualMinutes, moveCount, planningSettings, taskPlanningEvents } from '../planningData';
import { logTaskTime } from '../planner';
import { updateTaskSettings } from '../taskSettings';
import TaskDependencyFields from './TaskDependencyFields';

export default function TaskPlanningFields({ state, task, onChange, notify, onReason, onOpenRelated, ownerId }: {
  state: GameState; task: Quest; ownerId: string; onChange: Dispatch<SetStateAction<GameState>>; notify: (s: string) => void; onReason: (s: string) => void; onOpenRelated: (id: string) => void;
}) {
  const [minutes, setMinutes] = useState('');
  const moves = moveCount(state, task.id);
  function apply(action: (s: GameState) => GameState) {
    onChange((s) => { try { return action(s); } catch (e) { queueMicrotask(() => notify((e as Error).message)); return s; } });
  }
  return <details className="twin-field">
    <summary>Планирование и время · зависимости{moves ? ` · переносов: ${moves}` : ''}</summary>
    <TaskDependencyFields state={state} task={task} ownerId={ownerId} onChange={onChange} notify={notify} onOpen={onOpenRelated} />
    <label>Приоритет<select aria-label="Приоритет задачи" value={task.priority ?? 'normal'} disabled={task.done}
      onChange={(e) => apply((s) => updateTaskSettings(s, task.id, { priority: e.target.value as Quest['priority'] }))}>
      <option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option>
    </select></label>
    <label>Плановое время, мин<input type="number" min={1} max={43200} disabled={task.done} defaultValue={task.estimateMinutes ?? ''} key={task.estimateMinutes ?? 'empty'}
      aria-label="Плановое время, мин" onBlur={(e) => apply((s) => updateTaskSettings(s, task.id, { estimateMinutes: e.target.value ? Number(e.target.value) : null }))} /></label>
    {!task.done && <div className="twin-chips">{[5, 15, 30, 45, 60, 90].map((n) => <button key={n} type="button" aria-pressed={task.estimateMinutes === n}
      onClick={() => apply((s) => updateTaskSettings(s, task.id, { estimateMinutes: n }))}>{n} мин</button>)}</div>}
    <p>Учтено фактически: {actualMinutes(state, task.id)} мин</p>
    <form className="twin-inline" onSubmit={(e) => { e.preventDefault(); const value = Number(minutes); const actionId = crypto.randomUUID(); apply((s) => logTaskTime(s, task.id, value, ownerId, actionId)); setMinutes(''); }}>
      <input type="number" min={1} max={43200} step={1} required value={minutes} aria-label="Добавить фактическое время, мин" placeholder="Фактические минуты" onChange={(e) => setMinutes(e.target.value)} />
      <button type="submit" disabled={!minutes}>Учесть время</button>
    </form>
    {moves >= planningSettings(state).moveWarning && <p role="status">Задача переносилась {moves} раз. Разбей её на подзадачи или выдели отдельное время.</p>}
    {!task.done && <label>Причина следующего переноса (необязательно)<input maxLength={300} aria-label="Причина переноса" placeholder="Например, не хватило времени" onChange={(e) => onReason(e.target.value)} /></label>}
    <h4>История планирования</h4>
    {taskPlanningEvents(state, task.id).length === 0 ? <p>Истории пока нет. Изменения дат и учёт времени появятся здесь.</p>
      : <ul>{taskPlanningEvents(state, task.id).map((e) => <li key={e.id}>{new Date(e.date).toLocaleString('ru-RU')} · {e.planningChange?.type === 'time'
        ? `${e.planningChange.minutes} мин` : `${e.planningChange?.from ? new Date(e.planningChange.from).toLocaleString('ru-RU') : 'Без даты'} → ${e.planningChange?.to ? new Date(e.planningChange.to).toLocaleString('ru-RU') : 'Без даты'}${e.planningChange?.reason ? ` · ${e.planningChange.reason}` : ''}`}</li>)}</ul>}
  </details>;
}
