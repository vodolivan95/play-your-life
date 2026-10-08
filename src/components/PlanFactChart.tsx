import { useState } from "react";
import type { GameState, Goal, GoalStage } from "../game";
import { planFact } from "../goalSystem";
export default function PlanFactChart({
  state,
  goal,
  stage,
}: {
  state: GameState;
  goal: Goal;
  stage: GoalStage;
}) {
  const points = planFact(state, goal, stage),
    [selected, setSelected] = useState<number>();
  if (!points.length)
    return (
      <section className="panel">
        <h3>План и факт</h3>
        <p>Пока недостаточно данных для построения графика.</p>
      </section>
    );
  const x = (i: number) => 35 + (i / Math.max(1, points.length - 1)) * 520,
    y = (n: number) => 165 - n * 1.4,
    path = (key: "plan" | "actual") =>
      points
        .map((p, i) =>
          p[key] === undefined
            ? ""
            : `${i === 0 ? "M" : "L"}${x(i)} ${y(p[key]!)}`,
        )
        .join(" ");
  const point = points[selected ?? points.length - 1];
  return (
    <section className="panel">
      <h3>План и факт</h3>
      <svg
        viewBox="0 0 600 200"
        className="stage-chart"
        role="img"
        aria-label="План и фактический прогресс"
      >
        <path
          d={path("plan")}
          stroke="#ab79da"
          fill="none"
          strokeWidth="3"
          strokeDasharray="5 4"
        />
        <path d={path("actual")} stroke="#149ce5" fill="none" strokeWidth="3" />
        {points
          .filter((p) => p.actual !== undefined)
          .map((p) => {
            const i = points.indexOf(p);
            return (
              <circle
                key={p.date}
                cx={x(i)}
                cy={y(p.actual!)}
                r="5"
                fill="#149ce5"
                tabIndex={0}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
              >
                <title>
                  {p.date}: план {p.plan?.toFixed(1) ?? "не задан"}%, факт{" "}
                  {p.actual?.toFixed(1)}%
                </title>
              </circle>
            );
          })}
        <text x="35" y="190" fontSize="11">
          {points[0].date}
        </text>
        <text x="485" y="190" fontSize="11">
          {points.at(-1)!.date}
        </text>
      </svg>
      <p aria-live="polite">
        {point.date} · План:{" "}
        {point.plan === undefined ? "не задан" : point.plan.toFixed(1) + "%"} ·
        Факт:{" "}
        {point.actual === undefined
          ? "будущий период"
          : point.actual.toFixed(1) + "%"}
      </p>
      <small>
        Факт — события выполнения и отмены текущих обязательных задач. План —
        равномерная траектория при заданных сроках.
      </small>
    </section>
  );
}
