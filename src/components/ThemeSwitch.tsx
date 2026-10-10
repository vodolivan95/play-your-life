import { useMenuTheme } from '../menuTheme';

/** Переключатель тёмной и светлой темы; compact — значки без подписей для шторки «Ещё». */
export default function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useMenuTheme();
  return (
    <div className={`pyl-theme${compact ? ' pyl-theme-compact' : ''}`} role="group" aria-label="Тема оформления">
      <button type="button" className={theme === 'dark' ? 'on' : ''} aria-pressed={theme === 'dark'} aria-label={compact ? 'Тёмная тема' : undefined} onClick={() => setTheme('dark')}>
        {compact ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
        ) : 'Тёмная'}
      </button>
      <button type="button" className={theme === 'light' ? 'on' : ''} aria-pressed={theme === 'light'} aria-label={compact ? 'Светлая тема' : undefined} onClick={() => setTheme('light')}>
        {compact ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5" /></svg>
        ) : 'Светлая'}
      </button>
    </div>
  );
}
