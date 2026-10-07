import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { dateKey, removeQuest, spheres } from "../game";
import type { GameState, Quest } from "../game";
import {
  completeHabit,
  habitDue,
  habitDay,
  habitIcons,
  habitStreak,
  progressQuest,
  putRewardInSport,
  questCoins,
  removeHabit,
  saveCustomQuest,
  saveHabit,
  virtualRewards,
} from "../personalQuests";
import type { Habit } from "../personalQuests";
import { sphereProgress } from "../sphereProgress";
import { SphereBuilding } from "./SphereCity";
import QuestWizard from "./QuestWizard";
import { cityAssets } from "../sphereAssets";
const hero = cityAssets.preview;
import "./QuestBoard.css";

const nav = [
  "Все квесты",
  "Ежедневные (привычки)",
  "Мои квесты",
  "По сферам",
  "Основные",
  "Сложные",
  "Коллекции",
];
const recommendations = [
  {
    name: "Медитация 10 минут",
    sphere: "health",
    difficulty: "Simple",
    targetValue: 10,
    unit: "минут",
  },
  {
    name: "Изучить 5 новых слов",
    sphere: "english",
    difficulty: "Micro",
    targetValue: 5,
    unit: "слов",
  },
  {
    name: "Прочитать 20 страниц",
    sphere: "growth",
    difficulty: "Medium",
    targetValue: 20,
    unit: "страниц",
  },
];
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="pyl-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export default function QuestBoard({
  state,
  onChange,
  ownerId,
  today,
  onCreate,
  notify,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  ownerId: string;
  today: string;
  onCreate: (q?: Partial<Quest>) => void;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState(0),
    [sphere, setSphere] = useState(""),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("new"),
    [form, setForm] = useState<{
      quest?: Quest;
      habit?: Habit;
      habitMode: boolean;
    } | null>(null),
    [progress, setProgress] = useState<Quest | null>(null),
    [progressValue, setProgressValue] = useState(0),
    [celebrate, setCelebrate] = useState("");
  const own = (q: Quest) => !q.ownerId || q.ownerId === ownerId;
  const quests = state.quests.filter(own),
    habits = (state.habits ?? []).filter((h) => h.ownerId === ownerId),
    now = new Date(`${today}T12:00:00`),
    daily = habits.filter((h) => habitDue(h));
  const history = state.habitCompletions ?? [],
    doneToday = daily.filter((h) =>
      history.some(
        (c) => c.habitId === h.id && c.day === habitDay(h) && c.rewardClaimed,
      ),
    ).length;
  const completed = quests.filter((q) => q.done).length,
    total = quests.length,
    percent = total ? Math.round((completed / total) * 100) : 0;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const start = dateKey(weekStart);
  const weekly =
    quests.filter(
      (q) =>
        q.done && q.completedAt && dateKey(new Date(q.completedAt)) >= start,
    ).length +
    history.filter((c) => c.day >= start && c.day <= today && c.rewardClaimed)
      .length;
  const items = state.rewardInventory ?? [];
  function apply(action: (s: GameState) => GameState, message: string) {
    onChange(action(state));
    notify(message);
  }
  function finish(q: Quest, value: number) {
    try {
      const next = progressQuest(state, q.id, value, ownerId);
      onChange(next);
      if (!q.done && next.quests.find((i) => i.id === q.id)?.done) {
        const item = virtualRewards.find((i) => i.id === q.virtualRewardId);
        setCelebrate(
          state.completed === 0
            ? "🏆 Первый шаг! Твой первый квест выполнен!"
            : `✓ +${next.xp - state.xp} XP · +${questCoins(q)} Life Coins${item ? " · " + item.icon + " " + item.name : ""}`,
        );
      } else notify("Прогресс сохранён");
      setProgress(null);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const visible = quests
    .filter(
      (q) =>
        (!sphere || q.sphere === sphere) &&
        q.name
          .toLocaleLowerCase("ru")
          .includes(search.toLocaleLowerCase("ru")) &&
        (filter === "all" || (filter === "done" ? q.done : !q.done)) &&
        (tab !== 4 || q.priority === "high" || q.goalId) &&
        (tab !== 5 || ["Hard", "Very Hard"].includes(q.difficulty)),
    )
    .sort((a, b) =>
      sort === "reward"
        ? questCoins(b) - questCoins(a)
        : sort === "progress"
          ? (b.currentValue ?? (b.done ? 1 : 0)) / (b.targetValue ?? 1) -
            (a.currentValue ?? (a.done ? 1 : 0)) / (a.targetValue ?? 1)
          : sort === "important"
            ? Number(b.priority === "high") - Number(a.priority === "high")
            : (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
  function deleteQuest(q: Quest) {
    if (
      window.confirm(
        "Удалить квест? История и текущий прогресс этого квеста будут удалены.",
      )
    )
      apply((s) => removeQuest(s, q.id), "Квест удалён");
  }
  return (
    <div className="pyl-quest-board">
      <section
        className="pyl-quest-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,#0d3262f2,#1266a779 65%,#124d6950),url(${hero})`,
        }}
      >
        <div>
          <h1>Квесты</h1>
          <h2>Твоя жизнь — это множество приключений</h2>
          <p>Реальные цели, маленькие шаги и награды за твой прогресс.</p>
        </div>
        <div className="pyl-hero-progress">
          <b>{percent}%</b>
          <span>
            Общий прогресс квестов
            <strong>
              {completed} из {total}
            </strong>
          </span>
        </div>
      </section>
      <section>
        <div className="pyl-section-title">
          <h2>Мои сферы</h2>
          {sphere && (
            <button onClick={() => setSphere("")}>Сбросить фильтр</button>
          )}
        </div>
        <div className="pyl-quest-spheres">
          {spheres.map((s) => {
            const p = sphereProgress(state.spheres[s.id].xp);
            return (
              <button
                key={s.id}
                className={sphere === s.id ? "selected" : ""}
                onClick={() => setSphere(sphere === s.id ? "" : s.id)}
                aria-pressed={sphere === s.id}
              >
                <SphereBuilding id={s.id} />
                <strong>
                  {s.icon} {s.name}
                </strong>
                <small>LVL {p.level} / 100</small>
                <Meter value={p.progress} label={`Прогресс: ${s.name}`} />
              </button>
            );
          })}
        </div>
      </section>
      <div className="pyl-quest-navigation">
        <nav aria-label="Разделы квестов">
          {nav.map((name, i) => (
            <button
              key={name}
              className={i === tab ? "selected" : ""}
              aria-pressed={i === tab}
              onClick={() => setTab(i)}
            >
              {name}
            </button>
          ))}
        </nav>
        <button className="primary-button" onClick={() => onCreate()}>
          ＋ Создать квест
        </button>
      </div>
      <div className="pyl-quest-columns">
        <main>
          {(tab === 0 || tab === 1) && (
            <section className="pyl-habit-section">
              <div className="pyl-section-title">
                <h2>
                  ✨ Ежедневные мини-квесты <small>(привычки)</small>
                </h2>
                <button onClick={() => setForm({ habitMode: true })}>
                  ＋ Добавить привычку
                </button>
              </div>
              <div className="pyl-habit-grid">
                {habits
                  .filter((h) => !sphere || h.sphere === sphere)
                  .map((h) => {
                    const done = history.some(
                        (c) =>
                          c.habitId === h.id &&
                          c.day === habitDay(h) &&
                          c.rewardClaimed,
                      ),
                      due = habitDue(h);
                    return (
                      <article
                        key={h.id}
                        className={`pyl-habit-card ${done ? "is-done" : ""}`}
                      >
                        <div className="pyl-habit-heading">
                          <span>
                            {habitIcons.find(([id]) => id === h.iconId)?.[1]}
                          </span>
                          <strong>{h.title}</strong>
                        </div>
                        <p>
                          {done ? h.targetValue : 0} / {h.targetValue} {h.unit}
                        </p>
                        <Meter value={done ? 100 : 0} label={h.title} />
                        <small>
                          ✦ +5 XP · 🪙 {h.rewardCoins} · 🔥{" "}
                          {habitStreak(h, history)}
                        </small>
                        <button
                          disabled={done || !due}
                          onClick={() => {
                            try {
                              apply(
                                (s) => completeHabit(s, h.id, ownerId),
                                `✓ +5 XP · +${h.rewardCoins} Life Coins`,
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          {done
                            ? "✓ Выполнено"
                            : due
                              ? "Выполнить"
                              : "Сегодня отдых"}
                        </button>
                        <div className="pyl-card-edit">
                          <button
                            onClick={() =>
                              setForm({ habitMode: true, habit: h })
                            }
                          >
                            Изменить
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Удалить привычку? История и текущий прогресс этой привычки будут удалены.",
                                )
                              )
                                apply(
                                  (s) => removeHabit(s, h.id, ownerId),
                                  "Привычка удалена",
                                );
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                        <small>
                          Всего {h.totalCompletions} · рекорд {h.bestStreak}{" "}
                          дней
                        </small>
                      </article>
                    );
                  })}
              </div>
              {!habits.length && (
                <div className="pyl-empty">
                  <strong>Твои привычки, твой ритм</strong>
                  <p>
                    Добавь первый маленький шаг. Список привычек выбираешь ты.
                  </p>
                  <button onClick={() => setForm({ habitMode: true })}>
                    ＋ Добавить привычку
                  </button>
                </div>
              )}
            </section>
          )}
          {tab !== 1 && tab !== 6 && (
            <section>
              <div className="pyl-section-title">
                <h2>
                  {tab === 5
                    ? "Сложные квесты"
                    : tab === 4
                      ? "Основные квесты"
                      : "Мои квесты"}
                </h2>
                <span>{visible.length}</span>
              </div>
              <div className="pyl-quest-filters">
                <div className="tabs">
                  {[
                    ["all", "Все"],
                    ["active", "Активные"],
                    ["done", "Выполненные"],
                  ].map(([id, name]) => (
                    <button
                      key={id}
                      className={filter === id ? "selected" : ""}
                      onClick={() => setFilter(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <label>
                  <span className="sr-only">По сферам</span>
                  <select
                    value={sphere}
                    onChange={(e) => setSphere(e.target.value)}
                  >
                    <option value="">По сферам: все</option>
                    {spheres.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Поиск квестов</span>
                  <input
                    type="search"
                    placeholder="Поиск квестов..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  <span className="sr-only">Сортировка</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="new">Сначала новые</option>
                    <option value="important">Сначала важные</option>
                    <option value="progress">По прогрессу</option>
                    <option value="reward">По награде</option>
                  </select>
                </label>
              </div>
              <div className="pyl-quest-grid">
                {visible.map((q) => {
                  const target = q.targetValue ?? 1,
                    current = q.done ? target : (q.currentValue ?? 0),
                    s = spheres.find((i) => i.id === q.sphere)!;
                  const reward = virtualRewards.find(
                    (i) => i.id === q.virtualRewardId,
                  );
                  return (
                    <article
                      key={q.id}
                      className={`pyl-custom-card ${q.done ? "is-done" : ""}`}
                    >
                      <div className="pyl-quest-cover">
                        {q.coverImage ? (
                          <img src={q.coverImage} alt="" />
                        ) : (
                          <SphereBuilding id={q.sphere} />
                        )}
                        <span>
                          {q.done
                            ? "✓ Выполнено"
                            : q.priority === "high"
                              ? "★ Важный"
                              : "В пути"}
                        </span>
                      </div>
                      <div className="pyl-quest-card-body">
                        <h3>{q.name}</h3>
                        <small className="pyl-sphere-badge">
                          {s.icon} {s.name}
                        </small>
                        {q.notes && (
                          <p className="pyl-quest-notes">{q.notes}</p>
                        )}
                        <p>
                          {current} / {target} {q.unit}
                        </p>
                        <Meter
                          value={(current / target) * 100}
                          label={`Прогресс: ${q.name}`}
                        />
                        {q.dueAt && (
                          <small>
                            До {new Date(q.dueAt).toLocaleDateString("ru-RU")}
                          </small>
                        )}
                        <div className="pyl-card-reward">
                          <b>✦ +{q.xp} XP</b>
                          <b>🪙 {questCoins(q)}</b>
                          {reward && (
                            <span title={reward.name}>{reward.icon}</span>
                          )}
                        </div>
                        <button
                          className="primary-button"
                          disabled={
                            q.done ||
                            !!(q.startsAt && q.startsAt.slice(0, 10) > today)
                          }
                          onClick={() => {
                            setProgress(q);
                            setProgressValue(current);
                          }}
                        >
                          {q.done ? "✓ Завершено" : "Продолжить"}
                        </button>
                        <div className="pyl-card-edit">
                          {!q.done && (
                            <button
                              onClick={() =>
                                setForm({ quest: q, habitMode: false })
                              }
                            >
                              Изменить
                            </button>
                          )}
                          <button onClick={() => deleteQuest(q)}>
                            Удалить
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!visible.length && (
                <div className="pyl-empty">
                  <strong>Каждое приключение начинается с первого шага</strong>
                  <p>Создай свой квест или измени фильтры.</p>
                  <button onClick={() => onCreate()}>＋ Создать квест</button>
                </div>
              )}
            </section>
          )}
          {tab === 6 && (
            <section className="pyl-empty">
              <h2>Коллекции</h2>
              <p>
                Здесь появятся подборки квестов. Пока выбирай личные цели и
                рекомендации.
              </p>
            </section>
          )}
          {(tab === 0 || tab === 2) && (
            <section className="pyl-recommendations">
              <h2>Рекомендуемые квесты для тебя</h2>
              <p>
                Идеи системы. Они станут твоими квестами только после создания.
              </p>
              <div>
                {recommendations.map((q) => (
                  <button key={q.name} onClick={() => onCreate(q)}>
                    <span>{spheres.find((s) => s.id === q.sphere)?.icon}</span>
                    <strong>{q.name}</strong>
                    <small>Настроить и создать →</small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
        <aside className="pyl-quest-aside">
          <section>
            <h3>Сегодняшние квесты</h3>
            <strong>
              {doneToday} из {daily.length} выполнено
            </strong>
            <Meter
              value={daily.length ? (doneToday / daily.length) * 100 : 0}
              label="Привычки сегодня"
            />
            {daily.map((h) => (
              <p key={h.id}>
                {history.some(
                  (c) =>
                    c.habitId === h.id &&
                    c.day === habitDay(h) &&
                    c.rewardClaimed,
                )
                  ? "✅"
                  : "○"}{" "}
                {h.title}
              </p>
            ))}
            {!daily.length && <p>На сегодня привычек нет.</p>}
          </section>
          <section>
            <h3>Мои награды</h3>
            <div className="pyl-inventory">
              {items
                .slice(-6)
                .reverse()
                .map((item) => {
                  const spec = virtualRewards.find((i) => i.id === item.itemId);
                  return (
                    <div key={item.id}>
                      <span title={spec?.name}>{spec?.icon}</span>
                      {item.itemId === "plant_basic" && !item.placedIn && (
                        <button
                          onClick={() => {
                            apply(
                              (s) => putRewardInSport(s, item.id),
                              "Растение доступно в инвентаре SPORT. Открой комнату, чтобы разместить.",
                            );
                          }}
                        >
                          В SPORT
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
            {!items.length && (
              <p>Выбери виртуальный предмет при создании квеста.</p>
            )}
            {items.some((i) => i.itemId !== "plant_basic") && (
              <small>3D-модели остальных предметов готовятся.</small>
            )}
          </section>
          <section>
            <h3>Недельная цель</h3>
            <strong>{weekly} из 10</strong>
            <Meter value={(weekly / 10) * 100} label="Недельная цель" />
            <p>Личный ориентир: 10 выполнений за неделю.</p>
          </section>
          <section>
            <h3>Достижения за квесты</h3>
            <p>
              {state.completed >= 1 ? "⭐" : "🔒"} Первый шаг{" "}
              {state.completed >= 1 ? "✓" : ""}
            </p>
            <small>Выполни первый квест</small>
            {["Квестомастер", "Постоянство", "Легенда квестов"].map((name) => (
              <p key={name}>
                🔒 {name} <small>Скоро</small>
              </p>
            ))}
          </section>
        </aside>
      </div>
      {form && (
        <QuestWizard
          {...form}
          onClose={() => setForm(null)}
          onQuest={(q) =>
            apply((s) => saveCustomQuest(s, q, ownerId), "Квест сохранён")
          }
          onHabit={(h) =>
            apply((s) => saveHabit(s, h, ownerId), "Привычка сохранена")
          }
        />
      )}
      {progress && (
        <div className="pyl-overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="quest-progress-title"
            onSubmit={(e) => {
              e.preventDefault();
              finish(progress, progressValue);
            }}
          >
            <h2 id="quest-progress-title">{progress.name}</h2>
            <label>
              Выполнено ({progress.unit || "шагов"})
              <input
                autoFocus
                type="number"
                required
                min={progress.currentValue ?? 0}
                max={progress.targetValue ?? 1}
                step="any"
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.valueAsNumber)}
              />
            </label>
            <p>
              Цель: {progress.targetValue ?? 1} {progress.unit}
            </p>
            <footer>
              <button type="button" onClick={() => setProgress(null)}>
                Отмена
              </button>
              <button className="primary-button">Сохранить прогресс</button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => finish(progress, progress.targetValue ?? 1)}
              >
                Выполнить полностью
              </button>
            </footer>
          </form>
        </div>
      )}
      {celebrate && (
        <div className="pyl-celebration" role="status">
          <span>✦</span>
          <h2>{celebrate}</h2>
          <button onClick={() => setCelebrate("")}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}
