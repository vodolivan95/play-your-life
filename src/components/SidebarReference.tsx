import city from '../assets/sidebar-city-sharp.webp';

function Brand({ compact = false }: { compact?: boolean }) {
  return <svg className="sidebar-brand-vector" viewBox={compact ? '0 0 220 73' : '0 0 220 80'} role="img" aria-label="PLAY YOUR LIFE — Твоя жизнь. Твоя игра.">
    {!compact && <g transform="translate(4 19)">
      <path d="M4 12 13 19 21 4 29 19 39 12 34 34H9Z" fill="#ffbd34" />
      <path d="M9 35H34V39H9Z" fill="#ffa719" />
      <g fill="#ffc64b"><circle cx="3" cy="10" r="2.5"/><circle cx="21" cy="2" r="2.5"/><circle cx="40" cy="10" r="2.5"/></g>
    </g>}
    <g fill="#0b174b" fontFamily="Arial, sans-serif" fontWeight="900" fontSize={compact ? 25 : 24}>
      <text x={compact ? 14 : 54} y="29">PLAY</text>
      <text x={compact ? 14 : 54} y="53">YOUR LIFE</text>
    </g>
    <text x={compact ? 14 : 54} y="70" fill="#5974a9" fontFamily="Arial, sans-serif" fontSize="11">Твоя жизнь. Твоя игра.</text>
  </svg>;
}

export default function SidebarReference({ part }: { part: 'logo' | 'city' }) {
  if (part === 'logo') return <div className="sidebar-reference sidebar-reference-logo"><Brand /></div>;
  return <div className="sidebar-reference sidebar-reference-city"><img src={city} alt="Два тропических острова с дворцами PLAY YOUR LIFE" /><Brand compact /></div>;
}
