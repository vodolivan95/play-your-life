/**
 * «Что нового»: короткий список изменений текущей версии. Окно показывается один раз
 * после обновления сайта. Обновляйте вместе с номером версии и CHANGELOG.md.
 */
export const whatsNew: Record<string, string[]> = {
  '0.87.0': [
    'В меню после «Ключевых итогов» — «База знаний» со списком всех пространств сфер жизни, экспортом и импортом.',
    'Верхний баннер собран в одну строку: время, поиск, погода, уведомления, лайфкоины, уровень и карточка игрока с полосой XP.',
    'Когда выходит новая версия сайта, внизу появляется кнопка «Обновить», а после обновления — это окно с изменениями.',
  ],
  '0.86.0': [
    'В каждой сфере — вкладки «База знаний» (как в Teamly) и «Заметки» (как в Google Keep).',
    'Белая дымка на фото сфер стала узкой полосой — здание видно целиком.',
  ],
};

export const seenVersionKey = 'pyl-seen-version';

/** Версия из <meta name="application-version"> в HTML страницы. */
export function versionFromHtml(html: string): string | null {
  return html.match(/<meta\s+name="application-version"\s+content="([^"]+)"/)?.[1] ?? null;
}

/** Окно «Что нового» нужно, если пользователь ещё не видел изменения этой версии. */
export function shouldShowWhatsNew(current: string | null, seen: string | null): boolean {
  return !!current && seen !== current && !!whatsNew[current]?.length;
}
