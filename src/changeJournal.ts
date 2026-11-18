import { whatsNew } from './whatsNew';

/**
 * «Журнал изменений» в профиле: каждая выпущенная версия, время, когда правки внесены
 * (слияние в main, московское время), редактор и список изменений.
 * При каждом выпуске добавляйте строку в начало `releases` и пункты в whatsNew.ts.
 */
export type JournalEntry = { version: string; at: string; editor: string; items: string[] };

export const JOURNAL_EDITOR = 'Александр';

// [версия, дата и время внесения правок (Europe/Moscow)]
const releases: [string, string][] = [
  ['0.89.6', '2026-11-18T23:37'],
  ['0.89.5', '2026-11-18T23:30'],
  ['0.89.4', '2026-11-18T22:55'],
  ['0.89.3', '2026-11-18T22:19'],
  ['0.89.2', '2026-11-18T20:09'],
  ['0.89.1', '2026-11-18T19:28'],
  ['0.89.0', '2026-11-18T18:12'],
  ['0.88.0', '2026-11-18T14:06'],
  ['0.87.1', '2026-11-18T12:49'],
  ['0.87.0', '2026-11-18T12:09'],
  ['0.86.0', '2026-11-18T11:14'],
  ['0.85.2', '2026-11-18T11:03'],
];

// Версии старше окна «Что нового».
const earlier: Record<string, string[]> = {
  '0.85.2': ['Белая тень на фото сфер стала заметно меньше — здание видно лучше.'],
};

export const changeJournal: JournalEntry[] = releases.map(([version, at]) => ({
  version,
  at,
  editor: JOURNAL_EDITOR,
  items: whatsNew[version] ?? earlier[version] ?? [],
}));

/** «18 ноября 2026, 23:30» */
export function journalDate(at: string): string {
  const [date, time = ''] = at.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const month = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][m - 1] ?? '';
  return `${d} ${month} ${y}${time ? `, ${time}` : ''}`;
}
