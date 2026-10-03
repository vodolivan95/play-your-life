import type { GameState, Page } from "../types";
import { achievementDefinitions, milestones } from "../data/demo";
import { dispatch } from "../state/store";
import { level, levelTitle } from "../engine/game";
import { streak } from "../utils/date";
export function Profile({
  state,
  navigate,
}: {
  state: GameState;
  navigate: (p: Page) => void;
}) {
  const count = streak(state.activityDays);
  return (
    <>
      <p className="eyebrow">ТЫ — ГЛАВНЫЙ ГЕРОЙ</p>
      <h1>Профиль</h1>
      <div className="card profile-card">
        <div className="avatar">🧑‍🚀</div>
        <h2>{state.name}</h2>
        <p className="muted">
          {levelTitle(state.xp)} · LEVEL {level(state.xp)}
        </p>
        <form
          className="name-form"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({
              type: "name",
              name: String(new FormData(e.currentTarget).get("name")),
            });
          }}
        >
          <label>
            Имя игрока
            <input
              name="name"
              defaultValue={state.name}
              maxLength={40}
              required
            />
          </label>
          <button className="primary">Сохранить</button>
        </form>
      </div>
      <div className="profile-links">
        <button className="card" onClick={() => navigate("tree")}>
          <span>🌳</span>
          <div>
            <h2>Дерево навыков</h2>
            <p className="muted">Открой свои ветки развития</p>
          </div>
          <b>→</b>
        </button>
        <button className="card" onClick={() => navigate("achievements")}>
          <span>🏆</span>
          <div>
            <h2>Достижения</h2>
            <p className="muted">
              {state.achievements.length} из {achievementDefinitions.length}{" "}
              открыто
            </p>
          </div>
          <b>→</b>
        </button>
      </div>
      <div className="card">
        <h2>🔥 Серия активности · {count} дней</h2>
        <p className="muted">
          Выполняй хотя бы один квест каждый день. Если пропустишь день, серия
          начнётся заново.
        </p>
        <div className="streak-grid">
          {Object.entries(milestones).map(([day, xp]) => (
            <div className={count >= Number(day) ? "reached" : ""} key={day}>
              <b>{day}</b>
              <small>дней</small>
              <span>+{xp} XP</span>
            </div>
          ))}
        </div>
      </div>
      <p className="local-note">
        V0.1 · Данные сохраняются только в этом браузере.
        <br />
        Первый запуск содержит демоданные. Бонусы не умножаются.
      </p>
    </>
  );
}
