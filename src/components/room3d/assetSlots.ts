import type { ObjectId } from '../../roomEngine';
/**
 * GLB-модели спортзала в public/models/sport. Сейчас — авторские процедурные модели (CC0),
 * собранные scripts/blend2glb/sport_models.py. Любой файл можно заменить своей моделью с тем же именем:
 * движок сам масштабирует её под клетку предмета и ставит на пол.
 */
const CC0 = 'CC0 PLAY YOUR LIFE (scripts/blend2glb/sport_models.py)';
export const sportAssets: Partial<Record<ObjectId, { file: string; available: boolean; license: string | null }>> = {
  mat: { file: 'mat.glb', available: true, license: CC0 },
  dumbbells: { file: 'dumbbells.glb', available: true, license: CC0 },
  bench: { file: 'bench.glb', available: true, license: CC0 },
  ball: { file: 'ball.glb', available: true, license: CC0 },
  plant: { file: 'plant.glb', available: true, license: CC0 },
  treadmill: { file: 'treadmill.glb', available: true, license: CC0 },
  kettlebells: { file: 'kettlebells.glb', available: true, license: CC0 },
  'dumbbell-rack': { file: 'dumbbell-rack.glb', available: true, license: CC0 },
  'exercise-bike': { file: 'exercise-bike.glb', available: true, license: CC0 },
  'boxing-bag': { file: 'boxing-bag.glb', available: true, license: CC0 },
  'power-rack': { file: 'power-rack.glb', available: true, license: CC0 },
};
export const futureAssetSlots = ['functional-trainer', 'sports-display'] as const;
export const decorAssets = { trophy: 'trophy.glb', plant: 'plant.glb' } as const;
export function assetUrl(id: ObjectId) {
  const entry = sportAssets[id];
  return entry?.available && entry.license ? `${import.meta.env.BASE_URL}models/sport/${entry.file}` : undefined;
}
export function decorUrl(id: keyof typeof decorAssets) {
  return `${import.meta.env.BASE_URL}models/sport/${decorAssets[id]}`;
}
