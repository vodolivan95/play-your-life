import { useSyncExternalStore } from 'react';

export type MenuTheme = 'dark' | 'light';

/** Одна общая тема всего приложения: меню, главная, все страницы и окна. */
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

/** Тема ставится на <html>: по ней стили всех страниц выбирают светлые или тёмные цвета. */
function apply(theme: MenuTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070d20' : '#edf8ff');
}
apply(current);

export function setMenuTheme(next: MenuTheme) {
  current = next;
  apply(next);
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
