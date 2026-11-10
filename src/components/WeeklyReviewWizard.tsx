import { useState } from 'react';
import type { GameState } from '../game';
import {
  MAX_WEEKLY_FOCUS,
  MAX_WEEKLY_REVIEW_NOTE,
  confirmWeeklyReview,
  weekAnchor,
  weeklyReviewOf,
  weeklyReviewProblemTasks,
  weeklyReviewProjectStatusLabels,
  weeklyReviewProjects,
  weeklyReviewTotals,
  weeklyReviews,
} from '../weeklyReview';
import { addDays, mondayOf } from '../tasksCalendar';
import { isGoalDone } from '../goalsOverview';
import './WeeklyReviewWizard.css';

const STEPS = ['Итоги недели', 'Проблемные задачи', 'Продвижение проектов', 'Фокус недели', 'Подтверждение'] as const;
const fmtWeek = (d: string) => `${new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} – ${new Date(`${addDays(d, 6)}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
const fmtMinutes = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} ч ${n % 60 ? `${n % 60} мин` : ''}`.trim() : `${n} мин`);

/** «Мастер недельного обзора» (ТЗ «Этап 3», раздел 5): 5 коротких шагов, без обязательных полей. */
export default function WeeklyReviewWizard({
  state,
  onClose,
  onApply,
  onOpenTask,
}: {
  state: GameState;
  onClose: () => void;
  onApply: (action: (s: GameState) => GameState, message?: string) => void;
  onOpenTask: (id: string) => void;
}) {
  const [weekFrom, setWeekFrom] = useState(weekAnchor());
  const [step, setStep] = useState(0);
  const [focusGoalIds, setFocusGoalIds] = useState<string[]>([]);
  const [focusNote, setFocusNote] = useState('');
  const [history, setHistory] = useState(false);
  const existing = weeklyReviewOf(state, weekFrom);
  const totals = weeklyReviewTotals(state, weekFrom);
  const problems = weeklyReviewProblemTasks(state);
  const projects = weeklyReviewProjects(state, weekFrom);
  const activeGoals = state.goals.filter((g) => !isGoalDone(g) && !g.paused);
  const toggleFocus = (id: string) =>
    setFocusGoalIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_WEEKLY_FOCUS ? ids : [...ids, id]));
  function confirm() {
    onApply(
      (s) => confirmWeeklyReview(s, weekFrom, focusGoalIds, { focusNote, problemTaskIds: problems.map((p) => p.id) }),
      'Недельный обзор сохранён',
    );
    onClose();
  }
  return (
    <div className="pyl-overlay wrw-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="wrw" role="dialog" aria-modal="true" aria-labelledby="wrw-title">
        <header className="wrw-head">
          <div>
            <h2 id="wrw-title">Недельный обзор</h2>
            <p>{fmtWeek(weekFrom)}{existing && ' · уже подведён, сохранение обновит его'}</p>
          </div>
          <button type="button" className="wrw-close" aria-label="Закрыть" onClick={onClose}>✕</button>
        </header>
        <nav className="wrw-steps" aria-label="Шаги обзора">
          {STEPS.map((label, i) => (
            <button key={label} type="button" aria-current={i === step} className="wrw-step" onClick={() => setStep(i)}>
              {i + 1}. {label}
            </button>
          ))}
        </nav>
        {step === 0 && (
          <div className="wrw-panel" aria-label="Итоги недели">
            <div className="wrw-grid">
              <span><b>{totals.done}</b>выполнено</span>
              <span><b>{totals.undone}</b>не выполнено</span>
              <span><b>{totals.overdue}</b>просрочено</span>
              <span><b>{totals.moves}</b>переносов</span>
              <span><b>{fmtMinutes(totals.actualMinutes)}</b>учтено времени</span>
            </div>
            <label>
              Неделя обзора
              <input type="date" value={weekFrom} onChange={(e) => e.target.value && setWeekFrom(mondayOf(e.target.value))} />
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="wrw-panel" aria-label="Проблемные задачи">
            {problems.length === 0 ? (
              <p>Часто переносимых или просроченных задач нет.</p>
            ) : (
              <ul className="wrw-list">
                {problems.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => onOpenTask(p.id)}>{p.name}</button>
                    <small>{[p.moves > 0 && `переносов: ${p.moves}`, p.overdue && 'просрочена'].filter(Boolean).join(' · ')}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="wrw-panel" aria-label="Продвижение проектов">
            {projects.length === 0 ? (
              <p>Нет активных проектов.</p>
            ) : (
              <ul className="wrw-list">
                {projects.map((p) => (
                  <li key={p.goalId}>
                    <b>{p.name}</b>
                    <small>{weeklyReviewProjectStatusLabels[p.status]}{p.stagesCompletedThisWeek > 0 && ` · этапов завершено: ${p.stagesCompletedThisWeek}`}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="wrw-panel" aria-label="Фокус недели">
            <p>До {MAX_WEEKLY_FOCUS} приоритетных проектов на следующую неделю. Выбор ничего не меняет в TickTick и расписании — это только заметка себе.</p>
            <ul className="wrw-list">
              {activeGoals.map((g) => (
                <li key={g.id}>
                  <label className="wrw-check">
                    <input
                      type="checkbox"
                      checked={focusGoalIds.includes(g.id)}
                      disabled={!focusGoalIds.includes(g.id) && focusGoalIds.length >= MAX_WEEKLY_FOCUS}
                      onChange={() => toggleFocus(g.id)}
                    />
                    {g.name}
                  </label>
                </li>
              ))}
            </ul>
            <label>
              Направление (свободный текст, необязательно)
              <textarea value={focusNote} maxLength={MAX_WEEKLY_REVIEW_NOTE} onChange={(e) => setFocusNote(e.target.value)} rows={3} />
            </label>
          </div>
        )}
        {step === 4 && (
          <div className="wrw-panel" aria-label="Подтверждение">
            <p>
              {focusGoalIds.length === 0 && !focusNote.trim()
                ? 'Фокус на неделю не выбран.'
                : `Фокус: ${[...focusGoalIds.map((id) => state.goals.find((g) => g.id === id)?.name).filter(Boolean), focusNote.trim()].filter(Boolean).join(', ')}`}
            </p>
            <button type="button" onClick={confirm}>{existing ? 'Обновить обзор' : 'Подтвердить итоги недели'}</button>
            <button type="button" onClick={() => setHistory((v) => !v)}>{history ? 'Скрыть предыдущие обзоры' : 'Открыть предыдущие обзоры'}</button>
            {history && (
              <ul className="wrw-list">
                {weeklyReviews(state).length === 0 && <li><small>Пока нет сохранённых обзоров.</small></li>}
                {weeklyReviews(state).map((r) => (
                  <li key={r.weekStart}>
                    <button type="button" onClick={() => { setWeekFrom(r.weekStart); setFocusGoalIds(r.focusGoalIds); setFocusNote(r.focusNote ?? ''); setStep(0); setHistory(false); }}>
                      {fmtWeek(r.weekStart)}
                    </button>
                    <small>выполнено {r.totals.done} · переносов {r.totals.moves}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="wrw-nav">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>← Назад</button>
          <button type="button" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Дальше →</button>
        </div>
      </section>
    </div>
  );
}
