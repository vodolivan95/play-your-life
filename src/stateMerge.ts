/**
 * Трёхстороннее слияние состояния игры (как на телефоне и компьютере одновременно
 * копятся несинхронизированные правки): общий предок (`base` — последняя версия,
 * подтверждённая облаком до начала локальных правок), `local` (то, что сейчас
 * на этом устройстве) и `remote` (то, что успело уйти в облако с другого устройства).
 *
 * Слияние структурное, без знания игровой схемы: массивы объектов с `id`/`transactionId`
 * сливаются по ключу (добавления с обеих сторон сохраняются, удаление с любой стороны
 * побеждает, кроме случая «удалено с одной стороны, изменено с другой» — тогда правка
 * побеждает удаление); массивы без такого ключа (даты, строки-логи) — как множество:
 * объединение минус то, что пропало одновременно и в base, и на одной из сторон;
 * словари (profile, spheres, skillTrees и т.п.) — как объекты, по тем же правилам;
 * обычные скаляры — «не менялось с одной стороны → берём другую сторону», а если
 * обе стороны успели изменить одно и то же поле — побеждает `local` (устройство,
 * которое сейчас пытается сохраниться).
 *
 * Отдельное правило для накопительных числовых полей (xp, монеты, опыт сферы):
 * их нельзя сливать как обычный скаляр (одна из сторон потеряла бы честно
 * заработанное), поэтому результат — remote + (local − base), то есть к актуальному
 * облачному значению добавляется именно то, что заработало само это устройство.
 * Экономическая проверка (`firestore.rules`/`questEconomy.ts`) после слияния работает
 * как обычно и остаётся последним рубежом защиты от задвоенных наград.
 * `spheres.*.score` сюда не входит: это не накопительная награда, а абсолютная
 * самооценка «Жизненного счёта» 0–9 (`changeScore()`), которую игрок один раз
 * выставляет заново — сливается обычным правилом скаляров.
 */
import { canonical } from './stateFingerprint.ts';
import type { GameState } from './game.ts';

/** Пути вида 'spheres.*.xp' — '*' совпадает с любым ключом словаря на этом уровне. */
const ADDITIVE_PATHS = ['xp', 'coins', 'spheres.*.xp'];

function pathMatches(path: string[], pattern: string) {
  const parts = pattern.split('.');
  if (parts.length !== path.length) return false;
  return parts.every((part, i) => part === '*' || part === path[i]);
}

function isAdditive(path: string[]) {
  return (
    path.length > 0 &&
    typeof path[path.length - 1] === 'string' &&
    ADDITIVE_PATHS.some((pattern) => pathMatches(path, pattern))
  );
}

function sameValue(a: unknown, b: unknown) {
  return a === b || canonical(a) === canonical(b);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Поле, которое однозначно опознаёт элемент массива среди добавлений/правок. */
function arrayIdKey(arrays: unknown[][]): 'id' | 'transactionId' | null {
  for (const key of ['id', 'transactionId'] as const) {
    let sawAny = false;
    const ok = arrays.every((arr) =>
      arr.every((item) => {
        if (!isPlainObject(item)) return false;
        const value = item[key];
        if (value === undefined) return false;
        sawAny = true;
        return typeof value === 'string' && value.length > 0;
      }),
    );
    if (ok && sawAny) return key;
  }
  return null;
}

/** Слияние массива объектов по идентифицирующему полю. */
function mergeKeyedArray(
  key: 'id' | 'transactionId',
  base: Record<string, unknown>[],
  local: Record<string, unknown>[],
  remote: Record<string, unknown>[],
  path: string[],
): unknown[] {
  const byKey = (arr: Record<string, unknown>[]) => {
    const map = new Map<string, Record<string, unknown>>();
    for (const item of arr) map.set(item[key] as string, item);
    return map;
  };
  const baseMap = byKey(base),
    localMap = byKey(local),
    remoteMap = byKey(remote);
  const order: string[] = [];
  const seen = new Set<string>();
  for (const item of [...local, ...remote]) {
    const id = item[key] as string;
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  const result: unknown[] = [];
  for (const id of order) {
    const inBase = baseMap.get(id),
      inLocal = localMap.get(id),
      inRemote = remoteMap.get(id);
    if (inLocal && inRemote) {
      result.push(mergeValue(inBase, inLocal, inRemote, [...path, id]));
      continue;
    }
    // Отсутствует на одной стороне: это либо добавление (не было в base), либо удаление.
    if (!inBase) {
      // Элемент появился только с одной стороны — это её собственное добавление.
      result.push(inLocal ?? inRemote);
      continue;
    }
    const survivor = inLocal ?? inRemote;
    if (sameValue(survivor, inBase)) continue; // Удалено с одной стороны, не менялось с другой.
    result.push(survivor); // Удалено с одной стороны, изменено с другой — правка побеждает.
  }
  return result;
}

/** Множество без устойчивых id: строки, числа, простые логи. */
function mergeSetArray(base: unknown[], local: unknown[], remote: unknown[]): unknown[] {
  const key = (v: unknown) => canonical(v);
  const baseKeys = new Set(base.map(key));
  const result: unknown[] = [];
  const seen = new Set<string>();
  const add = (item: unknown) => {
    const k = key(item);
    if (seen.has(k)) return;
    seen.add(k);
    result.push(item);
  };
  for (const item of local) if (!baseKeys.has(key(item)) || remote.some((r) => key(r) === key(item))) add(item);
  for (const item of remote) if (!baseKeys.has(key(item)) || local.some((l) => key(l) === key(item))) add(item);
  return result;
}

function mergeArray(base: unknown, local: unknown[], remote: unknown[], path: string[]): unknown[] {
  const baseArr = Array.isArray(base) ? base : [];
  if (sameValue(local, remote)) return local;
  if (sameValue(baseArr, local)) return remote;
  if (sameValue(baseArr, remote)) return local;
  const key = arrayIdKey([baseArr, local, remote]);
  if (key)
    return mergeKeyedArray(
      key,
      baseArr as Record<string, unknown>[],
      local as Record<string, unknown>[],
      remote as Record<string, unknown>[],
      path,
    );
  return mergeSetArray(baseArr, local, remote);
}

function mergeObject(
  base: unknown,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  path: string[],
): Record<string, unknown> {
  const baseObj = isPlainObject(base) ? base : {};
  const keys = new Set([...Object.keys(baseObj), ...Object.keys(local), ...Object.keys(remote)]);
  const result: Record<string, unknown> = {};
  for (const k of keys) {
    const inBase = baseObj[k],
      inLocal = local[k],
      inRemote = remote[k];
    const hasLocal = k in local,
      hasRemote = k in remote,
      hasBase = k in baseObj;
    if (!hasLocal && !hasRemote) continue;
    if (!hasLocal || !hasRemote) {
      if (!hasBase) {
        // Новое поле только с одной стороны.
        result[k] = hasLocal ? inLocal : inRemote;
        continue;
      }
      const survivorHas = hasLocal;
      const survivorValue = hasLocal ? inLocal : inRemote;
      if (sameValue(survivorValue, inBase)) continue; // Удалено с одной стороны, не менялось с другой.
      result[k] = survivorValue; // Удалено с одной стороны, изменено с другой — правка побеждает.
      void survivorHas;
      continue;
    }
    result[k] = mergeValue(inBase, inLocal, inRemote, [...path, k]);
  }
  return result;
}

function mergeValue(base: unknown, local: unknown, remote: unknown, path: string[]): unknown {
  if (sameValue(local, remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) return mergeArray(base, local, remote, path);
  if (isPlainObject(local) && isPlainObject(remote)) return mergeObject(base, local, remote, path);
  if (typeof local === 'number' && typeof remote === 'number' && isAdditive(path)) {
    const baseNum = typeof base === 'number' ? base : remote;
    return remote + (local - baseNum);
  }
  if (sameValue(base, local)) return remote; // Не менялось локально — берём облачное.
  if (sameValue(base, remote)) return local; // Не менялось в облаке — берём локальное.
  return local; // Обе стороны изменили одно и то же поле — побеждает текущее устройство.
}

/**
 * Сливает три версии игры в одну. Результат ещё должен пройти `validateState()`
 * и обычную отправку через `SaveDriver.save()` — экономика (XP/монеты) там
 * перепроверяется по доказательствам заново, слияние лишь готовит кандидата.
 */
export function mergeStates(base: GameState, local: GameState, remote: GameState): GameState {
  return mergeObject(base, local as unknown as Record<string, unknown>, remote as unknown as Record<string, unknown>, []) as unknown as GameState;
}
