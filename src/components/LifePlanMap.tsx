import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import {
  MAX_KEY_SPHERES,
  buildPlanMap,
  dayDiff,
  keySphereIds,
  shiftAnchor,
  spanPlacement,
  startOfDay,
  toggleKeySphere,
} from '../lifePlanMap';
import type { PlanMapPeriod } from '../lifePlanMap';
import './LifePlanMap.css';

const periods: [PlanMapPeriod, string][] = [
  ['month', 'Месяц'],
  ['quarter', 'Квартал'],
  ['year', 'Год'],
];
const sphereIds = spheres.map((s) => s.id);
const short = (d: Date) =>
  d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export default function LifePlanMap({
  state,
  onChange,
  onGoal,
  onNotify,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  onGoal: (id: string) => void;
  onNotify: (message: string) => void;
}) {
  const [period, setPeriod] = useState<PlanMapPeriod>('month');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<'all' | 'today'>('all');
  const today = startOfDay(new Date());
  const keys = keySphereIds(state);
  const map = buildPlanMap(state, period, anchor, sphereIds, today);
  const { range } = map;
  const maxLoad = Math.max(1, ...map.load);
  const todayInRange = today >= range.start && today <= range.end;
  const todayLeft = todayInRange
    ? ((dayDiff(range.start, today) + 0.5) / (dayDiff(range.start, range.end) + 1)) * 100
    : null;
  const todayColumn = range.columns.findIndex(
    (c) => today >= c.start && today <= c.end,
  );
  const gantt = map.spans
    .filter((s) => view === 'all' || (s.from <= today && s.to >= today))
    .sort(
      (a, b) =>
        Number(keys.includes(b.sphere)) - Number(keys.includes(a.sphere)) ||
        a.from.getTime() - b.from.getTime(),
    )
    .slice(0, 14);
  const sphereOf = (id: string) => spheres.find((s) => s.id === id)!;
  const concurrent = map.spans.filter(
    (s) => s.from <= today && s.to >= today,
  ).length;
  function toggle(id: string) {
    try {
      onChange(toggleKeySphere(state, id, sphereIds));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось выбрать');
    }
  }
  const cellColumns = {
    gridTemplateColumns: `repeat(${range.columns.length}, minmax(0, 1fr))`,
  };
  const gridWidth = { minWidth: `max(100%, ${range.columns.length * 14}px)` };
  return (
    <section className="lpm" aria-label="Карта пересечений">
      <header className="lpm-head">
        <div>
          <h2>{range.title}</h2>
          <p>
            Как пересекаются этапы и задачи всех сфер. Правь их в сферах —
            здесь общая картина.
          </p>
        </div>
        <div className="lpm-controls">
          <div className="lpm-seg" role="group" aria-label="Период">
            {periods.map(([id, label]) => (
              <button
                key={id}
                className={period === id ? 'is-on' : ''}
                aria-pressed={period === id}
                onClick={() => {
                  setPeriod(id);
                  setAnchor(startOfDay(new Date()));
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="lpm-nav">
            <button
              aria-label="Предыдущий период"
              onClick={() => setAnchor(shiftAnchor(period, anchor, -1))}
            >
              ‹
            </button>
            <button
              className="lpm-today"
              onClick={() => setAnchor(startOfDay(new Date()))}
            >
              К сегодняшнему дню
            </button>
            <button
              aria-label="Следующий период"
              onClick={() => setAnchor(shiftAnchor(period, anchor, 1))}
            >
              ›
            </button>
          </div>
        </div>
      </header>

      <div className="lpm-card">
        <div className="lpm-peak">
          {map.peak ? (
            <>
              <b>Пик нагрузки</b>
              <span>
                {range.columns[map.peak.index].label} ·{' '}
                {map.peak.value} параллельно
              </span>
            </>
          ) : (
            <span>В этом периоде нет этапов и задач с датами.</span>
          )}
        </div>
        <div className="lpm-grid-scroll">
        <div className="lpm-grid" style={gridWidth}>
          <div className="lpm-row lpm-bars">
            <span className="lpm-name">Нагрузка</span>
            <div className="lpm-cells" style={cellColumns}>
              {map.load.map((value, i) => (
                <div
                  key={i}
                  className={`lpm-bar-col ${i === todayColumn ? 'is-today' : ''}`}
                  title={`${range.columns[i].label}: ${value}`}
                >
                  <i>{period === 'month' || i % 2 === 0 ? range.columns[i].label : ''}</i>
                  <span
                    className={map.peak?.index === i ? 'is-peak' : ''}
                    style={{ height: `${Math.max(value ? 8 : 2, (value / maxLoad) * 40)}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
          {spheres.map((sphere) => {
            const key = keys.includes(sphere.id);
            return (
              <div
                key={sphere.id}
                className={`lpm-row ${key ? 'is-key' : ''}`}
              >
                <span className="lpm-name">
                  <button
                    className={`lpm-star ${key ? 'is-on' : ''}`}
                    aria-pressed={key}
                    aria-label={`${key ? 'Убрать из ключевых' : 'Сделать ключевой'}: ${sphere.name}`}
                    onClick={() => toggle(sphere.id)}
                  >
                    {key ? '★' : '☆'}
                  </button>
                  <em style={{ background: sphere.color }} />
                  {sphere.name}
                </span>
                <div className="lpm-cells" style={cellColumns}>
                  {range.columns.map((col, i) => {
                    const n = map.bySphere[sphere.id]?.[i] ?? 0;
                    return (
                      <span
                        key={i}
                        className={i === todayColumn ? 'is-today' : ''}
                        style={{
                          background: n ? sphere.color : undefined,
                          opacity: n ? Math.min(1, 0.35 + n * 0.25) : undefined,
                        }}
                        title={`${sphere.name}, ${col.label}: ${n}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        <p className="lpm-hint lpm-mobile-hint">
          На телефоне проведите по шкале вбок, чтобы увидеть все дни.
        </p>
        <p className="lpm-hint">
          ★ — до {MAX_KEY_SPHERES} ключевых сфер месяца: они выделены золотом.
        </p>
      </div>

      <div className="lpm-card">
        <div className="lpm-card-head">
          <div>
            <h3>Этапы в работе</h3>
            <p>
              {concurrent
                ? `Сейчас параллельно идёт: ${concurrent}`
                : 'Сегодня ничего не идёт параллельно'}
            </p>
          </div>
          <div className="lpm-seg" role="group" aria-label="Что показывать">
            <button
              className={view === 'all' ? 'is-on' : ''}
              aria-pressed={view === 'all'}
              onClick={() => setView('all')}
            >
              Весь период
            </button>
            <button
              className={view === 'today' ? 'is-on' : ''}
              aria-pressed={view === 'today'}
              onClick={() => setView('today')}
            >
              Сегодня
            </button>
          </div>
        </div>
        <div className="lpm-gantt-scroll">
        <div className="lpm-gantt" style={gridWidth}>
          {todayLeft !== null && (
            <i className="lpm-now" style={{ left: `${todayLeft}%` }}>
              <b>{short(today)}</b>
            </i>
          )}
          {gantt.map((span) => {
            const sphere = sphereOf(span.sphere);
            const place = spanPlacement(span, range);
            const key = keys.includes(span.sphere);
            return (
              <button
                key={span.id}
                className={`lpm-span ${key ? 'is-key' : ''}`}
                disabled={!span.goalId}
                onClick={() => span.goalId && onGoal(span.goalId)}
                title={`${span.name} · ${short(span.from)} — ${short(span.to)}`}
              >
                <span
                  style={{
                    left: `${place.left}%`,
                    width: `${place.width}%`,
                    background: sphere.color,
                  }}
                >
                  {place.width > 14 ? span.name : ''}
                </span>
                {place.width <= 14 && (
                  <small
                    style={{
                      left: `${Math.min(place.left + place.width + 1, 70)}%`,
                    }}
                  >
                    {span.name}
                  </small>
                )}
              </button>
            );
          })}
          {gantt.length === 0 && (
            <p className="lpm-empty">
              {view === 'today'
                ? 'На сегодня этапов нет.'
                : 'Добавь даты этапам или целям — они появятся здесь.'}
            </p>
          )}
        </div>
        </div>
        <p className="lpm-hint lpm-mobile-hint">
          Проведите по шкале вбок, чтобы просмотреть даты этапов.
        </p>
      </div>

      <div className="lpm-two">
        <div className="lpm-card">
          <h3>Баланс по сферам</h3>
          <p className="lpm-sub">Доля этапов и задач периода</p>
          {map.balance
            .filter((b) => b.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((b) => {
              const sphere = sphereOf(b.sphere);
              return (
                <div
                  key={b.sphere}
                  className={`lpm-bal ${keys.includes(b.sphere) ? 'is-key' : ''}`}
                >
                  <span>{sphere.name}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(3, b.share * 100)}%`,
                        background: sphere.color,
                      }}
                    />
                  </div>
                  <b>{Math.round(b.share * 100)}%</b>
                </div>
              );
            })}
          {map.spans.length === 0 && <p className="lpm-empty">Пока пусто.</p>}
          {keys.length > 0 &&
            map.spans.length > 0 &&
            keys.every((id) => !map.balance.find((b) => b.sphere === id)?.count) && (
              <p className="lpm-warn">
                У ключевых сфер нет этапов в этом периоде.
              </p>
            )}
        </div>
        <div className="lpm-card">
          <h3>Свободные окна</h3>
          <p className="lpm-sub">Дни без этапов и задач, начиная с сегодня</p>
          {map.freeWindows.map((w) => (
            <div className="lpm-free" key={w.start.getTime()}>
              <b>
                {short(w.start)} — {short(w.end)}
              </b>
              <span>{w.days} дн.</span>
            </div>
          ))}
          {map.freeWindows.length === 0 && (
            <p className="lpm-empty">Свободных окон от двух дней нет.</p>
          )}
        </div>
      </div>
    </section>
  );
}
