import type { MenuIconId } from './menuIcons';

/** Тринадцать разделов приложения: плоский список в боковом меню и источник заголовков страниц. */
export const navigation: { id: MenuIconId; label: string; icon: string }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'spheres', label: 'Сферы жизни', icon: 'spheres' },
  { id: 'tasks', label: 'Мои задачи', icon: 'tasks' },
  { id: 'quests', label: 'Привычки', icon: 'quests' },
  { id: 'goals', label: 'Цели', icon: 'goals' },
  { id: 'plan', label: 'План жизни', icon: 'plan' },
  { id: 'monthly', label: 'Итоги месяца', icon: 'calendar' },
  { id: 'tree', label: 'Skill Tree', icon: 'tree' },
  { id: 'achievements', label: 'Достижения', icon: 'trophy' },
  { id: 'shop', label: 'Магазин', icon: 'shop' },
  { id: 'city', label: 'Город', icon: 'city' },
  { id: 'statistics', label: 'Статистика', icon: 'statistics' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
];
