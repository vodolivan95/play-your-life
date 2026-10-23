import { useContext, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { removeQuest, reopenQuest } from "../game";
import type { GameState, Quest } from "../game";
import {
  progressQuest,
  questCoins,
  saveCustomQuest,
  saveHabit,
  virtualRewards,
} from "../personalQuests";
import type { Habit } from "../personalQuests";
import { pluralDays } from "../goalsOverview";
import { updateTaskSettings } from "../taskSettings";
import QuestWizard from "./QuestWizard";
import GoalTaskList from "./GoalTaskList";
import TaskWindow from "./TaskWindow";
import TasksSummary from "./TasksSummary";
import TasksCalendar from "./TasksCalendar";
import TasksAside from "./TasksAside";
import TickTickInbox from "./TickTickInbox";
import { TickTickContext } from "../tickTickContext";
import "./QuestBoard.css";
import "./TasksAside.css";

type Mode = "inbox" | "list" | "calendar";
const modes: [Mode, string][] = [
  ["inbox", "Входящие"],
  ["list", "Список"],
  ["calendar", "Календарь"],
];

export default function QuestBoard({
  state,
  onChange,
  ownerId,
  today,
  onCreate,
  notify,
  initialTaskId = null,
  onInitialTaskOpened,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  ownerId: string;
  today: string;
  onCreate: (q?: Partial<Quest>) => void;
  notify: (s: string) => void;
  /** Задача, которую нужно открыть сразу (например, с кнопки «Показать задачу» на главной). */
  initialTaskId?: string | null;
  onInitialTaskOpened?: () => void;
}) {
  const manager = useContext(TickTickContext);
  const [mode, setMode] = useState<Mode>("list"),
    [form, setForm] = useState<{
      quest?: Quest;
      habit?: Habit;
      habitMode: boolean;
    } | null>(null),
    [openTask, setOpenTask] = useState<string | null>(initialTaskId),
    [progress, setProgress] = useState<Quest | null>(null),
    [progressValue, setProgressValue] = useState(0),
    [celebrate, setCelebrate] = useState("");
  useEffect(() => {
    if (initialTaskId) onInitialTaskOpened?.();
    // Один раз при открытии страницы: задача уже передана в начальное состояние.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const quests = state.quests.filter((q) => !q.ownerId || q.ownerId === ownerId);
  const connected = Boolean(
    manager?.connection && manager.connected && state.profile.mode !== "demo",
  );
  function apply(action: (s: GameState) => GameState, message: string) {
    onChange(action(state));
    notify(message);
  }
  function startProgress(q: Quest) {
    setProgress(q);
    setProgressValue(q.currentValue ?? 0);
  }
  function finish(q: Quest, value: number) {
    try {
      const next = progressQuest(state, q.id, value, ownerId);
      onChange(next);
      if (!q.done && next.quests.find((i) => i.id === q.id)?.done) {
        if (q.rewardClaimed) setCelebrate("Задача снова отмечена выполненной. Награда повторно не начислена.");
        else {
          const item = virtualRewards.find((i) => i.id === q.virtualRewardId);
          setCelebrate(
            state.completed === 0
              ? "🏆 Первый шаг! Твоя первая задача выполнена!"
              : `✓ +${next.xp - state.xp} XP · +${questCoins(q)} лайфкоинов${item ? " · " + item.icon + " " + item.name : ""}`,
          );
        }
      } else notify("Прогресс сохранён");
      setProgress(null);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function deleteQuest(q: Quest) {
    if (
      window.confirm(
        "Удалить задачу? История и текущий прогресс этой задачи будут удалены.",
      )
    ) {
      setOpenTask(null);
      apply((s) => removeQuest(s, q.id), "Задача удалена");
    }
  }
  return (
    <div className="pyl-quest-board">
      <header className="pyl-tasks-head">
        <nav className="pyl-quest-modes" aria-label="Раздел">
          {modes.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              {label}
              {id === "inbox" && manager?.incoming.length ? (
                <b className="pyl-tasks-badge">{manager.incoming.length}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <button className="primary-button" onClick={() => onCreate()}>
          ＋ Новая задача
        </button>
      </header>
      <TasksSummary quests={quests} today={today} />
      <div className="pyl-tasks-layout">
      <div className="pyl-tasks-main">
      {mode === "inbox" &&
        (connected ? (
          <TickTickInbox state={state} onChange={onChange} />
        ) : (
          <p className="pyl-tasks-empty">
            TickTick не подключён. Подключи его в профиле, и новые задачи из
            твоих списков появятся здесь.
          </p>
        ))}
      {mode === "list" && (
        <GoalTaskList
          state={state}
          quests={quests}
          today={today}
          onOpen={setOpenTask}
          onProgress={startProgress}
        />
      )}
      {mode === "calendar" && (
        <TasksCalendar
          quests={quests}
          today={today}
          onOpen={(q) => setOpenTask(q.id)}
          onMove={(q, days) => {
            try {
              onChange(updateTaskSettings(state, q.id, { shiftDays: days }));
              notify(`«${q.name}» перенесена на ${pluralDays(Math.abs(days))} ${days > 0 ? "вперёд" : "назад"}`);
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        />
      )}
      </div>
      <TasksAside quests={quests} connected={connected} />
      </div>
      {form && (
        <QuestWizard
          {...form}
          onClose={() => setForm(null)}
          onQuest={(q) =>
            apply((s) => saveCustomQuest(s, q, ownerId), "Задача сохранена")
          }
          onHabit={(h) =>
            apply((s) => saveHabit(s, h, ownerId), "Привычка сохранена")
          }
        />
      )}
      {openTask && (
        <TaskWindow
          taskId={openTask}
          state={state}
          today={today}
          onChange={onChange}
          notify={notify}
          onClose={() => setOpenTask(null)}
          onAdvanced={(q) => setForm({ quest: q, habitMode: false })}
          onProgress={(q) => { setOpenTask(null); startProgress(q); }}
          onUndo={(q) => apply((s) => reopenQuest(s, q.id), "Отметка выполнения снята. Полученная награда остаётся и повторно не начислится.")}
          onDelete={deleteQuest}
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
