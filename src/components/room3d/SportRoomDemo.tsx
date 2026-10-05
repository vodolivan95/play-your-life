import { useEffect, useState } from 'react';
import { newAccountGame } from '../../accountGame';
import { restoreBackup } from '../../backup';
import LifeCity from '../LifeCity';
import { CityAppearanceContext } from '../../cityAppearanceContext';
import './RoomMapDemo.css';
const key = 'play-your-life-3d-sport-demo-v1';
function initial() {
  try { const raw = localStorage.getItem(key); if (raw) return restoreBackup(raw); } catch { /* Повреждённый тестовый прогресс не затрагивает основную игру. */ }
  const state = newAccountGame('3D-прототип'); state.coins = 2000; state.spheres.sport.xp = 3600; return state;
}
export default function SportRoomDemo() {
  const [state, setState] = useState(initial);
  const [error, setError] = useState(false);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { queueMicrotask(() => setError(true)); } }, [state]);
  return <CityAppearanceContext.Provider value={state.city}>
    <main className="room-map-demo" aria-label="Общая карта">
      <header className="room-map-demo-header"><h1>Общая карта</h1><span>Демо · прогресс хранится отдельно</span></header>
      {error && <p role="alert">Сохранение недоступно: проверь память браузера.</p>}
      <LifeCity state={state} onChange={setState} notify={() => {}} roomNotice={error ? 'Сохранение недоступно: проверь память браузера' : 'Тестовый город · Прогресс хранится отдельно'} />
    </main>
  </CityAppearanceContext.Provider>;
}
