/**
 * Разделы только для аккаунта владельца игры (Александр). В коде хранится не адрес почты,
 * а его SHA-256, чтобы адрес не попадал в опубликованный сайт открытым текстом.
 * Это ограничение интерфейса, а не защита данных: сам модуль «Психология» — внешний сайт.
 */
export const OWNER_EMAIL_SHA256 = '66a2bdd97307b85c9eb6cd7a2cbc0dad3f177b8797fb55bb58649e3cedfdd310';
/** Аккаунты с разделом «Психология»: Александр и (с 0.89.8) Иван. */
export const PSYCHOLOGY_EMAIL_SHA256 = [OWNER_EMAIL_SHA256, '68fbf3d2f2b99c52a62599a780b5ea077badb0e6f5e1e4998b680daefb316bfa'];
export const PSYCHOLOGY_URL = 'https://play-your-life-psychology.savani2026.chatgpt.site/';

/** Есть ли у аккаунта раздел «Психология». */
export async function isOwnerEmail(email: string | null | undefined): Promise<boolean> {
  if (!email || typeof crypto === 'undefined' || !crypto.subtle) return false;
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return PSYCHOLOGY_EMAIL_SHA256.includes(hex);
}
