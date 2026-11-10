import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Quest } from '../game';
import {
  discardFocus, extendFocus, finishFocus, FOCUS_CUSTOM_MINUTES, FOCUS_EXTENSIONS, FOCUS_MODES, focusModeLabel, focusModeName,
  focusSnapshot, formatClock, formatFocus, pauseFocus, resumeFocus, startFocus, startStopwatch, taskFocusHistory, taskFocusSeconds,
} from '../focusSessions';
import { FOCUS_FIRST_ACTION_MAX, FOCUS_RESULT_MAX } from '../planningData';
import { useNow } from '../useNow';
import './FocusSection.css';

type Way = 'timer' | 'stopwatch';
const statusText = { active: 'Идёт', paused: 'На паузе', expired: 'Время вышло' } as const;

/**
 * Блок «Фокус» в окне задачи (ТЗ «Этап 4.1», разделы 3 и 5): суммарное время и история сессий
 * задачи, запуск таймера или секундомера, управление текущей сессией. Таймер и секундомер —
 * два способа работы; время обоих сохраняется одной и той же записью (src/focusSessions.ts).
 */
export default function FocusSection({ state, task, onChange, notify, onOpenTask }: {
  state: GameState;
  task: Quest;
  onChange: Dispatch<SetStateAction<GameState>>;
  notify: (text: string) => void;
  onOpenTask?: (id: string) => void;
}) {
  const session = state.focusSession;
  const mine = session?.taskId === task.id;
  const now = useNow(!!session);
  const snap = session ? focusSnapshot(session, now) : undefined;
  const goal = state.goals.find((g) => g.id === task.goalId);
  const stage = goal?.stages?.find((s) => s.id === task.stageId);
  const estimate = task.estimateMinutes && task.estimateMinutes <= FOCUS_CUSTOM_MINUTES.max ? task.estimateMinutes : 25;
  const [launching, setLaunching] = useState(false);
  const [way, setWay] = useState<Way>('timer');
  const [minutes, setMinutes] = useState(estimate);
  const [custom, setCustom] = useState('');
  const [firstAction, setFirstAction] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState('');
  const [extra, setExtra] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const total = taskFocusSeconds(state, task.id);
  const history = historyOpen ? taskFocusHistory(state, task.id) : [];
  const chosen = custom ? Number(custom) : minutes;
  const chosenValid = Number.isInteger(chosen) && chosen >= FOCUS_CUSTOM_MINUTES.min && chosen <= FOCUS_CUSTOM_MINUTES.max;
  const preset = FOCUS_MODES.find((m) => m.minutes === chosen);
  const otherTask = session && !mine ? state.quests.find((q) => q.id === session.taskId) : undefined;

  /** Пробный запуск на текущем состоянии решает успех; настоящий — на самом свежем (как в TaskPlanningFields). */
  function run(action: (s: GameState) => GameState): boolean {
    try { action(state); } catch (e) { notify(e instanceof Error ? e.message : 'Не удалось сохранить изменение.'); return false; }
    onChange((s) => { try { return action(s); } catch { return s; } });
    return true;
  }
  function start() {
    const at = new Date();
    const id = crypto.randomUUID();
    const ok = way === 'stopwatch'
      ? run((s) => startStopwatch(s, { taskId: task.id, firstAction }, at, id))
      : run((s) => startFocus(s, { taskId: task.id, minutes: chosen, firstAction }, at, id));
    if (ok) { setLaunching(false); setFirstAction(''); setCustom(''); }
  }
  function finish() {
    const at = new Date();
    if (run((s) => finishFocus(s, { result }, at))) {
      setFinishing(false); setResult('');
      notify('Сессия сохранена. Время добавлено в фокус задачи.');
    }
  }
  function extend(value: number) {
    const at = new Date();
    if (run((s) => extendFocus(s, value, at))) setExtra('');
  }
  function discard() {
    if (window.confirm('Отменить сессию без учёта времени? Отработанное время не сохранится.')) run((s) => discardFocus(s));
  }

  return (
    <section className="twin-field focus" aria-label="Фокус">
      <div className="focus-top">
        <button type="button" className="focus-total" aria-expanded={historyOpen} onClick={() => setHistoryOpen((v) => !v)}>
          ⏱ Фокус: <b>{formatFocus(total)}</b> <i aria-hidden="true">{historyOpen ? '▴' : '▾'}</i>
        </button>
        {!session && !task.done && !launching && (
          <button type="button" className="primary-button" onClick={() => setLaunching(true)}>Начать фокус</button>
        )}
      </div>

      {launching && !session && (
        <div className="focus-box">
          <dl className="focus-context">
            <div><dt>Задача</dt><dd>{task.name}</dd></div>
            <div><dt>Этап</dt><dd>{stage?.name ?? 'Без этапа'}</dd></div>
            <div><dt>Проект</dt><dd>{goal?.name ?? 'Вне проекта'}</dd></div>
          </dl>
          <div className="twin-chips" role="group" aria-label="Способ работы">
            <button type="button" aria-pressed={way === 'timer'} onClick={() => setWay('timer')}>⏳ Таймер</button>
            <button type="button" aria-pressed={way === 'stopwatch'} onClick={() => setWay('stopwatch')}>⏱ Секундомер</button>
          </div>
          {way === 'timer' ? (
            <>
              <div className="focus-minutes" role="group" aria-label="Продолжительность, минуты">
                {FOCUS_MODES.map((m) => (
                  <button key={m.id} type="button" title={`${m.name}: ${m.purpose}`} aria-pressed={!custom && minutes === m.minutes}
                    onClick={() => { setMinutes(m.minutes); setCustom(''); }}>
                    <b>{m.minutes}</b><small>мин</small>
                  </button>
                ))}
              </div>
              <label className="focus-custom">Своя продолжительность, мин
                <input type="number" inputMode="numeric" min={FOCUS_CUSTOM_MINUTES.min} max={FOCUS_CUSTOM_MINUTES.max} step={1}
                  value={custom} placeholder={`${FOCUS_CUSTOM_MINUTES.min}–${FOCUS_CUSTOM_MINUTES.max}`} onChange={(e) => setCustom(e.target.value)} />
              </label>
              <small>
                {chosenValid
                  ? `${chosen} мин · ${preset ? `${preset.name}: ${preset.purpose.toLowerCase()}` : 'своя продолжительность'}`
                  : `Укажи от ${FOCUS_CUSTOM_MINUTES.min} до ${FOCUS_CUSTOM_MINUTES.max} минут.`}
              </small>
            </>
          ) : (
            <small>Отсчёт идёт вверх, без заданного времени. Результат попадёт в тот же отчёт, что и таймер.</small>
          )}
          <label>Первое действие (необязательно)
            <input value={firstAction} maxLength={FOCUS_FIRST_ACTION_MAX} placeholder="С чего начну прямо сейчас" onChange={(e) => setFirstAction(e.target.value)} />
          </label>
          <div className="twin-inline">
            <button type="button" className="primary-button" disabled={way === 'timer' && !chosenValid} onClick={start}>Начать фокус</button>
            <button type="button" className="text-button" onClick={() => setLaunching(false)}>Отмена</button>
          </div>
        </div>
      )}

      {session && mine && snap && (
        <div className="focus-box focus-live" data-status={snap.status}>
          <div className="focus-clock-row">
            <span className="focus-clock" role="timer" aria-live="off">
              {formatClock(snap.stopwatch ? snap.focusedSeconds : snap.remainingSeconds)}
            </span>
            <span className="focus-state">
              <b>{statusText[snap.status]}</b>
              <small>
                {snap.stopwatch
                  ? 'Секундомер'
                  : `${focusModeName(session.mode)} · план ${formatFocus(snap.plannedSeconds)} · отработано ${formatFocus(snap.focusedSeconds)}`}
                {snap.pausedSeconds >= 60 ? ` · паузы ${formatFocus(snap.pausedSeconds)}` : ''}
              </small>
            </span>
          </div>
          {session.firstAction && <small>Первое действие: {session.firstAction}</small>}
          {finishing ? (
            <>
              <label>Что получилось? (необязательно)
                <textarea rows={2} value={result} maxLength={FOCUS_RESULT_MAX} onChange={(e) => setResult(e.target.value)} />
              </label>
              <small>Будет засчитано {formatFocus(snap.focusedSeconds)} — только фактически отработанное время, без пауз.</small>
              <div className="twin-inline">
                <button type="button" className="primary-button" onClick={finish}>Сохранить сессию</button>
                <button type="button" className="text-button" onClick={() => setFinishing(false)}>Назад</button>
              </div>
            </>
          ) : (
            <>
              {snap.status === 'expired' && (
                <p role="status">{snap.stopwatch ? 'Секундомер дошёл до предела в 12 часов.' : 'Запланированное время закончилось. Продлить сессию или завершить?'}</p>
              )}
              <div className="twin-inline">
                {snap.status === 'active' && <button type="button" className="secondary-button" onClick={() => { const at = new Date(); run((s) => pauseFocus(s, at)); }}>Пауза</button>}
                {snap.status === 'paused' && <button type="button" className="primary-button" onClick={() => { const at = new Date(); run((s) => resumeFocus(s, at)); }}>Продолжить</button>}
                <button type="button" className={snap.status === 'expired' ? 'primary-button' : 'secondary-button'} onClick={() => setFinishing(true)}>Завершить сессию</button>
                {snap.status !== 'active' && <button type="button" className="text-button" onClick={discard}>Отменить без учёта</button>}
              </div>
              {!snap.stopwatch && (
                <div className="focus-extend" role="group" aria-label="Продлить сессию">
                  <span>Продлить:</span>
                  {FOCUS_EXTENSIONS.map((m) => <button key={m} type="button" onClick={() => extend(m)}>+{m} мин</button>)}
                  <input type="number" inputMode="numeric" min={FOCUS_CUSTOM_MINUTES.min} max={FOCUS_CUSTOM_MINUTES.max} step={1}
                    value={extra} aria-label="Другое время продления, мин" placeholder="другое" onChange={(e) => setExtra(e.target.value)} />
                  {extra && <button type="button" onClick={() => extend(Number(extra))}>Добавить</button>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {session && !mine && snap && (
        <div className="focus-box" role="status">
          <span>Сейчас идёт фокус {otherTask ? `задачи «${otherTask.name}»` : 'другой задачи'} — {formatClock(snap.stopwatch ? snap.focusedSeconds : snap.remainingSeconds)}, {statusText[snap.status].toLowerCase()}. Одновременно может идти только одна сессия.</span>
          <div className="twin-inline">
            {onOpenTask && otherTask && <button type="button" className="secondary-button" onClick={() => onOpenTask(otherTask.id)}>Вернуться к текущей</button>}
            {otherTask
              ? <button type="button" className="secondary-button" onClick={() => { const at = new Date(); if (run((s) => finishFocus(s, {}, at))) notify('Текущая сессия завершена и сохранена.'); }}>Завершить текущую</button>
              : <button type="button" className="secondary-button" onClick={discard}>Отменить ту сессию</button>}
          </div>
        </div>
      )}

      {historyOpen && (
        history.length === 0 ? <small>Сессий пока нет. Запусти таймер или секундомер — время появится здесь.</small> : (
          <ul className="focus-history" aria-label="История сессий задачи">
            {history.map((r) => {
              const started = new Date(r.startedAt);
              return (
                <li key={r.id}>
                  <span>{started.toLocaleDateString('ru-RU')}{r.mode === 'manual' ? '' : ` · ${started.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}</span>
                  <span>{focusModeLabel(r.mode)}</span>
                  <b>{formatFocus(r.seconds)}</b>
                  {r.firstAction && <small>Первое действие: {r.firstAction}</small>}
                  {r.result && <small>Результат: {r.result}</small>}
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
