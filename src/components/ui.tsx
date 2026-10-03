import type { ReactNode } from "react";
import type { Quest, Sphere } from "../types";
import { level, levelProgress } from "../engine/game";
import { dispatch } from "../state/store";
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label ?? "Прогресс"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Section({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="section-head">
        <h2>{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
export function QuestRow({
  quest,
  sphere,
  onComplete,
  removable = false,
}: {
  quest: Quest;
  sphere: Sphere;
  onComplete: (q: Quest) => void;
  removable?: boolean;
}) {
  return (
    <div className={`quest-row ${quest.completedAt ? "done" : ""}`}>
      <span className={`icon-tile ${sphere.id}`}>{sphere.icon}</span>
      <div className="quest-copy">
        <strong>{quest.title}</strong>
        <small>
          {sphere.name} <span>· {quest.difficulty}</span>
        </small>
      </div>
      <span className="xp-tag">+{quest.xp} XP</span>
      <button
        className="complete"
        disabled={!!quest.completedAt}
        aria-label={`Выполнить: ${quest.title}`}
        onClick={() => onComplete(quest)}
      >
        {quest.completedAt ? "✓" : "＋"}
      </button>
      {removable && (
        <button
          className="delete"
          aria-label={`Удалить: ${quest.title}`}
          onClick={() => dispatch({ type: "deleteQuest", id: quest.id })}
        >
          ×
        </button>
      )}
    </div>
  );
}
export function SphereCard({
  sphere,
  onClick,
}: {
  sphere: Sphere;
  onClick: () => void;
}) {
  return (
    <button className="sphere-card" onClick={onClick}>
      <div className="sphere-top">
        <span className={`icon-tile ${sphere.id}`}>{sphere.icon}</span>
        <span className="level-pill">LVL {level(sphere.xp)}</span>
      </div>
      <h3>{sphere.name}</h3>
      <div className="muted sphere-xp">
        {sphere.xp} XP <span>до уровня {level(sphere.xp) + 1}</span>
      </div>
      <Progress value={levelProgress(sphere.xp).percent} />
      <div className="sphere-bottom">
        <span>
          Life Score{" "}
          <b>
            {sphere.score}
            <small>/9</small>
          </b>
        </span>
        <span className="delta">
          {sphere.score - sphere.previous > 0 ? "+" : ""}
          {sphere.score - sphere.previous} ↗
        </span>
      </div>
    </button>
  );
}
