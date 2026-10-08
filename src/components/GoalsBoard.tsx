import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { spheres, updateGoal } from "../game";
import type { GameState, Goal } from "../game";
import { durationLabel, formatDate, goalStatus } from "../planning";
import Icon from "./Icon";
import GameArt from "./GameArt";
import ProjectArt from "./ProjectArt";
import GoalWorkspace from "./GoalWorkspace";
import { coverSource } from "../goalCoverSource";
export default function GoalsBoard({
  state,
  onChange,
  selectedId,
  onSelect,
  onNew,
  onNotify,
  ownerId,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onNotify: (message: string) => void;
  ownerId?: string;
  backLabel?: string;
}) {
  const [goalFilter, setGoalFilter] = useState("active");
  const goal = state.goals.find((g) => g.id === selectedId);
  const mainGoal =
    state.goals.find((g) => g.id === state.mainGoalId) ??
    state.goals.find((g) => !g.rewarded) ??
    state.goals[0];
  const visibleGoals = state.goals.filter(
    (g) =>
      goalFilter === "all" ||
      (goalFilter === "done" ? g.current >= g.target : g.current < g.target),
  );
  const progress = (g: Goal) => Math.round((g.current / g.target) * 100);
  function main(id: string) {
    onChange((s) => ({ ...s, mainGoalId: id }));
    onNotify("Главная цель выбрана");
  }
  if (goal)
    return (
      <GoalWorkspace
        key={goal.id}
        goal={goal}
        state={state}
        onChange={onChange}
        onNotify={onNotify}
        ownerId={ownerId}
      />
    );
  if (selectedId)
    return (
      <section className="panel">
        <h2>Цель не найдена</h2>
        <button onClick={() => onSelect(null)}>Все цели</button>
      </section>
    );
  return (
    <>
      <div className="page-toolbar">
        <p className="muted">Сферы жизни → цели → этапы → задачи.</p>
        <button className="primary-button" onClick={onNew}>
          <Icon name="plus" size={17} /> Новая цель
        </button>
      </div>
      <div className="tabs goal-tabs">
        {[
          ["active", "Активные"],
          ["done", "Достигнутые"],
          ["all", "Все"],
        ].map(([id, name]) => (
          <button
            key={id}
            className={goalFilter === id ? "selected" : ""}
            onClick={() => setGoalFilter(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="goals-grid">
        {visibleGoals.map((g) => {
          const sphere = spheres.find((s) => s.id === g.sphere)!;
          return (
            <section className="panel goal-card" key={g.id}>
              <div className="goal-list-cover-frame">
                <img
                  className="goal-list-cover"
                  alt="Обложка цели"
                  src={coverSource(g)}
                  style={{
                    objectPosition: `${g.cover?.x ?? 50}% ${g.cover?.y ?? 50}%`,
                    transform: `scale(${g.cover?.scale ?? 1})`,
                  }}
                />
              </div>
              <div className="section-heading">
                <span className="sphere-icon">
                  {g.image ? (
                    <ProjectArt
                      name={g.name}
                      sphere={g.sphere}
                      image={g.image}
                    />
                  ) : (
                    <GameArt
                      kind={g.sphere === "english" ? "target" : g.sphere}
                    />
                  )}
                </span>
                <span
                  className={`mini-pill ${goalStatus(g) === "Срок прошёл" ? "overdue-pill" : ""}`}
                >
                  {goalStatus(g)}
                </span>
              </div>
              <small className="muted">
                {sphere.name} · {durationLabel(g.startsAt, g.dueAt)}
              </small>
              <h2>
                <button
                  className="goal-title-link"
                  onClick={() => onSelect(g.id)}
                >
                  {g.name}
                </button>
              </h2>

              <div className="goal-progress-label">
                <span>
                  {g.progressMode === "tasks"
                    ? `${state.quests.filter((q) => q.goalId === g.id && q.done).length} / ${state.quests.filter((q) => q.goalId === g.id).length} задач`
                    : `${g.current} / ${g.target}`}
                </span>
                <b>{progress(g)}%</b>
              </div>
              <div className="progress">
                <span style={{ width: `${progress(g)}%` }} />
              </div>
              <details className="goal-controls">
                <summary>Прогресс и сроки</summary>{" "}
                <button
                  className="text-button main-goal-button"
                  aria-pressed={mainGoal?.id === g.id}
                  onClick={() => main(g.id)}
                >
                  {mainGoal?.id === g.id
                    ? "★ Главная цель"
                    : "☆ Сделать главной"}
                </button>
                {g.progressMode !== "tasks" && (
                  <label className="goal-input">
                    Текущий прогресс
                    <input
                      type="number"
                      min="0"
                      max={g.target}
                      value={g.current}
                      onChange={(e) => {
                        const next = updateGoal(
                          state,
                          g.id,
                          Number(e.target.value),
                        );
                        onChange(next);
                        if (next.xp > state.xp)
                          onNotify(
                            `Цель достигнута! +${next.xp - state.xp} XP`,
                          );
                      }}
                    />
                  </label>
                )}
                <div className="goal-dates-summary">
                  <small>Срок: {formatDate(g.dueAt)}</small>
                  <span>
                    🏆 {g.reward} XP {g.rewarded ? "· Получены" : ""}
                  </span>
                </div>
              </details>
              <button
                className="primary-button goal-plan-button"
                onClick={() => onSelect(g.id)}
              >
                План цели
                <Icon name="arrow" size={16} />
              </button>
            </section>
          );
        })}
        {visibleGoals.length === 0 && (
          <div className="panel empty">
            <span>🎯</span>
            <h3>
              {goalFilter === "done"
                ? "Твои победы ещё впереди"
                : "Начни с того, что важно"}
            </h3>
            <p>Поставь цель, выбери срок и добавь первый реальный шаг.</p>
          </div>
        )}
      </div>
    </>
  );
}
