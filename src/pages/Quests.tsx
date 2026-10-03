import { useState } from "react";
import type { Difficulty, GameState, Quest, SphereId } from "../types";
import { difficultyXP } from "../data/demo";
import { dispatch } from "../state/store";
import { QuestRow } from "../components/ui";
export function Quests({
  state,
  complete,
}: {
  state: GameState;
  complete: (q: Quest) => void;
}) {
  const [filter, setFilter] = useState<"active" | "done" | "all">("active");
  const [sphere, setSphere] = useState<SphereId>("english");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  return (
    <>
      <p className="eyebrow">ДЕЙСТВИЕ → ПРОГРЕСС</p>
      <h1>Твои квесты</h1>
      <p className="muted">Реальные действия приносят настоящие изменения.</p>
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          dispatch({
            type: "addQuest",
            quest: {
              id: crypto.randomUUID(),
              title: String(data.get("title")).trim(),
              sphere,
              difficulty,
              xp: difficultyXP[difficulty],
            },
          });
          e.currentTarget.reset();
        }}
      >
        <h2>Новый квест</h2>
        <label>
          Название
          <input
            name="title"
            required
            maxLength={100}
            placeholder="Что ты сделаешь для себя?"
          />
        </label>
        <div className="form-grid">
          <label>
            Сфера
            <select
              value={sphere}
              onChange={(e) => setSphere(e.target.value as SphereId)}
            >
              {state.spheres.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сложность
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {Object.entries(difficultyXP).map(([d, xp]) => (
                <option key={d} value={d}>
                  {d} · {xp} XP
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="primary">
          ＋ Добавить квест · {difficultyXP[difficulty]} XP
        </button>
      </form>
      <div className="tabs">
        {(["active", "done", "all"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {{ active: "Активные", done: "Выполненные", all: "Все" }[f]}
          </button>
        ))}
      </div>
      <div className="card quest-list">
        {state.quests
          .filter(
            (q) =>
              filter === "all" ||
              (filter === "done" ? !!q.completedAt : !q.completedAt),
          )
          .map((q) => (
            <QuestRow
              key={q.id}
              quest={q}
              sphere={state.spheres.find((s) => s.id === q.sphere)!}
              onComplete={complete}
              removable
            />
          ))}
        {!state.quests.some(
          (q) =>
            filter === "all" ||
            (filter === "done" ? !!q.completedAt : !q.completedAt),
        ) && <p className="empty">Здесь пока нет квестов.</p>}
      </div>
    </>
  );
}
