import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Quest } from '../game';
import {
  actualMinutes, forwardMoveCount, moveCount, planningSettings, postponeReasons, taskPlanningEvents,
} from '../planningData';
import type { PostponeReasonCode } from '../planningData';
import { logTaskTime } from '../planner';
import { updateTaskSettings } from '../taskSettings';
import { discardTimer, elapsedSeconds, finishTimer, formatElapsed, pauseTimer, readTimer, resumeTimer, startTimer } from '../taskTimer';
import TaskDependencyFields from './TaskDependencyFields';

/** Мягкая текстовая градация числа переносов (ТЗ 4.6): без цветных блоков, только формулировка. Пороги 1–2/3–4/5+ фиксированы относительно настраиваемого moveWarning, который остаётся порогом явного предупреждения ниже. */
function moveTier(moves: number): '' | 'neutral' | 'notice' | 'attention' {
  if (moves <= 0) return '';
  if (moves <= 2) return 'neutral';
  if (moves <= 4) return 'notice';
  return 'attention';
}

export default function TaskPlanningFields({ state, task, onChange, notify, onReason, onReasonCode, onOpenRelated, ownerId }: {
  state: GameState; task: Quest; ownerId: string; onChange: Dispatch<SetStateAction<GameState>>; notify: (s: string) => void;
  onReason: (s: string) => void; onReasonCode: (c: PostponeReasonCode | undefined) => void; onOpenRelated: (id: string) => void;
}) {
  const [minutes, setMinutes] = useState('');
  const [timer, setTimer] = useState(() => readTimer(task.id));
  // Таймер хранится в localStorage этого устройства (src/taskTimer.ts), не в GameState — обновляем
  // отображение раз в секунду, пока он запущен, перечитывая сохранённый момент старта.
  useEffect(() => { setTimer(readTimer(task.id)); }, [task.id]);
  useEffect(() => {
    if (!timer?.runningSince) return;
    const i = setInterval(() => setTimer(readTimer(task.id)), 1000);
    return () => clearInterval(i);
  }, [task.id, timer?.runningSince]);
  const moves = moveCount(state, task.id);
  const forward = forwardMoveCount(state, task.id);
  const events = taskPlanningEvents(state, task.id);
  const toOf = (e: (typeof events)[number]) => (e.planningChange?.type !== 'time' ? e.planningChange?.to : undefined);
  const firstKnown = events.map(toOf).find((v) => v);
  const lastMove = [...events].reverse().find((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.auto);
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
    <p>Учтено фактически: {actualMinutes(state, task.id)} мин{task.estimateMinutes && actualMinutes(state, task.id)
      ? ` (план ${task.estimateMinutes} мин, отклонение ${actualMinutes(state, task.id) - task.estimateMinutes >= 0 ? '+' : ''}${actualMinutes(state, task.id) - task.estimateMinutes} мин)` : ''}</p>
    <form className="twin-inline" onSubmit={(e) => { e.preventDefault(); const value = Number(minutes); const actionId = crypto.randomUUID(); apply((s) => logTaskTime(s, task.id, value, ownerId, actionId)); setMinutes(''); }}>
      <input type="number" min={1} max={43200} step={1} required value={minutes} aria-label="Добавить фактическое время, мин" placeholder="Фактические минуты" onChange={(e) => setMinutes(e.target.value)} />
      <button type="submit" disabled={!minutes}>Учесть время</button>
    </form>
    {!task.done && <div className="twin-inline" aria-label="Таймер фактического времени">
      {!timer && <button type="button" onClick={() => setTimer(startTimer(task.id))}>Начать отсчёт времени</button>}
      {timer?.runningSince && <>
        <span role="timer">Идёт: {formatElapsed(elapsedSeconds(timer))}</span>
        <button type="button" onClick={() => setTimer(pauseTimer(task.id))}>Пауза</button>
        <button type="button" onClick={() => {
          const seconds = elapsedSeconds(timer);
          const value = Math.max(1, Math.round(seconds / 60));
          const actionId = crypto.randomUUID();
          apply((s) => logTaskTime(s, task.id, value, ownerId, actionId));
          finishTimer(task.id); setTimer(undefined);
        }}>Завершить</button>
      </>}
      {timer && !timer.runningSince && <>
        <span>На паузе: {formatElapsed(elapsedSeconds(timer))}</span>
        <button type="button" onClick={() => setTimer(resumeTimer(task.id))}>Продолжить</button>
        <button type="button" onClick={() => {
          const seconds = elapsedSeconds(timer);
          const value = Math.max(1, Math.round(seconds / 60));
          const actionId = crypto.randomUUID();
          apply((s) => logTaskTime(s, task.id, value, ownerId, actionId));
          finishTimer(task.id); setTimer(undefined);
        }}>Завершить</button>
        <button type="button" onClick={() => { discardTimer(task.id); setTimer(undefined); }}>Отменить</button>
      </>}
    </div>}
    {moves > 0 && <p data-move-tier={moveTier(moves)}>
      Переносов: {moves}{forward ? ` (вперёд: ${forward})` : ''}
      {firstKnown ? ` · первая известная дата: ${new Date(firstKnown).toLocaleDateString('ru-RU')}` : ''}
      {lastMove?.date ? ` · последнее изменение: ${new Date(lastMove.date).toLocaleDateString('ru-RU')}` : ''}
    </p>}
    {moves >= planningSettings(state).moveWarning && <p role="status">
      Задача переносилась {moves} раз. Можно уменьшить её объём, разбить на подзадачи, назначить конкретное время, пересмотреть приоритет или проверить, актуальна ли она ещё.
    </p>}
    {!task.done && <div className="twin-inline">
      <label>Причина следующего переноса (необязательно)<select aria-label="Категория причины переноса" defaultValue=""
        onChange={(e) => onReasonCode(e.target.value ? (e.target.value as PostponeReasonCode) : undefined)}>
        <option value="">Не указана</option>
        {postponeReasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
      </select></label>
      <input maxLength={300} aria-label="Причина переноса своими словами" placeholder="Можно уточнить своими словами" onChange={(e) => onReason(e.target.value)} />
    </div>}
    <h4>История планирования</h4>
    {events.length === 0 ? <p>Истории пока нет. Изменения дат и учёт времени появятся здесь.</p>
      : <ul>{events.map((e) => <li key={e.id}>{new Date(e.date).toLocaleString('ru-RU')} · {e.planningChange?.type === 'time'
        ? `${e.planningChange.minutes} мин`
        : `${e.planningChange?.type === 'retime' ? 'Время: ' : ''}${e.planningChange?.from ? new Date(e.planningChange.from).toLocaleString('ru-RU') : 'Без даты'} → ${e.planningChange?.to ? new Date(e.planningChange.to).toLocaleString('ru-RU') : 'Без даты'}${e.planningChange?.type === 'reschedule' && e.planningChange.auto ? ' · автоматически (повтор TickTick)' : ''}${e.planningChange?.reasonCode ? ` · ${postponeReasons.find((r) => r.code === e.planningChange?.reasonCode)?.label ?? ''}` : ''}${e.planningChange?.reason ? ` · ${e.planningChange.reason}` : ''}`}</li>)}</ul>}
  </details>;
}
