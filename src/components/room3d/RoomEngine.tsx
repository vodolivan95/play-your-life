import { Component, lazy, Suspense, useEffect, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '../../game';
import PlayBrand from '../PlayBrand';
import type { ObjectId, RoomId, RoomObject, Vec3 } from '../../roomEngine';
import { moveRoomObject, objectSpec, placementValid, placeRoomObject, purchaseRoomObject, removeRoomObject, roomConfigs, roomData } from '../../roomEngine';
import { sphereProgress } from '../../sphereProgress';
import type { RoomQuality, RoomTime } from './RoomScene3D';
import './RoomEngine.css';
import RoomHUD from './RoomHUD';
import Shop from './Shop';
import Inventory from './Inventory';
import type { CameraPreset } from './RoomCamera';
import { sportAssets, futureAssetSlots } from './assetSlots';

const Scene = lazy(() => import('./RoomScene3D'));
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="room3d-unavailable">Не удалось запустить 3D. Обнови страницу или попробуй браузер с поддержкой WebGL 2.</div> : this.props.children; }
}
function autoQuality(): RoomQuality {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return memory <= 2 || navigator.hardwareConcurrency <= 2 ? 'low' : memory <= 4 || matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}
export default function RoomEngine({ state, onChange, onBack, roomId = 'sport', demoNotice }: {
  state: GameState; onChange: Dispatch<SetStateAction<GameState>>; onBack: () => void; roomId?: RoomId;
  demoNotice?: string;
}) {
  const [sheet, setSheet] = useState<'shop' | 'inventory' | 'settings' | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [cameraRevision, setCameraRevision] = useState(0);
  const [build, setBuild] = useState(false);
  const [selected, setSelected] = useState<ObjectId | null>(null);
  const [ghost, setGhost] = useState<RoomObject | null>(null);
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState('Вращай ракурс одним пальцем, приближай двумя.');
  const [time, setTime] = useState<RoomTime>('sunset');
  const [preset, setPreset] = useState<'auto' | RoomQuality>('auto');
  const [webgl] = useState(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; });
  const room = roomData(state, roomId), config = roomConfigs[roomId];
  const level = sphereProgress(state.spheres[roomId].xp).level;
  const valid = ghost ? placementValid(room, ghost, roomId) : false;
  const quality = preset === 'auto' ? autoQuality() : preset;
  useEffect(() => {
    const prior = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prior; };
  }, []);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (sheet) setSheet(null); else if (ghost) setGhost(null); else if (build) setBuild(false); else onBack(); }
    };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, [sheet, ghost, build, onBack]);
  function apply(action: (current: GameState) => GameState, success: string): boolean {
    try { action(state); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось изменить комнату.'); return false; }
    onChange(current => { try { return action(current); } catch { return current; } });
    setMessage(success); return true;
  }
  function start(id: ObjectId, existing?: RoomObject) {
    setGhost(existing ? { ...existing, position: [...existing.position], rotation: [...existing.rotation] } : { id, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
    setMoving(!!existing); setSelected(id); setBuild(true); setSheet(null); setMessage('Выбери место на полу и подтверди установку.');
  }
  function floor(position: Vec3) { setGhost(current => current && ({ ...current, position })); }
  function step(dx: number, dz: number) { if (ghost) floor([ghost.position[0] + dx, 0, ghost.position[2] + dz]); }
  function turn() {
    if (ghost) setGhost({ ...ghost, rotation: [0, (ghost.rotation[1] + Math.PI / 2) % (Math.PI * 2), 0] });
    else if (selected) { const item = room.objects.find(item => item.id === selected); if (item) { start(selected, item); setGhost({ ...item, rotation: [0, (item.rotation[1] + Math.PI / 2) % (Math.PI * 2), 0] }); } }
  }
  function confirm() { if (ghost && valid && apply(current => moving ? moveRoomObject(current, roomId, ghost) : placeRoomObject(current, roomId, ghost), 'Предмет установлен. Положение сохранено.')) { setGhost(null); setSelected(null); setBuild(false); } }
  const chosen = selected ? room.objects.find(item => item.id === selected) : null;
  return createPortal(<section className="room3d" aria-label={`3D-комната ${config.title}`}>
    <div className="room3d-stage" data-testid="room-scene">
      {webgl ? <SceneBoundary><Suspense fallback={<div className="room3d-loading"><PlayBrand /><span>Загрузка спортзала…</span><i /></div>}><Scene roomId={roomId} objects={room.objects} ghost={ghost} valid={valid} build={build} selected={selected} time={time} quality={quality} cameraPreset={cameraPreset} cameraRevision={cameraRevision} onFloor={floor} onSelect={id => { setSelected(id); if (!build) setMessage(`${objectSpec(id).name}${id === 'treadmill' ? ' · Нажми, чтобы включить экран' : ''}`); }} /></Suspense></SceneBoundary> : <div className="room3d-unavailable">Для комнаты нужен WebGL 2. Попробуй актуальный Chrome или Safari. Покупки и позиции сохранены.</div>}
    </div>
    <RoomHUD title={config.title} level={level} coins={state.coins} progress={config.catalog.length ? Math.round(room.objects.length / config.catalog.length * 100) : 0} preset={cameraPreset} onBack={onBack} onSettings={() => setSheet('settings')} onView={view => { setCameraPreset(view); setCameraRevision(n => n + 1); }} />
    {build && <div className="room3d-build-label">РЕЖИМ ОБУСТРОЙСТВА</div>}
    {demoNotice && !build && <span className="room3d-demo-note" title={demoNotice}>SANDBOX</span>}
    <div className="room3d-controls">
      <p className="room3d-status" role="status">{ghost ? valid ? 'Место свободно' : 'Место занято или за границей комнаты' : message}</p>
      {ghost ? <>
        <div className="room3d-placement">
          <button onClick={() => step(-.5, 0)} aria-label="Сдвинуть влево">←</button><button onClick={() => step(0, -.5)} aria-label="Сдвинуть назад">↑</button><button onClick={() => step(0, .5)} aria-label="Сдвинуть вперёд">↓</button><button onClick={() => step(.5, 0)} aria-label="Сдвинуть вправо">→</button>
          <button onClick={turn}>Повернуть</button>
        </div>
        <div className="room3d-actions"><button onClick={() => { setGhost(null); setSelected(null); setBuild(false); }}>Отмена</button><button className="primary" disabled={!valid} onClick={confirm}>✓ Установить</button></div>
      </> : chosen && build ? <div className="room3d-actions">
        <button onClick={() => start(chosen.id, chosen)}>Переместить</button><button onClick={turn}>Повернуть</button><button onClick={() => { if (apply(current => removeRoomObject(current, roomId, chosen.id), 'Предмет возвращён в инвентарь.')) setSelected(null); }}>Убрать</button><button onClick={() => setSelected(null)}>Готово</button>
      </div> : <nav className="room3d-actions" aria-label="Управление комнатой">
        <button onClick={() => setSheet('shop')}>Магазин</button><button onClick={() => setSheet('inventory')}>Инвентарь</button><button className={build ? 'primary' : ''} onClick={() => { setBuild(!build); setSelected(null); }}>{build ? '✓ Готово' : 'BUILD'}</button>
      </nav>}
    </div>
    {sheet && <div className="room3d-scrim" onClick={() => setSheet(null)}>
      <section className="room3d-sheet" role="dialog" aria-modal="true" aria-label={sheet === 'shop' ? 'Магазин комнаты' : sheet === 'inventory' ? 'Инвентарь комнаты' : 'Настройки комнаты'} onClick={event => event.stopPropagation()}>
        <header><h2>{sheet === 'shop' ? 'Магазин' : sheet === 'inventory' ? 'Инвентарь' : 'Настройки'}</h2><button onClick={() => setSheet(null)} aria-label="Закрыть панель">×</button></header>
        {sheet === 'settings' ? <div className="room3d-options">
          <label>Время суток<select value={time} onChange={event => setTime(event.target.value as RoomTime)}><option value="day">DAY · День</option><option value="sunset">SUNSET · Закат</option><option value="night">NIGHT · Ночь</option></select></label>
          <label>Качество<select value={preset} onChange={event => setPreset(event.target.value as 'auto' | RoomQuality)}><option value="auto">AUTO</option><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select></label>
          <p>Сетка: 0.5 м. Камера остаётся внутри зала. Текущий запрос качества: {quality.toUpperCase()}; при падении FPS включается LOW.</p>
          {new URLSearchParams(location.search).has('room-dev') && <details><summary>DEV · Asset status</summary>{Object.entries(sportAssets).map(([id, asset]) => <p key={id}>{asset.file}: {asset.available && asset.license ? 'GLB' : 'PLACEHOLDER ASSET'}</p>)}<p>Дополнительные слоты: {futureAssetSlots.join(', ')}</p></details>}
          <p>Вращение — мышь или один палец. Приближение — колесо или два пальца. В режиме установки выбери точку на полу.</p>
        </div> : sheet === 'shop' ? <Shop catalog={config.catalog} room={room} level={level} coins={state.coins} onBuy={id => apply(current => purchaseRoomObject(current, roomId, id), `${objectSpec(id).name} куплен. Открой инвентарь для установки.`)} /> : <Inventory catalog={config.catalog} room={room} onPlace={start} onRemove={id => apply(current => removeRoomObject(current, roomId, id), 'Предмет возвращён в инвентарь.')} />}

        <p className="room3d-sheet-status" role="status">{message}</p>
      </section>
    </div>}
  </section>, document.body);
}
