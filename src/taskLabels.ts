import type { TaskLabel } from './game.ts';

export const TASK_LABEL_LIMIT = 50;
export const TASK_LABEL_NAME_LIMIT = 40;
const idPattern = /^[A-Za-z0-9_-]{1,64}$/;
const hasControlCharacters = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0)!;
    return code < 32 || (code >= 127 && code <= 159);
  });

export function validTaskLabels(value: unknown): value is TaskLabel[] {
  if (!Array.isArray(value) || value.length > TASK_LABEL_LIMIT) return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const label = item as Record<string, unknown>;
    if (
      typeof label.id !== 'string' ||
      !idPattern.test(label.id) ||
      typeof label.name !== 'string' ||
      !label.name.trim() ||
      label.name !== label.name.trim() ||
      label.name.length > TASK_LABEL_NAME_LIMIT ||
      hasControlCharacters(label.name)
    )
      return false;
    const normalized = label.name.toLocaleLowerCase('ru-RU');
    if (ids.has(label.id) || names.has(normalized)) return false;
    ids.add(label.id);
    names.add(normalized);
  }
  return true;
}
