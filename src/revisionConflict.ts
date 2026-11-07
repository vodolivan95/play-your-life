/** Firestore может отклонить устаревшую запись правилами до обычного retry транзакции. */
export async function revisionConflictOnDenial<T>(
  save: () => Promise<T | null>,
  expected: number,
  readRevision: () => Promise<number | undefined>,
): Promise<T | null> {
  try {
    return await save();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      try {
        const actual = await readRevision();
        // Только доказанная более новая серверная запись означает конфликт.
        if (actual !== undefined && Number.isSafeInteger(actual) && actual > expected) return null;
      } catch { /* Исходная ошибка доступа важнее ошибки дополнительного чтения. */ }
    }
    throw error;
  }
}
