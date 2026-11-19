import type { Space } from '../../sharedSpace';

/* Форматирование для «Нашей жизни»: имена участников и даты. */
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '·';
export const nameIn = (space: Space) => (uid: string) => space.members[uid]?.name ?? 'Участник';
export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
export const fmtDateTime = (ms: number) => `${fmtDate(ms)}, ${fmtTime(ms)}`;
export const fmtIso = (iso: string) => new Date(iso).toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
export const fmtDay = (day: string) => (day ? new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
