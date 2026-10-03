import type { GameState } from "../types";
import { achievementDefinitions } from "../data/demo";
import { level } from "../engine/game";
export function Achievements({ state }: { state: GameState }) {
  return (
    <>
      <p className="eyebrow">КАЖДЫЙ ШАГ ИМЕЕТ ЗНАЧЕНИЕ</p>
      <h1>Достижения</h1>
      <div className="goals-grid">
        {achievementDefinitions.map((a) => {
          const open = state.achievements.includes(a.id);
          return (
            <div
              className={`card achievement ${open ? "unlocked" : "locked"}`}
              key={a.id}
            >
              <span className="achievement-icon">{a.icon}</span>
              <span className="level-pill">
                {open ? "✓ Открыто" : "🔒 Заблокировано"}
              </span>
              <h2>{a.title}</h2>
              <p className="muted">{a.description}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
export function SkillTree({ state }: { state: GameState }) {
  return (
    <>
      <p className="eyebrow">РАЗВИВАЙ СВОИ СУПЕРСИЛЫ</p>
      <h1>Дерево навыков</h1>
      <p className="muted">
        Узлы открываются на 1, 3 и 5 уровнях сферы. Это первая визуальная версия
        дерева.
      </p>
      <div className="tree-root">
        🧑‍🚀<span>Твой персонаж</span>
      </div>
      <div className="tree-grid">
        {state.spheres.map((s) => (
          <div className="card tree-branch" key={s.id}>
            <h2>
              {s.icon} {s.name}
            </h2>
            <span className="level-pill">LEVEL {level(s.xp)}</span>
            {["Первый шаг", "Устойчивая привычка", "Личный мастер"].map(
              (name, i) => (
                <div
                  className={`tree-node ${level(s.xp) >= i * 2 + 1 ? "open" : ""}`}
                  key={name}
                >
                  <span>{level(s.xp) >= i * 2 + 1 ? "✓" : "🔒"}</span>
                  <div>
                    <strong>{name}</strong>
                    <small>Уровень {i * 2 + 1}</small>
                  </div>
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </>
  );
}
