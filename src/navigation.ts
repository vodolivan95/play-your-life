import type { MenuIconId } from './menuIcons';

/** Тринадцать разделов приложения: «База знаний» (0.87.0) — после «Ключевых итогов». Ниже прежнее описание. Двенадцать разделов приложения: плоский список в боковом меню и источник заголовков страниц. «Ключевые итоги» (бывшие «Итоги месяца» и «Статистика») — над «Профилем», последним пунктом; страница «Итоги месяца» открывается из неё. «Проекты» — третьим пунктом, сразу под «Сферами жизни» (0.77.1). «Финансы» — личный учёт трат и доходов (реальные деньги), отдельно от игровой сферы «Финансы» (`finance` в сферах); стоит перед «Деревом навыков». */
/** `ownerOnly` — раздел только для аккаунта владельца (см. privateAccess.ts). */
export const navigation: { id: MenuIconId; label: string; icon: string; ownerOnly?: boolean }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'spheres', label: 'Сферы жизни', icon: 'spheres' },
  { id: 'goals', label: 'Проекты', icon: 'goals' },
  { id: 'tasks', label: 'Мои задачи', icon: 'tasks' },
  { id: 'quests', label: 'Привычки', icon: 'quests' },
  { id: 'budget', label: 'Финансы', icon: 'budget' },
  { id: 'tree', label: 'Дерево навыков', icon: 'tree' },
  { id: 'achievements', label: 'Достижения', icon: 'trophy' },
  { id: 'shop', label: 'Магазин', icon: 'shop' },
  { id: 'city', label: 'Город', icon: 'city' },
  { id: 'psychology', label: 'Психология', icon: 'psychology', ownerOnly: true },
  { id: 'statistics', label: 'Ключевые итоги', icon: 'statistics' },
  { id: 'knowledge', label: 'База знаний', icon: 'knowledge' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
];

/** Пункты меню, видимые текущему аккаунту. */
export const visibleNavigation = (owner: boolean) => navigation.filter((item) => owner || !item.ownerOnly);
