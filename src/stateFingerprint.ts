/**
 * Отпечаток содержимого игры. Нужен, чтобы отличить «облако изменено другим устройством»
 * от «в облаке лежит то, что мы сами отправили» (например, ответ сервера потерялся по пути).
 * Отпечаток не зависит от порядка ключей и от полей со значением undefined.
 */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(item).sort())
        sorted[key] = (item as Record<string, unknown>)[key];
      return sorted;
    }
    return item;
  });
}
/** Хэш cyrb53: быстрый, 53 бита, безопасное целое число. Не криптографический. */
export function hash53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export function fingerprint(value: unknown): number {
  return hash53(canonical(value));
}
