import type { GameState, Quest, SphereId, Page } from "../types";
import { level, levelTitle, levelProgress } from "../engine/game";
import { streak } from "../utils/date";
import { Progress, Section, QuestRow, SphereCard } from "../components/ui";
export function Home({
  state,
  navigate,
  openSphere,
  complete,
}: {
  state: GameState;
  navigate: (p: Page) => void;
  openSphere: (s: SphereId) => void;
  complete: (q: Quest) => void;
}) {
  const main = state.goals.find((g) => !g.rewarded) ?? state.goals[0];
  const progress = levelProgress(state.xp);
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">ТВОЯ ИГРА УЖЕ НАЧАЛАСЬ</p>
          <h1>
            Привет, {state.name}! <span>✦</span>
          </h1>
          <p className="muted">Маленькие шаги. Большие перемены.</p>
        </div>
        <span className="date-chip">
          {new Date().toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
      <div className="hero-grid">
        <section className="player-card">
          <div className="player-top">
            <div className="avatar">🧑‍🚀</div>
            <div>
              <p className="eyebrow">ТВОЙ ПЕРСОНАЖ</p>
              <h2>{levelTitle(state.xp)}</h2>
              <span className="hero-level">LEVEL {level(state.xp)}</span>
            </div>
            <span className="orbit">✦</span>
          </div>
          <div className="hero-xp">
            <span>До следующего уровня</span>
            <b>
              {progress.current} / {progress.target} XP
            </b>
          </div>
          <Progress value={progress.percent} />
          <p className="hero-foot">
            Всего {state.xp.toLocaleString("ru-RU")} XP{" "}
            <span>Продолжай расти ↗</span>
          </p>
          <div className="hero-stats">
            <div>
              🪙 <b>{state.coins}</b>
              <small>Монеты</small>
            </div>
            <div>
              🔥 <b>{streak(state.activityDays)} дня</b>
              <small>Текущая серия</small>
            </div>
            <button onClick={() => navigate("achievements")}>
              🏆 <b>{state.achievements.length}</b>
              <small>Достижения</small>
            </button>
          </div>
        </section>
        <section className="main-goal">
          <p className="eyebrow">🎯 ГЛАВНАЯ ЦЕЛЬ</p>
          <div className="goal-art" aria-hidden="true">
            <span>◎</span>
            <i>✦</i>
            <b>↗</b>
          </div>
          <h2>{main?.title ?? "Выбери свою следующую вершину"}</h2>
          <p className="muted">Каждый квест приближает тебя к цели</p>
          {main && (
            <>
              <div className="goal-numbers">
                <span>Твой прогресс</span>
                <b>{Math.round((main.current / main.target) * 100)}%</b>
              </div>
              <Progress value={(main.current / main.target) * 100} />
            </>
          )}
          <button className="text-button" onClick={() => navigate("goals")}>
            Перейти к целям <span>→</span>
          </button>
        </section>
      </div>
      <Section
        title="Квесты на сегодня"
        extra={
          <button className="text-button" onClick={() => navigate("quests")}>
            Все квесты →
          </button>
        }
      >
        <div className="card quest-list">
          {state.quests.slice(0, 4).map((q) => (
            <QuestRow
              key={q.id}
              quest={q}
              sphere={state.spheres.find((s) => s.id === q.sphere)!}
              onComplete={complete}
            />
          ))}
          {!state.quests.length && (
            <p className="empty">Создай первый квест и начни новый путь.</p>
          )}
        </div>
      </Section>
      <Section
        title="Твои сферы жизни"
        extra={<span className="muted">9 веток развития</span>}
      >
        <div className="sphere-grid">
          {state.spheres.map((s) => (
            <SphereCard
              key={s.id}
              sphere={s}
              onClick={() => openSphere(s.id)}
            />
          ))}
        </div>
      </Section>
      <div className="quote">
        ✦{" "}
        <span>
          Ты не обязан быть идеальным. Достаточно стать чуть лучше, чем вчера.
        </span>
      </div>
    </>
  );
}
