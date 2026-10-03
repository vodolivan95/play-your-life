import { useState } from 'react';
import { dateKey, spheres, streak } from '../game';
import type { GameState } from '../game';

export default function Statistics({
  state,
  compact = false,
  onMonthly,
}: {
  state: GameState;
  compact?: boolean;
  onMonthly?: () => void;
}) {
  const [period, setPeriod] = useState('week');
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'year') start.setMonth(0, 1);
  else if (period === 'month') start.setDate(1);
  else start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  if (period === 'year') end.setFullYear(end.getFullYear() + 1);
  else if (period === 'month') end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + 7);
  const events = state.events.filter(
    (e) =>
      new Date(e.date) >= start &&
      new Date(e.date) < end &&
      new Date(e.date) <= now,
  );
  const buckets = Array.from(
    {
      length:
        period === 'year'
          ? 12
          : period === 'month'
            ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
            : 7,
    },
    (_, i) => {
      const date = new Date(start);
      if (period === 'year') date.setMonth(i);
      else date.setDate(date.getDate() + i);
      const xp = events
        .filter((e) =>
          period === 'year'
            ? new Date(e.date).getMonth() === i
            : dateKey(new Date(e.date)) === dateKey(date),
        )
        .reduce((sum, e) => sum + e.xp, 0);
      return {
        xp,
        label:
          period === 'week'
            ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]
            : period === 'year'
              ? date.toLocaleDateString('ru', { month: 'short' })
              : `${i + 1}`,
      };
    },
  );
  const max = Math.max(1, ...buckets.map((b) => b.xp));
  const total = events.reduce((sum, e) => sum + e.xp, 0);
  return (
    <div className={`statistics-view ${compact ? 'compact-statistics' : ''}`}>
      <div className="page-toolbar">
        <div className="tabs">
          {[
            ['week', 'Неделя'],
            ['month', 'Месяц'],
            ['year', 'Год'],
          ].map(([id, name]) => (
            <button
              key={id}
              className={period === id ? 'selected' : ''}
              onClick={() => setPeriod(id)}
            >
              {name}
            </button>
          ))}
        </div>
        {onMonthly && (
          <button className="text-button" onClick={onMonthly}>
            Итоги месяца →
          </button>
        )}
      </div>
      <section className="panel xp-chart-card">
        <small className="muted">
          {compact ? 'Прогресс недели' : 'Общий XP за период'}
        </small>
        <h2>
          +{total} <small>XP</small>
        </h2>
        <div className="xp-chart" aria-label="XP за выбранный период">
          {buckets.map((b, i) => (
            <div key={i} className="xp-bar-column">
              <span
                className={`xp-bar ${b.xp ? '' : 'zero'}`}
                style={{
                  height: `${b.xp ? Math.max(8, (b.xp / max) * 100) : 3}%`,
                }}
                title={`${b.label}: ${b.xp} XP`}
              />
              <small>{b.label}</small>
              <span className="sr-only">{b.xp} XP</span>
            </div>
          ))}
        </div>
        {!total && (
          <p className="chart-empty">
            Выполни квест — здесь появится твой прогресс.
          </p>
        )}
      </section>
      {!compact && (
        <>
          <div className="statistics-summary">
            <section className="panel">
              <small>Выполнено квестов</small>
              <h2>
                {events.filter((e) => e.kind === 'quest').length} <span>✓</span>
              </h2>
            </section>
            <section className="panel">
              <small>Текущая серия</small>
              <h2>
                🔥 {streak(state.activeDates)} <small>дней</small>
              </h2>
            </section>
          </div>
          <section className="panel sphere-development">
            <h2>Развитие сфер</h2>
            {spheres.map((s) => {
              const xp = events
                .filter((e) => e.sphere === s.id)
                .reduce((sum, e) => sum + e.xp, 0);
              return (
                <div className="development-row" key={s.id}>
                  <span>{s.icon}</span>
                  <strong>{s.name}</strong>
                  <div className="progress">
                    <span
                      style={{ width: `${total ? (xp / total) * 100 : 0}%` }}
                    />
                  </div>
                  <small>+{xp} XP</small>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
