import type { GameState } from '../game';
import { visibleNavigation } from '../navigation';
import { menuIconSrc } from '../menuIcons';
import { useMenuTheme } from '../menuTheme';
import SidebarReference from './SidebarReference';
import ThemeSwitch from './ThemeSwitch';
import CityMiniLive from './CityMiniLive';
import SpaceSwitch from './SpaceSwitch';
import { ourMenuIcon } from './ourIcons';
import { lifeModeOf, ourNavigation } from '../ourLife';
import type { LifeMode } from '../ourLife';
import './AppMenu.css';

/** Левое меню компьютера: логотип, тема (карточка игрока убрана в 0.87.1 — она есть в верхнем баннере), плоский список из 11 разделов и карта города. */
export default function AppSidebar({ page, questCount, onNavigate, owner = false, onMode }: { page: string; state: GameState; questCount: number; onNavigate: (id: string) => void; owner?: boolean; onMode: (mode: LifeMode) => void }) {
  const mode = lifeModeOf(page);
  const [theme] = useMenuTheme();
  const isActive = (id: string) => page === id || (id === 'statistics' && page === 'monthly');
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
      <div className="pyl-menu-theme">
        <ThemeSwitch />
        <SpaceSwitch mode={mode} onChange={onMode} />
      </div>
      {mode === 'our' ? (
        <nav className="pyl-menu-nav pyl-our-nav" aria-label="Наша жизнь">
          {ourNavigation.map((item) => (
            <button key={item.id} type="button" className={page === item.id ? 'pyl-nav-item pyl-our-item active' : 'pyl-nav-item pyl-our-item'} aria-current={page === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
              <img className="pyl-nav-icon" src={menuIconSrc(ourMenuIcon[item.id])} alt="" width={32} height={32} />
              <span className="pyl-our-text"><strong>{item.label}</strong><small>{item.caption}</small></span>
            </button>
          ))}
        </nav>
      ) : (
      <nav className="pyl-menu-nav" aria-label="Разделы">
        {visibleNavigation(owner).map((item) => (
          <button
            key={item.id}
            type="button"
            className={isActive(item.id) ? 'pyl-nav-item active' : 'pyl-nav-item'}
            aria-current={isActive(item.id) ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <img className="pyl-nav-icon" src={menuIconSrc(item.id)} alt="" width={32} height={32} />
            <span>{item.label}</span>
            {item.id === 'tasks' && <span className="pyl-nav-count">{questCount}</span>}
          </button>
        ))}
      </nav>
      )}
      {mode === 'my' && <button type="button" className="pyl-city-card" onClick={() => onNavigate('city')}>
        <CityMiniLive />
        <span className="pyl-city-label">
          <strong>Твой город</strong>
          <em>Открыть →</em>
        </span>
      </button>}
    </aside>
  );
}
