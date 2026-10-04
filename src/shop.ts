import type { GameState } from './game.ts';

export const shopItems = [
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
    id: 'rest',
    name: 'Выходной без задач',
    description: 'Целый день только для себя',
    icon: '🏖️',
    price: 1200,
    color: '#e1f6ff',
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
export type Purchase = {
  id: string;
  itemId: string;
  price: number;
  date: string;
  usedAt?: string;
};
export type ShopState = { purchases: Purchase[]; equippedFrame?: string; rewardTargetId?: string };
export function buyItem(
  state: GameState,
  itemId: string,
  now = new Date(),
): GameState {
  const item = shopItems.find((i) => i.id === itemId);
  if (!item) throw new Error('Эта награда недоступна.');
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
  const item = shopItems.find((i) => i.id === purchase?.itemId);
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
  if (itemId !== null && !shopItems.some(i => i.id === itemId && i.kind === 'reward')) throw new Error('Эта награда недоступна.');
  if ((state.shop?.rewardTargetId ?? null) === itemId) return state;
  const shop: ShopState = { ...state.shop, purchases: state.shop?.purchases ?? [] };
  if (itemId === null) delete shop.rewardTargetId;
  else shop.rewardTargetId = itemId;
  return { ...state, shop };
}
