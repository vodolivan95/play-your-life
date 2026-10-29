import type { MenuIconId } from './menuIcons';

/** Двенадцать разделов приложения: плоский список в боковом меню и источник заголовков страниц. «Ключевые итоги» (бывшие «Итоги месяца» и «Статистика») — внизу под «Профилем»; страница «Итоги месяца» открывается из неё. «Финансы» — личный учёт трат и доходов (реальные деньги), отдельно от игровой сферы «Финансы» (`finance` в сферах). */
export const navigation: { id: MenuIconId; label: string; icon: string }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'spheres', label: 'Сферы жизни', icon: 'spheres' },
  { id: 'tasks', label: 'Мои задачи', icon: 'tasks' },
  { id: 'quests', label: 'Привычки', icon: 'quests' },
  { id: 'goals', label: 'Цели', icon: 'goals' },
  { id: 'tree', label: 'Дерево навыков', icon: 'tree' },
  { id: 'achievements', label: 'Достижения', icon: 'trophy' },
  { id: 'shop', label: 'Магазин', icon: 'shop' },
  { id: 'city', label: 'Город', icon: 'city' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
  { id: 'budget', label: 'Финансы', icon: 'budget' },
  { id: 'statistics', label: 'Ключевые итоги', icon: 'statistics' },
];
