import { achievements, playerProgress, spheres } from '../game';
import type { GameState } from '../game';

export default function LifeScoreChart({ state }: { state: GameState }) {
  const point = (i: number, score: number, radius = 115) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / spheres.length;
    return [
      180 + (Math.cos(angle) * radius * score) / 9,
      170 + (Math.sin(angle) * radius * score) / 9,
    ];
  };
  const polygon = (scores: number[]) =>
    scores.map((v, i) => point(i, v).join(',')).join(' ');
  const average =
    spheres.reduce((sum, s) => sum + state.spheres[s.id].score, 0) /
    spheres.length;
  const level = playerProgress(state);
  return (
    <>
      <section className="panel life-score-chart">
        <div className="score-chart-heading">
          <h2>Life Score</h2>
          <span>
            Средний {average.toLocaleString('ru', { maximumFractionDigits: 1 })}{' '}
            / 9
          </span>
        </div>
        <svg
          viewBox="0 0 360 345"
          role="img"
          aria-label="Оценки сфер жизни: синяя линия — текущие, пунктир — предыдущие"
        >
          <g fill="none" stroke="#e5ebf5" strokeWidth="1.5">
            {[3, 6, 9].map((v) => (
              <polygon key={v} points={polygon(spheres.map(() => v))} />
            ))}
            {spheres.map((s, i) => (
              <line
                key={s.id}
                x1="180"
                y1="170"
                x2={point(i, 9)[0]}
                y2={point(i, 9)[1]}
              />
            ))}
          </g>
          <polygon
            points={polygon(
              spheres.map((s) => state.spheres[s.id].previousScore),
            )}
            fill="none"
            stroke="#8696b8"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <polygon
            points={polygon(spheres.map((s) => state.spheres[s.id].score))}
            fill="#275cf52a"
            stroke="#275cf5"
            strokeWidth="3"
          />
          {spheres.map((s, i) => {
            const p = point(i, state.spheres[s.id].score);
            const label = point(i, 9, 146);
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
        <p className="muted">Пунктир — предыдущая оценка</p>
        <details>
          <summary>Оценки по сферам</summary>
          <div className="score-values">
            {spheres.map((s) => (
              <p key={s.id}>
                <span>
                  {s.icon} {s.name}
                </span>
                <strong>{state.spheres[s.id].score} / 9</strong>
                <small>Ранее {state.spheres[s.id].previousScore}</small>
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
