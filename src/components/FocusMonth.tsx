import { useState } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import {
  comparisonText, dayFocus, FOCUS_HEAT_MINUTES, focusModeLabel, focusSlices, formatFocus, monthFocus, NO_SPHERE, NO_SPHERE_NAME,
} from '../focusSessions';
import type { FocusRecord, NamedFocus } from '../focusSessions';
import './FocusMonth.css';

const R = 80;
const C = 2 * Math.PI * R;
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const noon = (day: string) => new Date(`${day}T12:00:00`);
const dayLong = (day: string) => noon(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const dayShort = (day: string) => noon(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const rangeLabel = (r: { from: string; to: string }) => `${Number(r.from.slice(8, 10))}–${dayLong(r.to)}`;
const percent = (share: number) => Math.round(share * 100);
function sphereInfo(id: string) {
  const s = spheres.find((item) => item.id === id);
  return s ? { name: s.name, icon: s.icon, color: s.color } : { name: NO_SPHERE_NAME, icon: '◌', color: '#8b93a7' };
}

function Rows({ rows, color, onOpen, canOpen }: {
  rows: NamedFocus[]; color?: string; onOpen?: (key: string) => void; canOpen?: (key: string) => boolean;
}) {
  return (
    <ul className="fm-rows">
      {rows.map((row) => {
        const body = (
          <>
            <span className="fm-row-name">{row.name}</span>
            <span className="fm-row-value">{formatFocus(row.seconds)} · {percent(row.share)}%</span>
            <span className="fm-track" aria-hidden="true"><i style={{ width: `${Math.max(2, percent(row.share))}%`, background: color }} /></span>
          </>
        );
        return (
          <li key={row.key}>
            {onOpen && canOpen?.(row.key)
              ? <button type="button" aria-label={`Открыть задачу: ${row.name}`} onClick={() => onOpen(row.key)}>{body}</button>
              : <div>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * «Фокус месяца» в «Ключевые итоги → Отчёт месяца» (ТЗ «Этап 4.1», разделы 8–12, 15, 18).
 * Все числа считаются из записей рабочих сессий (src/focusSessions.ts) — таймер, секундомер и
 * время, внесённое вручную, складываются в один отчёт. Случайных и примерных значений нет.
 */
export default function FocusMonth({ state, month, onOpenTask }: {
  state: GameState;
  month: string;
  onOpenTask?: (taskId: string) => void;
}) {
  const [sphere, setSphere] = useState('');
  const [goalId, setGoalId] = useState('');
  const [stageId, setStageId] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const goal = state.goals.find((g) => g.id === goalId);
  const stages = goal?.stages ?? [];
  const stage = stages.find((s) => s.id === stageId);
  const filter = { ...(sphere ? { sphere } : {}), ...(goal ? { goalId: goal.id } : {}), ...(goal && stage ? { stageId: stage.id } : {}) };
  const filtered = !!sphere || !!goal;
  const data = monthFocus(state, month, filter);
  const c = data.comparison;
  const activeDay = day && day.startsWith(month) ? day : null;
  const dayDetail = activeDay ? dayFocus(state, activeDay, filter) : null;
  const withTime = data.spheres.filter((s) => s.seconds > 0);
  const pickedRow = picked ? data.spheres.find((s) => s.id === picked && s.seconds > 0) : undefined;
  const detail = pickedRow ? monthFocus(state, month, { ...filter, sphere: pickedRow.id }) : null;
  const recent: FocusRecord[] = pickedRow
    ? [...new Set(focusSlices(state, { ...filter, sphere: pickedRow.id, from: data.days[0].day, to: data.days[data.days.length - 1].day }).map((slice) => slice.record))].slice(0, 5)
    : [];
  const taskExists = (id: string) => state.quests.some((q) => q.id === id);
  const taskName = (id: string) => state.quests.find((q) => q.id === id)?.name ?? 'Удалённая задача';
  const maxDay = Math.max(1, ...data.days.map((d) => d.seconds));
  const lead = (noon(data.days[0].day).getDay() + 6) % 7;
  const shownFilters = [
    sphere ? sphereInfo(sphere).name : 'все сферы',
    goal ? `проект «${goal.name}»` : 'все проекты',
    ...(goal && stage ? [`этап «${stage.name}»`] : []),
  ].join(' · ');
  const pick = (id: string) => setPicked(picked === id ? null : id);
  const pickDay = (d: string) => setDay(activeDay === d ? null : d);
  const reset = () => { setSphere(''); setGoalId(''); setStageId(''); };

  const segments = withTime.map((s, i) => ({
    ...s, length: s.share * C, offset: withTime.slice(0, i).reduce((sum, before) => sum + before.share * C, 0),
  }));

  return (
    <section className="fm" aria-label="Фокус месяца">
      <header className="fm-head">
        <div>
          <h3>⏱ Фокус месяца</h3>
          <p>Сколько времени ты посвятил своим целям</p>
        </div>
        <div className="fm-total">
          <b>{formatFocus(data.totalSeconds)}</b>
          <span className="fm-compare" data-direction={c.deltaSeconds > 0 ? 'up' : 'flat'}>{comparisonText(c)}</span>
          <small>{rangeLabel(c.range)} и {rangeLabel(c.previousRange)}{c.partial ? ' · месяц ещё идёт, сравниваются одинаковые отрезки' : ''}</small>
        </div>
      </header>

      <div className="fm-filters" role="group" aria-label="Фильтры фокуса месяца">
        <label>Сфера
          <select value={sphere} onChange={(e) => setSphere(e.target.value)}>
            <option value="">Все сферы</option>
            {spheres.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            <option value={NO_SPHERE}>{NO_SPHERE_NAME}</option>
          </select>
        </label>
        <label>Проект
          <select value={goal ? goal.id : ''} onChange={(e) => { setGoalId(e.target.value); setStageId(''); }}>
            <option value="">Все проекты</option>
            {state.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        {stages.length > 0 && (
          <label>Этап
            <select value={stage ? stage.id : ''} onChange={(e) => setStageId(e.target.value)}>
              <option value="">Все этапы</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {filtered && <button type="button" className="fm-reset" onClick={reset}>Сбросить фильтры</button>}
        <small className="fm-shown" role="status">Показано: {shownFilters}</small>
      </div>

      <div className="fm-stats">
        <div><small>Всего фокуса</small><b>{formatFocus(data.totalSeconds)}</b></div>
        <div><small>Рабочих сессий</small><b>{data.sessions}</b></div>
        <div><small>Дней с фокусом</small><b>{data.activeDays}</b></div>
        <div><small>Средняя сессия</small><b>{formatFocus(data.averageSeconds)}</b></div>
      </div>

      {data.totalSeconds === 0 ? (
        <p className="fm-empty">
          {filtered ? 'По выбранным фильтрам в этом месяце нет сессий фокуса.' : 'В этом месяце пока нет сессий фокуса.'}
          {' '}Открой задачу и нажми «Начать фокус» — таймер или секундомер запишет время, и оно появится здесь.
        </p>
      ) : (
        <>
          <div className="fm-spheres">
            <div className="fm-donut">
              <svg viewBox="0 0 200 200" role="group" aria-label="Распределение фокуса по сферам">
                <circle cx="100" cy="100" r={R} className="fm-donut-bg" />
                {segments.map((s) => (
                  <circle key={s.id} cx="100" cy="100" r={R} className="fm-donut-seg" stroke={s.color}
                    strokeDasharray={`${Math.max(0, s.length - (segments.length > 1 ? 2 : 0))} ${C}`} strokeDashoffset={-s.offset}
                    transform="rotate(-90 100 100)" role="button" tabIndex={0} aria-pressed={picked === s.id}
                    aria-label={`${s.name}: ${formatFocus(s.seconds)}, ${percent(s.share)}%`}
                    data-dim={picked && picked !== s.id ? '' : undefined}
                    onClick={() => pick(s.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(s.id); } }} />
                ))}
              </svg>
              <div className="fm-donut-center" aria-live="polite">
                {pickedRow ? (
                  <><small>{pickedRow.icon} {pickedRow.name}</small><b>{formatFocus(pickedRow.seconds)}</b><small>{percent(pickedRow.share)}% времени</small></>
                ) : (
                  <><b>{formatFocus(data.totalSeconds)}</b><small>всего за месяц</small></>
                )}
              </div>
            </div>
            <div className="fm-sphere-list">
              <ul>
                {(showAll ? data.spheres : withTime).map((s) => (
                  <li key={s.id}>
                    <button type="button" aria-pressed={picked === s.id} disabled={s.seconds === 0} onClick={() => pick(s.id)}>
                      <span className="fm-sphere-icon" style={{ background: `${s.color}33`, borderColor: s.color }} aria-hidden="true">{s.icon}</span>
                      <span className="fm-row-name">{s.name}</span>
                      <span className="fm-row-value">{formatFocus(s.seconds)} · {percent(s.share)}%</span>
                      <span className="fm-track" aria-hidden="true"><i style={{ width: `${s.seconds ? Math.max(2, percent(s.share)) : 0}%`, background: s.color }} /></span>
                    </button>
                  </li>
                ))}
              </ul>
              <label className="fm-toggle"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Показать все сферы</label>
            </div>
          </div>

          {pickedRow && detail && (
            <div className="fm-panel" role="region" aria-label={`Сфера ${pickedRow.name}`}>
              <div className="fm-panel-head">
                <b>{pickedRow.icon} {pickedRow.name} — {formatFocus(detail.totalSeconds)}</b>
                <span>сессий: {detail.sessions} · дней с фокусом: {detail.activeDays}</span>
                <button type="button" aria-label="Закрыть детализацию сферы" onClick={() => setPicked(null)}>✕</button>
              </div>
              <h4>Фокус по проектам</h4>
              <Rows rows={detail.projects} color={pickedRow.color} />
              <h4>Фокус по задачам</h4>
              <Rows rows={detail.tasks.slice(0, 8)} color={pickedRow.color} onOpen={onOpenTask} canOpen={taskExists} />
              <h4>Фокус по дням</h4>
              <p className="fm-chips">{detail.days.filter((d) => d.seconds > 0).map((d) => <span key={d.day}>{dayShort(d.day)} · {formatFocus(d.seconds)}</span>)}</p>
              <h4>Последние сессии</h4>
              <ul className="fm-sessions">
                {recent.map((r) => (
                  <li key={r.id}><span>{new Date(r.endedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span><span>{taskName(r.taskId)}</span><span>{focusModeLabel(r.mode)}</span><b>{formatFocus(r.seconds)}</b></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <details className="fm-block" open>
        <summary>Календарь фокуса</summary>
        <div className="fm-cal" role="group" aria-label="Календарь фокуса по дням">
          {weekdays.map((w) => <span key={w} className="fm-cal-head" aria-hidden="true">{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} aria-hidden="true" />)}
          {data.days.map((d) => (
            <button key={d.day} type="button" data-level={d.level} data-future={d.future ? '' : undefined} aria-pressed={activeDay === d.day}
              aria-label={`${dayLong(d.day)}: ${formatFocus(d.seconds)}`} onClick={() => pickDay(d.day)}>
              {Number(d.day.slice(8, 10))}
            </button>
          ))}
        </div>
        <p className="fm-legend" aria-label="Шкала календаря">
          <span><i data-level="0" /> нет</span>
          {FOCUS_HEAT_MINUTES.map((limit, i) => <span key={limit}><i data-level={i + 1} /> от {limit} мин</span>)}
        </p>
      </details>

      {dayDetail && (
        <div className="fm-panel" role="region" aria-label={`Фокус за ${dayLong(dayDetail.day)}`}>
          <div className="fm-panel-head">
            <b>{dayLong(dayDetail.day)} — {formatFocus(dayDetail.totalSeconds)}</b>
            <span>сессий: {dayDetail.sessions}</span>
            <button type="button" aria-label="Закрыть детализацию дня" onClick={() => setDay(null)}>✕</button>
          </div>
          {dayDetail.totalSeconds === 0 ? <p className="fm-empty">В этот день фокуса не было.</p> : (
            <>
              <h4>Сферы</h4>
              <p className="fm-chips">{dayDetail.spheres.map((s) => <span key={s.key}>{sphereInfo(s.key).icon} {s.name} · {formatFocus(s.seconds)}</span>)}</p>
              <h4>Проекты</h4>
              <p className="fm-chips">{dayDetail.projects.map((p) => <span key={p.key}>{p.name} · {formatFocus(p.seconds)}</span>)}</p>
              <h4>Задачи</h4>
              <Rows rows={dayDetail.tasks} onOpen={onOpenTask} canOpen={taskExists} />
            </>
          )}
        </div>
      )}

      <details className="fm-block">
        <summary>Динамика по дням</summary>
        {data.totalSeconds === 0 ? <p className="fm-empty">Пока нечего показывать: в этом месяце нет сессий фокуса{filtered ? ' по выбранным фильтрам' : ''}.</p> : (
          <>
            <p className="fm-axis">Минуты фокуса по дням{sphere ? ` · ${sphereInfo(sphere).name}` : ''} · максимум {Math.round(maxDay / 60)} мин</p>
            <div className="fm-chart" role="group" aria-label="Динамика фокуса по дням" style={{ gridTemplateColumns: `repeat(${data.days.length}, minmax(0, 1fr))` }}>
              {data.days.map((d) => {
                const n = Number(d.day.slice(8, 10));
                return (
                  <button key={d.day} type="button" aria-pressed={activeDay === d.day} data-future={d.future ? '' : undefined}
                    aria-label={`${dayLong(d.day)}: ${Math.round(d.seconds / 60)} мин`} onClick={() => pickDay(d.day)}>
                    <i style={{ height: `${d.seconds ? Math.max(5, Math.round((d.seconds / maxDay) * 100)) : 0}%` }} />
                    <small>{n === 1 || n % 5 === 0 ? n : ''}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </details>

      <details className="fm-block">
        <summary>Проекты и задачи месяца</summary>
        {data.totalSeconds === 0 ? <p className="fm-empty">Список появится после первой сессии фокуса.</p> : (
          <>
            <h4>Проекты</h4>
            <Rows rows={data.projects} />
            <h4>Задачи, на которые ушло больше всего времени</h4>
            <Rows rows={data.tasks.slice(0, 10)} onOpen={onOpenTask} canOpen={taskExists} />
          </>
        )}
      </details>
    </section>
  );
}
