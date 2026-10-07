// Области входа в процентах оригинального изображения 1005 × 1280.
export const coastalBuildings = [
  { id: 'health', x: 40, y: 7, width: 24, height: 19 },
  { id: 'sport', x: 15, y: 12, width: 24, height: 17 },
  { id: 'growth', x: 69, y: 14, width: 30, height: 18 },
  { id: 'finance', x: 8, y: 29, width: 24, height: 16 },
  { id: 'english', x: 71, y: 32, width: 29, height: 17 },
  { id: 'driving', x: 13, y: 48, width: 29, height: 14 },
  { id: 'together', x: 58, y: 47, width: 36, height: 17 },
  { id: 'tasks', x: 40, y: 63, width: 27, height: 15 },
  { id: 'hobby', x: 75, y: 68, width: 25, height: 19 },
] as const;

// Roof/facade silhouettes within the existing bounds. Streets at rectangle corners are not entrances.
export const coastalHitShapes:Record<string,string>={
  health:'polygon(25% 0, 67% 0, 82% 20%, 100% 38%, 95% 78%, 65% 100%, 15% 91%, 0 55%, 8% 25%)',
  sport:'polygon(5% 12%, 65% 0, 98% 18%, 100% 70%, 72% 100%, 12% 90%, 0 50%)',
  growth:'polygon(12% 5%, 70% 0, 100% 17%, 98% 78%, 74% 100%, 5% 86%, 0 34%)',
  finance:'polygon(28% 0, 75% 8%, 100% 35%, 96% 78%, 68% 100%, 8% 86%, 0 43%)',
  english:'polygon(20% 4%, 72% 0, 100% 27%, 97% 81%, 70% 100%, 5% 85%, 0 42%)',
  driving:'polygon(15% 7%, 75% 0, 100% 28%, 95% 80%, 55% 100%, 5% 79%, 0 35%)',
  together:'polygon(15% 10%, 73% 0, 100% 24%, 97% 78%, 77% 100%, 5% 85%, 0 40%)',
  tasks:'polygon(18% 6%, 77% 0, 100% 25%, 93% 78%, 67% 100%, 8% 84%, 0 40%)',
  hobby:'polygon(20% 0, 76% 6%, 100% 25%, 100% 82%, 65% 100%, 5% 84%, 0 32%)',
};
