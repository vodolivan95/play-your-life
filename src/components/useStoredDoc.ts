import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { accountStorage } from '../accountStorage';

/**
 * Документ раздела в localStorage владельца: загрузка, отложенная запись и подхват изменений
 * из другой вкладки. Ошибку записи (нет места, запрет хранения) показывает через `error`.
 */
export function useStoredDoc<T>(key: string, parse: (raw: string | null) => T) {
  const parser = useRef(parse);
  const [doc, setDoc] = useState<T>(() => parse(accountStorage.getItem(key)));
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const pending = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedKey = useRef(key);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current === null) return;
    try {
      accountStorage.setItem(loadedKey.current, JSON.stringify(pending.current));
      setError('');
      setSavedAt(new Date());
    } catch {
      setError('Не удалось сохранить: в браузере закончилось место. Удалите крупные изображения или файлы.');
    }
    pending.current = null;
  }, []);

  useEffect(() => {
    if (loadedKey.current === key) return;
    flush();
    loadedKey.current = key;
    queueMicrotask(() => setDoc(parser.current(accountStorage.getItem(key))));
  }, [key, flush]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === loadedKey.current && pending.current === null) setDoc(parser.current(e.newValue));
    };
    const onHide = () => flush();
    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  const update = useCallback((action: SetStateAction<T>) => {
    setDoc((current) => {
      const next = typeof action === 'function' ? (action as (value: T) => T)(current) : action;
      if (next !== current) {
        pending.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 400);
      }
      return next;
    });
  }, [flush]);

  return { doc, update, error, savedAt, flush };
}
