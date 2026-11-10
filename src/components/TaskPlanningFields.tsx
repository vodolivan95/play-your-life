import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Event, GameState, Quest } from '../game';
import {
  actualMinutes, ambiguousMoveCount, forwardMoveCount, moveCount, planningSettings, postponeReasons, taskPlanningEvents,
} from '../planningData';
import type { PostponeReasonCode } from '../planningData';
import { logTaskTime } from '../planner';
import { updateTaskSettings } from '../taskSettings';
import {
  commitFinish, discardTimer, elapsedSeconds, formatElapsed, isTimerStorageCorrupted, pauseTimer, peekFinish, readTimer, resumeTimer,
} from '../taskTimer';
import TaskDependencyFields from './TaskDependencyFields';

/** Мягкая текстовая градация числа переносов (ТЗ 4.6): без цветных блоков, только формулировка. Пороги 1–2/3–4/5+ фиксированы относительно настраиваемого moveWarning, который остаётся порогом явного предупреждения ниже. */
function moveTier(moves: number): '' | 'neutral' | 'notice' | 'attention' {
  if (moves <= 0) return '';
  if (moves <= 2) return 'neutral';
  if (moves <= 4) return 'notice';
  return 'attention';
}

/**
 * Строка истории одного события планирования. Значения сужаемого union-типа
 * `PlanningChange` сначала читаются в локальные переменные, а не передаются в замыкание
 * `.find()` напрямую — сужение TypeScript по `?.type === …` не распространяется внутрь
 * вложенной функции (TS2339 в CI на предыдущей версии этого файла), поэтому дальше
 * работаем с уже вычисленными примитивами.
 */
function historyLine(e: Event): string {
  const change = e.planningChange;
  const when = new Date(e.date).toLocaleString('ru-RU');
  if (!change) return when;
  if (change.type === 'time') return `${when} · ${change.minutes} мин`;
  const from = change.from ? new Date(change.from).toLocaleString('ru-RU') : 'Без даты';
  const to = change.to ? new Date(change.to).toLocaleString('ru-RU') : 'Без даты';
  const prefix = change.type === 'retime' ? 'Время: ' : '';
  const autoSuffix = change.type === 'reschedule' && change.ambiguousRepeat ? ' · причина изменения неизвестна (возможно, повтор TickTick)' : '';
  // code — в отдельную переменную до .find(): сужение TypeScript по дискриминанту 'type' не
  // переживает вход во вложенное замыкание (см. комментарий к historyLine выше).
  const code = change.reasonCode;
  const reasonLabel = code ? postponeReasons.find((r) => r.code === code)?.label : undefined;
  const reasonSuffix = reasonLabel ? ` · ${reasonLabel}` : '';
  const freeTextSuffix = change.reason ? ` · ${change.reason}` : '';
  return `${when} · ${prefix}${from} → ${to}${autoSuffix}${reasonSuffix}${freeTextSuffix}`;
}

export default function TaskPlanningFields({ state, task, onChange, notify, onReason, onReasonCode, onOpenRelated, ownerId }: {
  state: GameState; task: Quest; ownerId: string; onChange: Dispatch<SetStateAction<GameState>>; notify: (s: string) => void;
  onReason: (s: string) => void; onReasonCode: (c: PostponeReasonCode | undefined) => void; onOpenRelated: (id: string) => void;
}) {
  const [minutes, setMinutes] = useState('');
  const [timer, setTimer] = useState(() => readTimer(ownerId, task.id));
  // Если владелец/задача сменились без перемонтирования компонента — пересчитываем состояние
  // прямо во время рендера («adjusting state during render» из react.dev/learn/you-might-not-need-an-effect),
  // а не в useEffect: синхронный setState в теле эффекта помечается react-hooks/set-state-in-effect
  // как причина лишних каскадных рендеров, а здесь это ровно производное от пропсов состояние.
  const [timerKey, setTimerKey] = useState(`${ownerId}:${task.id}`);
  const nextTimerKey = `${ownerId}:${task.id}`;
  if (timerKey !== nextTimerKey) { setTimerKey(nextTimerKey); setTimer(readTimer(ownerId, task.id)); }
  // Таймер хранится в localStorage этого устройства, отдельно по владельцу (src/taskTimer.ts,
  // ТЗ 3.3), а не в GameState — обновляем отображение раз в секунду, пока он запущен, перечитывая
  // сохранённый момент старта. Этот эффект не нарушает то же правило: setTimer вызывается не
  // синхронно в теле эффекта, а асинхронно в callback'е setInterval.
  useEffect(() => {
    if (!timer?.runningSince) return;
    const i = setInterval(() => setTimer(readTimer(ownerId, task.id)), 1000);
    return () => clearInterval(i);
  }, [ownerId, task.id, timer?.runningSince]);
  // С 0.78.0 новые отсчёты (таймер и секундомер) запускаются из блока «Фокус» окна задачи
  // (src/focusSessions.ts) и сохраняются вместе с игрой. Здесь остаётся только возможность
  // завершить или отменить секундомер, запущенный прежней версией на этом устройстве.
  const timerStorageCorrupted = isTimerStorageCorrupted(ownerId);
  function finishActiveTimer(current: typeof timer) {
    if (!current) return;
    const peek = peekFinish(ownerId, task.id);
    if (!peek) { setTimer(undefined); return; }
    const value = Math.min(43200, Math.round(peek.seconds / 60));
    if (value < 1) {
      // 3.5: сессия короче 30 секунд НЕ удаляется автоматически — остаётся на паузе, накопленные
      // секунды не теряются; явный отказ от учёта — отдельная кнопка «Отменить» (discardTimer).
      pauseTimer(ownerId, task.id); setTimer(readTimer(ownerId, task.id));
      notify('Сессия короче 30 секунд — пока не учтена как факт. Таймер поставлен на паузу, время не потеряно: продолжите позже или отмените явно.');
      return;
    }
    if (!state.quests.some((q) => q.id === task.id)) {
      // Задача не найдена в текущем состоянии — не удаляем таймер, чтобы не потерять время незаметно (3.1/3.4).
      notify('Задача не найдена — время сессии пока не учтено, таймер сохранён для повторной попытки.');
      return;
    }
    // 3.1: сначала подтверждённо сохраняем время (apply возвращает true только при реальном
    // успехе — см. ниже) и только тогда удаляем таймер (commitFinish). Тот же actionId
    // переживает повторную попытку, поэтому повтор клика при неудаче не задвоит время.
    const ok = apply((s) => logTaskTime(s, task.id, value, ownerId, peek.actionId));
    if (ok) { commitFinish(ownerId, task.id); setTimer(undefined); }
    // При неудаче apply() уже показал причину через notify() — таймер остаётся для повтора.
  }
  const moves = moveCount(state, task.id);
  const forward = forwardMoveCount(state, task.id);
  const events = taskPlanningEvents(state, task.id);
  const toOf = (e: (typeof events)[number]) => (e.planningChange?.type !== 'time' ? e.planningChange?.to : undefined);
  const firstKnown = events.map(toOf).find((v) => v);
  const lastMove = [...events].reverse().find((e) => e.planningChange?.type === 'reschedule' && !e.planningChange.ambiguousRepeat);
  const ambiguous = ambiguousMoveCount(state, task.id);
  // Возвращает true только если действие ДЕЙСТВИТЕЛЬНО применилось без ошибки (тот же паттерн,
  // что в src/components/room3d/RoomEngine.tsx: пробный синхронный запуск против известного
  // состояния решает успех/неудачу для вызывающей стороны — React вызывает функцию-обновитель
  // синхронно при onChange(fn), так что это не гадание, а реальная проверка). Второй, «настоящий»
  // запуск — против самого свежего состояния через onChange — и его ошибки не пробрасываются
  // наружу (решение уже принято пробным запуском), чтобы не показать два сообщения об одной ошибке.
  function apply(action: (s: GameState) => GameState): boolean {
    try { action(state); } catch (e) { notify(e instanceof Error ? e.message : 'Не удалось сохранить изменение.'); return false; }
    onChange((s) => { try { return action(s); } catch { return s; } });
    return true;
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
    {timerStorageCorrupted && <p role="alert">
      Не удалось прочитать сохранённый таймер этого устройства — данные повреждены. Если время не учтено, добавьте его вручную выше.
    </p>}
    {!task.done && timer && <div className="twin-inline" aria-label="Секундомер прежней версии">
      {timer?.runningSince && <>
        <span role="timer">Идёт: {formatElapsed(elapsedSeconds(timer))}</span>
        <button type="button" onClick={() => setTimer(pauseTimer(ownerId, task.id))}>Пауза</button>
        <button type="button" onClick={() => finishActiveTimer(timer)}>Завершить</button>
      </>}
      {timer && !timer.runningSince && <>
        <span>На паузе: {formatElapsed(elapsedSeconds(timer))}</span>
        <button type="button" onClick={() => {
          try { setTimer(resumeTimer(ownerId, task.id)); } catch (e) { notify((e as Error).message); }
        }}>Продолжить</button>
        <button type="button" onClick={() => finishActiveTimer(timer)}>Завершить</button>
        <button type="button" onClick={() => { discardTimer(ownerId, task.id); setTimer(undefined); }}>Отменить</button>
      </>}
    </div>}
    {task.done && timer && <p role="status">
      У завершённой задачи осталось неучтённое время таймера: {formatElapsed(elapsedSeconds(timer))}.
      {' '}<button type="button" onClick={() => finishActiveTimer(timer)}>Учесть это время</button>{' '}
      <button type="button" onClick={() => { discardTimer(ownerId, task.id); setTimer(undefined); }}>Отменить без учёта</button>
    </p>}
    {moves > 0 && <p data-move-tier={moveTier(moves)}>
      Переносов: {moves}{forward ? ` (вперёд: ${forward})` : ''}
      {firstKnown ? ` · первая известная дата: ${new Date(firstKnown).toLocaleDateString('ru-RU')}` : ''}
      {lastMove?.date ? ` · последнее изменение: ${new Date(lastMove.date).toLocaleDateString('ru-RU')}` : ''}
    </p>}
    {ambiguous > 0 && <p><small>
      Ещё {ambiguous} {ambiguous === 1 ? 'изменение даты' : 'изменения даты'} вперёд с совпадающим шагом повтора TickTick — неизвестно,
      ручной перенос это или автоматическое наступление следующего повтора, поэтому в счётчик выше не включено.
    </small></p>}
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
      : <ul>{events.map((e) => <li key={e.id}>{historyLine(e)}</li>)}</ul>}
  </details>;
}
