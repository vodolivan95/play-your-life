import quotesData from './quotes.json';
import { dateKey } from './game';

export type Quote = { id: string; category: string; text: string };

export const QUOTES: Quote[] = quotesData.quotes;

/** Сутки делятся на 4 равных окна (0–5, 6–11, 12–17, 18–23 часа по местному времени устройства). */
export function daySlot(now = new Date()): 0 | 1 | 2 | 3 {
  return Math.floor(now.getHours() / 6) as 0 | 1 | 2 | 3;
}

/** Простой устойчивый хэш строки в неотрицательное целое. */
function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Цитата дня: меняется 4 раза в сутки, одна и та же для всех игроков в
 * конкретном окне времени (детерминирована датой и слотом, без сети и
 * без сохранения в состоянии игрока).
 */
export function quoteForNow(now = new Date()): Quote {
  const key = `${dateKey(now)}:${daySlot(now)}`;
  const index = hashString(key) % QUOTES.length;
  return QUOTES[index];
}
