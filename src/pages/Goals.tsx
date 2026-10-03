import type { GameState, SphereId } from "../types";
import { dispatch } from "../state/store";
import { Progress } from "../components/ui";
import { dateLabel } from "../utils/date";
export function Goals({ state }: { state: GameState }) {
  return (
    <>
      <p className="eyebrow">ТВОИ СЛЕДУЮЩИЕ ВЕРШИНЫ</p>
      <h1>Цели</h1>
      <p className="muted">Большой результат начинается с понятной цели.</p>
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          dispatch({
            type: "addGoal",
            goal: {
              id: crypto.randomUUID(),
              title: String(d.get("title")).trim(),
              sphere: String(d.get("sphere")) as SphereId,
              current: 0,
              target: Number(d.get("target")),
              reward: Number(d.get("reward")),
              rewarded: false,
              createdAt: new Date().toISOString(),
            },
          });
          e.currentTarget.reset();
        }}
      >
        <h2>Новая цель</h2>
        <label>
          Название
          <input
            name="title"
            required
            maxLength={100}
            placeholder="Например: прочитать 12 книг"
          />
        </label>
        <div className="form-grid">
          <label>
            Сфера
            <select name="sphere">
              {state.spheres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Целевое значение
            <input
              name="target"
              type="number"
              min="1"
              max="1000000"
              required
              defaultValue="100"
            />
          </label>
          <label>
            Награда XP
            <input
              name="reward"
              type="number"
              min="100"
              max="500"
              step="50"
              defaultValue="200"
              required
            />
          </label>
        </div>
        <button className="primary">＋ Создать цель</button>
      </form>
      <div className="goals-grid">
        {state.goals.map((g) => {
          const s = state.spheres.find((s) => s.id === g.sphere)!;
          return (
            <article className="card goal-card" key={g.id}>
              <div className="section-head">
                <span className={`icon-tile ${s.id}`}>{s.icon}</span>
                <span className="level-pill">
                  {g.current >= g.target ? "✓ Завершена" : "В процессе"}
                </span>
              </div>
              <h2>{g.title}</h2>
              <p className="muted">
                {s.name} · {dateLabel(g.createdAt)}
              </p>
              <div className="goal-numbers">
                <span>
                  {g.current} / {g.target}
                </span>
                <b>{Math.round((g.current / g.target) * 100)}%</b>
              </div>
              <Progress value={(g.current / g.target) * 100} />
              <label className="goal-range">
                Обновить прогресс
                <input
                  aria-label={`Прогресс: ${g.title}`}
                  type="range"
                  min="0"
                  max={g.target}
                  value={g.current}
                  onChange={(e) =>
                    dispatch({
                      type: "goalProgress",
                      id: g.id,
                      current: Number(e.target.value),
                    })
                  }
                />
              </label>
              <span className="xp-tag">
                {g.rewarded ? "Награда получена" : "Награда"} · +{g.reward} XP
              </span>
            </article>
          );
        })}
      </div>
    </>
  );
}
