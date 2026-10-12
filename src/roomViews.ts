import { coastalBuildings } from './coastalCity.ts';

/**
 * Вид из окон 3D-комнаты, рассчитанный по карте острова (1005 × 1280, ось Y вниз).
 * У комнаты два окна: заднее (камера смотрит в него) и боковое справа.
 * Перебираем четыре стороны света для заднего окна и выбираем ту, где в обоих окнах
 * видны разные соседние здания, а при равенстве — ближайшие.
 */
export type Facing = 'north' | 'east' | 'south' | 'west';
export type WindowView = { building: string | null; distance: number };
export type RoomViews = { facing: Facing; back: WindowView; side: WindowView };

const MAP = { width: 1005, height: 1280 };
const vectors: Record<Facing, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
/** Полуугол обзора окна, градусы. */
const CONE = 50;

function center(id: string): [number, number] {
  const b = coastalBuildings.find(item => item.id === id);
  if (!b) throw new Error(`Нет здания ${id}`);
  return [(b.x + b.width / 2) / 100 * MAP.width, (b.y + b.height / 2) / 100 * MAP.height];
}
/** Ближайшее здание в секторе обзора от точки `from` в направлении `dir`. */
export function nearestInView(id: string, dir: [number, number], exclude: string | null = null): WindowView {
  const [x, y] = center(id);
  let best: WindowView = { building: null, distance: Infinity };
  for (const other of coastalBuildings) {
    if (other.id === id || other.id === exclude) continue;
    const [ox, oy] = center(other.id), dx = ox - x, dy = oy - y;
    const along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1] - dy * dir[0]);
    if (along <= 0 || Math.atan2(across, along) * 180 / Math.PI > CONE) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < best.distance) best = { building: other.id, distance: Math.round(distance) };
  }
  return best;
}
export function roomViews(id: string): RoomViews {
  let best: RoomViews | null = null, bestScore = -Infinity;
  for (const facing of ['south', 'west', 'north', 'east'] as const) {
    const f = vectors[facing], right: [number, number] = [-f[1], f[0]];
    const back = nearestInView(id, f), side = nearestInView(id, right, back.building);
    const seen = [back, side].filter(view => view.building);
    const score = seen.length * 10000 - seen.reduce((sum, view) => sum + view.distance, 0);
    if (score > bestScore) { best = { facing, back, side }; bestScore = score; }
  }
  return best!;
}
