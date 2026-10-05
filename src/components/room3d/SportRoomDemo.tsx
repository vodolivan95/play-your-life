import { useEffect, useState } from 'react';
import { newAccountGame } from '../../accountGame';
import { restoreBackup } from '../../backup';
import RoomEngine from './RoomEngine';
const key = 'play-your-life-3d-sport-demo-v1';
function initial() {
  try { const raw = localStorage.getItem(key); if (raw) return restoreBackup(raw); } catch { /* Повреждённый тестовый прогресс не затрагивает основную игру. */ }
  const state = newAccountGame('3D-прототип'); state.coins = 2000; state.spheres.sport.xp = 3600; return state;
}
export default function SportRoomDemo() {
  const [state, setState] = useState(initial);
  const [error, setError] = useState(false);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { queueMicrotask(() => setError(true)); } }, [state]);
  return <RoomEngine state={state} onChange={setState} onBack={() => { location.href = import.meta.env.BASE_URL; }} demoNotice={error ? 'Тестовая комната · Сохранение недоступно: проверь память браузера' : 'Тестовая комната · Прогресс хранится отдельно'} />;
}
