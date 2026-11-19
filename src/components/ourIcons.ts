import type { IconName } from './KbIcons';
import type { OurPageId } from '../ourLife';

/** Значки разделов «Нашей жизни» для меню и заголовков. */
export const ourIcons: Record<OurPageId, IconName> = { 'our-chat': 'chat', 'our-calendar': 'calendar', 'our-places': 'mapPin', 'our-meetings': 'meeting' };
