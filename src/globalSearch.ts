import type { GameState } from './game.ts';
import { spheres, achievements } from './game.ts';
import { goalProgressValue } from './goalWorkspace.ts';

export type SearchResultKind = 'task' | 'goal' | 'sphere' | 'city' | 'achievement';

export type SearchResult = {
  kind: SearchResultKind;
  /** Для задачи/проекта — их id. Для сферы/города — id сферы. Для достижения — её название (у достижений нет своего id). */
  id: string;
  title: string;
  subtitle: string;
  icon: string;
};

const KIND_LABEL: Record<SearchResultKind, string> = {
  task: 'Задача',
  goal: 'Проект',
  sphere: 'Сфера',
  city: 'Город',
  achievement: 'Достижение',
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ru');
}

/** Позиция первого совпадения (для сортировки — совпадения с начала строки выше). -1, если не найдено. */
function matchRank(haystack: string, needle: string): number {
  return normalize(haystack).indexOf(needle);
}

/**
 * Ищет по всему приложению — задачам, проектам, сферам, зданиям в «Городе» и достижениям —
 * простым сравнением подстроки без учёта регистра. Возвращает отсортированный и ограниченный список.
 */
export function searchEverything(state: GameState, rawQuery: string, limit = 8): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const results: { result: SearchResult; rank: number; order: number }[] = [];
  let order = 0;

  function push(result: SearchResult, rank: number) {
    results.push({ result, rank, order: order++ });
  }

  for (const sphere of spheres) {
    const rank = matchRank(sphere.name, query);
    if (rank >= 0) {
      push(
        {
          kind: 'sphere',
          id: sphere.id,
          title: sphere.name,
          subtitle: `${KIND_LABEL.sphere} · уровень ${sphere.score ?? 0}`,
          icon: sphere.icon,
        },
        rank,
      );
      push(
        {
          kind: 'city',
          id: sphere.id,
          title: `Здание «${sphere.name}» в Городе`,
          subtitle: KIND_LABEL.city,
          icon: '🏙️',
        },
        rank,
      );
    }
  }
  if (matchRank('город', query) >= 0 || matchRank('city', query) >= 0) {
    push({ kind: 'city', id: '', title: 'Открыть «Город»', subtitle: KIND_LABEL.city, icon: '🏙️' }, 0);
  }

  for (const goal of state.goals) {
    const rank = matchRank(goal.name, query);
    if (rank < 0) continue;
    const sphere = spheres.find((s) => s.id === goal.sphere);
    const progress = Math.round(goalProgressValue(state, goal));
    push(
      {
        kind: 'goal',
        id: goal.id,
        title: goal.name,
        subtitle: `${KIND_LABEL.goal} · ${sphere?.name ?? goal.sphere} · ${progress}%`,
        icon: sphere?.icon ?? '🎯',
      },
      rank,
    );
  }

  for (const quest of state.quests) {
    const rank = matchRank(quest.name, query);
    if (rank < 0) continue;
    const sphere = spheres.find((s) => s.id === quest.sphere);
    push(
      {
        kind: 'task',
        id: quest.id,
        title: quest.name,
        subtitle: `${KIND_LABEL.task} · ${sphere?.name ?? quest.sphere}${quest.done ? ' · выполнена' : ''}`,
        icon: sphere?.icon ?? '📝',
      },
      rank,
    );
  }

  for (const achievement of achievements) {
    const rank = Math.min(
      matchRank(achievement.name, query) >= 0 ? matchRank(achievement.name, query) : Infinity,
      matchRank(achievement.description, query) >= 0 ? matchRank(achievement.description, query) + 1000 : Infinity,
    );
    if (rank === Infinity) continue;
    push(
      {
        kind: 'achievement',
        id: achievement.name,
        title: achievement.name,
        subtitle: `${KIND_LABEL.achievement} · ${achievement.category}${achievement.unlocked(state) ? ' · получено' : ''}`,
        icon: achievement.icon,
      },
      rank,
    );
  }

  results.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return results.slice(0, limit).map((r) => r.result);
}
