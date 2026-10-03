import type { GameState, Quest, SphereId } from "../types";
import { dispatch } from "../state/store";
import { level, levelProgress } from "../engine/game";
import { Section, Progress, QuestRow } from "../components/ui";
import { dateLabel } from "../utils/date";
const descriptions = [
  "Сфера практически отсутствует",
  "Очень низкий уровень",
  "Очень низкий уровень",
  "Требует развития",
  "Нестабильно",
  "Нормальная базовая точка",
  "Хороший уровень",
  "Стабильный хороший результат",
  "Очень высокий уровень",
  "Достигнут личный целевой стандарт",
];
export function SphereView({
  state,
  id,
  complete,
  back,
}: {
  state: GameState;
  id: SphereId;
  complete: (q: Quest) => void;
  back: () => void;
}) {
  const s = state.spheres.find((s) => s.id === id)!;
  return (
    <>
      <button className="text-button" onClick={back}>
        ← Все сферы
      </button>
      <h1>
        {s.icon} {s.name}
      </h1>
      <div className="card sphere-detail">
        <div className="section-head">
          <h2>LEVEL {level(s.xp)}</h2>
          <span className="xp-tag">{s.xp} XP</span>
        </div>
        <Progress value={levelProgress(s.xp).percent} />
        <p className="muted">
          Ещё {200 - levelProgress(s.xp).current} XP до следующего уровня
        </p>
        <div className="score-header">
          <div>
            <p className="eyebrow">LIFE SCORE</p>
            <strong>
              {s.score}
              <small> / 9</small>
            </strong>
          </div>
          <div className="muted">
            Изменение: {s.score - s.previous > 0 ? "+" : ""}
            {s.score - s.previous}
            <br />
            Коэффициент: {s.coefficient} XP
          </div>
        </div>
        <div className="score-picker">
          {Array.from({ length: 10 }, (_, score) => (
            <button
              key={score}
              className={s.score === score ? "selected" : ""}
              aria-label={`Life Score ${score}`}
              onClick={() => dispatch({ type: "score", id, score })}
            >
              {score}
            </button>
          ))}
        </div>
        <p>{descriptions[s.score]}</p>
        <p className="muted">
          Бонус за новый личный максимум. Возврат к прежней оценке не начисляет
          XP повторно. Лучший результат: {s.best}/9.
        </p>
      </div>
      <Section title="Активные цели">
        <div className="card">
          {state.goals
            .filter((g) => g.sphere === id && !g.rewarded)
            .map((g) => (
              <div className="mini-goal" key={g.id}>
                <strong>{g.title}</strong>
                <Progress value={(g.current / g.target) * 100} />
                <small>
                  {g.current} / {g.target}
                </small>
              </div>
            ))}
          {!state.goals.some((g) => g.sphere === id && !g.rewarded) && (
            <p className="muted">Активных целей пока нет.</p>
          )}
        </div>
      </Section>
      <Section title="Активные квесты">
        <div className="card quest-list">
          {state.quests
            .filter((q) => q.sphere === id && !q.completedAt)
            .map((q) => (
              <QuestRow key={q.id} quest={q} sphere={s} onComplete={complete} />
            ))}
          {!state.quests.some((q) => q.sphere === id && !q.completedAt) && (
            <p className="empty">
              Все квесты выполнены. Можно поставить новую задачу.
            </p>
          )}
        </div>
      </Section>
      <Section title="История прогресса">
        <div className="card">
          {state.events
            .filter((e) => e.sphere === id)
            .slice(0, 20)
            .map((e) => (
              <div className="history-row" key={e.id}>
                <div>
                  <strong>{e.title}</strong>
                  <small>
                    {dateLabel(e.date)} ·{" "}
                    {e.kind === "score" ? "Оценка сферы" : "Реальное действие"}
                  </small>
                </div>
                <span className="xp-tag">+{e.xp} XP</span>
              </div>
            ))}
          {!state.events.some((e) => e.sphere === id) && (
            <p className="muted">
              Здесь появятся выполненные действия и изменения Life Score.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
