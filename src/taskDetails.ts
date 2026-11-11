import type { GameState, Quest } from "./game.ts";
import { validProjectImage } from "./projectImage.ts";
import { goalProgressValue } from "./goalWorkspace.ts";

export type TaskAttachment = {
  id: string;
  name: string;
  url: string;
  type: "photo" | "file" | "link";
  size?: number;
};
export type TaskDetails = {
  coverHidden?: boolean;
  place?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  notes?: { id: string; text: string; updatedAt: string }[];
  attachments?: TaskAttachment[];
};
export function safeWebUrl(value: string) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function yandexRoute(details?: TaskDetails) {
  if (!details) return null;
  const { latitude: lat, longitude: lon } = details;
  const coords =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat!) <= 90 &&
    Math.abs(lon!) <= 180;
  const destination = coords ? `${lat},${lon}` : details.address?.trim();
  if (!destination || (!coords && destination.length < 5)) return null;
  // Yandex Maps route URL: empty start point uses the current location.
  return `https://yandex.ru/maps/?rtext=~${encodeURIComponent(destination)}&rtt=auto`;
}
export function validTaskDetails(
  value: unknown,
): value is TaskDetails | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const d = value as TaskDetails;
  const text = (v: unknown, max: number) =>
    v === undefined || (typeof v === "string" && v.length <= max);
  return (
    (d.coverHidden === undefined || typeof d.coverHidden === "boolean") &&
    text(d.place, 200) &&
    text(d.address, 500) &&
    (d.latitude === undefined ||
      (Number.isFinite(d.latitude) && Math.abs(d.latitude) <= 90)) &&
    (d.longitude === undefined ||
      (Number.isFinite(d.longitude) && Math.abs(d.longitude) <= 180)) &&
    (d.tags === undefined ||
      (Array.isArray(d.tags) &&
        d.tags.length <= 30 &&
        d.tags.every(
          (t) => typeof t === "string" && !!t.trim() && t.length <= 50,
        ) &&
        new Set(d.tags.map((t) => t.trim().toLowerCase())).size ===
          d.tags.length)) &&
    (d.notes === undefined ||
      (Array.isArray(d.notes) &&
        d.notes.length <= 50 &&
        new Set(d.notes.map((n) => n?.id)).size === d.notes.length &&
        d.notes.every(
          (n) =>
            n &&
            text(n.id, 100) &&
            !!n.id &&
            typeof n.text === "string" &&
            !!n.text.trim() &&
            n.text.length <= 2000 &&
            typeof n.updatedAt === "string" &&
            Number.isFinite(Date.parse(n.updatedAt)),
        ))) &&
    (d.attachments === undefined ||
      (Array.isArray(d.attachments) &&
        d.attachments.length <= 10 &&
        d.attachments.reduce(
          (sum, a) => sum + (typeof a?.url === "string" ? a.url.length : 0),
          0,
        ) <= 350000 &&
        new Set(d.attachments.map((a) => a?.id)).size ===
          d.attachments.length &&
        d.attachments.every(
          (a) =>
            a &&
            typeof a.id === "string" &&
            !!a.id &&
            typeof a.name === "string" &&
            a.name.length <= 200 &&
            typeof a.url === "string" &&
            ["photo", "file", "link"].includes(a.type) &&
            (a.type === "photo"
              ? validProjectImage(a.url) && !!a.url
              : !!safeWebUrl(a.url)) &&
            (a.size === undefined || (Number.isFinite(a.size) && a.size >= 0)),
        )))
  );
}
export function taskGoalForecast(state: GameState, task: Quest) {
  const goal = state.goals.find((g) => g.id === task.goalId);
  if (!goal) return null;
  const progress = Math.max(0, Math.min(100, goalProgressValue(state, goal)));
  const pool = state.quests.filter(
    (q) => q.goalId === goal.id && q.required !== false,
  );
  const total = pool.reduce((sum, q) => sum + (q.weight ?? 1), 0);
  const share =
    total && task.required !== false ? ((task.weight ?? 1) / total) * 100 : 0;
  // Forecast through the canonical engine: goals with stages average stage progress.
  const after =
    goal.progressMode === "tasks" && !task.done
      ? goalProgressValue(
          {
            quests: state.quests.map((q) =>
              q.id === task.id
                ? { ...q, done: true, currentValue: q.targetValue ?? 1 }
                : q,
            ),
          },
          goal,
        )
      : progress;
  return {
    progress,
    share,
    after: Math.max(progress, Math.min(100, after)),
    manual: goal.progressMode !== "tasks",
  };
}

/** Derived on read: expiring URLs from remote content are never saved as file IDs. */
export function firstDescriptionImage(value?: string) {
  for (const match of (value ?? "").matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const url = safeWebUrl(match[1]);
    if (url) return url;
  }
  return undefined;
}
