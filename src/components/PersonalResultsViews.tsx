import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { monthKey, monthLabel, validMonth } from '../monthly';
import { patchSphereReview, reviewOf, sphereReviewOf } from '../keyResults';
import { personalTimeline, personalYear, victoryOf } from '../personalResults';
import Statistics from './Statistics';
import './PersonalResultsViews.css';

type StateChange = Dispatch<SetStateAction<GameState>>;
type Range = 6 | 12;

const DEFAULT_SPHERE = 'health';

function abbreviatedMonth(month: string) {
  return monthLabel(month).split(' ')[0].slice(0, 3);
}

function monthForYear(year: number, index: number) {
  return monthKey(new Date(year, index, 1, 12));
}

function evidenceFor(state: GameState, month: string, sphere: string) {
  return sphereReviewOf(reviewOf(state, month), sphere).resultEvidence ?? '';
}

function pluralTasks(value: number) {
  const rest = Math.abs(value) % 100;
  const last = rest % 10;
  if (rest > 10 && rest < 20) return 'задач';
  if (last === 1) return 'задача';
  if (last > 1 && last < 5) return 'задачи';
  return 'задач';
}

function SpherePicker({
  value,
  onChange,
  label = 'Сфера',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="prv-sphere-picker" role="group" aria-label={label}>
      {spheres.map((sphere) => (
        <button
          key={sphere.id}
          type="button"
          aria-pressed={value === sphere.id}
          onClick={() => onChange(sphere.id)}
        >
          <i className="kr-sphere-dot" style={{ background: sphere.color }} aria-hidden="true" />
          <span>{sphere.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Поле одной собственной победы и необязательного подтверждения в каждой сфере. */
export function VictoryResults({
  state,
  onChange,
  month,
  onOpenMine,
}: {
  state: GameState;
  onChange: StateChange;
  month: string;
  onOpenMine?: () => void;
}) {
  const review = reviewOf(state, month);
  const [evidenceOpen, setEvidenceOpen] = useState<Record<string, boolean>>({});
  const written = spheres.filter((sphere) => victoryOf(review, sphere.id).trim()).length;

  return (
    <div className="prv prv-victories">
      <section className="kr-hero prv-victories-hero" aria-labelledby="prv-victories-title">
        <div>
          <p className="kr-eyebrow">КЛЮЧЕВОЙ РЕЗУЛЬТАТ · {monthLabel(month)}</p>
          <h2 id="prv-victories-title">Что в этом месяце было по‑настоящему важным?</h2>
          <p className="kr-muted">
            Одна ясная формулировка на сферу. Это личная запись, не оценка и не соревнование.
          </p>
        </div>
        <div className="prv-hero-stat" aria-label={`Записано результатов: ${written} из ${spheres.length}`}>
          <b>{written}</b>
          <span>из {spheres.length}<br />сфер</span>
        </div>
      </section>

      <div className="prv-victory-list">
        {spheres.map((sphere) => {
          const sphereReview = sphereReviewOf(review, sphere.id);
          const result = victoryOf(review, sphere.id);
          const evidence = sphereReview.resultEvidence ?? '';
          const open = evidenceOpen[sphere.id] ?? Boolean(evidence);
          const tasks = sphereReview.tasksDone;
          return (
            <section className="kr-card prv-victory-card" key={sphere.id}>
              <header className="prv-victory-head">
                <div>
                  <span className="prv-sphere-name">
                    <i className="kr-sphere-dot" style={{ background: sphere.color }} aria-hidden="true" />
                    {sphere.name}
                  </span>
                  <p className="kr-muted">
                    {typeof tasks === 'number'
                      ? `Ручная отметка: ${tasks} ${pluralTasks(tasks)} за месяц.`
                      : 'Ручное число задач пока не указано в «Моих итогах». '}
                  </p>
                </div>
                <span className="kr-pill">ЛИЧНЫЙ ИТОГ</span>
              </header>

              <label className="prv-result-field">
                <span>Ключевой результат</span>
                <textarea
                  value={result}
                  maxLength={2000}
                  rows={3}
                  placeholder="Например: вернулся к регулярным тренировкам два раза в неделю"
                  onChange={(event) =>
                    onChange((current) =>
                      patchSphereReview(current, month, sphere.id, { keyResult: event.target.value }),
                    )
                  }
                />
                <small>{result.length} / 2000</small>
              </label>

              <details
                className="prv-evidence"
                open={open}
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  setEvidenceOpen((current) => ({
                    ...current,
                    [sphere.id]: isOpen,
                  }));
                }}
              >
                <summary>Добавить подтверждение <span>необязательно</span></summary>
                <label>
                  <span className="sr-only">Подтверждение результата в сфере «{sphere.name}»</span>
                  <textarea
                    value={evidence}
                    maxLength={2000}
                    rows={3}
                    placeholder="Факт, ссылка или короткая заметка для себя"
                    onChange={(event) =>
                      onChange((current) =>
                        patchSphereReview(current, month, sphere.id, { resultEvidence: event.target.value }),
                      )
                    }
                  />
                  <small>{evidence.length} / 2000</small>
                </label>
              </details>
            </section>
          );
        })}
      </div>

      {onOpenMine && (
        <button className="kr-secondary prv-open-mine" type="button" onClick={onOpenMine}>
          Открыть «Мои итоги»
        </button>
      )}
    </div>
  );
}

/** Динамика ручных чисел и синхронная история личных результатов. */
export function PersonalDynamics({
  state,
  month,
  onOpenMonth,
}: {
  state: GameState;
  month: string;
  onOpenMonth: (month: string) => void;
}) {
  const [sphere, setSphere] = useState(DEFAULT_SPHERE);
  const [range, setRange] = useState<Range>(6);
  const [mode, setMode] = useState<'personal' | 'game'>('personal');
  const timeline = personalTimeline(state, month, sphere, range).filter(
    (item) => validMonth(item.month) && item.month <= monthKey(),
  );
  const [selectedMonth, setSelectedMonth] = useState(month);
  const selected = timeline.find((item) => item.month === selectedMonth) ?? timeline[timeline.length - 1];
  const maximum = Math.max(1, ...timeline.map((item) => item.tasks ?? 0));
  const writtenVictories = timeline.filter((item) => item.victory.trim()).length;

  return (
    <div className="prv prv-dynamics">
      <section className="kr-hero prv-dynamics-hero" aria-labelledby="prv-dynamics-title">
        <div>
          <p className="kr-eyebrow">ДИНАМИКА · ЛИЧНАЯ ИСТОРИЯ</p>
          <h2 id="prv-dynamics-title">Видеть ритм, а не оценивать себя</h2>
          <p className="kr-muted">
            Ручные числа и собственные итоги идут рядом. Пропуск остаётся пропуском, а не нулём.
          </p>
        </div>
        <div className="prv-dynamic-facts" aria-label="Сводка выбранного диапазона">
          <span><b>{writtenVictories}</b> записано<br />результатов</span>
          <span><b>{timeline.filter((item) => item.tasks !== null).length}</b> месяцев<br />с числом</span>
        </div>
      </section>

      <div className="prv-controls">
        <SpherePicker value={sphere} onChange={setSphere} />
        <div className="prv-segmented" role="group" aria-label="Диапазон динамики">
          {([6, 12] as Range[]).map((value) => (
            <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>
              {value} месяцев
            </button>
          ))}
        </div>
        <div className="prv-segmented" role="group" aria-label="Источник динамики">
          <button type="button" aria-pressed={mode === 'personal'} onClick={() => setMode('personal')}>Личные результаты</button>
          <button type="button" aria-pressed={mode === 'game'} onClick={() => setMode('game')}>Активность в приложении</button>
        </div>
      </div>

      {mode === 'game' ? (
        <section className="kr-card prv-game-statistics" aria-label="Активность в приложении">
          <Statistics state={state} onMonthly={() => onOpenMonth(month)} />
        </section>
      ) : (
        <>
          <section className="kr-card prv-timeline-card" aria-labelledby="prv-timeline-title">
            <div className="kr-section-head">
              <div>
                <p className="kr-eyebrow">РУЧНЫЕ ЧИСЛА</p>
                <h3 id="prv-timeline-title">{spheres.find((item) => item.id === sphere)?.name}</h3>
              </div>
              <p className="kr-muted">Нажмите на месяц, чтобы прочитать его запись.</p>
            </div>

            {timeline.length === 0 ? (
              <p className="kr-empty">В выбранном периоде ещё нет месяцев, которые можно показать.</p>
            ) : (
              <div
                className="prv-chart"
                role="group"
                aria-label="Динамика ручных чисел по месяцам"
                style={{ ['--prv-columns' as string]: timeline.length }}
              >
                {timeline.map((item) => {
                  const selectedColumn = selected?.month === item.month;
                  const hasNumber = item.tasks !== null;
                  const positive = typeof item.tasks === 'number' && item.tasks > 0;
                  const height = positive ? Math.max(9, ((item.tasks ?? 0) / maximum) * 100) : 0;
                  const stateClass = !hasNumber ? 'is-gap' : item.tasks === 0 ? 'is-zero' : 'is-value';
                  return (
                    <button
                      key={item.month}
                      type="button"
                      className={`prv-chart-column ${stateClass}${item.current ? ' is-current' : ''}${selectedColumn ? ' is-selected' : ''}`}
                      style={{ ['--prv-height' as string]: `${height}%` }}
                      aria-pressed={selectedColumn}
                      aria-label={`${monthLabel(item.month)}: ${hasNumber ? `${item.tasks} ${pluralTasks(item.tasks!)}` : 'число не указано'}${item.current ? ', текущий месяц' : ''}`}
                      onClick={() => setSelectedMonth(item.month)}
                    >
                      <span className="prv-chart-plot" aria-hidden="true">
                        {positive && <i style={{ height: `${height}%` }} />}
                        {item.tasks === 0 && <i className="prv-zero-baseline" />}
                        {hasNumber && <b>{item.tasks}</b>}
                      </span>
                      <span>{abbreviatedMonth(item.month)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="kr-card prv-timeline-detail" aria-live="polite">
            {selected ? (
              <>
                <div className="prv-timeline-detail-head">
                  <div>
                    <p className="kr-eyebrow">{selected.current ? 'ТЕКУЩИЙ МЕСЯЦ' : 'ВЫБРАННЫЙ МЕСЯЦ'}</p>
                    <h3>{monthLabel(selected.month)}</h3>
                  </div>
                  <button className="kr-secondary" type="button" onClick={() => onOpenMonth(selected.month)}>
                    Открыть месяц
                  </button>
                </div>
                <div className="prv-selected-metrics">
                  <div>
                    <span>Ручные задачи</span>
                    <b>{selected.tasks === null ? '—' : `${selected.tasks} ${pluralTasks(selected.tasks)}`}</b>
                  </div>
                  <div>
                    <span>Личный результат</span>
                    <b>{selected.victory.trim() || 'Не записан'}</b>
                  </div>
                </div>
                {evidenceFor(state, selected.month, sphere).trim() && (
                  <p className="prv-evidence-copy">{evidenceFor(state, selected.month, sphere)}</p>
                )}
              </>
            ) : (
              <p className="kr-empty">Выберите месяц, чтобы увидеть связанную с ним запись.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Матрица личных ручных чисел за год и история побед выбранной сферы. */
export function YearResults({
  state,
  month,
  onOpenMonth,
}: {
  state: GameState;
  month: string;
  onOpenMonth: (month: string) => void;
}) {
  const currentMonth = monthKey();
  const currentYear = Number(currentMonth.slice(0, 4));
  const validMonths = [month, ...Object.keys(state.monthlyReflections ?? {})].filter(
    (value) => validMonth(value) && value <= currentMonth,
  );
  const earliestYear = Math.min(
    currentYear,
    ...validMonths.map((value) => Number(value.slice(0, 4))).filter(Number.isFinite),
  );
  const years = Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => currentYear - index);
  const initialYear = validMonth(month) && month <= currentMonth ? Number(month.slice(0, 4)) : currentYear;
  const [year, setYear] = useState(initialYear);
  const [sphere, setSphere] = useState(DEFAULT_SPHERE);
  const chosenYear = years.includes(year) ? year : (years[0] ?? currentYear);

  const summaries = spheres.map((item) => ({ item, data: personalYear(state, chosenYear, item.id) }));
  const selected = summaries.find((entry) => entry.item.id === sphere) ?? summaries[0];
  const writtenVictories = summaries.reduce((total, entry) => total + entry.data.months.filter((item) => !item.future && item.victory.trim()).length, 0);
  const knownRecords = summaries.reduce((total, entry) => total + entry.data.knownMonths, 0);
  const elapsedRecords = summaries.reduce((total, entry) => total + entry.data.elapsedMonths, 0);
  const yearMonths = Array.from({ length: 12 }, (_, index) => monthForYear(chosenYear, index));

  return (
    <div className="prv prv-year">
      <section className="kr-hero prv-year-hero" aria-labelledby="prv-year-title">
        <div>
          <p className="kr-eyebrow">ГОДОВЫЕ ИТОГИ · ЛИЧНЫЕ ЗАПИСИ</p>
          <h2 id="prv-year-title">{chosenYear}</h2>
          <p className="kr-muted">
            {writtenVictories
              ? `Записано личных результатов: ${writtenVictories}.`
              : 'Личные результаты за этот год ещё не записаны.'}
            {' '}
            {elapsedRecords
              ? `Ручные числа внесены в ${knownRecords} из ${elapsedRecords} записей завершённых месяцев.`
              : 'Завершённых месяцев для ручного учёта пока нет.'}
            {chosenYear === currentYear && ' Текущий месяц показан отдельно и ещё не завершён.'}
          </p>
        </div>
        <label className="prv-year-select">
          <span>Год</span>
          <select value={chosenYear} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      </section>

      <section className="kr-card prv-year-matrix-card" aria-labelledby="prv-matrix-title">
        <div className="kr-section-head">
          <div>
            <p className="kr-eyebrow">МАТРИЦА РУЧНЫХ ЧИСЕЛ</p>
            <h3 id="prv-matrix-title">Все сферы по месяцам</h3>
          </div>
          <p className="kr-muted">Пустая ячейка — число не вносилось. Это не ноль.</p>
        </div>
        <div className="prv-table-scroll" tabIndex={0} aria-label="Прокручиваемая по горизонтали таблица итогов года">
          <table className="prv-year-table">
            <caption>Ручные количества задач по каждой сфере за {chosenYear} год</caption>
            <thead>
              <tr>
                <th scope="col">Месяц</th>
                {summaries.map(({ item }) => (
                  <th scope="col" key={item.id}>
                    <i className="kr-sphere-dot" style={{ background: item.color }} aria-hidden="true" />
                    <span>{item.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearMonths.map((key) => (
                <tr key={key} className={key === currentMonth ? 'is-current' : ''}>
                  <th scope="row">{monthLabel(key).split(' ')[0]}</th>
                  {summaries.map(({ item, data }) => {
                    const entry = data.months.find((candidate) => candidate.month === key);
                    const future = entry?.future ?? key > currentMonth;
                    const tasks = entry?.tasks ?? null;
                    return (
                      <td key={item.id} className={future ? 'is-future' : tasks === null ? 'is-unknown' : ''}>
                        {future ? (
                          <span>ещё не наступил</span>
                        ) : tasks === null ? (
                          <span aria-label="число не указано">—</span>
                        ) : (
                          <b>{tasks}</b>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Завершённые</th>
                {summaries.map(({ item, data }) => (
                  <td key={item.id}><b>{data.knownMonths ? data.total : '—'}</b><small>{data.knownMonths ? 'задач' : 'числа не внесены'}</small></td>
                ))}
              </tr>
              <tr>
                <th scope="row">Учёт</th>
                {summaries.map(({ item, data }) => (
                  <td key={item.id}>
                    <b>{data.elapsedMonths ? `${data.knownMonths} / ${data.elapsedMonths}` : '—'}</b>
                    <small>{data.elapsedMonths ? 'месяцев с числом' : 'нет завершённых'}</small>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Текущий месяц</th>
                {summaries.map(({ item, data }) => (
                  <td key={item.id}>
                    {data.currentTasks === null ? <span>—</span> : <b>{data.currentTasks}</b>}
                    <small>{chosenYear === currentYear ? 'идёт сейчас' : 'год завершён'}</small>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="kr-card prv-year-detail" aria-labelledby="prv-year-detail-title">
        <div className="kr-section-head">
          <div>
            <p className="kr-eyebrow">ЛИЧНАЯ ХРОНИКА</p>
            <h3 id="prv-year-detail-title">Числа и результаты по одной сфере</h3>
          </div>
          <p className="kr-muted">Победа и ручное число относятся к одному и тому же месяцу.</p>
        </div>
        <SpherePicker value={sphere} onChange={setSphere} label="Сфера для годовой хроники" />
        {selected && (
          <div className="prv-year-months">
            {yearMonths.map((key) => {
              const item = selected.data.months.find((candidate) => candidate.month === key);
              const future = item?.future ?? key > currentMonth;
              const tasks = item?.tasks ?? null;
              const victory = item?.victory.trim() ?? '';
              const evidence = evidenceFor(state, key, sphere).trim();
              const empty = !future && tasks === null && !victory && !evidence;
              return (
                <article className={`prv-year-month${future ? ' is-future' : ''}${key === currentMonth ? ' is-current' : ''}`} key={key}>
                  <div className="prv-year-month-head">
                    <h4>{monthLabel(key).split(' ')[0]}</h4>
                    {key === currentMonth && <span className="kr-pill">СЕЙЧАС</span>}
                  </div>
                  {future ? (
                    <p className="kr-muted">Ещё не наступил</p>
                  ) : (
                    <>
                      <p className="prv-year-count">
                        <span>Ручные задачи</span>
                        <b>{tasks === null ? 'Не указано' : `${tasks} ${pluralTasks(tasks)}`}</b>
                      </p>
                      {victory && <p className="prv-year-victory">{victory}</p>}
                      {evidence && <p className="prv-year-evidence">{evidence}</p>}
                      {empty && <p className="kr-muted">Ничего не записано.</p>}
                      <button className="prv-month-link" type="button" onClick={() => onOpenMonth(key)}>
                        Открыть месяц
                      </button>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
