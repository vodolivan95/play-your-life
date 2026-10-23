import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { monthKey, monthLabel, moveMonth } from '../monthly';
import {
  TASKS_DONE_MAX, addMoodCheckin, carriedPlans, finishReview, moodSeries,
  patchSphereReview, reviewOf, savePlanCheck, saveReview, sphereReviewOf,
} from '../keyResults';
import type { CarryPlan, MonthReview, ReviewPlan, ReviewPlanCheck } from '../keyResults';
import { victoryOf } from '../personalResults';
import './MyResults.css';

const outcomeOptions: { id: ReviewPlanCheck['outcome']; label: string }[] = [
  { id: 'done', label: 'Да' }, { id: 'no', label: 'Нет' },
  { id: 'part', label: 'Частично' }, { id: 'custom', label: 'Свой ответ' },
];
function readHints() {
  try { return localStorage.getItem('pyl-results-hints') !== 'off'; }
  catch { return true; }
}
function Hint({ on, children }: { on: boolean; children: string }) {
  return on ? <p className="myr-hint kr-muted">{children}</p> : null;
}

/** Прежние ответы остаются доступны: переработка интерфейса не удаляет историю. */
function PreviousNotes({ state, month, review }: { state: GameState; month: string; review: MonthReview }) {
  const reflection = state.monthlyReflections?.[month];
  const legacy = spheres.filter((sphere) => {
    const r = review.spheres[sphere.id];
    return r && (r.achieved || r.failed || r.next || r.ifWhen || r.ifThen || r.task || r.score !== null || r.trend);
  });
  const hasOther = review.wins.length || review.gratitude.some(Boolean) || review.focuses.length ||
    review.softHelped || review.softStep || reflection?.highlights || reflection?.challenges || reflection?.nextMonth;
  if (!legacy.length && !hasOther) return null;
  return (
    <details className="kr-card kr-legacy">
      <summary>Прежние записи месяца <span>Сохранены без изменений</span></summary>
      <div className="kr-legacy-content">
        {legacy.map((sphere) => {
          const r = review.spheres[sphere.id];
          return <section key={sphere.id}>
            <h4>{sphere.name}</h4>
            {[['Что удалось', r.achieved], ['Что не получилось', r.failed], ['План', r.next],
              ['Если… то…', [r.ifWhen, r.ifThen].filter(Boolean).join(' → ')],
              ['Прежняя оценка', r.score === null ? '' : String(r.score)], ['Тенденция', r.trend ?? ''],
              ['Задача из прежнего плана', r.task?.title ?? '']].filter(([, value]) => value).map(([label, value]) =>
              <p key={label}><span>{label}</span>{value}</p>)}
          </section>;
        })}
        {review.wins.length > 0 && <p><span>Прежние победы</span>{review.wins.join(' · ')}</p>}
        {review.gratitude.some(Boolean) && <p><span>Благодарность</span>{review.gratitude.filter(Boolean).join(' · ')}</p>}
        {review.focuses.length > 0 && <p><span>Прежние фокусы</span>{review.focuses.map((id) => spheres.find((s) => s.id === id)?.name ?? id).join(', ')}</p>}
        {[['Что помогло', review.softHelped], ['Маленький шаг', review.softStep],
          ['Главное', reflection?.highlights], ['Сложности', reflection?.challenges],
          ['Следующий месяц', reflection?.nextMonth]].filter(([, text]) => text).map(([label, text]) =>
            <p key={label}><span>{label}</span>{text}</p>)}
      </div>
    </details>
  );
}

export default function MyResults({ state, onChange, notify, selectedMonth, onOpenVictory }: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  ownerId: string;
  notify: (text: string) => void;
  selectedMonth?: string;
  onOpenVictory?: () => void;
}) {
  const [localMonth, setLocalMonth] = useState(monthKey);
  const month = selectedMonth ?? localMonth;
  const [hints, setHints] = useState(readHints);
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(0);
  const review = reviewOf(state, month);
  const reflection = state.monthlyReflections?.[month];
  const completed = reflection?.status === 'completed';
  const plans = carriedPlans(state, month);
  const newPlans = review.nextPlans ?? [];
  const knownCounts = spheres.filter((s) => sphereReviewOf(review, s.id).tasksDone != null).length;
  const totalTasks = spheres.reduce((total, sphere) => total + (sphereReviewOf(review, sphere.id).tasksDone ?? 0), 0);
  const series = moodSeries(state, month);
  const patch = (changes: Partial<MonthReview>) => onChange((s) => saveReview(s, month, changes));
  function toggleHints() {
    const next = !hints;
    setHints(next);
    try { localStorage.setItem('pyl-results-hints', next ? 'on' : 'off'); } catch { /* настройка необязательна */ }
  }
  function checkPlan(plan: CarryPlan, outcome: ReviewPlanCheck['outcome'], comment?: string) {
    onChange((s) => {
      const current = reviewOf(s, month).planChecks?.[plan.id];
      return savePlanCheck(s, month, plan, outcome, comment ?? current?.comment ?? '');
    });
  }
  function changeNewPlan(id: string, changes: Partial<ReviewPlan>) {
    onChange((s) => {
      const current = reviewOf(s, month);
      return saveReview(s, month, { nextPlans: (current.nextPlans ?? []).map((plan) => plan.id === id ? { ...plan, ...changes } : plan) });
    });
  }
  function addPlan() {
    onChange((s) => {
      const current = reviewOf(s, month);
      return saveReview(s, month, { nextPlans: [...(current.nextPlans ?? []), { id: crypto.randomUUID(), title: '' }] });
    });
  }
  function finish() {
    onChange((s) => finishReview(s, month));
    notify('Итоги сохранены. Планы появятся при подведении итогов следующего месяца.');
  }
  return (
    <div className="myr kr-review">
      {!selectedMonth && <div className="myr-bar"><div className="myr-month">
        <button className="kr-arrow" aria-label="Предыдущий месяц" onClick={() => setLocalMonth(moveMonth(month, -1))}>←</button>
        <b>{monthLabel(month)}</b>
        <button className="kr-arrow" aria-label="Следующий месяц" disabled={month >= monthKey()} onClick={() => setLocalMonth(moveMonth(month, 1))}>→</button>
      </div></div>}

      {plans.length > 0 && <section className="kr-card kr-carryover" aria-labelledby="kr-carry-title">
        <div className="kr-section-head">
          <div><span className="kr-eyebrow">СВЯЗЬ МЕЖДУ МЕСЯЦАМИ</span><h3 id="kr-carry-title">Что получилось из прошлых планов?</h3>
            <p className="kr-muted">Твои строки из {monthLabel(moveMonth(month, -1)).toLowerCase()}. Отметь результат перед новыми итогами.</p></div>
          <span className="kr-pill">{plans.filter((p) => review.planChecks?.[p.id]).length} отмечено</span>
        </div>
        <div className="kr-plan-checks">
          {plans.map((plan) => {
            const check = review.planChecks?.[plan.id];
            const sphere = spheres.find((s) => s.id === plan.sphere);
            return <article className="kr-plan-check" key={plan.id}>
              <div className="kr-plan-source"><span className="kr-muted">{sphere?.name ?? 'Общий план'} · {monthLabel(plan.sourceMonth)}</span><p>{plan.text}</p></div>
              <div className="kr-plan-controls" role="group" aria-label={`Результат плана: ${plan.text}`}>
                {outcomeOptions.map((option) => <button key={option.id} className={`kr-outcome kr-outcome-${option.id}`}
                  aria-pressed={check?.outcome === option.id} onClick={() => checkPlan(plan, option.id)}>{option.label}</button>)}
              </div>
              {check?.outcome === 'custom' && <label className="kr-custom-answer"><span>Свой ответ</span>
                <textarea rows={2} maxLength={2000} aria-label={`Свой ответ: ${plan.text}`} value={check.comment}
                  placeholder="Что получилось, что изменилось или почему план больше не актуален"
                  onChange={(event) => checkPlan(plan, 'custom', event.target.value)} /></label>}
              {check?.outcome !== 'custom' && check?.comment && <p className="kr-muted kr-plan-comment">{check.comment}</p>}
            </article>;
          })}
        </div>
        <p className="kr-muted kr-fine">Исходный текст не меняется. Ответы относятся к этому месяцу и не создают новые задачи.</p>
      </section>}

      <section className="kr-hero">
        <div><span className="kr-eyebrow">МОИ ИТОГИ · {completed ? 'СОХРАНЕНЫ' : 'ЛИЧНОЕ ЗАКЛЮЧЕНИЕ'}</span>
          <h2>Мой месяц.<br />Мои выводы.</h2>
          <p>Отметь сделанное, выбери главное и реши, что брать дальше. Без оценок за заполнение.</p></div>
        <div className="kr-hero-aside" role="group" aria-label="Итого задач по всем сферам">
          <span className="kr-hero-symbol" aria-hidden="true">↗</span>
          <b aria-live="polite" aria-atomic="true">{knownCounts ? totalTasks : '—'}</b>
          <span>Итого задач<br />по всем сферам</span>
        </div>
      </section>
      <div className="kr-review-tools">
        <label className="myr-switch"><input type="checkbox" role="switch" checked={hints} onChange={toggleHints} /><span aria-hidden="true" />Подсказки</label>
        <button className="kr-secondary" aria-pressed={review.soft} onClick={() => patch({ soft: !review.soft })}>{review.soft ? 'Показать полный вариант' : 'Ответить коротко'}</button>
        <span className="kr-muted">{reflection?.updatedAt ? 'Изменения сохраняются автоматически' : 'Можно заполнить только важное'}</span>
      </div>

      {!review.soft && <section className="kr-card" aria-labelledby="kr-counts-title">
        <div className="kr-section-head"><div><span className="kr-eyebrow">РУЧНОЙ УЧЁТ</span><h3 id="kr-counts-title">Что сделано по сферам</h3>
          <Hint on={hints}>Внеси количество закрытых задач, например по TickTick. Оно автоматически попадёт в динамику и итоги года. На XP не влияет.</Hint></div>
          <button className="kr-secondary" onClick={onOpenVictory}>К личным победам →</button></div>
        <div className="kr-count-grid">
          {spheres.map((sphere) => {
            const r = sphereReviewOf(review, sphere.id);
            const victory = victoryOf(review, sphere.id);
            return <article className="myr-sphere kr-count-card" key={sphere.id} style={{ ['--sphere' as string]: sphere.color }}>
              <h4><i className="kr-sphere-dot" />{sphere.name}</h4>
              <label className="kr-number-label"><span>Задач закрыто за месяц</span><input type="number" inputMode="numeric" min={0} max={TASKS_DONE_MAX}
                aria-label={`Задач закрыто за месяц в сфере ${sphere.name}`} value={r.tasksDone ?? ''} placeholder="—"
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === '') return onChange((s) => patchSphereReview(s, month, sphere.id, { tasksDone: null }));
                  const n = Number(raw);
                  if (Number.isInteger(n) && n >= 0 && n <= TASKS_DONE_MAX) onChange((s) => patchSphereReview(s, month, sphere.id, { tasksDone: n }));
                }} /></label>
              <small className="kr-muted">{victory ? `Личная победа: ${victory}` : 'Победу можно записать в «Ключевом результате»'}</small>
            </article>;
          })}
        </div>
        <p className="kr-muted kr-fine">Пустое поле — число не указано. Ноль — осознанно внесённый результат. Игровые задачи к этим значениям не прибавляются.</p>
      </section>}

      <section className="kr-card kr-conclusion">
        <div className="kr-section-head"><div><span className="kr-eyebrow">ОСМЫСЛЕНИЕ</span><h3>Что этот месяц показал мне?</h3>
          <Hint on={hints}>Один главный вывод из опыта месяца. Не нужно повторять список задач или личную победу каждой сферы.</Hint></div></div>
        <label><span className="sr-only">Главный вывод месяца</span><textarea rows={4} maxLength={2000} aria-label="Главный вывод месяца"
          value={review.conclusion ?? reflection?.lessons ?? ''} placeholder="Какой подход работал? Что стало понятно?"
          onChange={(event) => patch({ conclusion: event.target.value })} /></label>
        <details className="kr-context"><summary>Важные обстоятельства <span>Необязательно</span></summary>
          <textarea rows={3} maxLength={2000} aria-label="Важные обстоятельства месяца" value={review.context ?? ''}
            placeholder="Если для понимания месяца важны отпуск, переезд или другие обстоятельства"
            onChange={(event) => patch({ context: event.target.value })} /></details>
      </section>

      <section className="kr-card kr-next-plans" aria-labelledby="kr-next-title">
        <div className="kr-section-head"><div><span className="kr-eyebrow">СЛЕДУЮЩИЙ ШАГ</span><h3 id="kr-next-title">Что беру в следующий месяц</h3>
          <Hint on={hints}>Каждый план записывай отдельной строкой. При следующих итогах эти строки появятся в начале с ответами «Да», «Нет», «Частично» или «Свой ответ».</Hint></div>
          <span className="kr-pill">{monthLabel(moveMonth(month, 1))}</span></div>
        {newPlans.length === 0 && <p className="kr-empty">Можно продолжить прежний подход или выбрать один небольшой шаг. Обязательного плана нет.</p>}
        <div className="kr-new-plans">{newPlans.map((plan, index) => <div className="kr-new-plan" key={plan.id}>
          <span className="kr-plan-index">{String(index + 1).padStart(2, '0')}</span>
          <label><span className="sr-only">План {index + 1} на следующий месяц</span><textarea rows={2} maxLength={2000}
            aria-label={`План ${index + 1} на следующий месяц`} value={plan.title} placeholder="Один конкретный план или решение"
            onChange={(event) => changeNewPlan(plan.id, { title: event.target.value })} /></label>
          <select aria-label={`Сфера плана ${index + 1}`} value={plan.sphere ?? ''} onChange={(event) => changeNewPlan(plan.id, { sphere: event.target.value || undefined })}>
            <option value="">Общий план</option>{spheres.map((sphere) => <option key={sphere.id} value={sphere.id}>{sphere.name}</option>)}
          </select>
          <button className="kr-remove-plan" aria-label={`Убрать план ${index + 1}`} onClick={() => patch({ nextPlans: newPlans.filter((p) => p.id !== plan.id) })}>×</button>
        </div>)}</div>
        <button className="kr-secondary kr-add-plan" disabled={newPlans.length >= 40} onClick={addPlan}>＋ Добавить план</button>
        <p className="kr-muted kr-fine">Планы не становятся задачами автоматически. Итоги не меняют XP, лайфкоины и серии.</p>
      </section>

      <PreviousNotes state={state} month={month} review={review} />
      <details className="kr-card kr-mood"><summary>Настроение и энергия <span>Дополнительные наблюдения</span></summary>
        {month === monthKey() && <div className="kr-mood-controls">
          <div role="group" aria-label="Настроение"><b>Настроение</b>{[1, 2, 3, 4, 5].map((n) => <button className="kr-outcome" key={n} aria-pressed={mood === n} onClick={() => setMood(n)}>{n}</button>)}</div>
          <div role="group" aria-label="Энергия"><b>Энергия</b>{[1, 2, 3, 4, 5].map((n) => <button className="kr-outcome" key={n} aria-pressed={energy === n} onClick={() => setEnergy(n)}>{n}</button>)}</div>
          <button className="kr-secondary" disabled={!mood || !energy} onClick={() => { onChange((s) => addMoodCheckin(s, mood, energy)); notify('Отметка сохранена'); }}>Отметить сейчас</button>
        </div>}
        {series.points.length >= 2 ? <><div className="kr-mood-legend"><span>Голубой — настроение</span><span>Лавандовый — энергия</span></div><svg className="kr-mood-chart" viewBox="0 0 1000 200" role="img" aria-label="История настроения и энергии: голубой — настроение, лавандовый — энергия">
          <polyline fill="none" stroke="var(--kr-blue)" strokeWidth="3" points={series.points.map((p) => `${((p.day - 1) / (series.days - 1)) * 1000},${180 - ((p.mood - 1) / 4) * 160}`).join(' ')} />
          <polyline fill="none" stroke="var(--kr-violet)" strokeWidth="3" points={series.points.map((p) => `${((p.day - 1) / (series.days - 1)) * 1000},${180 - ((p.energy - 1) / 4) * 160}`).join(' ')} />
        </svg></> : <p className="kr-muted">График появится после двух отметок. Уже сохранённые наблюдения остаются в истории.</p>}
      </details>
      <footer className="kr-review-footer"><p className="kr-muted">{completed ? 'Итоги подведены. Их можно дополнить.' : 'Можно завершить с любым количеством ответов.'}</p>
        <button className="kr-primary" onClick={finish}>{completed ? 'Сохранить изменения' : 'Итоги подведены'}</button></footer>
    </div>
  );
}
