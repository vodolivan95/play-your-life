import { lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { difficulties, spheres } from "../game";
import type { GameState, Quest } from "../game";
import { localFingerprint } from "../ticktick";
import { TickTickContext } from "../tickTickContext";
import { taskRoute } from "../taskRoutes";
import {
  canChangeDifficulty,
  difficultyLockReason,
  difficultyLabels,
  repeatLabels,
  taskContribution,
  updateTaskSettings,
} from "../taskSettings";
import type { TaskPatch } from "../taskSettings";
import { inspectQuestPhoto } from "../questPhoto";
import { readProjectImage } from "../projectImage";
import {
  firstDescriptionImage,
  safeWebUrl,
  taskGoalForecast,
  yandexRoute,
} from "../taskDetails";
import { isTaskReviewMode } from "../taskReviewMode";
import type { TaskDetails } from "../taskDetails";
import TaskDescription from "./TaskDescription";
import Icon from "./Icon";
import "./TaskWindow.css";
const FocusSection = lazy(() => import("./FocusSection"));
const tabs = [
  "Планирование",
  "Описание",
  "Вложения",
  "Заметки",
  "История",
] as const;
const tabIcons = ["calendar", "document", "attachment", "note", "history"];
function localValue(value?: string) {
  if (!value) return "";
  if (value.length === 10) return value + "T00:00";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function TaskWindowContent({
  taskId,
  state,
  today,
  onChange,
  onClose,
  onAdvanced,
  onProgress,
  onComplete,
  onUndo,
  onDelete,
  onDuplicate,
  onTransfer,
  onPractice,
  onOpenRelated,
  notify,
}: {
  taskId: string;
  ownerId?: string;
  today: string;
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  onClose: () => void;
  onAdvanced?: (q: Quest) => void;
  onProgress?: (q: Quest) => void;
  onComplete?: (q: Quest) => void;
  onUndo?: (q: Quest) => void;
  onDelete?: (q: Quest) => void;
  onDuplicate?: (q: Quest) => void;
  onTransfer?: (q: Quest) => void;
  onPractice?: (q: Quest) => void;
  onOpenRelated?: (id: string) => void;
  notify: (s: string) => void;
}) {
  const tickTick = useContext(TickTickContext);
  const task = state.quests.find((q) => q.id === taskId);
  const taskExists = !!task;
  const [tab, setTab] = useState<(typeof tabs)[number]>("Планирование");
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.notes ?? "");
  const [sub, setSub] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [placeEditing, setPlaceEditing] = useState(false);
  const [tag, setTag] = useState("");
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState<string>();
  const [menu, setMenu] = useState(false);
  const [coverMenu, setCoverMenu] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [filter, setFilter] = useState("Все");
  const [busy, setBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | undefined>(undefined);
  const dialog = useRef<HTMLElement>(null);
  const duplicateGuard = useRef(false);
  const duplicateReset = useRef<number | undefined>(undefined);
  const dirty =
    !!task &&
    (name !== task.name ||
      description !== (task.notes ?? "") ||
      !!sub.trim() ||
      !!note.trim() ||
      !!tag.trim());
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const unsavedField = Array.from(
        dialog.current?.querySelectorAll<HTMLInputElement>(
          "input:not([type=checkbox]):not([type=file])",
        ) ?? [],
      ).some((field) => field.value !== field.defaultValue);
      if (dirty || unsavedField) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    if (!taskExists) return;
    dialog.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (duplicateReset.current !== undefined)
        window.clearTimeout(duplicateReset.current);
      duplicateReset.current = undefined;
      duplicateGuard.current = false;
    };
  }, [taskExists]);
  if (!task) return null;
  const c = taskContribution(state, task);
  const forecast = taskGoalForecast(state, task);
  const locked = task.done;
  const details = task.details ?? {};
  const attachments = details.attachments ?? [];
  const tickTickImage = task.tickTickSharedAt
    ? firstDescriptionImage(task.notes)
    : undefined;
  const cover =
    task.coverImage ??
    (!details.coverHidden
      ? (tickTickImage ?? attachments.find((a) => a.type === "photo")?.url)
      : undefined);
  const coverChoices = [
    ...new Set(
      [
        task.coverImage,
        ...attachments.filter((a) => a.type === "photo").map((a) => a.url),
      ].filter((value): value is string => !!value),
    ),
  ];
  function stepCover(direction: number) {
    const index = coverChoices.indexOf(cover ?? "");
    const next =
      index < 0
        ? direction > 0
          ? 0
          : coverChoices.length - 1
        : (index + direction + coverChoices.length) % coverChoices.length;
    patch({
      coverImage: coverChoices[next],
      details: { ...details, coverHidden: false },
    });
  }
  const route = yandexRoute(details);
  const workflow =
    task.planning?.workflow === "ready"
      ? "planned"
      : (task.planning?.workflow ?? "planned");
  const events = state.events
    .filter((e) => e.sourceId === task.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  function patch(p: TaskPatch | ((current: Quest) => TaskPatch)) {
    const apply = (current: GameState) => {
      const currentTask = current.quests.find((q) => q.id === taskId);
      if (!currentTask) throw new Error("Задача не найдена.");
      return updateTaskSettings(
        current,
        taskId,
        typeof p === "function" ? p(currentTask) : p,
      );
    };
    try {
      apply(state);
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
    onChange((current) => {
      try {
        return apply(current);
      } catch (e) {
        queueMicrotask(() => notify((e as Error).message));
        return current;
      }
    });
    return true;
  }
  function updateDetails(
    p: Partial<TaskDetails> | ((current: TaskDetails) => Partial<TaskDetails>),
  ) {
    return patch((current) => {
      const latest = current.details ?? {};
      return {
        details: { ...latest, ...(typeof p === "function" ? p(latest) : p) },
      };
    });
  }
  function close() {
    if (
      !dirty ||
      window.confirm(
        "Есть несохранённый текст. Закрыть без сохранения этого текста?",
      )
    )
      onClose();
  }
  function save() {
    if (sub.trim() || tag.trim() || note.trim()) {
      notify(
        "Сначала добавьте или очистите черновик пункта, тега или заметки.",
      );
      return;
    }
    if (locked) {
      onClose();
      return;
    }
    if (patch({ name, notes: description })) {
      notify("Изменения переданы в сохранение");
      onClose();
    }
  }
  async function copyLink() {
    const link = `${location.origin}${location.pathname}${location.search}#${taskRoute(task!.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      notify("Ссылка скопирована");
    } catch {
      notify("Ссылка: " + link);
    }
  }
  function duplicate() {
    if (!onDuplicate || duplicateGuard.current) return;
    duplicateGuard.current = true;
    try {
      onDuplicate(task!);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Не удалось дублировать задачу.",
      );
    } finally {
      duplicateReset.current = window.setTimeout(() => {
        duplicateGuard.current = false;
        duplicateReset.current = undefined;
      }, 400);
    }
  }
  function remove() {
    // All existing owners confirm deletion before invoking their service.
    onDelete?.(task!);
  }
  function template() {
    const data = {
      name: task!.name,
      sphere: task!.sphere,
      difficulty: task!.difficulty,
      notes: task!.notes,
      estimateMinutes: task!.estimateMinutes,
      subtasks: task!.subtasks?.map((s) => ({ title: s.title, done: false })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "play-your-life-task-template.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Шаблон сохранён в JSON-файл");
  }
  function addTag() {
    const next = tag.trim();
    if (!next) return;
    if (
      (details.tags ?? []).some((t) => t.toLowerCase() === next.toLowerCase())
    ) {
      setTag("");
      return;
    }
    if (updateDetails({ tags: [...(details.tags ?? []), next] })) {
      setTag("");
      setAddingTag(false);
    }
  }
  function addLink() {
    const url = window.prompt("HTTPS-ссылка на файл или страницу");
    if (!url) return;
    if (!safeWebUrl(url)) {
      notify("Введите корректную HTTP(S)-ссылку");
      return;
    }
    updateDetails({
      attachments: [
        ...attachments,
        {
          id: crypto.randomUUID(),
          name: new URL(url).hostname,
          url,
          type: "link",
        },
      ],
    });
  }
  async function upload(file: File | undefined, cover: boolean) {
    if (!file || busy) return;
    setBusy(true);
    try {
      await inspectQuestPhoto(file);
      const url = await readProjectImage(file, true);
      if (cover)
        patch((current) => ({
          coverImage: url,
          details: { ...current.details, coverHidden: false },
        }));
      else {
        const attachment = {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          type: "photo" as const,
          size: Math.floor(url.length * 0.75),
        };
        updateDetails((current) => {
          const latest = current.attachments ?? [];
          if (
            latest.reduce((sum, a) => sum + a.url.length, url.length) > 350000
          )
            throw new Error(
              "Превышен общий размер фотографий задачи. Удалите одно из фото и повторите загрузку.",
            );
          return { attachments: [...latest, attachment] };
        });
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const syncEnabled = task.tickTickSync !== false;
  const syncLink = tickTick?.connection?.links[task.id];
  const syncState = !syncEnabled
    ? "Выключена"
    : !tickTick?.connected
      ? "Не подключено"
      : tickTick.busy
        ? "Выполняется"
        : tickTick.lastSyncError
          ? "Ошибка"
          : tickTick.dirty ||
              !syncLink ||
              syncLink.local !== localFingerprint(task, state) ||
              !!syncLink.done !== task.done
            ? "Ожидает"
            : task.details || task.subtasks?.length || task.repeat
              ? "Частично синхронизировано"
              : "Синхронизировано";
  return (
    <div
      className="pyl-overlay twin-overlay"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        className="twin"
        role="dialog"
        aria-modal="true"
        aria-label={task.name}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            // Commit existing blur-saved fields before the editor can unmount.
            if (document.activeElement instanceof HTMLInputElement)
              document.activeElement.blur();
            if (preview) setPreview(undefined);
            else if (menu) setMenu(false);
            else if (coverMenu) setCoverMenu(false);
            else close();
          }
          if (e.key === "Tab") {
            const focusable = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
              ),
            ).filter((el) => el.getClientRects().length > 0);
            const first = focusable[0],
              last = focusable.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        {isTaskReviewMode() && (
          <small className="twin-review-label">
            Проверочный режим · локальная игра, без данных аккаунта
          </small>
        )}
        <h2 className="twin-sr-title">{task.name}</h2>
        <div className="twin-toolbar">
          <div>
            <button aria-label="Назад" onClick={close}>
              <Icon name="arrowLeft" size={24} />
            </button>
            <strong>Задача</strong>
          </div>
          <div>
            <button
              aria-label="Избранное"
              aria-pressed={!!task.pinned}
              disabled={locked}
              onClick={() => patch({ pinned: !task.pinned })}
            >
              <Icon name="star" size={23} />
            </button>
            {onDuplicate && (
              <button aria-label="Дублировать" onClick={duplicate}>
                <Icon name="copy" size={21} />
              </button>
            )}
            <button aria-label="Копировать ссылку" onClick={copyLink}>
              <Icon name="link" size={21} />
            </button>
            <div className="twin-menu-wrap">
              <button
                aria-label="Дополнительное меню"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <Icon name="more" size={24} />
              </button>
              {menu && (
                <div className="twin-menu">
                  <button
                    onClick={() => {
                      setTab("История");
                      setMenu(false);
                    }}
                  >
                    История задачи
                  </button>
                  {onTransfer && (
                    <button onClick={() => onTransfer(task)}>
                      Передать в TickTick
                    </button>
                  )}
                  <button onClick={template}>Экспорт шаблона</button>
                </div>
              )}
            </div>
            <button aria-label="Закрыть" onClick={close}>
              <Icon name="close" size={24} />
            </button>
          </div>
        </div>
        <header className="twin-head">
          <div
            className="twin-ring"
            style={{ ["--p" as string]: Math.min(100, (c.xp / 80) * 100) }}
            aria-label={`Награда: ${c.xp} XP`}
          >
            <b>+{c.xp}</b>
            <small>XP</small>
          </div>
          <div className="twin-heading">
            <span className="twin-category">
              {task.goalId ? "✦ Задача проекта" : "✦ Личная задача"}
            </span>
            <textarea
              aria-label="Название задачи"
              rows={2}
              maxLength={100}
              disabled={locked}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="twin-projects">
              <label>
                <Icon name="home" size={23} />
                <select
                  aria-label="Проект"
                  disabled={locked}
                  value={task.goalId ?? ""}
                  onChange={(e) => patch({ goalId: e.target.value || null })}
                >
                  <option value="">Проект: не выбран</option>
                  {state.goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      Проект: {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <Icon name="flag" size={22} />
                <select
                  aria-label="Этап"
                  disabled={locked || !c.goal}
                  value={task.stageId ?? ""}
                  onChange={(e) => patch({ stageId: e.target.value || null })}
                >
                  <option value="">Этап: не выбран</option>
                  {c.goal?.stages?.map((s) => (
                    <option key={s.id} value={s.id}>
                      Этап: {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="twin-cover">
            {cover ? (
              <button
                className="twin-cover-image"
                aria-label="Открыть обложку"
                onClick={() => setPreview(cover)}
              >
                <img src={cover} alt="Обложка задачи" />
              </button>
            ) : (
              <div className="twin-cover-empty">
                <span>▧</span>Обложка задачи
              </div>
            )}
            {cover && coverChoices.length > 1 && (
              <>
                <button
                  className="twin-cover-prev"
                  disabled={locked}
                  aria-label="Предыдущая обложка"
                  onClick={() => stepCover(-1)}
                >
                  <Icon name="back" size={24} />
                </button>
                <button
                  className="twin-cover-next"
                  disabled={locked}
                  aria-label="Следующая обложка"
                  onClick={() => stepCover(1)}
                >
                  <Icon name="arrow" size={24} />
                </button>
              </>
            )}
            <button
              className="twin-cover-edit"
              aria-label="Изменить обложку"
              disabled={locked || busy}
              onClick={() => setCoverMenu(!coverMenu)}
            >
              <Icon name="pencil" size={23} />
            </button>
            {coverMenu && (
              <div className="twin-menu">
                <button onClick={() => coverInput.current?.click()}>
                  Загрузить изображение
                </button>
                <button
                  onClick={() => {
                    setTab("Вложения");
                    setCoverMenu(false);
                  }}
                >
                  Выбрать из вложений
                </button>
                {cover && (
                  <button
                    onClick={() => {
                      patch({
                        coverImage: null,
                        details: { ...details, coverHidden: true },
                      });
                      setCoverMenu(false);
                    }}
                  >
                    Удалить обложку
                  </button>
                )}
                <button
                  disabled={!tickTickImage}
                  onClick={() => {
                    patch({
                      coverImage: null,
                      details: { ...details, coverHidden: false },
                    });
                    setCoverMenu(false);
                  }}
                >
                  Использовать первое фото TickTick
                </button>
                <small>
                  Доступны изображения из описания. Закрытые файлы TickTick не
                  загружаются.
                </small>
              </div>
            )}
            <input
              hidden
              ref={coverInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Загрузить обложку"
              onChange={(e) => {
                void upload(e.target.files?.[0], true);
                e.target.value = "";
              }}
            />
          </div>
        </header>
        <div className="twin-info">
          <label className="twin-card twin-sphere">
            <span className="twin-symbol">
              <Icon name="layers" size={40} />
            </span>
            <span>
              Сфера
              <select
                aria-label="Сфера жизни"
                disabled={locked || !!task.goalId}
                value={task.sphere}
                onChange={(e) => patch({ sphere: e.target.value })}
              >
                {Object.keys(state.spheres).map((id) => (
                  <option key={id} value={id}>
                    {spheres.find((s) => s.id === id)?.name ?? id}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <div className="twin-card twin-goal">
            {forecast ? (
              <>
                <div>
                  <span className="twin-symbol">
                    <Icon name="goals" size={42} />
                  </span>
                  <span>
                    Прогресс цели
                    <strong>{Math.round(forecast.progress)}%</strong>
                    <progress max={100} value={forecast.progress} />
                  </span>
                </div>
                <div>
                  <span>
                    Вклад в цель{" "}
                    <button
                      disabled={locked}
                      aria-label="Настроить вес задачи"
                      onClick={() => {
                        const value = window.prompt(
                          "Вес задачи (больше 0, до 1000)",
                          String(task.weight ?? 1),
                        );
                        if (value !== null) patch({ weight: Number(value) });
                      }}
                    >
                      <Icon name="info" size={22} />
                    </button>
                  </span>
                  <strong>+{Math.round(forecast.share)}%</strong>
                  <small>
                    После выполнения: <b>{Math.round(forecast.after)}%</b>
                  </small>
                  {forecast.manual && (
                    <small>Прогресс цели меняется вручную</small>
                  )}
                </div>
              </>
            ) : (
              <p>
                ◎ Нет связанной цели
                <br />
                <small>Выберите проект, чтобы увидеть вклад</small>
              </p>
            )}
          </div>
          <label className="twin-card twin-status">
            <span className="twin-symbol">
              <Icon name="play" size={32} />
            </span>
            <span>
              Статус
              <select
                aria-label="Статус"
                value={task.done ? "completed" : workflow}
                onChange={(e) => {
                  if (e.target.value === "completed") onComplete?.(task);
                  else if (task.done) {
                    const selectedWorkflow = e.target.value as
                      "planned" | "doing" | "waiting";
                    onUndo?.(task);
                    onChange((current) => {
                      if (current.quests.find((q) => q.id === task.id)?.done)
                        return current;
                      try {
                        return updateTaskSettings(current, task.id, {
                          planning: {
                            ...current.quests.find((q) => q.id === task.id)
                              ?.planning,
                            workflow: selectedWorkflow,
                          },
                        });
                      } catch {
                        return current;
                      }
                    });
                  } else
                    patch({
                      planning: {
                        ...task.planning,
                        workflow: e.target.value as
                          "planned" | "doing" | "waiting",
                      },
                    });
                }}
              >
                <option value="planned">Запланирована</option>
                <option value="doing">В работе</option>
                <option value="waiting">На паузе</option>
                <option value="completed" disabled={!onComplete && !task.done}>
                  Выполнена
                </option>
              </select>
              {!task.done &&
                task.dueAt &&
                Date.parse(
                  task.dueAt.length === 10
                    ? task.dueAt + "T23:59:59"
                    : task.dueAt,
                ) < Date.now() && (
                  <small className="twin-overdue">Просрочена</small>
                )}
            </span>
          </label>
        </div>
        <section className="twin-parameters twin-card">
          <h3>Параметры задачи</h3>
          <div>
            <label
              className="twin-priority"
              data-priority={
                task.priority === "high" && task.planning?.urgent
                  ? "critical"
                  : (task.priority ?? "normal")
              }
            >
              <Icon name="flag" size={35} />
              <span>Приоритет</span>
              <select
                aria-label="Приоритет задачи"
                disabled={locked}
                value={
                  task.priority === "high" && task.planning?.urgent
                    ? "critical"
                    : (task.priority ?? "normal")
                }
                onChange={(e) =>
                  patch({
                    priority:
                      e.target.value === "critical"
                        ? "high"
                        : (e.target.value as Quest["priority"]),
                    planning: {
                      ...task.planning,
                      urgent: e.target.value === "critical",
                    },
                  })
                }
              >
                <option value="low">Низкий</option>
                <option value="normal">Средний</option>
                <option value="high">Высокий</option>
                <option value="critical">Критичный</option>
              </select>
            </label>
            <label>
              <Icon name="statistics" size={35} />
              <span>Сложность</span>
              <select
                aria-label="Сложность"
                aria-describedby={difficultyLockReason(task) ? "task-difficulty-lock" : undefined}
                disabled={!canChangeDifficulty(task) || locked}
                value={task.difficulty}
                onChange={(e) => patch({ difficulty: e.target.value })}
              >
                {Object.keys(difficulties).map((d) => (
                  <option key={d} value={d}>
                    {difficultyLabels[d] ?? d}
                  </option>
                ))}
              </select>
              {difficultyLockReason(task) && <small id="task-difficulty-lock" className="twin-field-hint">{difficultyLockReason(task)}</small>}
            </label>
            <label>
              <Icon name="calendar" size={35} />
              <span>Дедлайн (физический)</span>
              <input
                aria-label="Физический дедлайн"
                type="datetime-local"
                disabled={locked}
                value={localValue(task.dueAt)}
                onChange={(e) => patch({ dueAt: e.target.value || null })}
              />
            </label>
            <label>
              <Icon name="layers" size={35} />
              <span>Оценка времени</span>
              <select
                aria-label="Оценка времени"
                disabled={locked}
                value={task.estimateMinutes ?? ""}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    const value = window.prompt(
                      "Оценка времени в минутах (1–43200)",
                      String(task.estimateMinutes ?? 60),
                    );
                    if (value !== null)
                      patch({ estimateMinutes: Number(value) });
                  } else
                    patch({
                      estimateMinutes: e.target.value
                        ? Number(e.target.value)
                        : null,
                    });
                }}
              >
                <option value="">Не задана</option>
                {[
                  ...new Set([
                    5,
                    15,
                    30,
                    45,
                    60,
                    90,
                    120,
                    180,
                    240,
                    360,
                    480,
                    ...(task.estimateMinutes ? [task.estimateMinutes] : []),
                  ]),
                ]
                  .sort((a, b) => a - b)
                  .map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes % 60 === 0
                        ? `${minutes / 60} ч`
                        : `${minutes} мин`}
                    </option>
                  ))}
                <option value="custom">Другое время…</option>
              </select>
            </label>
          </div>
        </section>
        <nav className="twin-tabs" role="tablist" aria-label="Разделы задачи">
          {tabs.map((t, i) => (
            <button
              role="tab"
              aria-selected={tab === t}
              aria-controls="task-tab-panel"
              id={`task-tab-${i}`}
              key={t}
              onClick={() => setTab(t)}
            >
              <Icon name={tabIcons[i]} size={23} />
              {t}
              {t === "Вложения" && attachments.length > 0 && (
                <i>{attachments.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div
          id="task-tab-panel"
          role="tabpanel"
          aria-labelledby={`task-tab-${tabs.indexOf(tab)}`}
          className="twin-body"
        >
          {tab === "Планирование" && (
            <div className="twin-plan-grid">
              <section className="twin-card">
                <h3>
                  <Icon name="quests" size={24} /> Чек-лист{" "}
                  <small>(подзадачи)</small>
                  <i>
                    {task.subtasks?.filter((s) => s.done).length ?? 0}/
                    {task.subtasks?.length ?? 0}
                  </i>
                </h3>
                <ul className="twin-subs">
                  {(task.subtasks ?? []).map((item) => (
                    <li
                      key={item.id}
                      draggable={!locked}
                      onDragStart={() => {
                        dragId.current = item.id;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const list = [...(task.subtasks ?? [])];
                        const from = list.findIndex(
                            (s) => s.id === dragId.current,
                          ),
                          to = list.findIndex((s) => s.id === item.id);
                        if (from < 0 || to < 0) return;
                        list.splice(to, 0, ...list.splice(from, 1));
                        patch({ subtasks: list });
                      }}
                    >
                      <input
                        aria-label={`Выполнить: ${item.title}`}
                        type="checkbox"
                        disabled={locked}
                        checked={item.done}
                        onChange={() =>
                          patch({
                            subtasks: task.subtasks!.map((s) =>
                              s.id === item.id ? { ...s, done: !s.done } : s,
                            ),
                          })
                        }
                      />
                      <input
                        aria-label="Текст пункта"
                        disabled={locked}
                        className={item.done ? "is-done" : ""}
                        key={item.title}
                        defaultValue={item.title}
                        maxLength={100}
                        onBlur={(e) =>
                          patch({
                            subtasks: task.subtasks!.map((s) =>
                              s.id === item.id
                                ? { ...s, title: e.target.value }
                                : s,
                            ),
                          })
                        }
                      />
                      <button
                        disabled={locked}
                        aria-label={`Переместить вверх: ${item.title}`}
                        onClick={() => {
                          const list = [...task.subtasks!],
                            i = list.findIndex((s) => s.id === item.id);
                          if (i > 0) {
                            [list[i - 1], list[i]] = [list[i], list[i - 1]];
                            patch({ subtasks: list });
                          }
                        }}
                      >
                        <Icon name="grip" size={19} />
                      </button>
                      <button
                        disabled={locked}
                        aria-label={`Удалить пункт: ${item.title}`}
                        onClick={() =>
                          patch({
                            subtasks: task.subtasks!.filter(
                              (s) => s.id !== item.id,
                            ),
                          })
                        }
                      >
                        <Icon name="close" size={24} />
                      </button>
                    </li>
                  ))}
                </ul>
                {!locked &&
                  (!addingSub ? (
                    <button
                      className="twin-add-sub"
                      onClick={() => setAddingSub(true)}
                    >
                      <Icon name="plus" size={23} /> Добавить пункт
                    </button>
                  ) : (
                    <form
                      className="twin-inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (
                          sub.trim() &&
                          patch({
                            subtasks: [
                              ...(task.subtasks ?? []),
                              {
                                id: crypto.randomUUID(),
                                title: sub.trim(),
                                done: false,
                              },
                            ],
                          })
                        ) {
                          setSub("");
                          setAddingSub(false);
                        }
                      }}
                    >
                      <input
                        aria-label="Новый пункт"
                        placeholder="Новый пункт"
                        autoFocus
                        value={sub}
                        maxLength={100}
                        onChange={(e) => setSub(e.target.value)}
                      />
                      <button disabled={!sub.trim()}>Добавить</button>
                      <button
                        type="button"
                        aria-label="Отменить добавление пункта"
                        onClick={() => {
                          setSub("");
                          setAddingSub(false);
                        }}
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </form>
                  ))}
              </section>
              <section className="twin-card">
                <h3>
                  <Icon name="calendar" size={24} />
                  Сроки и повтор
                </h3>
                <div className="twin-dates">
                  <label>
                    Дата начала
                    <input
                      aria-label="Дата начала"
                      disabled={locked}
                      type="date"
                      value={localValue(task.startsAt).slice(0, 10)}
                      onChange={(e) =>
                        patch({
                          startsAt: e.target.value
                            ? e.target.value +
                              (task.startsAt?.includes("T")
                                ? "T" + localValue(task.startsAt).slice(11)
                                : "")
                            : null,
                        })
                      }
                    />
                  </label>
                  <label>
                    Время начала
                    <input
                      aria-label="Время начала"
                      disabled={locked}
                      type="time"
                      value={
                        task.startsAt?.includes("T")
                          ? localValue(task.startsAt).slice(11)
                          : ""
                      }
                      onChange={(e) =>
                        patch({
                          startsAt:
                            (localValue(task.startsAt).slice(0, 10) || today) +
                            (e.target.value ? "T" + e.target.value : ""),
                        })
                      }
                    />
                  </label>
                  <label>
                    Дата окончания
                    <input
                      aria-label="Дата окончания"
                      disabled={locked}
                      type="date"
                      value={localValue(task.dueAt).slice(0, 10)}
                      onChange={(e) =>
                        patch({
                          dueAt: e.target.value
                            ? e.target.value +
                              (task.dueAt?.includes("T")
                                ? "T" + localValue(task.dueAt).slice(11)
                                : "")
                            : null,
                        })
                      }
                    />
                  </label>
                  <label>
                    Время окончания
                    <input
                      aria-label="Время окончания"
                      disabled={locked}
                      type="time"
                      value={
                        task.dueAt?.includes("T")
                          ? localValue(task.dueAt).slice(11)
                          : ""
                      }
                      onChange={(e) =>
                        patch({
                          dueAt:
                            (localValue(task.dueAt).slice(0, 10) || today) +
                            (e.target.value ? "T" + e.target.value : ""),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span className="twin-field-caption">
                      <Icon name="repeat" size={20} />
                      Повтор
                    </span>
                    <select
                      aria-label="Повтор"
                      disabled={locked}
                      value={task.repeat ?? ""}
                      onChange={(e) =>
                        patch({
                          repeat: (e.target.value || null) as
                            Quest["repeat"] | null,
                        })
                      }
                    >
                      {repeatLabels.map(([id, label]) => (
                        <option key={label} value={id ?? ""}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="twin-field-caption">
                      <Icon name="bell" size={20} />
                      Напоминание
                    </span>
                    <select
                      aria-label="Напоминание"
                      title="Напоминания настраиваются в TickTick; текущая интеграция не передаёт это поле"
                      disabled
                      value="external"
                    >
                      <option value="external">В TickTick</option>
                    </select>
                  </label>
                </div>
                {task.tickTickRepeatFlag && (
                  <small>Правило TickTick: {task.tickTickRepeatFlag}</small>
                )}
              </section>
              <section className="twin-card">
                <h3>
                  <Icon name="location" size={24} />
                  Место выполнения
                </h3>
                <div className="twin-place">
                  <button
                    className="twin-place-picker"
                    aria-label="Настроить место выполнения"
                    aria-expanded={placeEditing}
                    aria-controls="task-place-editor"
                    title={details.address || "Указать название и адрес"}
                    onClick={() => setPlaceEditing(!placeEditing)}
                  >
                    <span>
                      {details.place ||
                        details.address ||
                        (Number.isFinite(details.latitude) &&
                        Number.isFinite(details.longitude)
                          ? `${details.latitude}, ${details.longitude}`
                          : "Указать место")}
                    </span>
                    <Icon name="chevronDown" size={19} />
                  </button>
                  {route ? (
                    <a
                      className="twin-map-button"
                      aria-label="Открыть место на карте"
                      href={`https://yandex.ru/maps/?text=${encodeURIComponent(details.address || `${details.latitude},${details.longitude}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="map" size={25} />
                    </a>
                  ) : (
                    <button
                      className="twin-map-button"
                      aria-label="Открыть место на карте"
                      disabled
                    >
                      <Icon name="map" size={25} />
                    </button>
                  )}
                  {route ? (
                    <a
                      aria-label="Маршрут в Яндекс Картах"
                      className="twin-route"
                      href={route}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="location" size={30} />
                      <span>
                        Маршрут<small>в Яндекс Картах</small>
                      </span>
                      <Icon name="external" size={18} />
                    </a>
                  ) : (
                    <button
                      className="twin-route"
                      aria-label="Маршрут в Яндекс Картах"
                      disabled
                    >
                      <Icon name="location" size={30} />
                      <span>
                        Маршрут<small>в Яндекс Картах</small>
                      </span>
                      <Icon name="external" size={18} />
                    </button>
                  )}
                </div>
                {placeEditing && (
                  <div id="task-place-editor" className="twin-place-editor">
                    <label>
                      Название места
                      <input
                        aria-label="Название места"
                        disabled={locked}
                        key={details.place ?? "place"}
                        defaultValue={details.place ?? ""}
                        maxLength={200}
                        onBlur={(e) => updateDetails({ place: e.target.value })}
                      />
                    </label>
                    <label>
                      Адрес
                      <input
                        aria-label="Адрес"
                        disabled={locked}
                        key={details.address ?? "address"}
                        defaultValue={details.address ?? ""}
                        maxLength={500}
                        onBlur={(e) =>
                          updateDetails({
                            address: e.target.value,
                            latitude: undefined,
                            longitude: undefined,
                          })
                        }
                      />
                    </label>
                    <label>
                      Широта
                      <input
                        aria-label="Широта"
                        type="number"
                        min={-90}
                        max={90}
                        step="any"
                        disabled={locked}
                        key={details.latitude ?? "latitude"}
                        defaultValue={details.latitude ?? ""}
                        onBlur={(e) =>
                          updateDetails({
                            latitude: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                    <label>
                      Долгота
                      <input
                        aria-label="Долгота"
                        type="number"
                        min={-180}
                        max={180}
                        step="any"
                        disabled={locked}
                        key={details.longitude ?? "longitude"}
                        defaultValue={details.longitude ?? ""}
                        onBlur={(e) =>
                          updateDetails({
                            longitude: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                    <button onClick={() => setPlaceEditing(false)}>
                      Готово
                    </button>
                  </div>
                )}
              </section>
              <section className="twin-card">
                <h3>
                  <Icon name="tag" size={24} />
                  Теги
                </h3>
                <div className="twin-tags">
                  {(details.tags ?? []).map((t) => (
                    <span key={t}>
                      {t}
                      <button
                        disabled={locked}
                        aria-label={`Удалить тег ${t}`}
                        onClick={() =>
                          updateDetails({
                            tags: details.tags!.filter((x) => x !== t),
                          })
                        }
                      >
                        <Icon name="close" size={24} />
                      </button>
                    </span>
                  ))}
                  {!locked && !addingTag && (
                    <button
                      className="twin-tag-add"
                      aria-label="Добавить тег"
                      onClick={() => setAddingTag(true)}
                    >
                      <Icon name="plus" size={27} />
                    </button>
                  )}
                  {!(details.tags ?? []).length && !addingTag && (
                    <small>Тегов пока нет</small>
                  )}
                </div>
                {!locked && addingTag && (
                  <form
                    className="twin-inline"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addTag();
                    }}
                  >
                    <input
                      aria-label="Новый тег"
                      list="task-existing-tags"
                      placeholder="Добавить тег"
                      autoFocus
                      value={tag}
                      maxLength={50}
                      onChange={(e) => setTag(e.target.value)}
                    />
                    <datalist id="task-existing-tags">
                      {[
                        ...new Set(
                          state.quests.flatMap((q) => q.details?.tags ?? []),
                        ),
                      ].map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <button aria-label="Добавить тег" disabled={!tag.trim()}>
                      <Icon name="check" size={20} />
                    </button>
                    <button
                      type="button"
                      aria-label="Отменить добавление тега"
                      onClick={() => {
                        setTag("");
                        setAddingTag(false);
                      }}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </form>
                )}
              </section>
              <Suspense fallback={<p>Загрузка фокуса…</p>}>
                <FocusSection
                  state={state}
                  task={task}
                  onChange={onChange}
                  notify={notify}
                  onOpenTask={(id) => {
                    if (onOpenRelated) onOpenRelated(id);
                    else location.hash = taskRoute(id);
                  }}
                />
              </Suspense>
              <section className="twin-card twin-sync">
                <span className="twin-sync-emblem">
                  <Icon name="check" size={35} />
                </span>
                <div>
                  <h3>Синхронизация с TickTick</h3>
                  <small>
                    {syncState}
                    {tickTick?.connection?.lastSync &&
                      ` · Последний успешный обмен: ${new Date(tickTick.connection.lastSync).toLocaleString("ru-RU")}`}
                  </small>
                  <small>
                    Даты, название, описание, приоритет и выполнение.
                    Дополнительные поля — только в Play Your Life.
                  </small>
                </div>
                <button
                  disabled={locked}
                  role="switch"
                  aria-label="Синхронизация с TickTick"
                  aria-checked={syncEnabled}
                  onClick={() => patch({ sync: !syncEnabled })}
                >
                  <i />
                </button>
              </section>
            </div>
          )}
          {tab === "Описание" && (
            <section className="twin-card">
              <h3>Описание</h3>
              <textarea
                aria-label="Описание задачи"
                rows={8}
                maxLength={2000}
                value={description}
                disabled={locked}
                placeholder="Добавьте описание. Ссылки и изображения: Markdown."
                onChange={(e) => setDescription(e.target.value)}
              />
              <h3>Предпросмотр</h3>
              {description ? (
                <TaskDescription value={description} />
              ) : (
                <p className="twin-empty">Описания пока нет</p>
              )}
            </section>
          )}
          {tab === "Вложения" && (
            <section className="twin-card">
              <div className="twin-inline">
                {["Все", "Фото", "Файлы", "Ссылки"].map((f) => (
                  <button
                    key={f}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="twin-attachments">
                {attachments
                  .filter(
                    (a) =>
                      filter === "Все" ||
                      a.type ===
                        (
                          {
                            Фото: "photo",
                            Файлы: "file",
                            Ссылки: "link",
                          } as Record<string, string>
                        )[filter],
                  )
                  .map((a) => (
                    <article key={a.id}>
                      {a.type === "photo" && (
                        <button
                          aria-label={`Просмотреть ${a.name}`}
                          onClick={() => setPreview(a.url)}
                        >
                          <img src={a.url} alt={a.name} loading="lazy" />
                        </button>
                      )}
                      <strong>{a.name}</strong>
                      <small>
                        {a.type === "photo"
                          ? "Фото · сохранённая копия"
                          : "Ссылка"}
                        {a.size !== undefined
                          ? ` · ${Math.ceil(a.size / 1024)} КБ`
                          : ""}
                      </small>
                      {a.type !== "photo" && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Открыть ↗
                        </a>
                      )}
                      {a.type === "photo" && (
                        <>
                          <a href={a.url} download={a.name}>
                            Скачать
                          </a>
                          <button
                            disabled={locked}
                            onClick={() =>
                              patch({
                                coverImage: a.url,
                                details: { ...details, coverHidden: false },
                              })
                            }
                          >
                            Сделать обложкой
                          </button>
                        </>
                      )}
                      <button
                        disabled={locked}
                        onClick={() => {
                          if (window.confirm("Удалить вложение?"))
                            updateDetails({
                              attachments: attachments.filter(
                                (x) => x.id !== a.id,
                              ),
                            });
                        }}
                      >
                        Удалить
                      </button>
                    </article>
                  ))}
              </div>
              {!attachments.length && (
                <p className="twin-empty">Вложений пока нет</p>
              )}
              <div className="twin-inline">
                <button
                  disabled={locked || busy || attachments.length >= 10}
                  onClick={() => photoInput.current?.click()}
                >
                  {busy ? "Подготовка…" : "＋ Добавить фото"}
                </button>
                <button
                  disabled={locked || attachments.length >= 10}
                  onClick={addLink}
                >
                  ＋ Добавить ссылку
                </button>
              </div>
              <input
                hidden
                ref={photoInput}
                aria-label="Добавить фото"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  void upload(e.target.files?.[0], false);
                  e.target.value = "";
                }}
              />
              <small>
                До 10 вложений. Фотографии сохраняются в уменьшенном виде.
                Загрузка произвольных файлов на сервер и файлы TickTick пока не
                поддерживаются.
              </small>
            </section>
          )}
          {tab === "Заметки" && (
            <section className="twin-card">
              <h3>Заметки</h3>
              {(details.notes ?? []).map((n) => (
                <article className="twin-note" key={n.id}>
                  <p>{n.text}</p>
                  <small>{new Date(n.updatedAt).toLocaleString("ru-RU")}</small>
                  <div>
                    <button
                      disabled={locked}
                      onClick={() => {
                        setNote(n.text);
                        setEditingNote(n.id);
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      disabled={locked}
                      onClick={() =>
                        updateDetails({
                          notes: details.notes!.filter((x) => x.id !== n.id),
                        })
                      }
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
              {!details.notes?.length && (
                <p className="twin-empty">Заметок пока нет</p>
              )}
              {!locked && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = {
                      id: editingNote ?? crypto.randomUUID(),
                      text: note.trim(),
                      updatedAt: new Date().toISOString(),
                    };
                    if (
                      updateDetails({
                        notes: editingNote
                          ? details.notes!.map((x) =>
                              x.id === editingNote ? n : x,
                            )
                          : [...(details.notes ?? []), n],
                      })
                    ) {
                      setNote("");
                      setEditingNote(undefined);
                    }
                  }}
                >
                  <textarea
                    aria-label="Текст заметки"
                    rows={3}
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button disabled={!note.trim()}>
                    {editingNote ? "Сохранить заметку" : "Добавить заметку"}
                  </button>
                </form>
              )}
            </section>
          )}
          {tab === "История" && (
            <section className="twin-card">
              <h3>История задачи</h3>
              {task.createdAt && (
                <p>
                  Создана: {new Date(task.createdAt).toLocaleString("ru-RU")}
                </p>
              )}
              {events.length ? (
                <ol className="twin-history">
                  {events.map((e) => (
                    <li key={e.id}>
                      <time>{new Date(e.date).toLocaleString("ru-RU")}</time>
                      <span>{e.title}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="twin-empty">Событий пока нет</p>
              )}
            </section>
          )}
        </div>
        <footer className="twin-foot">
          {onAdvanced && (
            <button
              className="twin-settings"
              aria-label="Расширенные настройки"
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm("Перейти без сохранения текста?")
                ) {
                  onClose();
                  onAdvanced(task);
                }
              }}
            >
              <Icon name="settings" size={24} /> Расширенные настройки
            </button>
          )}
          {onDelete && (
            <button className="twin-delete" onClick={remove}>
              <Icon name="trash" size={24} /> Удалить
            </button>
          )}
          {onDuplicate && (
            <button onClick={duplicate}>
              <Icon name="copy" size={23} /> Дублировать
            </button>
          )}
          <button onClick={template}>
            <Icon name="bookmark" size={23} /> Сохранить как шаблон
          </button>
          <button disabled={busy} onClick={save}>
            Сохранить
          </button>
          {task.done && onUndo && (
            <button onClick={() => onUndo(task)}>Вернуть в работу</button>
          )}
          {task.done && onPractice && (
            <button onClick={() => onPractice(task)}>Практиковать снова</button>
          )}
          {!task.done && onProgress && (task.targetValue ?? 1) > 1 && (
            <button onClick={() => onProgress(task)}>Продолжить</button>
          )}
          {!task.done && onComplete && (
            <button
              className="twin-complete"
              disabled={busy || dirty}
              title={
                dirty
                  ? "Сначала сохраните текст и добавьте черновики пунктов, тегов и заметок"
                  : undefined
              }
              onClick={() => onComplete(task)}
            >
              <Icon name="check" size={26} /> Выполнить
            </button>
          )}
        </footer>
        <small className="twin-save-hint">
          Параметры сохраняются сразу. Название и описание — кнопкой
          «Сохранить».
        </small>
        {preview && (
          <div
            className="twin-preview"
            role="dialog"
            aria-label="Просмотр изображения"
            onClick={() => setPreview(undefined)}
          >
            <button
              aria-label="Закрыть изображение"
              onClick={() => setPreview(undefined)}
            >
              <Icon name="close" size={24} />
            </button>
            <img src={preview} alt="Изображение задачи" />
          </div>
        )}
      </section>
    </div>
  );
}

export default function TaskWindow(
  props: Parameters<typeof TaskWindowContent>[0],
) {
  return <TaskWindowContent key={props.taskId} {...props} />;
}
