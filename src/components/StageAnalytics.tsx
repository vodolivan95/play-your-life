import PlanFactChart from "./PlanFactChart";
import { useState } from "react";
import type { GameState, Goal, GoalStage, Quest } from "../game";
import {
  stageSeries,
  stageForecast,
  taskProgress,
  timeline,
} from "../goalSystem";
export function ProgressRing({ tasks }: { tasks: Quest[] }) {
  const p = taskProgress(tasks);
  return (
    <div className="stage-ring">
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Выполнено ${Math.round(p.percent)} процентов`}
      >
        <circle
          cx="60"
          cy="60"
          r="49"
          fill="none"
          stroke="#e0edf7"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r="49"
          fill="none"
          stroke="#159ceb"
          strokeWidth="10"
          strokeDasharray={`${p.percent * 3.079} 307.9`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <b>{Math.round(p.percent)}%</b>
      <span>
        {p.done} из {p.total} обязательных задач
      </span>
    </div>
  );
}
export function StageTimeline({
  stage,
  tasks,
}: {
  stage: GoalStage;
  tasks: Quest[];
}) {
  const t = timeline(stage),
    p = taskProgress(tasks),
    diff = t.percent === undefined ? undefined : p.percent - t.percent;
  return (
    <section className="panel">
      <h3>Временная шкала этапа</h3>
      <div className="timeline-dates">
        <span>{t.start ?? "Начало не задано"}</span>
        <strong>Сегодня: {t.today}</strong>
        <span>{t.end ?? "Без даты окончания"}</span>
      </div>
      <div className="progress">
        <span style={{ width: `${t.percent ?? 0}%` }} />
      </div>
      <p>
        Прошло {t.elapsed} дн. ·{" "}
        {t.remaining === undefined
          ? "Без срока"
          : `Осталось ${t.remaining} дн.`}
        {t.late > 0 && ` · Просрочка ${t.late} дн.`}
      </p>
      <p>
        План:{" "}
        {t.percent === undefined ? "не задан" : Math.round(t.percent) + "%"} ·
        Факт: {Math.round(p.percent)}%
      </p>
      {diff !== undefined && (
        <p>
          {diff < 0
            ? "Отставание от равномерного плана"
            : "Опережение равномерного плана"}
          : {Math.abs(diff).toFixed(1)} процентных пунктов
        </p>
      )}
    </section>
  );
}
export default function StageAnalytics({
  state,
  goal,
  stage,
  tasks,
  onTask,
}: {
  state: GameState;
  goal: Goal;
  stage: GoalStage;
  tasks: Quest[];
  onTask: (id: string) => void;
}) {
  const [group, setGroup] = useState<"day" | "week" | "month">("day"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const rows = stageSeries(state, goal, stage, group, from, to),
    t = timeline(stage);
  const [metric, setMetric] = useState<"count" | "xp" | "coins">("count");
  const max = Math.max(1, ...rows.map((r) => Math.abs(r[metric])));
  const forecast = stageForecast(state, goal, stage);
  const [selectedBar, setSelectedBar] = useState<string>();
  return (
    <section className="stage-analytics">
      <div className="stage-filters">
        <label>
          Группировка
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as typeof group)}
          >
            <option value="day">По дням</option>
            <option value="week">По неделям</option>
            <option value="month">По месяцам</option>
          </select>
        </label>
        <label>
          С
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          По
          <input
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Показатель
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            <option value="count">Задачи</option>
            <option value="xp">XP</option>
            <option value="coins">Life Coins</option>
          </select>
        </label>
      </div>
      <div className="stage-two-columns">
        <section className="panel">
          <ProgressRing tasks={tasks} />
          <p>
            Просроченных:{" "}
            {
              tasks.filter(
                (q) => !q.done && q.dueAt && new Date(q.dueAt) < new Date(),
              ).length
            }
          </p>
          <p>
            Получено: {rows.reduce((n, r) => n + r.xp, 0)} XP ·{" "}
            {rows.reduce((n, r) => n + r.coins, 0)} Life Coins
          </p>
          <p>
            {forecast
              ? `Прогноз: ${forecast.date} (около ${forecast.days} дн.)${t.end ? (forecast.date > t.end ? " — позже срока" : " — к сроку") : ""}`
              : "Недостаточно данных для прогноза"}
          </p>
        </section>
        <StageTimeline stage={stage} tasks={tasks} />
      </div>
      <PlanFactChart state={state} goal={goal} stage={stage} />
      <section className="panel">
        <h3>Фактическая история выполнения</h3>
        {!rows.length ? (
          <p>Пока недостаточно данных для построения графика.</p>
        ) : (
          <>
            <svg
              className="stage-chart"
              viewBox={`0 0 ${Math.max(600, rows.length * 45)} 200`}
              role="img"
              aria-label="График реальных событий"
            >
              {rows.map((r, i) => (
                <g key={r.date}>
                  <rect
                    tabIndex={0}
                    onClick={() => setSelectedBar(r.date)}
                    onFocus={() => setSelectedBar(r.date)}
                    x={i * 45 + 10}
                    y={160 - (Math.abs(r[metric]) / max) * 130}
                    width="25"
                    height={(Math.abs(r[metric]) / max) * 130}
                    fill={r[metric] < 0 ? "#ed718a" : "#159ceb"}
                  >
                    <title>
                      {r.date}: {r[metric]}
                    </title>
                  </rect>
                  <text
                    x={i * 45 + 22}
                    y="185"
                    textAnchor="middle"
                    fontSize="10"
                  >
                    {r.date.slice(5)}
                  </text>
                </g>
              ))}
            </svg>
            {selectedBar && (
              <p aria-live="polite">
                {selectedBar}:{" "}
                {rows.find((r) => r.date === selectedBar)?.[metric]}{" "}
                {metric === "xp"
                  ? "XP"
                  : metric === "coins"
                    ? "Life Coins"
                    : "задач"}
              </p>
            )}
            <table>
              <thead>
                <tr>
                  <th>Период</th>
                  <th>Задачи</th>
                  <th>XP</th>
                  <th>Монеты</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{r.count}</td>
                    <td>{r.xp}</td>
                    <td>{r.coins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
      <section className="panel">
        <h3>Задачи и точные даты</h3>
        {tasks
          .filter((q) => q.completedAt)
          .map((q) => (
            <button key={q.id} onClick={() => onTask(q.id)}>
              {q.name} · {new Date(q.completedAt!).toLocaleString("ru-RU")}
            </button>
          ))}
      </section>
    </section>
  );
}
