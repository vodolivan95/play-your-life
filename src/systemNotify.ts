import { BRAND_ASSET_ROOT } from './brandAssets.ts';

/* PLAY YOUR LIFE 2.0 — системные уведомления телефона и компьютера (без сервера):
 * приходят, пока игра открыта или свёрнута. На Android их показывает сервис-воркер public/sw.js. */
const base = () => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
const icon = () => `${base()}${BRAND_ASSET_ROOT}icon-192.png`;

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notificationPermission = (): NotificationPermission | 'unsupported' => (notificationsSupported() ? Notification.permission : 'unsupported');

export async function askNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}

export function registerNotificationWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || location.protocol === 'file:' || !import.meta.env?.PROD) return;
  navigator.serviceWorker.register(`${base()}sw.js`).catch(() => undefined);
  // Нажатие на уведомление при открытой игре: переходим по ссылке внутри приложения.
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data as { type?: string; url?: string } | undefined;
    if (data?.type === 'pyl-open' && data.url) { const hash = new URL(data.url).hash; if (hash) location.hash = hash; }
  });
}

/** Показать системное уведомление. hash — раздел игры, который откроется по нажатию (например, «#our/chat»). */
export async function showSystemNotification(title: string, body: string, hash = '', tag?: string): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  const url = new URL(hash || '', location.href).toString();
  const options: NotificationOptions = { body, icon: icon(), badge: icon(), tag, data: { url } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, options); return true; }
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); if (hash) location.hash = hash; n.close(); };
    return true;
  } catch { return false; }
}

/** Неделя года (понедельник — первый день): ключ для «раз в неделю». */
export function weekKey(d = new Date()): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y = x.getUTCFullYear();
  const w = Math.ceil(((x.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** Пора ли напомнить о психологии: пятница, с 10:00, и на этой неделе ещё не напоминали. */
export function psychologyReminderDue(now: Date, lastWeek: string | null): boolean {
  return now.getDay() === 5 && now.getHours() >= 10 && lastWeek !== weekKey(now);
}

/** Ссылка из уведомления «#open=<раздел>» → id раздела игры. */
export const readOpenRoute = (hash: string) => /^#open=([a-z0-9-]+)$/.exec(hash)?.[1] ?? null;
