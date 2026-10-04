export function saveError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  if (code.includes('permission-denied'))
    return 'Firebase отклонил доступ. Проверьте опубликованные правила Firestore. Текущая игра не сбрасывается.';
  if (code.includes('resource-exhausted'))
    return 'Достигнут лимит Firebase. Изменения сохранены локально и ожидают отправки.';
  if (error instanceof Error && error.message.includes('слишком большое'))
    return error.message;
  if (code.includes('failed-precondition'))
    return 'Облачное хранилище пока недоступно. Проверьте настройку Firestore.';
  return 'Не удалось связаться с облаком. Локальные изменения ожидают отправки.';
}
