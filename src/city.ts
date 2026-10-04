import type { GameState } from './game.ts';

export const cityRooms: Record<string, { name: string; activity: string; items: [string, string, string]; icons: [string, string, string] }> = {
  health: { name: 'Центр здоровья', activity: 'Отдыхают и заботятся о себе', items: ['Зона восстановления', 'Полезное кафе', 'Сад спокойствия'], icons: ['🛋️', '🥗', '🌿'] },
  sport: { name: 'Спортивный клуб', activity: 'Тренируются и общаются', items: ['Тренажёры', 'Зона йоги', 'Кубок клуба'], icons: ['🏋️', '🧘', '🏆'] },
  growth: { name: 'Библиотека знаний', activity: 'Читают и учатся', items: ['Книжные стеллажи', 'Стол исследователя', 'Обсерватория'], icons: ['📚', '🔬', '🔭'] },
  english: { name: 'Языковая академия', activity: 'Практикуют язык вместе', items: ['Аудиостудия', 'Разговорный клуб', 'Карта путешествий'], icons: ['🎧', '🛋️', '🌍'] },
  finance: { name: 'Банк возможностей', activity: 'Планируют новые возможности', items: ['Рабочий кабинет', 'Сейф накоплений', 'Биржевой экран'], icons: ['💻', '🏦', '📈'] },
  together: { name: 'Дом общих дел', activity: 'Готовят и проводят время вместе', items: ['Общая кухня', 'Уютная гостиная', 'Сад встреч'], icons: ['🍳', '🛋️', '🌳'] },
  driving: { name: 'Автошкола', activity: 'Изучают маршруты и машины', items: ['Симулятор вождения', 'Учебный автомобиль', 'Карта маршрутов'], icons: ['🎮', '🚗', '🗺️'] },
  tasks: { name: 'Мастерская планов', activity: 'Обсуждают и воплощают планы', items: ['Стол планирования', 'Доска проектов', 'Зона отдыха'], icons: ['💻', '📋', '🛋️'] },
  hobby: { name: 'Дом творчества', activity: 'Рисуют и играют музыку', items: ['Мольберт художника', 'Музыкальная студия', 'Галерея работ'], icons: ['🎨', '🎹', '🖼️'] },
};
export const cityPrices = [30, 80, 150];
export type CityPurchase = { id: string; sphere: string; slot: number; price: number; date: string };
export function cityBalance(state: GameState) {
  const earned = state.events.reduce((total, event) => total + (event.kind === 'goal' ? 100 : event.kind === 'quest' ? 10 : 0), 0);
  return Math.max(0, earned - (state.cityPurchases ?? []).reduce((total, purchase) => total + purchase.price, 0));
}
export function buyCityUpgrade(state: GameState, sphere: string, slot: number): GameState {
  if (!cityRooms[sphere] || !Number.isInteger(slot) || slot < 0 || slot > 2) throw new Error('Улучшение недоступно.');
  const purchases = state.cityPurchases ?? [];
  if (purchases.some((p) => p.sphere === sphere && p.slot === slot)) throw new Error('Улучшение уже установлено.');
  const price = cityPrices[slot];
  if (cityBalance(state) < price) throw new Error('Недостаточно жетонов. Заверши задачи или проект.');
  return { ...state, cityPurchases: [...purchases, { id: crypto.randomUUID(), sphere, slot, price, date: new Date().toISOString() }] };
}
