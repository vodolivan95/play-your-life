import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { monthKey, monthLabel, monthlySummary, moveMonth } from '../monthly';
import {
  CONFIDENCE_OK,
  MAX_FOCUSES,
  addMoodCheckin,
  createPlanTasks,
  filledSpheres,
  finishReview,
  moodInsights,
  moodSeries,
  needsSmallerStep,
  patchSphereReview,
  previousPlans,
  reviewOf,
  saveReview,
  setMonthRating,
  smallerStep,
  softModeSuggested,
  sphereReviewOf,
  winSuggestions,
} from '../keyResults';
import type { PlanOutcome, SphereTrend } from '../keyResults';
import './MyResults.css';

const ratingTitles = ['', 'Тяжёлый месяц', 'Неровный месяц', 'Спокойный месяц', 'Хороший месяц', 'Отличный месяц'];
const outcomes: { id: PlanOutcome; label: string }[] = [
  { id: 'done', label: 'Сделано' },
  { id: 'part', label: 'Частично' },
  { id: 'no', label: 'Не вышло' },
];
const trends: { id: SphereTrend; label: string }[] = [
  { id: 'up', label: 'Рост' },
  { id: 'stable', label: 'Стабильно' },
  { id: 'down', label: 'Просадка' },
];
const moodLabels = ['Тяжело', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];
function questsWord(n: number) {
  const last = n % 10;
  const teen = n % 100;
  if (teen > 10 && teen < 20) return 'задач';
  if (last === 1) return 'задача';
  if (last >= 2 && last <= 4) return 'задачи';
  return 'задач';
}

function readHints() {
  try {
    return localStorage.getItem('pyl-results-hints') !== 'off';
  } catch {
    return true;
  }
}
function Hint({ on, children }: { on: boolean; children: string }) {
  return on ? <p className="myr-hint">{children}</p> : null;
}
function Step({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="myr-step" aria-labelledby={`myr-step-${n}`}>
      <header>
        <span className="myr-num">{n}</span>
        <div>
          <h3 id={`myr-step-${n}`}>{title}</h3>
          <p>{text}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export default function MyResults({
  state,
  onChange,
  ownerId,
  notify,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  ownerId: string;
  notify: (text: string) => void;
}) {
  const [month, setMonth] = useState(monthKey);
  const [hints, setHints] = useState(readHints);
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(0);
  const review = reviewOf(state, month);
  const reflection = state.monthlyReflections?.[month];
  const rating = reflection?.mood ?? null;
  const completed = reflection?.status === 'completed';
  const summary = monthlySummary(state, month);
  const plans = previousPlans(state, month);
  const wins = winSuggestions(state, month);
  const series = moodSeries(state, month);
  const insights = moodInsights(state, month);
  const soft = review.soft;
  const tasksToCreate =
    spheres.filter((s) => {
      const t = review.spheres[s.id]?.task;
      return t && !t.questId && t.title.trim();
    }).length + (soft && review.softStep.trim() && !review.softQuestId ? 1 : 0);

  function toggleHints() {
    const next = !hints;
    setHints(next);
    try {
      localStorage.setItem('pyl-results-hints', next ? 'on' : 'off');
    } catch {
      /* без сохранения подсказки всё равно работают */
    }
  }
  const patch = (changes: Partial<typeof review>) => onChange((s) => saveReview(s, month, changes));
  const patchSphere = (id: string, changes: Parameters<typeof patchSphereReview>[3]) =>
    onChange((s) => patchSphereReview(s, month, id, changes));
  function toggleWin(label: string) {
    patch({ wins: review.wins.includes(label) ? review.wins.filter((w) => w !== label) : [...review.wins, label] });
  }
  function toggleFocus(id: string) {
    if (review.focuses.includes(id)) patch({ focuses: review.focuses.filter((f) => f !== id) });
    else if (review.focuses.length < MAX_FOCUSES) patch({ focuses: [...review.focuses, id] });
  }
  function finish() {
    const count = tasksToCreate;
    onChange((s) => finishReview(createPlanTasks(s, month, ownerId).state, month));
    notify(count ? `Итоги сохранены. Задач на следующий месяц: ${count}` : 'Итоги месяца сохранены');
  }
  function checkin() {
    if (!mood || !energy) return;
    onChange((s) => addMoodCheckin(s, mood, energy));
    notify('Отметка сохранена');
  }
  const x = (day: number) => Math.round(((day - 1) / Math.max(1, series.days - 1)) * 1000);
  const line = (field: 'mood' | 'energy') =>
    series.points.map((p) => `${x(p.day)},${Math.round(180 - ((p[field] - 1) / 4) * 160)}`).join(' ');

  return (
    <div className="myr">
      <div className="myr-bar">
        <div className="myr-month">
          <button className="icon-button outlined" aria-label="Предыдущий месяц" onClick={() => setMonth(moveMonth(month, -1))}>←</button>
          <b>{monthLabel(month)}</b>
          <button className="icon-button outlined" aria-label="Следующий месяц" disabled={month >= monthKey()} onClick={() => setMonth(moveMonth(month, 1))}>→</button>
        </div>
        <label className="myr-switch">
          <input type="checkbox" role="switch" checked={hints} onChange={toggleHints} />
          <span aria-hidden="true" />
          Подсказки
        </label>
        {!soft && (
          <button className="myr-soft-link" onClick={() => patch({ soft: true })}>
            Тяжело сейчас? Подвести итоги коротко →
          </button>
        )}
      </div>

      <section className="myr-hero">
        <span className="myr-pill">ИТОГИ МЕСЯЦА ЗА {soft ? '2 ШАГА' : '7 ШАГОВ'}</span>
        <h2>Подведи {monthLabel(month).split(' ')[0].toLowerCase()} спокойно и по порядку</h2>
        <p>
          {completed ? '✓ Итоги завершены. Их можно дополнить в любой день.' : 'Текст сохраняется сам. Пустое поле — не провал. За итоги нет XP, серий и штрафов.'}
        </p>
      </section>

      <Step n={1} title="Сначала факты" text="Память преувеличивает последние недели. Цифры возвращают месяц целиком.">
        <div className="myr-facts">
          <div><span>XP за месяц</span><b>{summary.xp}</b></div>
          <div><span>Задач</span><b>{summary.quests}</b></div>
          <div><span>Активных дней</span><b>{summary.activeDays}</b></div>
          <div><span>Лучшая серия</span><b>{summary.longest}</b></div>
        </div>
        <div className="myr-card">
          <h4>Настроение и энергия</h4>
          <Hint on={hints}>Одним нажатием отметь, как ты сейчас: настроение и энергию от 1 до 5. Писать ничего не нужно. В конце месяца отметки складываются в график.</Hint>
          {month === monthKey() && (
            <div className="myr-checkin">
              <div role="group" aria-label="Настроение">
                <span>Настроение</span>
                {moodLabels.map((label, i) => (
                  <button key={label} aria-pressed={mood === i + 1} onClick={() => setMood(i + 1)}>{i + 1}<small>{label}</small></button>
                ))}
              </div>
              <div role="group" aria-label="Энергия">
                <span>Энергия</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} aria-pressed={energy === n} onClick={() => setEnergy(n)}>{n}</button>
                ))}
              </div>
              <button className="myr-primary" disabled={!mood || !energy} onClick={checkin}>Отметить сейчас</button>
            </div>
          )}
          {series.points.length >= 2 ? (
            <>
              <svg viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label="График настроения и энергии">
                {[20, 100, 180].map((y) => <line key={y} x1="0" y1={y} x2="1000" y2={y} className="myr-grid" />)}
                <polyline points={line('mood')} className="myr-line mood" vectorEffect="non-scaling-stroke" />
                <polyline points={line('energy')} className="myr-line energy" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="myr-legend"><span className="mood">Настроение</span><span className="energy">Энергия</span><span>Отметок: {series.points.length}</span></div>
              {insights.map((i) => (
                <div className="myr-insight" key={i.tag}><b>{i.tag}</b>{i.text}</div>
              ))}
              {insights.length > 0 && <p className="myr-note">Это наблюдения, а не приговор: связь не значит причину.</p>}
            </>
          ) : (
            <p className="myr-note">Пока мало отметок. График появится после двух отметок, а выводы — после шести.</p>
          )}
        </div>
      </Step>

      {!soft && (
        <>
          <Step n={2} title="Что ты планировал в прошлом месяце" text="Твои собственные слова. Отметь, как вышло.">
            <Hint on={hints}>Это планы, которые ты сам записал в прошлом месяце в поле «Что будет в следующем месяце». «Частично» — тоже движение. Ничего не засчитывается и не штрафуется.</Hint>
            {plans.length === 0 ? (
              <p className="myr-note">Планов прошлого месяца пока нет. После этих итогов они появятся здесь в следующем месяце.</p>
            ) : (
              <div className="myr-card">
                {plans.map((p) => (
                  <div className="myr-plan" key={p.sphere}>
                    <i style={{ background: p.color }} />
                    <div><b>{p.text}</b><small>{p.name}</small></div>
                    <div role="group" aria-label={`Как вышло: ${p.text}`}>
                      {outcomes.map((o) => (
                        <button key={o.id} aria-pressed={review.plans[p.sphere] === o.id} onClick={() => {
                          const plansNext = { ...review.plans };
                          if (plansNext[p.sphere] === o.id) delete plansNext[p.sphere];
                          else plansNext[p.sphere] = o.id;
                          patch({ plans: plansNext });
                        }}>{o.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Step>

          <Step n={3} title="Маленькие победы" text="Мы нашли их в твоей истории. Выбери то, чем гордишься.">
            <Hint on={hints}>Нажми на победы, которыми гордишься, даже если они маленькие. Свою победу можно дописать в итоге сферы ниже.</Hint>
            {wins.length === 0 ? (
              <p className="myr-note">Пока не нашлось побед по истории месяца. Напиши свои в итогах сфер ниже.</p>
            ) : (
              <div className="myr-chips">
                {wins.map((w) => (
                  <button key={w} aria-pressed={review.wins.includes(w)} onClick={() => toggleWin(w)}>
                    {review.wins.includes(w) ? '✓ ' : '+ '}{w}
                  </button>
                ))}
              </div>
            )}
          </Step>

          <Step n={4} title="Итоги по сферам" text="Пиши своими словами. Текст сохраняется сам, пустое поле — не провал.">
            <p className="myr-progress">Заполнено {filledSpheres(review)} из {spheres.length}</p>
            {spheres.map((s) => {
              const r = sphereReviewOf(review, s.id);
              const lowConfidence = needsSmallerStep(r.task);
              const sphereQuests = summary.sphereResults.find((x) => x.id === s.id)?.quests ?? 0;
              return (
                <section className="myr-sphere" key={s.id} style={{ ['--sphere' as string]: s.color }}>
                  <h4><i /> {s.name} <span className="myr-sphere-quests">{sphereQuests} {questsWord(sphereQuests)} за месяц</span></h4>
                  <div className="myr-three">
                    <label>
                      <span>Что удалось достичь</span>
                      <textarea rows={4} maxLength={2000} value={r.achieved} placeholder="Победы месяца, большие и маленькие" onChange={(e) => patchSphere(s.id, { achieved: e.target.value })} />
                      <Hint on={hints}>Пиши факты, а не оценки. Пример: «5 недель без пропуска зарядки», а не «молодец». Считай и маленькое.</Hint>
                    </label>
                    <label>
                      <span>Что не получилось</span>
                      <textarea rows={4} maxLength={2000} value={r.failed} placeholder="Что не вышло и что мешало" onChange={(e) => patchSphere(s.id, { failed: e.target.value })} />
                      <Hint on={hints}>Назови причину без самокритики. Пример: «не хватило времени после работы», а не «я ленивый». Что бы ты посоветовал другу в такой ситуации?</Hint>
                    </label>
                    <label>
                      <span>Что будет в следующем месяце <em>один фокус</em></span>
                      <textarea rows={4} maxLength={2000} value={r.next} placeholder="Одна главная вещь и первый шаг" onChange={(e) => patchSphere(s.id, { next: e.target.value })} />
                      <Hint on={hints}>Одна главная вещь и первый шаг. Пример: «10 км без остановки — выйти в субботу на 6 км». Это можно превратить в задачу.</Hint>
                    </label>
                  </div>
                  <div className="myr-ifthen">
                    <b>Если… то…</b>
                    <input aria-label="Если случится" maxLength={200} value={r.ifWhen} placeholder="Если случится помеха…" onChange={(e) => patchSphere(s.id, { ifWhen: e.target.value })} />
                    <span>то я</span>
                    <input aria-label="то я сделаю" maxLength={200} value={r.ifThen} placeholder="…сделаю вот это" onChange={(e) => patchSphere(s.id, { ifThen: e.target.value })} />
                    <Hint on={hints}>Заранее придумай ответ на помеху. Пример: «Если будет дождь — пойду в бассейн вместо пробежки». Так проще не сорваться в моменте.</Hint>
                  </div>
                  <div className="myr-score">
                    <span>Оценка сферы</span>
                    <div role="group" aria-label={`Оценка сферы ${s.name} от 1 до 10`}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button key={n} aria-pressed={r.score === n} onClick={() => patchSphere(s.id, { score: r.score === n ? null : n })}>{n}</button>
                      ))}
                    </div>
                    <div role="group" aria-label="Как прошёл месяц в сфере">
                      {trends.map((t) => (
                        <button key={t.id} aria-pressed={r.trend === t.id} onClick={() => patchSphere(s.id, { trend: r.trend === t.id ? null : t.id })}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                  {r.task ? (
                    <div className="myr-task">
                      <div className="myr-task-head">
                        <b>✓ Станет задачей на следующий месяц</b>
                        {!r.task.questId && <button onClick={() => patchSphere(s.id, { task: null })}>Не создавать</button>}
                        {r.task.questId && <span>Уже создана</span>}
                      </div>
                      <input aria-label="Название задачи" maxLength={100} value={r.task.title} disabled={!!r.task.questId} onChange={(e) => patchSphere(s.id, { task: { ...r.task!, title: e.target.value } })} />
                      <Hint on={hints}>Название — конкретное действие, которое можно сделать за один подход. Пример: «Выйти на пробежку 6 км в субботу». Срок — 1-е число, сложность «Сложный» (40 XP).</Hint>
                      <div className="myr-conf">
                        <span>Насколько ты уверен, что сделаешь это?</span>
                        <div role="group" aria-label="Уверенность от 1 до 10">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <button key={n} aria-pressed={r.task!.confidence === n} disabled={!!r.task!.questId} onClick={() => patchSphere(s.id, { task: { ...r.task!, confidence: n } })}>{n}</button>
                          ))}
                        </div>
                        {lowConfidence ? (
                          <div className="myr-warn">
                            <span>Ниже {CONFIDENCE_OK} — шаг великоват. Давай уменьшим: «{smallerStep(r.task.title)}».</span>
                            <button onClick={() => patchSphere(s.id, { task: { ...r.task!, title: smallerStep(r.task!.title), confidence: CONFIDENCE_OK } })}>Взять шаг поменьше</button>
                          </div>
                        ) : (
                          <small>Хороший план: уверенности хватает.</small>
                        )}
                        <Hint on={hints}>Оценка нужна только тебе. Если ниже 7 из 10, лучше взять шаг поменьше: его сделать проще, а потом можно добавить.</Hint>
                      </div>
                    </div>
                  ) : (
                    <button className="myr-dashed" disabled={!r.next.trim()} onClick={() => patchSphere(s.id, { task: { title: r.next.trim().slice(0, 100), confidence: 8 } })}>
                      ＋ Превратить в задачу на следующий месяц
                    </button>
                  )}
                </section>
              );
            })}
          </Step>

          <Step n={5} title="За что я благодарен" text="Три хороших вещи. Необязательно, но это быстро.">
            <Hint on={hints}>Любые мелочи: человек, погода, вкусный обед, удачный разговор. Пример: «Сосед помог донести сумки». Хватит одной строки.</Hint>
            {[0, 1, 2].map((i) => (
              <input key={i} className="myr-line-input" aria-label={`Благодарность ${i + 1}`} maxLength={200} value={review.gratitude[i] ?? ''} placeholder="Что хорошего случилось?" onChange={(e) => patch({ gratitude: review.gratitude.map((g, j) => (j === i ? e.target.value : g)) })} />
            ))}
          </Step>

          <Step n={6} title="Три фокуса на следующий месяц" text="Не больше трёх. Так больше шансов дойти до конца.">
            <Hint on={hints}>Фокус — то, что действительно важно в следующем месяце. Выбирай из планов сфер выше: лучше три сделанных дела, чем десять начатых.</Hint>
            <div className="myr-focus">
              {spheres.map((s) => {
                const next = sphereReviewOf(review, s.id).next.trim();
                const on = review.focuses.includes(s.id);
                return (
                  <button key={s.id} aria-pressed={on} disabled={!on && (!next || review.focuses.length >= MAX_FOCUSES)} onClick={() => toggleFocus(s.id)} style={{ ['--sphere' as string]: s.color }}>
                    <small>{s.name}</small>
                    <b>{next || 'Сначала напиши план сферы'}</b>
                  </button>
                );
              })}
            </div>
            <p className="myr-note">Выбрано {review.focuses.length} из {MAX_FOCUSES}. {tasksToCreate ? `Будет создано задач: ${tasksToCreate}, срок — 1-е число.` : 'Задачи создаются из планов сфер кнопкой «Превратить в задачу».'}</p>
          </Step>
        </>
      )}

      <Step n={soft ? 2 : 7} title="Оценка месяца" text="Последний шаг. Месяц запоминается по пику и концу, поэтому закончим на главном.">
        <Hint on={hints}>Оценивай по ощущению, а не по цифрам: 5 — «хочу такой же», 3 — «нормально», 1 — «еле дотянул». Правильного ответа нет.</Hint>
        <div className="myr-stars" role="group" aria-label="Оценка месяца от 1 до 5 звёзд">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-label={`${n} из 5`} data-on={rating !== null && n <= rating} aria-pressed={rating === n} onClick={() => onChange((s) => setMonthRating(s, month, rating === n ? null : n))}>
              <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true" fill={rating !== null && n <= rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" /></svg>
            </button>
          ))}
          <strong>{rating ? ratingTitles[rating] : 'Поставь оценку'}</strong>
        </div>
        {softModeSuggested(rating) && !soft && (
          <div className="myr-warn calm">
            <span>Похоже, месяц был тяжёлым. Можно подвести итоги коротко: два вопроса и один маленький шаг.</span>
            <button onClick={() => patch({ soft: true })}>Включить мягкий режим</button>
          </div>
        )}
        {soft && (
          <div className="myr-soft">
            <h4>Тяжёлые месяцы бывают у всех. Это нормально.</h4>
            <p>Включён мягкий режим: остальные шаги можно пропустить. Серий, XP и штрафов нет.</p>
            <label>
              <span>Что помогло тебе выдержать этот месяц?</span>
              <input maxLength={200} value={review.softHelped} placeholder="Например: прогулки, разговор с другом, сон" onChange={(e) => patch({ softHelped: e.target.value })} />
              <Hint on={hints}>Даже одна вещь важна: это то, что стоит оставить на следующий месяц.</Hint>
            </label>
            <label>
              <span>Один маленький шаг на следующий месяц</span>
              <input maxLength={100} value={review.softStep} placeholder="Например: 10 минут прогулки по вечерам" onChange={(e) => patch({ softStep: e.target.value })} />
              <Hint on={hints}>Выбери шаг, который получится даже в плохой день. Он станет одной задачей.</Hint>
            </label>
            <button className="myr-link" onClick={() => patch({ soft: false })}>Вернуться к полным итогам</button>
          </div>
        )}
        <div className="myr-finish">
          <span>За итоги нет ни XP, ни штрафов, ни серий. К итогам можно вернуться в любой день.</span>
          <button className="myr-primary" onClick={finish}>{soft ? 'Закончить мягко' : completed ? 'Сохранить изменения' : 'Завершить итоги месяца'}</button>
        </div>
      </Step>
    </div>
  );
}
