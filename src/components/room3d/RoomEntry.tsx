import { lazy, Suspense, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../../game';
const RoomEngine = lazy(() => import('./RoomEngine'));
export default function RoomEntry({ state, onChange }: { state: GameState; onChange: Dispatch<SetStateAction<GameState>> }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="secondary-button" onClick={() => setOpen(true)}>Войти в 3D-спортзал →</button>
    {open && <Suspense fallback={<p>Загружаем спортзал…</p>}><RoomEngine state={state} onChange={onChange} onBack={() => setOpen(false)} /></Suspense>}
  </>;
}
