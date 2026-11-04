import { useEffect, useState } from 'react';
import type { GameState } from '../game';
import { playerProgress, questsForToday } from '../game';

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

export default function DashboardHeader({ state, onProfile, onQuests }: { state: GameState; onProfile: () => void; onQuests: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [clock, setClock] = useState(() => mskTime(new Date()));
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { const timer = setInterval(() => setClock(mskTime(new Date())), 1000); return () => clearInterval(timer); }, []);
  const count = questsForToday(state, now).filter(q => !q.done).length;
  return <div className="dashboard-header">
    <div className="dashboard-header-left">
      <div className="dashboard-clock" aria-label="Московское время"><Icon name="clock" size={17} /><span>{clock}</span></div>
      <div className="dashboard-date"><Icon name="calendar" size={19} /><time dateTime={now.toISOString()}>{now.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}</time></div>
    </div>
    <form className="dashboard-search" role="search" onSubmit={e => e.preventDefault()}>
      <label htmlFor="dashboard-search-input" className="visually-hidden">Поиск по всему приложению</label>
      <input id="dashboard-search-input" type="search" placeholder="Искать везде: задачи, цели, сферы, город, достижения…" />
      <button type="submit" aria-label="Спросить ИИ-ассистента"><Icon name="chat" size={15} /></button>
    </form>
    <div className="dashboard-header-right">
      <LyubertsyWeather />
      <details className="dashboard-notifications"><summary aria-label="Уведомления"><Icon name="bell" />{count > 0 && <span>{count}</span>}</summary><div><strong>Уведомления</strong><p>{count ? `Сегодня осталось задач: ${count}.` : 'На сегодня нет незавершённых задач.'}</p><button className="text-button" onClick={onQuests}>Открыть задачи →</button></div></details>
      <div className="dashboard-metric"><span>🪙</span><div><strong>{state.coins}</strong><small>Лайфкоины</small></div></div>
      <div className="dashboard-metric"><span>⭐</span><div><strong>{playerProgress(state).level}</strong><small>Уровень</small></div></div>
      <button className="avatar small dashboard-avatar" aria-label="Личный профиль" onClick={onProfile}><Avatar value={state.profile.avatar} photo={state.profile.photo} frame={state.shop?.equippedFrame} /></button>
    </div>
  </div>;
}
