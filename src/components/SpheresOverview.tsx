import { useState, useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GameState } from "../game";
import {
  sphereMetrics,
  filteredSpheres,
  demoSphereRecommendation,
  sphereCount,
} from "../sphereAnalytics";
import type { SphereFilter, SphereRecommendation } from "../sphereAnalytics";
import { SphereBuilding, SphereDistricts } from "./SphereCity";
import GameArt from "./GameArt";
import Icon from "./Icon";
import "./SpheresOverview.css";
const number = (value: number) => value.toFixed(1);
function Meter({
  value,
  color,
  label,
  max = 9,
}: {
  value: number;
  color?: string;
  label: string;
  max?: number;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: `${(value / max) * 100}%`, background: color }} />
    </div>
  );
}
function Radar({ state }: { state: GameState }) {
  const rows = sphereMetrics(state).rows;
  const fillId = useId().replace(/:/g, "");
  const point = (index: number, score: number) => {
    const angle = (index * 2 * Math.PI) / rows.length - Math.PI / 2;
    return `${220 + (Math.cos(angle) * 110 * score) / 9},${180 + (Math.sin(angle) * 110 * score) / 9}`;
  };
  return (
    <div className="sphere-radar">
      <svg
        viewBox="0 0 440 360"
        role="img"
        aria-label={`Баланс сфер жизни, шкала от 0 до 9. ${rows.map((r) => `${r.name}: ${number(r.score)}`).join("; ")}`}
      >
        <title>Life Score всех сфер, от 0 до 9</title>
        <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2cc5ff" stopOpacity=".8"/><stop offset="100%" stopColor="#008cff" stopOpacity=".65"/></linearGradient></defs>
        {[3, 6, 9]
          .map((value) => (
            <polygon
              key={value}
              points={rows.map((_, i) => point(i, value)).join(" ")}
              fill={value === 9 ? "#f5fbff" : "none"}
              stroke="#d4eafd"
              style={{ paintOrder: "fill stroke" }}
            />
          ))
          .reverse()}
        {rows.map((r, i) => (
          <line
            key={r.id}
            x1="220"
            y1="180"
            x2={point(i, 9).split(",")[0]}
            y2={point(i, 9).split(",")[1]}
            stroke="#d4eafd"
          />
        ))}
        <polygon
          className="radar-value"
          points={rows.map((row, i) => point(i, row.score)).join(" ")}
          fill={`url(#${fillId})`}
          stroke="#1697ff"
          strokeWidth="2"
        />
        {rows.map((r, i) => (
          <circle
            key={r.id}
            cx={point(i, r.score).split(",")[0]}
            cy={point(i, r.score).split(",")[1]}
            r="3"
            fill="white"
            stroke="#1697ff"
          />
        ))}
        {[0, 3, 6, 9].map((value) => (
          <text
            key={value}
            x="225"
            y={180 - (value / 9) * 110 - 4}
            fontSize="9"
            fill="#577a96"
          >
            {value}
          </text>
        ))}
      </svg>
      {rows.map((r, i) => {
        const angle = (i * 2 * Math.PI) / rows.length - Math.PI / 2;
        return (
          <div
            key={r.id}
            className="radar-label"
            style={
              {
                left: `${50 + Math.cos(angle) * 37}%`,
                top: `${50 + Math.sin(angle) * 40}%`,
                "--sphere-color": r.color,
              } as CSSProperties
            }
          >
            <span>
              <GameArt kind={r.id} />
            </span>
            <div>
              <strong>{r.name}</strong>
              <small>{number(r.score)} / 9</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default function SpheresOverview({
  state,
  onSelect,
  renderCard,
  onAddRecommendation,
  recommendation,
}: {
  state: GameState;
  onSelect: (id: string) => void;
  renderCard: (id: string) => ReactNode;
  onAddRecommendation: (idea: SphereRecommendation) => void;
  recommendation?: SphereRecommendation;
}) {
  const [filter, setFilter] = useState<SphereFilter>("all");
  const [view, setView] = useState<"cards" | "list" | "analytics">("cards");
  const metrics = sphereMetrics(state),
    rows = filteredSpheres(state, filter);
  const idea =
    recommendation?.sphereId === metrics.weakest.id
      ? recommendation
      : demoSphereRecommendation(metrics.weakest.id);
  const added = state.goals.some(
    (g) =>
      g.sphere === idea.sphereId &&
      g.name === idea.title &&
      g.current < g.target,
  );
  return (
    <div className="spheres-overview">
      <p className="spheres-intro">
        Развивай все важные области своей жизни. Баланс — ключ к лучшей версии
        себя.
      </p>
      <section className="spheres-summary" aria-label="Аналитика сфер жизни">
        <article className="panel life-balance-panel">
          <div className="eyebrow">✦ Твой баланс жизни</div>
          <strong className="life-balance-value">
            {number(metrics.balance100)} <small>/ 100</small>
          </strong>
          <Meter value={metrics.balance100} max={100} label="Общий баланс жизни" />
          <p>
            {metrics.average === 0
              ? "Это начало твоей игры. Оцени сферы и выбери первый шаг."
              : metrics.gap <= 2 && metrics.average >= 5
                ? "Ты развиваешься гармонично. Продолжай двигаться вперёд!"
                : "Каждый небольшой шаг укрепляет твой баланс. Удели внимание сферам, которым нужна поддержка."}
          </p>
          <SphereBuilding id={metrics.strongest.id} />
        </article>
        <article className="panel sphere-balance-panel">
          <h2>Баланс сфер жизни</h2>
          <div className="radar-legend">
            <span><i />Текущий уровень</span><span><i />Максимум шкалы: 9</span>
          </div>
          <div className="radar-and-insights">
            <Radar state={state} />
            <div className="balance-insights">
              <div className="insight-strong"><i className="insight-symbol" aria-hidden="true">↗</i><span className="insight-bars" aria-hidden="true"><i/><i/><i/></span>
                <small>
                  {metrics.equal ? "Сферы на одном уровне" : "Сильная сторона"}
                </small>
                <strong>
                  {metrics.equal ? "Равный баланс" : metrics.strongest.name}
                </strong>
                <b>
                  {number(metrics.strongest.score)} <small>/ 9</small>
                </b>
              </div>
              <div className="insight-weak"><i className="insight-symbol" aria-hidden="true">↓</i><span className="insight-sphere-art" aria-hidden="true"><GameArt kind={metrics.weakest.id}/></span>
                <small>
                  {metrics.equal ? "Первый фокус" : "Требует внимания"}
                </small>
                <strong>{metrics.weakest.name}</strong>
                <b>
                  {number(metrics.weakest.score)} <small>/ 9</small>
                </b>
              </div>
              <div className="insight-gap"><i className="insight-symbol" aria-hidden="true">⚖</i><span className="insight-bars" aria-hidden="true"><i/><i/><i/></span>
                <small>Разрыв сфер</small>
                <b>{number(metrics.gap)}</b>
                <span>Между максимальной и минимальной оценкой</span>
              </div>
            </div>
          </div>
        </article>
        <article className="panel sphere-focus-panel">
          <div className="focus-heading"><div className="eyebrow">✦ Фокус развития</div><small className="focus-badge">{idea.source === "ai" ? "AI-рекомендация" : "Идея проекта"}</small></div>
          <div className="focus-copy">
            <p>
              {metrics.equal ? (
                <>
                  Все сферы на одном уровне. Можно начать со сферы{" "}
                  <b>{metrics.weakest.name}</b>.
                </>
              ) : (
                <>
                  Сейчас сильнее всего отстаёт сфера{" "}
                  <b>{metrics.weakest.name}</b>.
                </>
              )}
            </p>
            <p>
              {metrics.deficit > 0 ? (
                <>
                  До среднего Life Score ({number(metrics.average)} / 9) не хватает <strong>+{number(metrics.deficit)}</strong>.
                </>
              ) : (
                "Выбери небольшой проект, чтобы сделать следующий шаг."
              )}
            </p>
            <div className="focus-art"><SphereBuilding id={metrics.weakest.id}/><span><GameArt kind={metrics.weakest.id}/></span></div>
          </div>
          <small className="recommendation-label">
            <GameArt kind="target"/> Рекомендуемый проект
          </small>
          <div className="focus-project">
            <Icon name="calendar" />
            <strong>{idea.title}</strong><Icon name="arrow" size={17}/>
          </div>
          <button
            className="primary-button"
            disabled={added}
            onClick={() => onAddRecommendation(idea)}
          >
            <Icon name={added ? "check" : "plus"} />
            {added ? "Уже в плане" : "Добавить в план"}
          </button>
        </article>
      </section>
      <section className="my-spheres" aria-label="Мои сферы">
        <div className="spheres-controls">
          <h2>Мои сферы</h2>
          <div className="tabs sphere-filters" aria-label="Фильтр сфер">
            {(
              [
                ["all", "Все сферы"],
                ["active", "Активные"],
                ["working", "В работе"],
                ["completed", "Завершённые"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "selected" : ""}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="tabs sphere-views" aria-label="Представление сфер">
            {(
              [
                ["cards", "Карточки"],
                ["list", "Список"],
                ["analytics", "Аналитика"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={view === id ? "selected" : ""}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <SphereDistricts
          state={state}
          selected={null}
          onSelect={onSelect}
          sphereIds={rows.map((r) => r.id)}
          showHeading={false}
        />
        {rows.length === 0 && (
          <p className="sphere-empty" role="status">
            {filter === "completed"
              ? "Пока нет сфер с завершёнными проектами или задачами."
              : filter === "working"
                ? "Пока нет сфер с открытыми проектами или задачами."
                : "Пока нет активных сфер. Открой «Все сферы» и выбери первый шаг."}
          </p>
        )}
      </section>
      {rows.length > 0 && (
        <section
          className={`sphere-results sphere-results-${view}`}
          aria-label={
            view === "cards"
              ? "Карточки сфер"
              : view === "list"
                ? "Список сфер"
                : "Аналитика по сферам"
          }
        >
          <h2>
            {view === "analytics" ? "Показатели сфер" : "Проекты по сферам"}
          </h2>
          {view === "cards" ? (
            <div className="sphere-grid all-spheres">
              {rows.map((row) => renderCard(row.id))}
            </div>
          ) : (
            <div className="sphere-list">
              {rows.map((row) => (
                <button
                  key={row.id}
                  className="sphere-list-row"
                  onClick={() => onSelect(row.id)}
                  style={{ "--sphere-color": row.color } as CSSProperties}
                >
                  <SphereBuilding id={row.id} />
                  <span className="list-icon">
                    <GameArt kind={row.id} />
                  </span>
                  <strong>{row.name}</strong>
                  <div className="list-score">
                    <b>{number(row.score)} / 9</b>
                    <Meter
                      value={row.score}
                      color={row.color}
                      label={`Life Score: ${row.name}`}
                    />
                  </div>
                  <span className="list-counts">
                    {sphereCount(row.projects, "projects")} ·{" "}
                    {sphereCount(row.tasks, "tasks")}
                    {view === "analytics" && (
                      <small>
                        {number(row.score - metrics.average)} к среднему ·{" "}
                        {state.spheres[row.id].xp} XP
                      </small>
                    )}
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
