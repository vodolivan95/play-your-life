import reference from '../assets/sidebar-reference.png';
// Keep the exact supplied logo and city; reference navigation is outside these view boxes.
export default function SidebarReference({ part }: { part: 'logo' | 'city' }) {
  return <svg className={`sidebar-reference sidebar-reference-${part}`} viewBox={part === 'logo' ? '20 25 195 70' : '0 638 238 375'} role="img" aria-label={part === 'logo' ? 'PLAY YOUR LIFE — Твоя жизнь. Твоя игра.' : 'Город PLAY YOUR LIFE — Твоя жизнь. Твоя игра.'} preserveAspectRatio="xMidYMid meet"><image href={reference} width="238" height="1013" /></svg>;
}
