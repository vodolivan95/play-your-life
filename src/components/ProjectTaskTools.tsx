import { useState } from 'react';
import type { GameState, Goal, Quest } from '../game';
import { dateKey } from '../game';
import { calendarItem, calendarDay, addDays, parseDay } from '../tasksCalendar';
import { updateTaskSettings } from '../taskSettings';
import { startFocus, pauseFocus, resumeFocus, finishFocus, focusSnapshot, formatClock } from '../focusSessions';
import { useNow } from '../useNow';
import { stageAccess } from '../goalWorkspace';
import { dependencyBlockMessage } from '../taskDependencies';
export type ProjectMutation = (fn: (s: GameState) => GameState) => boolean;
export function ProjectTaskDate({ task }: { task: Quest }) {
  const item = calendarItem(task);
  const format = (day: string) => parseDay(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return <span className="pw-task-date">▦ {item ? item.spanStartDay ? `${format(item.spanStartDay)} — ${format(item.spanEndDay!)}` : `${format(item.day)}${item.start ? ` · ${item.start}` : ''}` : 'Дата выполнения не задана'}{task.estimateMinutes ? ` · ${task.estimateMinutes} мин` : ''}{task.deadlineAt && <em> · Дедлайн {format(calendarDay(task.deadlineAt)!)}</em>}</span>;
}
export function ProjectReschedule({ task, mutate }: { task: Quest; mutate: ProjectMutation }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(calendarDay(task.dueAt || task.startsAt) ?? dateKey(new Date()));
  function save(chosen: string) {
    if (mutate(s => {
      const current = s.quests.find(q => q.id === task.id);
      if (!current) return s;
      const old = calendarDay(current.dueAt || current.startsAt);
      const shift = old ? Math.round((Date.parse(chosen) - Date.parse(old)) / 86400000) : 0;
      return old === chosen ? s : updateTaskSettings(s, task.id, old ? { shiftDays: shift } : { dueAt: chosen });
    })) setOpen(false);
  }
  return <div className="pw-reschedule"><button className="ss-secondary" aria-label={`Перенести: ${task.name}`} aria-expanded={open} onClick={() => setOpen(!open)}>▦</button>{open && <form onSubmit={e => { e.preventDefault(); save(day); }}><strong>Дата выполнения</strong><div className="ss-actions"><button type="button" onClick={() => save(dateKey(new Date()))}>Сегодня</button><button type="button" onClick={() => save(addDays(dateKey(new Date()), 1))}>Завтра</button></div><input aria-label="Новая дата выполнения" type="date" required value={day} onChange={e => setDay(e.target.value)} /><div className="ss-actions"><button type="submit">Применить</button><button type="button" onClick={() => setOpen(false)}>Отмена</button></div></form>}</div>;
}
export function ProjectNextStep({ state, goal, task, mutate, onOpen }: { state: GameState; goal: Goal; task?: Quest; mutate: ProjectMutation; onOpen: (task: Quest) => void }) {
  const session = state.focusSession;
  const runningTask = session && state.quests.find(q => q.id === session.taskId && q.goalId === goal.id);
  const selected = runningTask || task;
  const now = useNow(!!runningTask);
  const snap = runningTask && session ? focusSnapshot(session, now) : null;
  const minutes = selected?.estimateMinutes && selected.estimateMinutes <= 180 ? selected.estimateMinutes : 25;
  function start(s: GameState) {
    const q = s.quests.find(q => q.id === selected?.id);
    const g = s.goals.find(g => g.id === goal.id);
    if (!q || !g) return s;
    if (q.wontDo || q.planning?.archivedAt) throw new Error('Задача исключена из активного плана.');
    const stage = g.stages?.find(st => st.id === q.stageId);
    const reason = g.paused ? 'Проект на паузе' : stage && (stageAccess(s, g, stage) || (stage.status === 'paused' ? 'Этап на паузе' : '')) || dependencyBlockMessage(s.quests, q);
    if (reason) throw new Error(reason);
    if (q.startsAt && Date.parse(q.startsAt) > Date.now()) throw new Error('Дата начала задачи ещё не наступила.');
    return startFocus(s, { taskId: q.id, minutes });
  }
  return <section className="ss-panel pw-next gw-next-step"><div><small>СЛЕДУЮЩИЙ ШАГ</small><h3>{selected?.name || 'Все доступные шаги пройдены'}</h3>{selected && <ProjectTaskDate task={selected} />}</div>{selected && <><div className="ss-actions">{snap ? <><span className="pw-countdown">{snap.stopwatch ? 'Прошло' : 'Осталось'} <b>{formatClock(snap.stopwatch ? snap.focusedSeconds : snap.remainingSeconds)}</b></span>{snap.status !== 'expired' && <button className="ss-secondary" onClick={() => mutate(s => s.focusSession?.id === session?.id ? snap.status === 'paused' ? resumeFocus(s) : pauseFocus(s) : s)}>{snap.status === 'paused' ? 'Продолжить' : 'Пауза'}</button>}<button className="ss-primary" onClick={() => mutate(s => s.focusSession?.id === session?.id ? finishFocus(s) : s)}>Завершить сессию</button></> : <button className="ss-primary" disabled={!!session || !!goal.paused} onClick={() => mutate(start)}>▶ Начать · {minutes} мин</button>}<button className="ss-link" onClick={() => onOpen(selected)}>Открыть задачу →</button></div>{session && !runningTask && <p>Таймер другой задачи уже запущен. Завершите его, чтобы начать этот шаг.</p>}</>}</section>;
}
