import { useState } from 'react';
import { dateKey } from '../game';
import type { GameState, Goal } from '../game';
import { dayFocus, formatFocus, projectFocus, stageFocus } from '../focusSessions';
import type { DaySeconds, NamedFocus } from '../focusSessions';
import './FocusStats.css';

type Period = '7' | '30' | 'all';
const periods: [Period, string][] = [['7', '7 дней'], ['30', '30 дней'], ['all', 'Всё время']];
const shiftDay = (day: string, amount: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + amount, 12));
};
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

function Bars({ rows, onPick, pickLabel }: { rows: NamedFocus[]; onPick?: (key: string) => void; pickLabel?: string }) {
  return (
    <ul className="fst-bars">
      {rows.map((row) => {
        const percent = Math.round(row.share * 100);
        const body = (
          <>
            <span className="fst-bar-name">{row.name}</span>
            <span className="fst-bar-value">{formatFocus(row.seconds)} · {percent}%</span>
            <span className="fst-bar-track" aria-hidden="true"><i style={{ width: `${Math.max(2, percent)}%` }} /></span>
          </>
        );
        return (
          <li key={row.key}>
            {onPick && row.key
              ? <button type="button" aria-label={`${pickLabel}: ${row.name}`} onClick={() => onPick(row.key)}>{body}</button>
              : <div>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Фокус этапа и проекта во вкладке «Статистика» (ТЗ «Этап 4.1», разделы 6–7). Все числа — из
 * записей рабочих сессий; процент выполнения этапа от времени не зависит и здесь не показывается.
 */
export default function FocusStats({ state, goal, stageId, onOpenStage }: {
  state: GameState;
  goal: Goal;
  stageId?: string;
  onOpenStage?: (stageId: string) => void;
}) {
  const [period, setPeriod] = useState<Period>('all');
  const [day, setDay] = useState<string | null>(null);
  const [today] = useState(() => dateKey());
  const stage = stageId ? stageFocus(state, goal.id, stageId, new Date(`${today}T12:00:00`)) : undefined;
  const range = period === 'all' ? {} : { from: shiftDay(today, period === '7' ? -6 : -29), to: today };
  const project = stageId ? undefined : projectFocus(state, goal.id, range);
  const totals = stage ?? project!;
  const byDay: DaySeconds[] = totals.byDay;
  // График: последние 14 дней подряд, включая дни без фокуса.
  const chartDays = Array.from({ length: 14 }, (_, i) => shiftDay(today, i - 13));
  const perDay = new Map(byDay.map((d) => [d.day, d.seconds]));
  const max = Math.max(1, ...chartDays.map((d) => perDay.get(d) ?? 0));
  const detail = day ? dayFocus(state, day, { goalId: goal.id, ...(stageId ? { stageId } : {}) }) : undefined;
  const cards: [string, string][] = stage
    ? [
        ['Общее время фокуса', formatFocus(stage.totalSeconds)],
        ['За последние 7 дней', formatFocus(stage.last7Seconds)],
        ['Рабочих сессий', String(stage.sessions)],
        ['Средняя сессия', formatFocus(stage.averageSeconds)],
        ['Активных дней', String(stage.activeDays)],
        ['Самая длинная сессия', formatFocus(stage.longestSeconds)],
        ['Больше всего времени', stage.topTask ? `${stage.topTask.name} · ${formatFocus(stage.topTask.seconds)}` : '—'],
      ]
    : [
        [period === 'all' ? 'Всего фокуса' : 'Фокус за период', formatFocus(totals.totalSeconds)],
        ['Рабочих сессий', String(totals.sessions)],
        ['Дней с фокусом', String(totals.activeDays)],
        ['Средняя сессия', formatFocus(totals.averageSeconds)],
      ];
  return (
    <section className="gw-card fst" aria-label={stageId ? 'Фокус этапа' : 'Фокус проекта'}>
      <h3>⏱ {stageId ? 'Фокус этапа' : 'Фокус проекта'}</h3>
      {!stageId && (
        <div className="fst-periods" role="group" aria-label="Период">
          {periods.map(([id, label]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}>{label}</button>)}
        </div>
      )}
      <div className="fst-cards">
        {cards.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}
      </div>
      {totals.totalSeconds === 0 ? (
        <p className="gw-muted">Сессий фокуса{period === 'all' || stageId ? '' : ' за этот период'} пока нет. Открой задачу и нажми «Начать фокус» — время появится здесь.</p>
      ) : (
        <>
          <h4>Фокус по дням · последние 14 дней</h4>
          <div className="fst-chart" role="group" aria-label="Фокус по дням">
            {chartDays.map((d) => {
              const seconds = perDay.get(d) ?? 0;
              return (
                <button key={d} type="button" aria-pressed={day === d} aria-label={`${dayLabel(d)}: ${formatFocus(seconds)}`}
                  onClick={() => setDay(day === d ? null : d)}>
                  <i style={{ height: `${seconds ? Math.max(6, Math.round((seconds / max) * 100)) : 0}%` }} />
                  <small>{Number(d.slice(8, 10))}</small>
                </button>
              );
            })}
          </div>
          {detail && (
            <div className="fst-day" role="status">
              <b>{dayLabel(detail.day)} · {formatFocus(detail.totalSeconds)} · сессий: {detail.sessions}</b>
              {detail.tasks.length === 0 ? <span>В этот день фокуса не было.</span> : <Bars rows={detail.tasks} />}
            </div>
          )}
          {project && project.byStage.length > 0 && (
            <>
              <h4>Время по этапам</h4>
              <Bars rows={project.byStage} onPick={onOpenStage} pickLabel="Открыть этап" />
            </>
          )}
          <h4>На какие задачи ушло больше всего времени</h4>
          <Bars rows={(stage ?? project!).byTask.slice(0, 8)} />
        </>
      )}
    </section>
  );
}
