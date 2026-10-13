import type { GameState } from './game.ts';
import { validProjectImage } from './projectImage.ts';

export const shopItems = [
  {
    id: 'icecream',
    name: 'Любимое мороженое',
    description: 'Маленькая сладкая радость за хороший день',
    icon: '🍦',
    price: 80,
    color: '#ffeef3',
    kind: 'reward',
  },
  {
    id: 'coffee',
    name: 'Кофе в любимом месте',
    description: 'Пауза для себя и любимый напиток',
    icon: '☕',
    price: 150,
    color: '#fff0df',
    kind: 'reward',
  },
  {
    id: 'games',
    name: 'Час видеоигр',
    description: 'Честно заработанный отдых',
    icon: '🎮',
    price: 250,
    color: '#eceaff',
    kind: 'reward',
  },
  {
    id: 'movie',
    name: 'Вечер кино',
    description: 'Любой фильм без чувства вины',
    icon: '🎬',
    price: 300,
    color: '#ffedf1',
    kind: 'reward',
  },
  {
    id: 'book',
    name: 'Новая книга',
    description: 'Книга из твоего вишлиста',
    icon: '📖',
    price: 350,
    color: '#e7f8f0',
    kind: 'reward',
  },
  {
    id: 'dinner',
    name: 'Ужин в ресторане',
    description: 'Место, куда давно хотелось',
    icon: '🍣',
    price: 450,
    color: '#fff4dc',
    kind: 'reward',
  },
  {
    id: 'thermae',
    name: 'Поход в термы',
    description: 'Сауна, тёплые бассейны и полный отдых',
    icon: '♨️',
    price: 600,
    color: '#fff1e2',
    kind: 'reward',
  },
  {
    id: 'rest',
    name: 'Выходной без задач',
    description: 'Целый день только для себя',
    icon: '🏖️',
    price: 1200,
    color: '#e1f6ff',
    kind: 'reward',
  },
  {
    id: 'lux',
    name: 'Награда Люкс',
    description: 'Главная награда: выходные в отеле с ужином и спа — только для тебя',
    icon: '✨',
    price: 3000,
    color: '#15131f',
    kind: 'reward',
  },
  {
    id: 'gold',
    name: 'Золотая рамка',
    description: 'Сияющий акцент для твоего аватара',
    icon: '👑',
    price: 500,
    color: '#fff4dc',
    kind: 'frame',
  },
  {
    id: 'sky',
    name: 'Небесная рамка',
    description: 'Голубое сияние вокруг аватара',
    icon: '💎',
    price: 300,
    color: '#e1f6ff',
    kind: 'frame',
  },
  {
    id: 'rose',
    name: 'Розовая рамка',
    description: 'Нежный цвет твоего персонажа',
    icon: '🌸',
    price: 300,
    color: '#ffedf1',
    kind: 'frame',
  },
] as const;
/** Главная награда магазина: показывается отдельным баннером, а не в общей сетке. */
export const LUX_REWARD_ID = 'lux';
export type Purchase = {
  id: string;
  itemId: string;
  price: number;
  date: string;
  usedAt?: string;
};
/** Награда, которую игрок придумал сам: своё название, картинка и цена. */
export type CustomReward = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  createdAt: string;
  /** Купленную награду не удаляют, а убирают из витрины: покупки в «Моих» сохраняются. */
  archived?: boolean;
};
export type ShopState = { purchases: Purchase[]; equippedFrame?: string; rewardTargetId?: string; customRewards?: CustomReward[] };
export type ShopItem = {
  id: string; name: string; description: string; icon: string; price: number; color: string;
  kind: 'reward' | 'frame'; image?: string; custom?: boolean; archived?: boolean;
};
export const MAX_CUSTOM_REWARDS = 24;
export const MAX_CUSTOM_REWARD_PRICE = 100000;
export const customRewardIdPattern = /^custom-[A-Za-z0-9-]{8,60}$/;

function customItem(r: CustomReward): ShopItem {
  return { id: r.id, name: r.name, description: r.description ?? '', icon: '🎁', price: r.price, color: '#eef3ff', kind: 'reward', image: r.image, custom: true, archived: r.archived };
}
/** Каталог для витрины: встроенные товары и свои награды (без убранных из витрины). */
export function shopCatalog(state: GameState): ShopItem[] {
  return [
    ...(shopItems as readonly ShopItem[]),
    ...(state.shop?.customRewards ?? []).filter((r) => !r.archived).map(customItem),
  ];
}
/** Любой товар, включая убранные свои награды: нужен для истории покупок. */
export function findShopItem(state: GameState, id: string): ShopItem | undefined {
  const own = state.shop?.customRewards?.find((r) => r.id === id);
  return own ? customItem(own) : (shopItems as readonly ShopItem[]).find((i) => i.id === id);
}
export function saveCustomReward(
  state: GameState,
  input: { id?: string; name: string; description?: string; price: number; image?: string },
  now = new Date(),
): GameState {
  const name = input.name.trim(), description = input.description?.trim() || undefined;
  if (!name || name.length > 60) throw new Error('Название награды — от 1 до 60 символов.');
  if ((description?.length ?? 0) > 200) throw new Error('Описание — до 200 символов.');
  if (!Number.isSafeInteger(input.price) || input.price < 1 || input.price > MAX_CUSTOM_REWARD_PRICE)
    throw new Error(`Цена — целое число от 1 до ${MAX_CUSTOM_REWARD_PRICE.toLocaleString('ru')} монет.`);
  if (!validProjectImage(input.image)) throw new Error('Некорректная картинка.');
  const list = state.shop?.customRewards ?? [];
  const old = input.id ? list.find((r) => r.id === input.id && !r.archived) : undefined;
  if (input.id && !old) throw new Error('Награда не найдена.');
  if (!old && list.filter((r) => !r.archived).length >= MAX_CUSTOM_REWARDS)
    throw new Error(`Можно создать до ${MAX_CUSTOM_REWARDS} своих наград.`);
  const reward: CustomReward = {
    id: old?.id ?? `custom-${crypto.randomUUID()}`,
    name, price: input.price, createdAt: old?.createdAt ?? now.toISOString(),
    ...(description ? { description } : {}),
    ...(input.image ? { image: input.image } : {}),
  };
  return {
    ...state,
    shop: {
      ...state.shop,
      purchases: state.shop?.purchases ?? [],
      customRewards: old ? list.map((r) => (r.id === old.id ? reward : r)) : [...list, reward],
    },
  };
}
export function removeCustomReward(state: GameState, id: string): GameState {
  const list = state.shop?.customRewards ?? [];
  if (!list.some((r) => r.id === id)) return state;
  const bought = state.shop!.purchases.some((p) => p.itemId === id);
  const shop: ShopState = {
    ...state.shop!,
    customRewards: bought ? list.map((r) => (r.id === id ? { ...r, archived: true } : r)) : list.filter((r) => r.id !== id),
  };
  if (shop.rewardTargetId === id) delete shop.rewardTargetId;
  return { ...state, shop };
}
export function buyItem(
  state: GameState,
  itemId: string,
  now = new Date(),
): GameState {
  const item = findShopItem(state, itemId);
  if (!item || item.archived) throw new Error('Эта награда недоступна.');
  const purchases = state.shop?.purchases ?? [];
  if (item.kind === 'frame' && purchases.some((p) => p.itemId === itemId))
    throw new Error('Эта рамка уже твоя.');
  if (state.coins < item.price)
    throw new Error(
      'Недостаточно монет. Выполняй квесты, чтобы заработать ещё.',
    );
  return {
    ...state,
    coins: state.coins - item.price,
    shop: {
      ...state.shop,
      purchases: [
        ...purchases,
        {
          id: crypto.randomUUID(),
          itemId,
          price: item.price,
          date: now.toISOString(),
        },
      ],
    },
  };
}
export function redeemPurchase(
  state: GameState,
  purchaseId: string,
  now = new Date(),
): GameState {
  const purchase = state.shop?.purchases.find((p) => p.id === purchaseId);
  const item = purchase ? findShopItem(state, purchase.itemId) : undefined;
  if (!purchase || !item || purchase.usedAt) return state;
  if (item.kind === 'frame')
    return { ...state, shop: { ...state.shop!, equippedFrame: item.id } };
  return {
    ...state,
    shop: {
      ...state.shop!,
      purchases: state.shop!.purchases.map((p) =>
        p.id === purchaseId ? { ...p, usedAt: now.toISOString() } : p,
      ),
    },
  };
}

export function selectRewardTarget(state: GameState, itemId: string | null): GameState {
  if (itemId !== null && !shopCatalog(state).some(i => i.id === itemId && i.kind === 'reward')) throw new Error('Эта награда недоступна.');
  if ((state.shop?.rewardTargetId ?? null) === itemId) return state;
  const shop: ShopState = { ...state.shop, purchases: state.shop?.purchases ?? [] };
  if (itemId === null) delete shop.rewardTargetId;
  else shop.rewardTargetId = itemId;
  return { ...state, shop };
}
