import { useEffect, useState } from 'react';
import type { GameState } from '../game';
import { navigation } from '../navigation';
import { menuIconSrc } from '../menuIcons';
import type { MenuIconId } from '../menuIcons';
import { useMenuTheme } from '../menuTheme';
import PlayerCard from './PlayerCard';
import ThemeSwitch from './ThemeSwitch';
import './AppMenu.css';

/** Разделы, которые не помещаются в нижнюю панель и открываются шторкой «Ещё». */
const moreIds: MenuIconId[] = ['tasks', 'spheres', 'tree', 'achievements', 'shop', 'profile', 'statistics'];

/**
 * Нижняя панель телефона: Главная, Привычки, выпуклая «Цели» по центру, Город и «Ещё».
 * «Ещё» открывает шторку с остальными разделами, карточкой игрока и переключателем темы.
 */
export default function MobileNav({ page, state, onNavigate }: { page: string; state: GameState; onNavigate: (id: string) => void }) {
  const [theme] = useMenuTheme();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const go = (id: string) => {
    setOpen(false);
    onNavigate(id);
  };
  const moreActive = open || (moreIds as string[]).includes(page);
  const tab = (id: MenuIconId, label: string, badge?: number) => (
    <button
      key={id}
      type="button"
      className="pyl-tab"
      aria-current={!open && page === id ? 'page' : undefined}
      aria-label={badge ? `${label}, активных: ${badge}` : undefined}
      onClick={() => go(id)}
    >
      <span className="pyl-tab-icon">
        <img className="pyl-tab-art" src={menuIconSrc(id)} alt="" width={28} height={28} />
        {badge !== undefined && badge > 0 && <span className="pyl-tab-badge">{badge}</span>}
      </span>
      {label}
    </button>
  );
  return (
    <>
      {open && <button type="button" className="pyl-more-backdrop" aria-label="Закрыть" onClick={() => setOpen(false)} />}
      {open && (
        <section className="pyl-more" data-theme={theme} role="dialog" aria-label="Ещё">
          <span className="pyl-grabber" aria-hidden="true" />
          <PlayerCard state={state} />
          <div className="pyl-more-grid">
            {moreIds.map((id) => (
              <button key={id} type="button" className="pyl-more-item" aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
                <img src={menuIconSrc(id)} alt="" width={48} height={48} />
                <span>{navigation.find((item) => item.id === id)?.label}</span>
              </button>
            ))}
            <div className="pyl-more-theme">
              <ThemeSwitch compact />
              <span>Тема</span>
            </div>
          </div>
        </section>
      )}
      <nav className="pyl-tabbar" data-theme={theme} aria-label="Разделы">
        {tab('home', 'Главная')}
        {tab('quests', 'Привычки')}
        <button
          type="button"
          className="pyl-tab pyl-tab-center"
          aria-current={!open && page === 'goals' ? 'page' : undefined}
          onClick={() => go('goals')}
        >
          <span className="pyl-tab-orb"><img src={menuIconSrc('goals')} alt="" width={40} height={40} /></span>
          Цели
        </button>
        {tab('city', 'Город')}
        <button
          type="button"
          className="pyl-tab"
          aria-current={moreActive ? 'page' : undefined}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="pyl-tab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </span>
          Ещё
        </button>
      </nav>
    </>
  );
}
