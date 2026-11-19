import type { IconName } from './KbIcons';
import type { MenuIconId } from '../menuIcons';
import type { OurPageId } from '../ourLife';

/** Линейные значки разделов «Нашей жизни» (мелкие места). */
export const ourIcons: Record<OurPageId, IconName> = { 'our-chat': 'chat', 'our-calendar': 'calendar', 'our-places': 'mapPin', 'our-meetings': 'meeting' };
/** Объёмные иконки разделов «Нашей жизни» — в том же стиле, что и меню «Моей жизни». */
export const ourMenuIcon: Record<OurPageId, MenuIconId> = { 'our-chat': 'ourChat', 'our-calendar': 'ourCalendar', 'our-places': 'ourPlaces', 'our-meetings': 'ourMeetings' };
