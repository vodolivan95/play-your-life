import { lazy, Suspense } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import { spheres } from '../game';
const RoomEngine = lazy(() => import('./room3d/RoomEngine'));
export default function BuildingInterior({ id, state, onChange, onBack, onSphere, roomNotice }: {
  id: string; state: GameState; onChange: Dispatch<SetStateAction<GameState>>;
  notify: (message: string) => void; onBack: () => void; onSphere?: () => void; roomNotice?: string;
}) {
  if (id === 'sport') return <Suspense fallback={<section className="panel"><p>Загружаем 3D-спортзал…</p><button onClick={onBack}>Вернуться в город</button></section>}><RoomEngine state={state} onChange={onChange} onBack={onBack} demoNotice={roomNotice} /></Suspense>;
  return <section className="panel">
    <button className="text-button" onClick={onBack}>← Вернуться в город</button>
    <h2>{spheres.find(sphere => sphere.id === id)?.name}</h2>
    <p>3D-интерьер этой сферы готовится. Первый игровой прототип доступен в здании «Спорт».</p>
    {onSphere && <button className="secondary-button" onClick={onSphere}>Сфера и квесты →</button>}
  </section>;
}
