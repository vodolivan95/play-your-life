import type { GameState } from '../game';
import { navigation } from '../navigation';
import { menuIconSrc } from '../menuIcons';
import { useMenuTheme } from '../menuTheme';
import PlayerCard from './PlayerCard';
import SidebarReference from './SidebarReference';
import ThemeSwitch from './ThemeSwitch';
import cityMap from '../assets/life-city.webp';
import './AppMenu.css';

/** Левое меню компьютера: логотип, игрок, тема под карточкой игрока, плоский список из 12 разделов и карта города. */
export default function AppSidebar({ page, state, questCount, onNavigate }: { page: string; state: GameState; questCount: number; onNavigate: (id: string) => void }) {
  const [theme] = useMenuTheme();
  return (
    <aside className="sidebar pyl-menu" data-theme={theme}>
      <a
        className="pyl-brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNavigate('home');
        }}
      >
        <SidebarReference />
      </a>
      <PlayerCard state={state} />
      <div className="pyl-menu-theme">
        <ThemeSwitch />
      </div>
      <nav className="pyl-menu-nav" aria-label="Разделы">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? 'pyl-nav-item active' : 'pyl-nav-item'}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <img className="pyl-nav-icon" src={menuIconSrc(item.id)} alt="" width={32} height={32} />
            <span>{item.label}</span>
            {item.id === 'tasks' && <span className="pyl-nav-count">{questCount}</span>}
          </button>
        ))}
      </nav>
      <button type="button" className="pyl-city-card" onClick={() => onNavigate('city')}>
        <img className="pyl-city-art" src={cityMap} width={1536} height={1024} alt="" loading="lazy" decoding="async" />
        <span className="pyl-city-label">
          <strong>Твой город</strong>
          <em>Открыть →</em>
        </span>
      </button>
    </aside>
  );
}
