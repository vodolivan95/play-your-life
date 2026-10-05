import { MAX_SPHERE_LEVEL, sphereProgress } from '../sphereProgress';
import { sphereMetrics } from '../sphereAnalytics';
import { achievements, playerProgress, spheres } from '../game';
import type { GameState } from '../game';

export default function LifeScoreChart({ state }: { state: GameState }) {
  const point = (i: number, score: number, radius = 115) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / spheres.length;
    return [
      180 + (Math.cos(angle) * radius * score) / MAX_SPHERE_LEVEL,
      170 + (Math.sin(angle) * radius * score) / MAX_SPHERE_LEVEL,
    ];
  };
  const polygon = (scores: number[]) =>
    scores.map((v, i) => point(i, v).join(',')).join(' ');
  const average = sphereMetrics(state).average;
  const level = playerProgress(state);
  return (
    <>
      <section className="panel life-score-chart">
        <div className="score-chart-heading">
          <h2>Уровни сфер</h2>
          <span>
            Средний LVL {average.toLocaleString('ru', { maximumFractionDigits: 1 })}{' '}
            / {MAX_SPHERE_LEVEL}
          </span>
        </div>
        <svg
          viewBox="0 0 360 345"
          role="img"
          aria-label="Текущие уровни сфер, шкала от 0 до 100"
        >
          <g fill="none" stroke="#e5ebf5" strokeWidth="1.5">
            {[25, 50, MAX_SPHERE_LEVEL].map((v) => (
              <polygon key={v} points={polygon(spheres.map(() => v))} />
            ))}
            {spheres.map((s, i) => (
              <line
                key={s.id}
                x1="180"
                y1="170"
                x2={point(i, MAX_SPHERE_LEVEL)[0]}
                y2={point(i, MAX_SPHERE_LEVEL)[1]}
              />
            ))}
          </g>

          <polygon
            points={polygon(spheres.map((s) => sphereProgress(state.spheres[s.id].xp).level))}
            fill="#275cf52a"
            stroke="#275cf5"
            strokeWidth="3"
          />
          {spheres.map((s, i) => {
            const p = point(i, sphereProgress(state.spheres[s.id].xp).level);
            const label = point(i, MAX_SPHERE_LEVEL, 146);
            return (
              <g key={s.id}>
                <circle
                  cx={p[0]}
                  cy={p[1]}
                  r="5"
                  fill="white"
                  stroke={s.color}
                  strokeWidth="3"
                />
                <text
                  x={label[0]}
                  y={label[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="23"
                >
                  {s.icon}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="muted">Уровни растут за накопленный XP каждой сферы.</p>
        <details>
          <summary>Уровни и XP по сферам</summary>
          <div className="score-values">
            {spheres.map((s) => (
              <p key={s.id}>
                <span>
                  {s.icon} {s.name}
                </span>
                <strong>LVL {sphereProgress(state.spheres[s.id].xp).level} / {MAX_SPHERE_LEVEL}</strong>
                <small>{sphereProgress(state.spheres[s.id].xp).maxed ? "Максимальный уровень" : `${sphereProgress(state.spheres[s.id].xp).currentXP} / ${sphereProgress(state.spheres[s.id].xp).requiredXP} XP`}</small>
              </p>
            ))}
          </div>
        </details>
      </section>
      <section className="panel overall-progress">
        <span className="overall-level">{level.level}</span>
        <div>
          <h2>{level.title}</h2>
          <p>
            Всего {state.xp.toLocaleString('ru')} XP · {state.completed} квестов
            · {achievements.filter((a) => a.unlocked(state)).length} достижений
          </p>
        </div>
      </section>
    </>
  );
}
