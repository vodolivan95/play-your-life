import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { removeQuest, spheres } from "../game";
import type { GameState, Goal, GoalStage, Quest } from "../game";
import {
  deleteGoal,
  localDateTime,
  removeStage,
  saveGoal,
  toISO,
} from "../planning";
import {
  addHistory,
  saveGoalTask,
  duplicateStage,
  completeStage,
  editStage,
  finishGoalTask,
  goalTasks,
  orderedStages,
  stageLock,
  stageStatus,
  taskProgress,
  undoGoalTask,
} from "../goalSystem";
import { navigateGoal, useGoalRoute } from "../goalNavigation";
import { questCoins } from "../personalQuests";
import { GoalForm, TaskForm } from "./PlanningForms";
import GoalCoverEditor, { GoalBanner } from "./GoalCover";
import GameArt from "./GameArt";
import StageCalendar from "./StageCalendar";
import StageAnalytics, { ProgressRing, StageTimeline } from "./StageAnalytics";
import "./GoalWorkspace.css";
const labels = [
  ["overview", "Обзор"],
  ["tasks", "Задачи"],
  ["timeline", "Временная шкала"],
  ["settings", "Настройки"],
  ["statistics", "Статистика"],
] as const;
type Editor = {
  kind: "goal" | "stage" | "task" | "cover";
  stage?: GoalStage;
  task?: Quest;
  day?: string;
};
export default function GoalWorkspace({
  goal,
  state,
  onChange,
  onNotify,
  ownerId,
}: {
  goal: Goal;
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  onNotify: (s: string) => void;
  ownerId?: string;
}) {
  const route = useGoalRoute(),
    stage = goal.stages?.find((s) => s.id === route?.stageId),
    task = state.quests.find(
      (q) =>
        q.id === route?.taskId &&
        q.goalId === goal.id &&
        q.stageId === stage?.id,
    );
  const [tab, setTab] = useState("overview"),
    [editor, setEditor] = useState<Editor | null>(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("due"),
    [note, setNote] = useState(stage?.notes ?? "");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);
  const stageKey = stage?.id;
  useEffect(() => {
    queueMicrotask(() => {
      setTab("overview");
      setNote(stage?.notes ?? "");
    });
  }, [stageKey, stage?.notes]);
  const all = goalTasks(state, goal.id),
    tasks = stage ? goalTasks(state, goal.id, stage.id) : all,
    progress = taskProgress(tasks),
    stages = orderedStages(goal),
    index = stages.findIndex((s) => s.id === stage?.id),
    locked = stage ? stageLock(goal, stage) : "";
  const cloudEconomyReady =
    !ownerId || import.meta.env.VITE_GOAL_ECONOMY_ENABLED === "true";
  function mutate(fn: (s: GameState) => GameState) {
    try {
      fn(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Действие не выполнено.");
      return false;
    }
    setError("");
    onChange((s) => {
      try {
        return fn(s);
      } catch (e) {
        queueMicrotask(() =>
          setError(e instanceof Error ? e.message : "Действие не выполнено."),
        );
        return s;
      }
    });
    return true;
  }
  function openStage(id: string) {
    navigateGoal({ goalId: goal.id, stageId: id });
  }
  function openTask(id: string) {
    if (stage) navigateGoal({ goalId: goal.id, stageId: stage.id, taskId: id });
  }
  function finish(q: Quest) {
    if (
      !cloudEconomyReady &&
      stage?.autoComplete &&
      ((stage.rewardXP ?? 0) > 0 || (stage.rewardCoins ?? 0) > 0)
    ) {
      setError(
        "Облачные награды этапов требуют подтверждённого обновления правил Firebase. Отключите автоматическое завершение, чтобы выполнять задачи.",
      );
      return;
    }
    mutate((s) => finishGoalTask(s, q.id));
  }
  function undo(q: Quest) {
    if (!cloudEconomyReady) {
      setError(
        "Облачная отмена награды пока недоступна: новые правила Firebase не опубликованы. Выполнение не изменено.",
      );
      return;
    }
    if (
      window.confirm(
        `Отменить выполнение и вернуть ${q.xp} XP и ${questCoins(q)} Life Coins?`,
      )
    )
      mutate((s) => undoGoalTask(s, q.id));
  }
  function closeStage() {
    if (!stage) return;
    if (
      !cloudEconomyReady &&
      ((stage.rewardXP ?? 0) > 0 || (stage.rewardCoins ?? 0) > 0)
    ) {
      setError(
        "Награды этапов в облаке недоступны до проверки и публикации новых правил Firebase.",
      );
      return;
    }
    if (window.confirm("Завершить этап и начислить предусмотренную награду?"))
      mutate((s) => completeStage(s, goal.id, stage.id));
  }
  function taskRows(list: Quest[]) {
    return list.map((q) => (
      <div className="goal-task-row" key={q.id}>
        <button
          className="check-button"
          disabled={
            !!locked ||
            stage?.status === "paused" ||
            (!q.done && stage?.status === "completed")
          }
          aria-label={`${q.done ? "Отменить" : "Выполнить"}: ${q.name}`}
          onClick={() => (q.done ? undo(q) : finish(q))}
        >
          {q.done ? "✓" : "○"}
        </button>
        <button
          className="goal-task-title"
          onClick={() =>
            stage ? openTask(q.id) : setEditor({ kind: "task", task: q })
          }
        >
          <strong>{q.name}</strong>
          <small>
            {q.dueAt ? new Date(q.dueAt).toLocaleString("ru-RU") : "Без срока"}{" "}
            · {q.priority ?? "normal"}
            {q.required === false ? " · Необязательная" : ""}
          </small>
        </button>
        <span>
          {q.xp} XP · {questCoins(q)} LC
        </span>
        <button
          aria-label={`Редактировать задачу: ${q.name}`}
          disabled={q.done || !!locked}
          onClick={() => setEditor({ kind: "task", task: q })}
        >
          ✎
        </button>
        <button
          aria-label={`Удалить задачу: ${q.name}`}
          disabled={!!locked}
          onClick={() => {
            if (
              window.confirm(
                "Удалить задачу? История и начисленные награды сохранятся.",
              )
            )
              mutate((s) =>
                addHistory(removeQuest(s, q.id), goal.id, {
                  stageId: q.stageId,
                  taskId: q.id,
                  type: "task.deleted",
                  title: `Удалена задача: ${q.name}`,
                }),
              );
          }}
        >
          ×
        </button>
      </div>
    ));
  }
  const visible = tasks
    .filter(
      (q) =>
        (!search || q.name.toLowerCase().includes(search.toLowerCase())) &&
        (filter === "all" ||
          (filter === "done" && q.done) ||
          (filter === "active" && !q.done) ||
          (filter === "overdue" &&
            !q.done &&
            !!q.dueAt &&
            new Date(q.dueAt) < new Date())),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "priority"
          ? ["high", "normal", "low"].indexOf(a.priority ?? "normal") -
            ["high", "normal", "low"].indexOf(b.priority ?? "normal")
          : (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"),
    );
  const selectedHistory = (goal.history ?? []).filter(
    (e) => !stage || e.stageId === stage.id,
  );
  return (
    <div className="goal-workspace">
      <nav className="goal-breadcrumbs" aria-label="Навигационная цепочка">
        <button onClick={() => navigateGoal({})}>Все цели</button>
        <span>›</span>
        <button onClick={() => navigateGoal({ goalId: goal.id })}>
          {goal.name}
        </button>
        {stage && (
          <>
            <span>›</span>
            <button onClick={() => openStage(stage.id)}>{stage.name}</button>
          </>
        )}
        {task && (
          <>
            <span>›</span>
            <strong>{task.name}</strong>
          </>
        )}
      </nav>
      <GoalBanner goal={goal} onEdit={() => setEditor({ kind: "cover" })}>
        <span>
          {spheres.find((s) => s.id === goal.sphere)?.icon}{" "}
          {spheres.find((s) => s.id === goal.sphere)?.name}
        </span>
        <h2>{goal.name}</h2>
        <p>{goal.description}</p>
        <div className="progress">
          <span
            style={{
              width: `${goal.progressMode === "tasks" ? taskProgress(all).percent : Math.min(100, (goal.current / goal.target) * 100)}%`,
            }}
          />
        </div>
        <p>
          {Math.round(
            goal.progressMode === "tasks"
              ? taskProgress(all).percent
              : Math.min(100, (goal.current / goal.target) * 100),
          )}
          % · {all.filter((q) => q.done).length} из {all.length} задач ·{" "}
          {stages.filter((s) => s.status === "completed").length} из{" "}
          {stages.length} этапов
        </p>
        {stage && (
          <button
            className="primary-button"
            onClick={() => navigateGoal({ goalId: goal.id })}
          >
            Перейти к цели →
          </button>
        )}
      </GoalBanner>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {route?.stageId && !stage ? (
        <section className="panel">
          <h2>Этап не найден</h2>
          <button onClick={() => navigateGoal({ goalId: goal.id })}>
            Вернуться к цели
          </button>
        </section>
      ) : route?.taskId && !task ? (
        <section className="panel">
          <h2>Задача не найдена</h2>
          <button onClick={() => openStage(stage!.id)}>
            Вернуться к этапу
          </button>
        </section>
      ) : locked ? (
        <section className="panel" role="alert">
          <h2>Этап заблокирован</h2>
          <p>{locked}</p>
          <button onClick={() => navigateGoal({ goalId: goal.id })}>
            Вернуться к цели
          </button>
        </section>
      ) : task ? (
        <section className="panel">
          <h2>{task.name}</h2>
          <p>{task.notes || "Описание не добавлено."}</p>
          <p>
            {task.done ? "Выполнена" : "В процессе"} · {task.xp} XP ·{" "}
            {questCoins(task)} Life Coins
          </p>
          <p>
            Срок:{" "}
            {task.dueAt
              ? new Date(task.dueAt).toLocaleString("ru-RU")
              : "Без срока"}
          </p>
          <p>
            Выполнена:{" "}
            {task.completedAt
              ? new Date(task.completedAt).toLocaleString("ru-RU")
              : "ещё нет"}
          </p>
          <button
            className="primary-button"
            onClick={() => (task.done ? undo(task) : finish(task))}
          >
            {task.done ? "Отменить выполнение" : "Выполнить задачу"}
          </button>
          <button
            onClick={() => setEditor({ kind: "task", task })}
            disabled={task.done}
          >
            Редактировать
          </button>
          <button onClick={() => openStage(stage!.id)}>
            Вернуться к этапу
          </button>
          <h3>История задачи</h3>
          {selectedHistory
            .filter((e) => e.taskId === task.id)
            .map((e) => (
              <p key={e.id}>
                {new Date(e.timestamp).toLocaleString("ru-RU")} · {e.title}
              </p>
            ))}
        </section>
      ) : (
        <>
          <div className="section-heading">
            <div>
              <h2>
                {stage ? `Этап ${index + 1}. ${stage.name}` : "Путь к цели"}
              </h2>
              {stage && (
                <p>
                  {stage.description} · {stageStatus(stage)}
                </p>
              )}
            </div>
            <button
              className="secondary-button"
              onClick={() =>
                setEditor({ kind: stage ? "stage" : "goal", stage })
              }
            >
              Редактировать {stage ? "этап" : "цель"}
            </button>
            {!stage && (
              <button
                className="primary-button"
                onClick={() => setEditor({ kind: "stage" })}
              >
                + Этап
              </button>
            )}
          </div>
          <div className="tabs goal-stage-tabs">
            {labels.map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
            {!stage && (
              <button
                className={tab === "history" ? "selected" : ""}
                onClick={() => setTab("history")}
              >
                История
              </button>
            )}
          </div>
          {tab === "overview" &&
            (stage ? (
              <div className="stage-two-columns">
                <div>
                  <section className="panel">
                    <h3>Описание этапа</h3>
                    {stage.reminder && stage.status !== "completed" && (
                      <p role="status">
                        Напоминание:{" "}
                        {new Date(stage.reminder).toLocaleString("ru-RU")}
                        {new Date(stage.reminder) <= new Date()
                          ? " — пора продолжить этап"
                          : ""}
                      </p>
                    )}
                    <p>
                      {stage.description ||
                        "Добавьте описание в настройках этапа."}
                    </p>
                  </section>
                  <StageTimeline stage={stage} tasks={tasks} />
                  <section className="panel">
                    <div className="section-heading">
                      <h3>Задачи этапа</h3>
                      <button
                        disabled={stage.status === "completed"}
                        onClick={() => setEditor({ kind: "task" })}
                      >
                        + Добавить задачу
                      </button>
                    </div>
                    {taskRows(tasks.slice(0, 5))}
                    {tasks.length > 5 && (
                      <button onClick={() => setTab("tasks")}>
                        Показать все {tasks.length} задач
                      </button>
                    )}
                  </section>
                  <section className="panel">
                    <h3>Заметки</h3>
                    <textarea
                      aria-label="Заметки этапа"
                      rows={5}
                      maxLength={10000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        mutate((s) =>
                          editStage(s, goal.id, {
                            ...stage,
                            notes: note,
                            notesUpdatedAt: new Date().toISOString(),
                          }),
                        )
                      }
                    >
                      Сохранить заметки
                    </button>
                    <p>
                      Последнее изменение:{" "}
                      {stage.notesUpdatedAt
                        ? new Date(stage.notesUpdatedAt).toLocaleString("ru-RU")
                        : "нет"}
                    </p>
                    <div className="stage-note-text">
                      {stage.notes
                        ?.split(/(https?:\/\/[^\s]+)/g)
                        .map((part, i) =>
                          /^https?:\/\//.test(part) ? (
                            <a
                              key={i}
                              href={part}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {part}
                            </a>
                          ) : (
                            part
                          ),
                        )}
                    </div>
                  </section>
                </div>
                <aside>
                  <section className="panel">
                    <h3>Прогресс этапа</h3>
                    <ProgressRing tasks={tasks} />
                    <p>
                      Выполнено: {progress.done} · осталось:{" "}
                      {progress.remaining}
                    </p>
                  </section>
                  <StageCalendar
                    stage={stage}
                    tasks={tasks}
                    onTask={openTask}
                    onCreate={(day) => setEditor({ kind: "task", day })}
                  />
                  <section className="panel">
                    <h3>Награды за этап</h3>
                    <GameArt kind="trophy" />
                    <p>
                      {stage.rewardXP ?? 0} XP · {stage.rewardCoins ?? 0} Life
                      Coins
                    </p>
                    <p>
                      {stage.achievement ?? "Достижение не задано"} ·{" "}
                      {
                        {
                          common: "Обычное",
                          rare: "Редкое",
                          legendary: "Легендарное",
                        }[stage.rarity ?? "common"]
                      }
                    </p>
                    <p>
                      {stage.rewardClaimed
                        ? "Награда уже начислена"
                        : "После выполнения условий завершения"}
                    </p>
                    {!cloudEconomyReady && (
                      <small>
                        Облачное начисление новых наград этапов пока недоступно.
                      </small>
                    )}
                  </section>
                  <section className="panel stage-management">
                    <h3>Управление этапом</h3>
                    <button onClick={() => setEditor({ kind: "stage", stage })}>
                      Редактировать этап
                    </button>
                    <button
                      onClick={() =>
                        mutate((s) => duplicateStage(s, goal.id, stage.id))
                      }
                    >
                      Дублировать этап
                    </button>
                    <button onClick={() => setTab("settings")}>
                      Перенести даты
                    </button>
                    <button
                      disabled={stage.status === "completed"}
                      onClick={() =>
                        mutate((s) =>
                          editStage(s, goal.id, {
                            ...stage,
                            status:
                              stage.status === "paused" ? "active" : "paused",
                          }),
                        )
                      }
                    >
                      {stage.status === "paused"
                        ? "Возобновить"
                        : "Приостановить"}
                    </button>
                    <button
                      disabled={stage.status === "completed"}
                      onClick={closeStage}
                    >
                      Завершить этап
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            "Удалить этап? Его задачи останутся в цели.",
                          )
                        ) {
                          mutate((s) =>
                            addHistory(
                              removeStage(s, goal.id, stage.id),
                              goal.id,
                              {
                                stageId: stage.id,
                                type: "stage.deleted",
                                title: "Этап удалён",
                              },
                            ),
                          );
                          navigateGoal({ goalId: goal.id });
                        }
                      }}
                    >
                      Удалить этап
                    </button>
                  </section>
                </aside>
              </div>
            ) : (
              <div className="stage-two-columns">
                <div>
                  {stages.map((s, i) => {
                    const group = goalTasks(state, goal.id, s.id),
                      p = taskProgress(group);
                    return (
                      <section className="panel goal-stage-summary" key={s.id}>
                        <div className="section-heading">
                          <h3>
                            Этап {i + 1}. {s.name}
                          </h3>
                          <b>{Math.round(p.percent)}%</b>
                        </div>
                        <p>
                          {s.description} · {stageStatus(s)}
                        </p>
                        <div className="progress">
                          <span style={{ width: `${p.percent}%` }} />
                        </div>
                        {taskRows(group.slice(0, 3))}
                        <button
                          className="primary-button"
                          onClick={() => openStage(s.id)}
                        >
                          Продолжить →
                        </button>
                      </section>
                    );
                  })}
                  {!stages.length && (
                    <section className="panel">
                      Создайте первый этап, чтобы разбить цель на шаги.
                    </section>
                  )}
                  <section className="panel">
                    <h3>Задачи без этапа</h3>
                    {taskRows(all.filter((q) => !q.stageId))}
                    <button onClick={() => setEditor({ kind: "task" })}>
                      + Добавить задачу
                    </button>
                  </section>
                </div>
                <aside>
                  <section className="panel">
                    <h3>Общий прогресс</h3>
                    <ProgressRing tasks={all} />
                    <p>
                      Награда цели: {goal.reward} XP ·{" "}
                      {goal.rewarded ? "получена" : "ещё не получена"}
                    </p>
                    <p>{goal.description}</p>
                  </section>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Удалить цель? Задачи и начисленный XP сохранятся.",
                        )
                      ) {
                        mutate((s) => deleteGoal(s, goal.id));
                        navigateGoal({});
                      }
                    }}
                  >
                    Удалить цель
                  </button>
                </aside>
              </div>
            ))}
          {tab === "tasks" && (
            <section className="panel">
              <div className="stage-filters">
                <input
                  aria-label="Поиск задач"
                  placeholder="Поиск задач"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Фильтр задач"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Все</option>
                  <option value="active">Активные</option>
                  <option value="done">Выполненные</option>
                  <option value="overdue">Просроченные</option>
                </select>
                <select
                  aria-label="Сортировка задач"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="due">По сроку</option>
                  <option value="name">По названию</option>
                  <option value="priority">По приоритету</option>
                </select>
                <button onClick={() => setEditor({ kind: "task" })}>
                  + Создать задачу
                </button>
              </div>
              {taskRows(visible)}
              {!visible.length && <p>Задач пока нет.</p>}
            </section>
          )}
          {tab === "timeline" &&
            (stage ? (
              <>
                <StageTimeline stage={stage} tasks={tasks} />
                <StageCalendar
                  stage={stage}
                  tasks={tasks}
                  onTask={openTask}
                  onCreate={(day) => setEditor({ kind: "task", day })}
                />
                <button onClick={() => setEditor({ kind: "stage", stage })}>
                  Изменить сроки
                </button>
              </>
            ) : (
              stages.map((s) => (
                <StageTimeline
                  key={s.id}
                  stage={s}
                  tasks={goalTasks(state, goal.id, s.id)}
                />
              ))
            ))}
          {tab === "settings" &&
            (stage ? (
              <StageSettings
                key={stage.id}
                stage={stage}
                count={stages.length}
                onSave={(input) => {
                  if (mutate((s) => editStage(s, goal.id, input)))
                    onNotify("Настройки этапа сохранены");
                }}
              />
            ) : (
              <GoalForm
                initial={goal}
                onSave={(input) =>
                  mutate((s) =>
                    addHistory(saveGoal(s, input), goal.id, {
                      type: "goal.updated",
                      title: "Цель обновлена",
                    }),
                  )
                }
              />
            ))}
          {tab === "statistics" &&
            (stage ? (
              <StageAnalytics
                state={state}
                goal={goal}
                stage={stage}
                tasks={tasks}
                onTask={openTask}
              />
            ) : (
              stages.map((s) => (
                <StageAnalytics
                  key={s.id}
                  state={state}
                  goal={goal}
                  stage={s}
                  tasks={goalTasks(state, goal.id, s.id)}
                  onTask={(id) =>
                    navigateGoal({ goalId: goal.id, stageId: s.id, taskId: id })
                  }
                />
              ))
            ))}
          {(tab === "history" || tab === "statistics") && (
            <section className="panel">
              <h3>История изменений</h3>
              {selectedHistory.length ? (
                selectedHistory
                  .slice()
                  .reverse()
                  .map((e) => (
                    <p key={e.id}>
                      <time>
                        {new Date(e.timestamp).toLocaleString("ru-RU")}
                      </time>{" "}
                      · {e.title}
                      {e.xp !== undefined && ` · ${e.xp} XP`}
                      {e.coins !== undefined && ` · ${e.coins} LC`}
                    </p>
                  ))
              ) : (
                <p>Изменений пока нет.</p>
              )}
            </section>
          )}
          {stage && (
            <nav className="stage-navigation">
              <button
                disabled={index <= 0}
                onClick={() => openStage(stages[index - 1].id)}
              >
                ← Предыдущий этап
              </button>
              <button onClick={() => navigateGoal({ goalId: goal.id })}>
                Вернуться к цели
              </button>
              <button
                disabled={index >= stages.length - 1}
                onClick={() => openStage(stages[index + 1].id)}
              >
                Следующий этап →
              </button>
            </nav>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        aria-label="Редактор цели и этапа"
        onCancel={() => setEditor(null)}
      >
        <div className="dialog-content">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="icon-button modal-close"
            aria-label="Закрыть"
            onClick={() => setEditor(null)}
          >
            ×
          </button>
          {editor?.kind === "cover" && (
            <GoalCoverEditor
              goal={goal}
              goals={state.goals}
              ownerId={ownerId}
              onClose={() => setEditor(null)}
              onSave={(cover, clear) =>
                mutate((s) =>
                  addHistory(
                    {
                      ...s,
                      goals: s.goals.map((g) =>
                        g.id === goal.id
                          ? {
                              ...g,
                              cover,
                              ...(clear ? { image: undefined } : {}),
                            }
                          : g,
                      ),
                    },
                    goal.id,
                    { type: "goal.cover", title: "Обложка цели изменена" },
                  ),
                )
              }
            />
          )}{" "}
          {editor?.kind === "goal" && (
            <GoalForm
              initial={goal}
              onSave={(input) => {
                if (
                  mutate((s) =>
                    addHistory(saveGoal(s, input), goal.id, {
                      type: "goal.updated",
                      title: "Цель обновлена",
                    }),
                  )
                )
                  setEditor(null);
              }}
            />
          )}
          {editor?.kind === "stage" && (
            <StageSettings
              stage={
                editor.stage ?? {
                  id: "",
                  name: "",
                  startsAt: goal.startsAt,
                  order: stages.length,
                  status: "planned",
                }
              }
              count={stages.length + 1}
              onSave={(input) => {
                if (
                  mutate((s) =>
                    editStage(s, goal.id, {
                      ...input,
                      id: input.id || undefined,
                    }),
                  )
                )
                  setEditor(null);
              }}
            />
          )}
          {editor?.kind === "task" && (
            <TaskForm
              state={state}
              goalId={goal.id}
              stageId={stage?.id}
              initial={
                editor.task ??
                (editor.day
                  ? {
                      id: crypto.randomUUID(),
                      name: "",
                      sphere: goal.sphere,
                      xp: 20,
                      done: false,
                      difficulty: "Medium",
                      goalId: goal.id,
                      stageId: stage?.id,
                      dueAt: toISO(editor.day + "T12:00"),
                    }
                  : undefined)
              }
              onSave={(input) => {
                if (mutate((s) => saveGoalTask(s, input))) setEditor(null);
              }}
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
function StageSettings({
  stage,
  count,
  onSave,
}: {
  stage: GoalStage;
  count: number;
  onSave: (input: GoalStage) => void;
}) {
  const [error, setError] = useState("");
  return (
    <form
      className="planning-form panel"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          onSave({
            ...stage,
            name: String(f.get("name")).trim(),
            description: String(f.get("description")),
            order: Number(f.get("order")),
            startsAt: toISO(String(f.get("start"))),
            dueAt: toISO(String(f.get("end"))),
            completedAt: toISO(String(f.get("completed"))),
            status:
              stage.status === "completed"
                ? "completed"
                : (String(f.get("status")) as GoalStage["status"]),
            rewardXP: Number(f.get("xp")),
            rewardCoins: Number(f.get("coins")),
            achievement: String(f.get("achievement")),
            rarity: String(f.get("rarity")) as GoalStage["rarity"],
            notes: String(f.get("notes")),
            reminder: toISO(String(f.get("reminder"))),
            autoComplete: f.has("auto"),
            requiresPrevious: f.has("previous"),
            completionMode: String(
              f.get("mode"),
            ) as GoalStage["completionMode"],
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Проверьте настройки.");
        }
      }}
    >
      <h3>{stage.id ? "Настройки этапа" : "Новый этап"}</h3>
      <label>
        Название этапа
        <input name="name" required maxLength={100} defaultValue={stage.name} />
      </label>
      <label>
        Описание
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={stage.description}
        />
      </label>
      <label>
        Порядок
        <input
          name="order"
          type="number"
          min="0"
          max={count}
          defaultValue={stage.order ?? 0}
        />
      </label>
      <div className="planning-dates">
        <label>
          Дата начала
          <input
            name="start"
            type="datetime-local"
            defaultValue={
              stage.startsAt ? localDateTime(new Date(stage.startsAt)) : ""
            }
          />
        </label>
        <label>
          Дата окончания (можно оставить пустой)
          <input
            name="end"
            type="datetime-local"
            defaultValue={
              stage.dueAt ? localDateTime(new Date(stage.dueAt)) : ""
            }
          />
        </label>
      </div>
      <label>
        Фактическое завершение
        <input
          name="completed"
          type="datetime-local"
          readOnly={stage.status !== "completed"}
          defaultValue={
            stage.completedAt ? localDateTime(new Date(stage.completedAt)) : ""
          }
        />
      </label>
      <label>
        Статус
        <select
          name="status"
          disabled={stage.status === "completed"}
          defaultValue={stage.status ?? "planned"}
        >
          <option value="planned">Запланирован</option>
          <option value="active">В процессе</option>
          <option value="paused">Приостановлен</option>
          <option value="completed" disabled>
            Завершён
          </option>
        </select>
      </label>
      <label>
        Условия завершения
        <select name="mode" defaultValue={stage.completionMode ?? "all"}>
          <option value="all">Все обязательные задачи</option>
          <option value="manual">Ручное подтверждение</option>
        </select>
      </label>
      <label>
        XP за этап
        <input
          name="xp"
          type="number"
          min="0"
          max="500"
          readOnly={stage.rewardClaimed}
          defaultValue={stage.rewardXP ?? 0}
        />
      </label>
      <label>
        Life Coins
        <input
          name="coins"
          type="number"
          min="0"
          max="500"
          readOnly={stage.rewardClaimed}
          defaultValue={stage.rewardCoins ?? 0}
        />
      </label>
      <label>
        Достижение
        <input
          name="achievement"
          maxLength={100}
          defaultValue={stage.achievement}
        />
      </label>
      <label>
        Редкость
        <select
          name="rarity"
          defaultValue={
            { common: "Обычное", rare: "Редкое", legendary: "Легендарное" }[
              stage.rarity ?? "common"
            ]
          }
        >
          <option value="common">Обычное</option>
          <option value="rare">Редкое</option>
          <option value="legendary">Легендарное</option>
        </select>
      </label>
      <label>
        Заметки
        <textarea name="notes" maxLength={10000} defaultValue={stage.notes} />
      </label>
      <label>
        Напоминание
        <input
          name="reminder"
          type="datetime-local"
          defaultValue={
            stage.reminder ? localDateTime(new Date(stage.reminder)) : ""
          }
        />
      </label>
      <small>
        Напоминание отображается в приложении. Фоновые push-уведомления не
        подключены.
      </small>
      <label>
        <input
          name="previous"
          type="checkbox"
          defaultChecked={stage.requiresPrevious}
        />{" "}
        Требуется предыдущий этап
      </label>
      <label>
        <input
          name="auto"
          type="checkbox"
          defaultChecked={stage.autoComplete}
        />{" "}
        Автоматически завершать после обязательных задач
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="primary-button">Сохранить этап</button>
    </form>
  );
}
