/**
 * Разделение облачного сохранения.
 *
 * В памяти, в локальных черновиках и в резервных копиях игра всегда полная.
 * Только при записи в Firestore старые события уходят в архив по месяцам
 * (`players/{uid}/history/{ГГГГ-ММ}`), а обложки — в отдельные документы
 * (`players/{uid}/images/{id}`). В основном документе остаются указатели
 * `historyIndex` и `imageRefs`. При загрузке игра собирается обратно.
 */
import type { Event, GameState } from './game.ts';
import { validProjectImage } from './projectImage.ts';

/** События моложе этого срока остаются в основном документе. */
export const HISTORY_KEEP_DAYS = 60;
/** Запас под лимит 1 МиБ одного документа Firestore. */
export const MAX_HISTORY_MONTH_BYTES = 900_000;

const entityId = /^[A-Za-z0-9_-]{1,80}$/;
export const monthPattern = /^\d{4}-\d{2}$/;
export const imageDocPattern = /^(goal|quest)-[A-Za-z0-9_-]{1,80}-[0-9a-f]{8}$/;
export const imageRefPattern = /^(goal|quest):[A-Za-z0-9_-]{1,80}$/;

export type CloudSplit = {
  /** Основной документ: недавние события, без обложек, с указателями. */
  stored: GameState;
  /** Архив событий по месяцам, новые события первыми. */
  history: Record<string, Event[]>;
  /** Обложки: id документа → data URL. */
  images: Record<string, string>;
};

/** FNV-1a, 32 бита: короткий устойчивый отпечаток содержимого. */
export function fingerprint(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Подпись месяца: число событий и отпечаток их содержимого. */
export function monthSignature(events: Event[]) {
  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));
  return `${events.length}-${fingerprint(JSON.stringify(sorted))}`;
}

export function eventMonth(event: Event) {
  return new Date(event.date).toISOString().slice(0, 7);
}

function newestFirst(a: Event, b: Event) {
  return Date.parse(b.date) - Date.parse(a.date);
}

/** Состояние уже в облачном виде (пришло из основного документа). */
export function isCloudForm(state: GameState) {
  return state.historyIndex !== undefined || state.imageRefs !== undefined;
}

export function splitForCloud(state: GameState, now = new Date()): CloudSplit {
  if (isCloudForm(state)) return { stored: state, history: {}, images: {} };
  const cutoff = now.getTime() - HISTORY_KEEP_DAYS * 86_400_000;
  const kept: Event[] = [];
  const history: Record<string, Event[]> = {};
  for (const event of state.events) {
    if (Date.parse(event.date) >= cutoff) kept.push(event);
    else (history[eventMonth(event)] ??= []).push(event);
  }
  const historyIndex: Record<string, string> = {};
  for (const [month, events] of Object.entries(history)) {
    events.sort(newestFirst);
    historyIndex[month] = monthSignature(events);
    if (new TextEncoder().encode(JSON.stringify(events)).length > MAX_HISTORY_MONTH_BYTES)
      throw new Error(`История за ${month} слишком большая для сохранения. Скачайте резервную копию.`);
  }
  const images: Record<string, string> = {};
  const imageRefs: Record<string, string> = {};
  const extract = (kind: 'goal' | 'quest', id: string, data: string | undefined) => {
    // Обложку с необычным id оставляем в основном документе, как раньше.
    if (!data || !entityId.test(id)) return false;
    const docId = `${kind}-${id}-${fingerprint(data)}`;
    images[docId] = data;
    imageRefs[`${kind}:${id}`] = docId;
    return true;
  };
  const goals = state.goals.map((goal) => {
    if (!extract('goal', goal.id, goal.image)) return goal;
    const { image, ...rest } = goal;
    void image;
    return rest;
  });
  const quests = state.quests.map((quest) => {
    if (!extract('quest', quest.id, quest.coverImage)) return quest;
    const { coverImage, ...rest } = quest;
    void coverImage;
    return rest;
  });
  return {
    stored: { ...state, events: kept, goals, quests, historyIndex, imageRefs },
    history,
    images,
  };
}

/**
 * Собирает полную игру. Если какой-то части архива или обложки нет либо она
 * не совпадает с указателем, бросает ошибку: сохранять поверх неполной игры нельзя.
 */
export function assembleFromCloud(
  stored: GameState,
  history: Record<string, Event[]>,
  images: Record<string, string>,
): GameState {
  if (!isCloudForm(stored)) return stored;
  const missing = () => {
    throw new Error('Часть сохранения не загрузилась из облака. Повторите попытку позже.');
  };
  const events = [...stored.events];
  const seen = new Set(events.map((e) => e.id));
  for (const [month, signature] of Object.entries(stored.historyIndex ?? {})) {
    const archived = history[month];
    if (!archived || monthSignature(archived) !== signature) return missing();
    for (const event of archived)
      if (!seen.has(event.id)) {
        seen.add(event.id);
        events.push(event);
      }
  }
  events.sort(newestFirst);
  const refs = stored.imageRefs ?? {};
  const image = (key: string) => {
    const docId = refs[key];
    if (!docId) return undefined;
    const data = images[docId];
    if (!data || !validProjectImage(data)) return missing();
    return data;
  };
  const goals = stored.goals.map((goal) => {
    const data = image(`goal:${goal.id}`);
    return data ? { ...goal, image: data } : goal;
  });
  const quests = stored.quests.map((quest) => {
    const data = image(`quest:${quest.id}`);
    return data ? { ...quest, coverImage: data } : quest;
  });
  const { historyIndex, imageRefs, ...full } = stored;
  void historyIndex;
  void imageRefs;
  return { ...full, events, goals, quests };
}

/** Какие части облака нужно записать, чтобы основной документ на них ссылался. */
export function cloudWrites(next: CloudSplit, previous: GameState | null) {
  const oldIndex = previous?.historyIndex ?? {};
  const oldImages = new Set(Object.values(previous?.imageRefs ?? {}));
  return {
    months: Object.keys(next.history).filter(
      (month) => oldIndex[month] !== next.stored.historyIndex?.[month],
    ),
    images: Object.keys(next.images).filter((id) => !oldImages.has(id)),
  };
}

/** Обложки, на которые больше никто не ссылается после сохранения. */
export function unusedImages(previousRefs: string[], stored: GameState) {
  const used = new Set(Object.values(stored.imageRefs ?? {}));
  return [...new Set(previousRefs)].filter((id) => !used.has(id));
}
