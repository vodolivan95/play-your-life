// Атласы транспорта: 3D-модели Kenney (Car Kit, Watercraft Kit, CC0), отрисованные под углом карты.
// Каждая строка — одна модель, 16 столбцов — направления движения по экрану с шагом 22.5°, столбец 0 смотрит вправо.
export const DIRECTIONS = 16;
export const CAR_CELL = 64;
export const CAR_TYPES = 40;
// Размер кадра на карте (единицы MAP_WIDTH); точка касания дороги — центр кадра.
export const CAR_DRAW = 30;
export const BOAT_CELL = 128;
// Точка ватерлинии в кадре судна: 0.5 по ширине и 0.618 по высоте.
export const BOAT_ANCHOR = 0.618;
export type BoatType = { model: string; label: string; draw: number; radius: number };
export const boatTypes: BoatType[] = [
  { model: 'boat-speed-j', label: 'Яхта-катер', draw: 29, radius: 14 },
  { model: 'ship-ocean-liner-small', label: 'Лайнер', draw: 99, radius: 30 },
  { model: 'boat-speed-a', label: 'Катер', draw: 29, radius: 11 },
  { model: 'boat-speed-b', label: 'Катер-2', draw: 29, radius: 11 },
  { model: 'boat-speed-g', label: 'Гоночный катер', draw: 29, radius: 11 },
  { model: 'boat-speed-h', label: 'Гоночный катер-2', draw: 29, radius: 11 },
  { model: 'boat-fishing-small', label: 'Рыбацкая лодка', draw: 29, radius: 13 },
  { model: 'boat-tug-a', label: 'Буксир', draw: 29, radius: 13 },
  { model: 'boat-sail-a', label: 'Парусник', draw: 36, radius: 14 },
  { model: 'boat-sail-b', label: 'Парусник-2', draw: 34, radius: 14 },
];
// Какие суда ходят по каждому водному маршруту.
export const boatsByRoute: Record<string, number[]> = {
  'ocean-yachts': [0, 1],
  'ocean-speedboats': [2, 3, 4, 5],
  'west-cruise': [6, 7],
  'west-sail': [8, 9],
};
export const boatFallback = [6, 7];
export function directionFrame(angle: number) {
  const turn = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
  return Math.round(turn * DIRECTIONS) % DIRECTIONS;
}
