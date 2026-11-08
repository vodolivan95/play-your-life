import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../game';
import { dateKey, playerProgress } from '../game';
import { questsForCalendarDay } from '../tasksCalendar';
import { searchEverything } from '../globalSearch';
import type { SearchResult } from '../globalSearch';

import Avatar from './Avatar';
import Icon from './Icon';
import LyubertsyWeather from './LyubertsyWeather';

const mskTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
});

function mskTime(d: Date): string {
  try {
    return mskTimeFormatter.format(d);
  } catch {
    return '--:--';
  }
}

export default function DashboardHeader({ state, onProfile, onQuests, onSearchResult }: { state: GameState; onProfile: () => void; onQuests: () => void; onSearchResult: (result: SearchResult) => void }) {
  const [now, setNow] = useState(() => new Date());
  const [clock, setClock] = useState(() => mskTime(new Date()));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { const timer = setInterval(() => setClock(mskTime(new Date())), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);
  const count = questsForCalendarDay(state.quests, dateKey(now)).filter(q => !q.done).length;
  const results = useMemo(() => searchEverything(state, query), [state, query]);
  function selectResult(result: SearchResult) {
    onSearchResult(result);
    setQuery('');
    setOpen(false);
  }
  return <div className="dashboard-header">
    <div className="dashboard-header-left">
      <div className="dashboard-clock" aria-label="Московское время"><Icon name="clock" size={17} /><span>{clock}</span></div>
      <div className="dashboard-date"><Icon name="calendar" size={19} /><time dateTime={now.toISOString()}>{now.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}</time></div>
    </div>
    <div className="dashboard-search-wrap" ref={searchRef}>
      <form
        className="dashboard-search"
        role="search"
        onSubmit={e => {
          e.preventDefault();
          if (results[0]) selectResult(results[0]);
        }}
      >
        <label htmlFor="dashboard-search-input" className="visually-hidden">Поиск по всему приложению</label>
        <input
          id="dashboard-search-input"
          type="search"
          placeholder="Искать везде: задачи, цели, сферы, город, достижения…"
          value={query}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          role="combobox"
          aria-expanded={open && query.trim().length > 0}
          aria-controls="dashboard-search-listbox"
        />
        <button type="submit" aria-label="Искать" disabled={!results.length}><Icon name="search" size={15} /></button>
      </form>
      {open && query.trim() && (
        <div className="dashboard-search-results" id="dashboard-search-listbox" role="listbox">
          {results.length
            ? results.map(result => (
              <button
                type="button"
                key={`${result.kind}:${result.id}:${result.title}`}
                className="dashboard-search-result"
                role="option"
                aria-selected="false"
                onClick={() => selectResult(result)}
              >
                <span className="dashboard-search-result-icon">{result.icon}</span>
                <span className="dashboard-search-result-text">
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
              </button>
            ))
            : <div className="dashboard-search-empty">Ничего не найдено</div>}
        </div>
      )}
    </div>
    <div className="dashboard-header-right">
      <LyubertsyWeather />
      <details className="dashboard-notifications"><summary aria-label="Уведомления"><Icon name="bell" />{count > 0 && <span>{count}</span>}</summary><div><strong>Уведомления</strong><p>{count ? `Сегодня осталось задач: ${count}.` : 'На сегодня нет незавершённых задач.'}</p><button className="text-button" onClick={onQuests}>Открыть задачи →</button></div></details>
      <div className="dashboard-metric dashboard-metric-coins"><span className="metric-badge" aria-hidden="true">₽</span><div><strong>{state.coins}</strong><small>Лайфкоины</small></div></div>
      <div className="dashboard-metric dashboard-metric-level"><span className="metric-badge">⭐</span><div><strong>{playerProgress(state).level}</strong><small>Уровень</small></div></div>
      <button className="avatar small dashboard-avatar" aria-label="Личный профиль" onClick={onProfile}><Avatar value={state.profile.avatar} photo={state.profile.photo} frame={state.shop?.equippedFrame} /></button>
    </div>
  </div>;
}
