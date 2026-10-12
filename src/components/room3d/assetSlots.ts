import type { ObjectId } from '../../roomEngine';
type AssetSlot = { file: string; available: boolean; license: string | null };
/** Enable only after adding a licensed, validated game-ready GLB to public/models/sport. */
export const sportAssets: Partial<Record<ObjectId, AssetSlot>> = {
  mat: { file: 'mat.glb', available: false, license: null },
  dumbbells: { file: 'dumbbells.glb', available: false, license: null },
  bench: { file: 'bench.glb', available: false, license: null },
  ball: { file: 'ball.glb', available: false, license: null },
  plant: { file: 'plant.glb', available: false, license: null },
  treadmill: { file: 'treadmill.glb', available: false, license: null },
};
export const futureAssetSlots = ['dumbbell-rack', 'kettlebells', 'exercise-bike', 'boxing-bag', 'power-rack', 'functional-trainer', 'trophy', 'sports-display'] as const;
/** Предметы без лицензированного GLB рисуются процедурными моделями из Models.tsx. */
export function assetUrl(id: ObjectId) {
  const entry = sportAssets[id];
  return entry?.available && entry.license ? `${import.meta.env.BASE_URL}models/sport/${entry.file}` : undefined;
}
