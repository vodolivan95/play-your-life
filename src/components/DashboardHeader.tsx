import { useEffect, useState } from 'react';
import type { GameState } from '../game';
import { playerProgress, questsForToday } from '../game';

import Avatar from './Avatar';
import Icon from './Icon';
import LyubertsyWeather from './LyubertsyWeather';
export default function DashboardHeader({ state, onProfile, onQuests }: { state: GameState; onProfile: () => void; onQuests: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const count = questsForToday(state, now).filter(q => !q.done).length;
  return <div className="dashboard-header">
    <div className="dashboard-date"><Icon name="calendar" size={19} /><time dateTime={now.toISOString()}>{now.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' })}</time></div>
    <LyubertsyWeather />
    <details className="dashboard-notifications"><summary aria-label="Уведомления"><Icon name="bell" />{count > 0 && <span>{count}</span>}</summary><div><strong>Уведомления</strong><p>{count ? `Сегодня осталось квестов: ${count}.` : 'На сегодня нет незавершённых квестов.'}</p><button className="text-button" onClick={onQuests}>Открыть квесты →</button></div></details>
    <div className="dashboard-metric"><span>🪙</span><div><strong>{state.coins}</strong><small>Life Coins</small></div></div>
    <div className="dashboard-metric"><span>⭐</span><div><strong>{playerProgress(state).level}</strong><small>Уровень</small></div></div>
    <button className="avatar small dashboard-avatar" aria-label="Личный профиль" onClick={onProfile}><Avatar value={state.profile.avatar} photo={state.profile.photo} frame={state.shop?.equippedFrame} /></button>
  </div>;
}
