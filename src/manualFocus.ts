/** Ручные записи — те же planning/time события, которые читает вся аналитика фокуса. */
import { dateKey } from "./game.ts";
import type { Event, GameState } from "./game.ts";
import { addPlanningEvent, validDay } from "./planningData.ts";

export type ManualFocusInput = {
  id: string;
  taskId: string;
  minutes: number;
  day: string;
  comment: string;
  editing?: boolean;
  expected?: string;
};
export function manualFocusVersion(event: Event) {
  return JSON.stringify([event.date, event.planningChange]);
}
function manualRecord(
  state: GameState,
  taskId: string,
  id: string,
  expected?: string,
) {
  const event = state.events.find((e) => e.id === id && e.sourceId === taskId);
  if (
    !event ||
    event.planningChange?.type !== "time" ||
    event.planningChange.session
  )
    throw new Error("Ручная запись не найдена или уже удалена.");
  if (expected && manualFocusVersion(event) !== expected)
    throw new Error(
      "Запись изменилась на другом устройстве. Откройте её заново.",
    );
  return event;
}
export function saveManualFocus(
  state: GameState,
  input: ManualFocusInput,
  now = new Date(),
  auditId = crypto.randomUUID(),
): GameState {
  const task = state.quests.find((q) => q.id === input.taskId);
  if (!task) throw new Error("Задача не найдена.");
  if (
    !Number.isInteger(input.minutes) ||
    input.minutes < 1 ||
    input.minutes > 1440
  )
    throw new Error("Укажите от 1 минуты до 24 часов.");
  if (!validDay(input.day) || input.day > dateKey(now))
    throw new Error("Укажите существующую дату не позже сегодняшнего дня.");
  if (input.comment.length > 300)
    throw new Error("Комментарий: не больше 300 символов.");
  const comment = input.comment.trim();
  const change = {
    type: "time" as const,
    minutes: input.minutes,
    ...(comment ? { comment } : {}),
  };
  const at = new Date(`${input.day}T12:00:00`);
  at.setHours(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  if (!input.editing) {
    if (state.events.some((e) => e.id === input.id)) return state;
    return addPlanningEvent(state, task, change, input.id, at);
  }
  if (state.events.some((e) => e.id === auditId)) return state;
  if (state.events.length >= 100000)
    throw new Error("История слишком большая. Скачайте резервную копию.");
  const old = manualRecord(state, input.taskId, input.id, input.expected);
  if (
    old.date === at.toISOString() &&
    JSON.stringify(old.planningChange) === JSON.stringify(change)
  )
    return state;
  const replacement = {
    ...old,
    date: at.toISOString(),
    planningChange: change,
    title: `Учтено ${input.minutes} мин: ${task.name}`,
  };
  return {
    ...state,
    events: [
      {
        id: auditId,
        kind: "planning",
        xp: 0,
        sourceId: task.id,
        sphere: task.sphere,
        date: now.toISOString(),
        title: `Изменена ручная запись времени: ${old.planningChange?.type === "time" ? old.planningChange.minutes : 0} → ${input.minutes} мин`,
      },
      ...state.events.map((e) => (e.id === old.id ? replacement : e)),
    ],
  };
}
export function removeManualFocus(
  state: GameState,
  taskId: string,
  id: string,
  expected?: string,
  now = new Date(),
): GameState {
  const old = manualRecord(state, taskId, id, expected);
  // Оставляем событие с тем же ID как аудит: оно больше не входит в факт/аналитику.
  const { planningChange, ...audit } = old;
  return {
    ...state,
    events: state.events.map((e) =>
      e.id === id
        ? {
            ...audit,
            date: now.toISOString(),
            title: `Удалена ручная запись времени (${planningChange?.type === "time" ? planningChange.minutes : 0} мин)`,
          }
        : e,
    ),
  };
}
