import type { GameState } from './game.ts';
export const citySphereIds = [
  'health',
  'sport',
  'growth',
  'english',
  'finance',
  'together',
  'driving',
  'tasks',
  'hobby',
] as const;
export const cityStyles = ['coastal', 'tropical', 'modern'] as const;
export type CityStyle = (typeof cityStyles)[number];
export type BuildingState = {
  tier: number;
  style: CityStyle;
  owned: string[];
  slots: (string | null)[];
};
export type CityState = { buildings: Record<string, BuildingState> };
export const cityDecor = [
  { id: 'palm', name: 'Пальма', icon: '🌴', price: 15 },
  { id: 'bench', name: 'Скамейка', icon: '🪑', price: 20 },
  { id: 'flowers', name: 'Цветник', icon: '🌺', price: 25 },
  { id: 'lamp', name: 'Фонарь', icon: '💡', price: 30 },
  { id: 'fountain', name: 'Фонтан', icon: '⛲', price: 45 },
  { id: 'statue', name: 'Статуя', icon: '🗿', price: 70 },
] as const;
export function buildingState(state: GameState, id: string): BuildingState {
  if (!citySphereIds.includes(id as (typeof citySphereIds)[number]))
    throw new Error('Здание не найдено.');
  return (
    state.city?.buildings[id] ?? {
      tier: 1,
      style: 'coastal',
      owned: [],
      slots: [null, null, null],
    }
  );
}
function update(
  state: GameState,
  id: string,
  b: BuildingState,
  coins = state.coins,
): GameState {
  return {
    ...state,
    coins,
    city: { buildings: { ...state.city?.buildings, [id]: b } },
  };
}
export function upgradeBuilding(
  state: GameState,
  id: string,
  expectedTier: number,
): GameState {
  const b = buildingState(state, id);
  if (b.tier !== expectedTier) throw new Error('Здание уже изменилось.');
  if (b.tier >= 3) throw new Error('Максимальное улучшение уже достигнуто.');
  if (Math.floor(state.spheres[id].xp / 200) + 1 < b.tier + 1)
    throw new Error(
      `Для улучшения нужен уровень сферы ${b.tier + 1}. Выполняй квесты этой сферы.`,
    );
  const price = b.tier === 1 ? 60 : 120;
  if (state.coins < price)
    throw new Error(
      'Недостаточно монет. Выполняй квесты, чтобы заработать ещё.',
    );
  return update(state, id, { ...b, tier: b.tier + 1 }, state.coins - price);
}
export function changeBuildingStyle(
  state: GameState,
  id: string,
  style: CityStyle,
): GameState {
  const b = buildingState(state, id);
  if (!cityStyles.includes(style)) throw new Error('Неизвестный стиль.');
  return b.style === style ? state : update(state, id, { ...b, style });
}
export function buyCityDecor(
  state: GameState,
  id: string,
  itemId: string,
): GameState {
  const b = buildingState(state, id);
  const item = cityDecor.find((x) => x.id === itemId);
  if (!item) throw new Error('Предмет не найден.');
  if (b.owned.includes(itemId)) return state;
  if (state.coins < item.price) throw new Error('Недостаточно монет.');
  return update(
    state,
    id,
    { ...b, owned: [...b.owned, itemId] },
    state.coins - item.price,
  );
}
export function placeCityDecor(
  state: GameState,
  id: string,
  itemId: string | null,
  slot: number,
): GameState {
  const b = buildingState(state, id);
  if (!Number.isInteger(slot) || slot < 0 || slot > 2)
    throw new Error('Выбери место в окружении.');
  if (itemId !== null && !b.owned.includes(itemId))
    throw new Error('Сначала приобрети этот предмет.');
  const slots = b.slots.map((item, index) =>
    index === slot ? itemId : item === itemId ? null : item,
  );
  return update(state, id, { ...b, slots });
}
export function validCity(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const city = value as Record<string, unknown>;
  if (
    typeof city.buildings !== 'object' ||
    city.buildings === null ||
    Array.isArray(city.buildings)
  )
    return false;
  return Object.entries(city.buildings).every(([id, value]) => {
    if (
      !citySphereIds.includes(id as (typeof citySphereIds)[number]) ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    )
      return false;
    const b = value as Record<string, unknown>;
    if (
      !Number.isInteger(b.tier) ||
      Number(b.tier) < 1 ||
      Number(b.tier) > 3 ||
      !cityStyles.includes(b.style as CityStyle) ||
      !Array.isArray(b.owned) ||
      new Set(b.owned).size !== b.owned.length ||
      !b.owned.every((item) => cityDecor.some((x) => x.id === item)) ||
      !Array.isArray(b.slots) ||
      b.slots.length !== 3 ||
      !b.slots.every(
        (item) => item === null || (b.owned as unknown[]).includes(item),
      )
    )
      return false;
    const occupied = b.slots.filter((x) => x !== null);
    return new Set(occupied).size === occupied.length;
  });
}
