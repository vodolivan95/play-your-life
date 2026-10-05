/** Canonical sphere progression. Player progression is independent. */
export const MIN_SPHERE_LEVEL = 0;
export const MAX_SPHERE_LEVEL = 100;
export const SPHERE_XP_PER_LEVEL = 200;
export const SPHERE_PROGRESSION_MODEL = 'xp-levels-100-v1' as const;
export function sphereProgress(xp: number) {
  const totalXP = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const level = Math.min(MAX_SPHERE_LEVEL, Math.floor(totalXP / SPHERE_XP_PER_LEVEL));
  const maxed = level === MAX_SPHERE_LEVEL;
  const currentXP = maxed ? 0 : totalXP - level * SPHERE_XP_PER_LEVEL;
  return { level, totalXP, maxed, currentXP, requiredXP: maxed ? 0 : SPHERE_XP_PER_LEVEL, remainingXP: maxed ? 0 : SPHERE_XP_PER_LEVEL - currentXP, progress: maxed ? 100 : currentXP / SPHERE_XP_PER_LEVEL * 100 };
}
