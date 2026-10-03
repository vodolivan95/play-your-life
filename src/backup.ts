import { migrateState } from './game.ts';
import type { GameState } from './game.ts';
import { validateState } from './stateValidation.ts';
export const stateStorageKey = 'play-your-life-v1';
export const recoveryStorageKey = 'play-your-life-recovery-v1';
export function backupText(state: GameState) {
  return JSON.stringify(
    {
      app: 'PLAY YOUR LIFE',
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  );
}
export function restoreBackup(text: string): GameState {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw new Error('Выбери файл резервной копии размером до 10 МБ.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      'Не удалось прочитать JSON. Выбери файл резервной копии PLAY YOUR LIFE.',
    );
  }
  if (parsed && typeof parsed === 'object' && 'app' in parsed) {
    const envelope = parsed as {
      app: unknown;
      backupVersion: unknown;
      state: unknown;
    };
    if (envelope.app !== 'PLAY YOUR LIFE' || envelope.backupVersion !== 1)
      throw new Error('Этот формат резервной копии не поддерживается.');
    parsed = envelope.state;
  }
  validateState(parsed);
  return migrateState(parsed);
}
