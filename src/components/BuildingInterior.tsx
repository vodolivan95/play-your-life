import { lazy, Suspense } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import { spheres } from '../game';
import { hasRoom, roomConfigs } from '../roomEngine';
const RoomEngine = lazy(() => import('./room3d/RoomEngine'));
export default function BuildingInterior({ id, state, onChange, onBack, onSphere, roomNotice }: {
  id: string; state: GameState; onChange: Dispatch<SetStateAction<GameState>>;
  notify: (message: string) => void; onBack: () => void; onSphere?: () => void; roomNotice?: string;
}) {
  if (hasRoom(id)) return <Suspense fallback={<section className="panel"><p>Загружаем 3D-интерьер «{roomConfigs[id].title}»…</p><button onClick={onBack}>Вернуться в город</button></section>}><RoomEngine state={state} onChange={onChange} onBack={onBack} roomId={id} demoNotice={roomNotice} /></Suspense>;
  return <section className="panel">
    <button className="text-button" onClick={onBack}>← Вернуться в город</button>
    <h2>{spheres.find(sphere => sphere.id === id)?.name}</h2>
    <p>3D-интерьер этой сферы готовится. Уже можно обустроить здания «Спорт», «Саморазвитие», «Здоровье», «Финансы», «Английский», «Вождение» и «Общие дела».</p>
    {onSphere && <button className="secondary-button" onClick={onSphere}>Сфера и квесты →</button>}
  </section>;
}
