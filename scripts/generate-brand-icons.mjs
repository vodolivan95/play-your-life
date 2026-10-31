#!/usr/bin/env node
/**
 * Перегенерирует src/brands.ts из пакета `simple-icons` (devDependency).
 *
 * Логотипы зашиваются в код как обычные строки (путь + цвет) — без зависимости
 * от `simple-icons` в рантайме, чтобы не тащить в бандл весь пакет (его модуль
 * плохо tree-shake'ится сборщиком и даёт заметный лишний вес даже при импорте
 * десятка иконок). `simple-icons` нужен только здесь, при генерации.
 *
 * Запуск: node scripts/generate-brand-icons.mjs
 * Чтобы добавить сервис — добавь его в список BRAND_NAMES (имя экспорта
 * `simple-icons`, без приставки `si`, и регулярку для сопоставления с
 * названием платежа) и перезапусти скрипт.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { log } from 'node:console';
import * as si from 'simple-icons';

// [имя экспорта simple-icons без 'si', regex-источник для сопоставления с названием платежа]
const BRAND_NAMES = [
  ['Youtube', 'youtube|ютуб'],
  ['Ticktick', 'ticktick'],
  ['Netflix', 'netflix|нетфликс'],
  ['Spotify', 'spotify|спотифай'],
  ['Applemusic', 'apple\\s*music'],
  ['Appletv', 'apple\\s*tv'],
  ['Icloud', 'icloud|айклауд'],
  ['Apple', '\\bapple\\b|эппл'],
  ['Google', '\\bgoogle\\b|гугл'],
  ['Vk', '\\bvk\\b|вконтакте'],
  ['Telegram', 'telegram|телеграм'],
  ['Kinopoisk', 'кинопоиск|kinopoisk'],
  ['Steam', '\\bsteam\\b|стим'],
  ['Playstation', 'playstation|плейстейшн'],
  ['Discord', 'discord|дискорд'],
  ['Twitch', 'twitch|твич'],
  ['Instagram', 'instagram|инстаграм'],
  ['Whatsapp', 'whatsapp|вотсап'],
  ['Notion', 'notion'],
  ['Figma', 'figma'],
  ['Dropbox', 'dropbox'],
  ['Hbomax', 'hbo\\s*max'],
  ['Hbo', '\\bhbo\\b'],
  ['Crunchyroll', 'crunchyroll'],
  ['Tiktok', 'tiktok|тикток'],
  ['Facebook', 'facebook|фейсбук'],
];

const entries = BRAND_NAMES.map(([name, pattern]) => {
  const data = si[`si${name}`];
  if (!data) throw new Error(`simple-icons: нет бренда si${name}`);
  return { name, pattern, title: data.title, hex: data.hex, path: data.path };
});

const header = `/**
 * Логотипы известных сервисов для платежей/подписок («Финансы» → «Платежи»).
 * СГЕНЕРИРОВАНО: node scripts/generate-brand-icons.mjs — не редактировать руками,
 * править список брендов там и перезапускать скрипт.
 *
 * Данные логотипов — из пакета \`simple-icons\` (CC0, официальные SVG-пути
 * брендов специально для такого использования — идентификация сервиса, без
 * заявления об аффилиации); пакет нужен только при генерации, в рантайме не
 * участвует. У части крупных брендов (Microsoft, Xbox, OpenAI/ChatGPT, Amazon,
 * Disney, Adobe, обычный Yandex, Slack и т.д.) в этом пакете официального
 * логотипа нет вовсе — они удалены из библиотеки по требованию правообладателей.
 * Воссоздавать такие логотипы самостоятельно мы не можем (тот же риск нарушения
 * товарного знака, из-за которого их убрали из библиотеки), поэтому для них
 * остаётся прежняя эмодзи-иконка, заданная пользователем (\`PaymentEntry.icon\`).
 *
 * Сопоставление — по названию платежа (регистронезависимо, кириллица и
 * латиница). Порядок важен: более специфичные бренды (Apple Music, Apple TV,
 * iCloud, HBO Max) проверяются раньше общего \`Apple\`/\`HBO\`, иначе они бы
 * перехватывались общим правилом.
 */
export type BrandIconData = { title: string; hex: string; path: string };
type BrandMatch = { icon: BrandIconData; test: RegExp };

const BRANDS: BrandMatch[] = [
`;

const body = entries
  .map(
    (e) =>
      `  { icon: { title: ${JSON.stringify(e.title)}, hex: ${JSON.stringify(e.hex)}, path: ${JSON.stringify(e.path)} }, test: /${e.pattern}/i },`,
  )
  .join('\n');

const footer = `
];

/** Логотип сервиса по названию платежа, если он есть в библиотеке. */
export function matchBrand(name: string): BrandIconData | null {
  for (const b of BRANDS) if (b.test.test(name)) return b.icon;
  return null;
}
`;

const outPath = fileURLToPath(new URL('../src/brands.ts', import.meta.url));
writeFileSync(outPath, header + body + footer);
log(`Записано ${entries.length} брендов в src/brands.ts`);
