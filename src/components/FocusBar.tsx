import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import { focusSnapshot, formatClock, pauseFocus, resumeFocus } from '../focusSessions';
import { useNow } from '../useNow';
import './FocusBar.css';

/**
 * Компактная панель текущей сессии в разделах «Проекты» и «Мои задачи» (ТЗ «Этап 4.1», раздел 3.6):
 * свёрнутый таймер. Часы верхней панели приложения не затрагивает.
 */
export default function FocusBar({ state, onChange, onOpen }: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  onOpen: (taskId: string) => void;
}) {
  const session = state.focusSession;
  const now = useNow(!!session);
  if (!session) return null;
  const snap = focusSnapshot(session, now);
  const task = state.quests.find((q) => q.id === session.taskId);
  const act = (action: (s: GameState, at: Date) => GameState) => {
    const at = new Date();
    onChange((s) => { try { return action(s, at); } catch { return s; } });
  };
  return (
    <div className="focus-bar" data-status={snap.status} role="group" aria-label="Текущая сессия фокуса">
      <button type="button" className="focus-bar-open" disabled={!task} onClick={() => task && onOpen(task.id)}>
        <span aria-hidden="true">{snap.stopwatch ? '⏱' : '⏳'}</span>
        <b role="timer" aria-live="off">{formatClock(snap.stopwatch ? snap.focusedSeconds : snap.remainingSeconds)}</b>
        <span className="focus-bar-name">
          {snap.status === 'expired' ? 'Время вышло · ' : snap.status === 'paused' ? 'Пауза · ' : ''}{task?.name ?? 'Задача удалена'}
        </span>
      </button>
      {snap.status === 'active' && <button type="button" aria-label="Пауза" onClick={() => act(pauseFocus)}>⏸</button>}
      {snap.status === 'paused' && <button type="button" aria-label="Продолжить" onClick={() => act(resumeFocus)}>▶</button>}
    </div>
  );
}
