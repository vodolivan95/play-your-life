import { useSyncExternalStore } from 'react';

export type MenuTheme = 'dark' | 'light';

/** Тот же ключ, что и у главной: тема главной и меню — одна общая настройка. */
const themeKey = 'play-your-life-home-theme';
const listeners = new Set<() => void>();

function read(): MenuTheme {
  try {
    return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let current: MenuTheme = read();

export function setMenuTheme(next: MenuTheme) {
  current = next;
  try {
    localStorage.setItem(themeKey, next);
  } catch {
    /* тема не сохранится после перезагрузки, это не страшно */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Текущая тема и функция её смены; все компоненты меняются вместе. */
export function useMenuTheme(): [MenuTheme, (next: MenuTheme) => void] {
  const theme = useSyncExternalStore(subscribe, () => current);
  return [theme, setMenuTheme];
}
