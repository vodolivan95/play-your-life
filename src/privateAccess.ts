/**
 * Разделы только для аккаунта владельца игры (Александр). В коде хранится не адрес почты,
 * а его SHA-256, чтобы адрес не попадал в опубликованный сайт открытым текстом.
 * Это ограничение интерфейса, а не защита данных: сам модуль «Психология» — внешний сайт.
 */
export const OWNER_EMAIL_SHA256 = '66a2bdd97307b85c9eb6cd7a2cbc0dad3f177b8797fb55bb58649e3cedfdd310';
export const PSYCHOLOGY_URL = 'https://play-your-life-psychology.savani2026.chatgpt.site/';

export async function isOwnerEmail(email: string | null | undefined): Promise<boolean> {
  if (!email || typeof crypto === 'undefined' || !crypto.subtle) return false;
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === OWNER_EMAIL_SHA256;
}
