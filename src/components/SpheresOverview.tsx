import { MAX_SPHERE_LEVEL } from '../sphereProgress';
import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GameState, Quest } from "../game";
import { sphereMetrics, demoSphereRecommendation } from "../sphereAnalytics";
import type { SphereRecommendation } from "../sphereAnalytics";
import { SphereBuilding } from "./SphereCity";
import { SphereCards, SphereWeekPanels } from "./SphereHub";
import GameArt from "./GameArt";
import Icon from "./Icon";
import "./SpheresOverview.css";
const number = (value: number) => value.toFixed(1);
function Meter({
  value,
  color,
  label,
  max = MAX_SPHERE_LEVEL,
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
function Radar({ state, onQuick }: { state: GameState; onQuick: (id: string) => void }) {
  const rows = sphereMetrics(state).rows;
  const fillId = useId().replace(/:/g, "");
  const point = (index: number, score: number) => {
    const angle = (index * 2 * Math.PI) / rows.length - Math.PI / 2;
    return `${220 + (Math.cos(angle) * 110 * score) / MAX_SPHERE_LEVEL},${180 + (Math.sin(angle) * 110 * score) / MAX_SPHERE_LEVEL}`;
  };
  return (
    <div className="sphere-radar">
      <svg
        viewBox="0 0 440 360"
        role="img"
        aria-label={`Баланс сфер жизни, шкала от 0 до ${MAX_SPHERE_LEVEL}. ${rows.map((r) => `${r.name}: ${number(r.level)}`).join("; ")}`}
      >
        <title>Уровни сфер от 0 до {MAX_SPHERE_LEVEL}</title>
        <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2cc5ff" stopOpacity=".8"/><stop offset="100%" stopColor="#008cff" stopOpacity=".65"/></linearGradient></defs>
        {[MAX_SPHERE_LEVEL / 4, MAX_SPHERE_LEVEL / 2, (MAX_SPHERE_LEVEL * 3) / 4, MAX_SPHERE_LEVEL]
          .map((value) => (
            <polygon
              key={value}
              className={value === MAX_SPHERE_LEVEL ? "radar-web radar-web-outer" : "radar-web"}
              points={rows.map((_, i) => point(i, value)).join(" ")}
              fill={value === MAX_SPHERE_LEVEL ? "#f5fbff" : "none"}
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
            x2={point(i, MAX_SPHERE_LEVEL).split(",")[0]}
            y2={point(i, MAX_SPHERE_LEVEL).split(",")[1]}
            className="radar-axis"
            stroke="#d4eafd"
          />
        ))}
        <polygon
          className="radar-value"
          points={rows.map((row, i) => point(i, row.level)).join(" ")}
          fill={`url(#${fillId})`}
          stroke="#1697ff"
          strokeWidth="2"
        />
        {rows.map((r, i) => (
          <circle
            key={r.id}
            cx={point(i, r.level).split(",")[0]}
            cy={point(i, r.level).split(",")[1]}
            r="3"
            className="radar-dot"
            fill="white"
            stroke="#1697ff"
          />
        ))}
        {[0, MAX_SPHERE_LEVEL / 4, MAX_SPHERE_LEVEL / 2, (MAX_SPHERE_LEVEL * 3) / 4, MAX_SPHERE_LEVEL].map((value) => (
          <text
            key={value}
            x="225"
            y={180 - (value / MAX_SPHERE_LEVEL) * 110 - 4}
            fontSize="9"
            className="radar-tick"
            fill="#577a96"
          >
            {value}
          </text>
        ))}
      </svg>
      {rows.map((r, i) => {
        const angle = (i * 2 * Math.PI) / rows.length - Math.PI / 2;
        return (
          <button
            type="button"
            key={r.id}
            className="radar-label"
            onClick={() => onQuick(r.id)}
            aria-label={`${r.name}: LVL ${r.level}. Открыть окно сферы`}
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
              <small>LVL {r.level} / {MAX_SPHERE_LEVEL}</small>
            </div>
          </button>
        );
      })}
    </div>
  );
}
export default function SpheresOverview({
  state,
  onSelect,
  onQuick,
  onQuest,
  onQuests,
  renderQuest,
  onAddRecommendation,
  recommendation,
}: {
  state: GameState;
  onSelect: (id: string) => void;
  onQuick: (id: string) => void;
  onQuest: (id: string) => void;
  onQuests: () => void;
  renderQuest: (quest: Quest) => ReactNode;
  onAddRecommendation: (idea: SphereRecommendation) => void;
  recommendation?: SphereRecommendation;
}) {
  const metrics = sphereMetrics(state);
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
            LVL {number(metrics.average)} <small>/ {MAX_SPHERE_LEVEL}</small>
          </strong>
          <Meter value={metrics.average} max={MAX_SPHERE_LEVEL} label="Средний уровень активных сфер" />
          <p>
            {metrics.average === 0
              ? "Это начало твоей игры. Выбери первую задачу и заработай XP."
              : metrics.gap <= 2 && metrics.average >= 5
                ? "Ты развиваешься гармонично. Продолжай двигаться вперёд!"
                : "Каждый небольшой шаг укрепляет твой баланс. Удели внимание сферам, которым нужна поддержка."}
          </p>
          <SphereBuilding id={metrics.strongest.id} />
        </article>
        <article className="panel sphere-balance-panel">
          <h2>Баланс сфер жизни</h2>
          <div className="radar-legend">
            <span><i />Текущий уровень</span><span><i />Максимум шкалы: {MAX_SPHERE_LEVEL}</span>
          </div>
          <div className="radar-and-insights">
            <Radar state={state} onQuick={onQuick} />
            <div className="balance-insights">
              <div className="insight-strong"><i className="insight-symbol" aria-hidden="true">↗</i><span className="insight-bars" aria-hidden="true"><i/><i/><i/></span>
                <small>
                  {metrics.equal ? "Сферы на одном уровне" : "Сильная сторона"}
                </small>
                <strong>
                  {metrics.equal ? "Равный баланс" : metrics.strongest.name}
                </strong>
                <b>
                  LVL {metrics.strongest.level} <small>/ {MAX_SPHERE_LEVEL}</small>
                </b>
              </div>
              <div className="insight-weak"><i className="insight-symbol" aria-hidden="true">↓</i><span className="insight-sphere-art" aria-hidden="true"><GameArt kind={metrics.weakest.id}/></span>
                <small>
                  {metrics.equal ? "Первый фокус" : "Требует внимания"}
                </small>
                <strong>{metrics.weakest.name}</strong>
                <b>
                  LVL {metrics.weakest.level} <small>/ {MAX_SPHERE_LEVEL}</small>
                </b>
              </div>
              <div className="insight-gap"><i className="insight-symbol" aria-hidden="true">⚖</i><span className="insight-bars" aria-hidden="true"><i/><i/><i/></span>
                <small>Разрыв сфер</small>
                <b>{metrics.gap} уровней</b>
                <span>Между максимальным и минимальным уровнем активных сфер</span>
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
                  До среднего уровня активных сфер (LVL {number(metrics.average)} / {MAX_SPHERE_LEVEL}) не хватает <strong>+{number(metrics.deficit)} уровней</strong>.
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
      <SphereCards state={state} onOpen={onSelect} onQuick={onQuick} onQuest={onQuest} />
      <SphereWeekPanels state={state} renderQuest={renderQuest} onQuests={onQuests} />
    </div>
  );
}
