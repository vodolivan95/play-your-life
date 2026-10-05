import { Component, lazy, Suspense, useEffect, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '../../game';
import type { ObjectId, RoomId, RoomObject, Vec3 } from '../../roomEngine';
import { moveRoomObject, objectSpec, placementValid, placeRoomObject, purchaseRoomObject, removeRoomObject, roomConfigs, roomData } from '../../roomEngine';
import { sphereProgress } from '../../sphereProgress';
import type { RoomQuality, RoomTime } from './RoomScene3D';
import './RoomEngine.css';
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
      {webgl ? <SceneBoundary><Suspense fallback={<div className="room3d-loading"><strong>PLAY YOUR LIFE</strong><span>Загрузка спортзала…</span><i /></div>}><Scene roomId={roomId} objects={room.objects} ghost={ghost} valid={valid} build={build} selected={selected} time={time} quality={quality} cameraPreset={cameraPreset} cameraRevision={cameraRevision} onFloor={floor} onSelect={id => { setSelected(id); if (!build) setMessage(`${objectSpec(id).name}${id === 'treadmill' ? ' · Нажми, чтобы включить экран' : ''}`); }} /></Suspense></SceneBoundary> : <div className="room3d-unavailable">Для комнаты нужен WebGL 2. Попробуй актуальный Chrome или Safari. Покупки и позиции сохранены.</div>}
    </div>
    <header className="room3d-hud">
      <button className="room3d-back" onClick={onBack} aria-label="Вернуться из комнаты">←</button>
      <div><strong>{config.title}</strong><span>LVL {level} / 100 · {state.coins.toLocaleString('ru-RU')} Coins</span></div>
      <div className="room3d-completion"><b>{config.catalog.length ? Math.round(room.objects.length / config.catalog.length * 100) : 0}%</b><span>Комната</span></div>
      <button className="room3d-settings" onClick={() => setSheet('settings')} aria-label="Настройки комнаты">⚙</button>
    </header>
    {build && <div className="room3d-build-label">РЕЖИМ ОБУСТРОЙСТВА</div>}
    {demoNotice && !build && <span className="room3d-demo-note" title={demoNotice}>SANDBOX</span>}
    <nav className="room3d-camera" aria-label="Ракурсы камеры">
      {(['overview', 'left', 'center', 'right'] as const).map(view => <button key={view} className={cameraPreset === view ? 'active' : ''} onClick={() => { setCameraPreset(view); setCameraRevision(n => n + 1); }}>{({ overview: 'Общий', left: 'Левый', center: 'Центр', right: 'Правый' })[view]}</button>)}
      <button aria-label="RESET CAMERA" onClick={() => { setCameraPreset('overview'); setCameraRevision(n => n + 1); }}>↺</button>
    </nav>
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
        </div> : <div className="room3d-catalog">
          {config.catalog.filter(item => sheet === 'shop' || room.purchased.includes(item.id)).map(item => {
            const owned = room.purchased.includes(item.id), installed = room.objects.find(object => object.id === item.id), locked = level < item.level;
            return <article key={item.id}><div><h3>{item.name}</h3><p>{sheet === 'shop' ? `LVL ${item.level} · ${item.price} Coins` : installed ? 'Установлен в комнате' : 'В инвентаре'}</p></div>
              {sheet === 'shop' ? <button disabled={owned || locked || state.coins < item.price} onClick={() => apply(current => purchaseRoomObject(current, roomId, item.id), `${item.name} куплен. Открой инвентарь для установки.`)}>{owned ? 'Куплено' : locked ? `Нужен LVL ${item.level}` : 'Купить'}</button> : <button onClick={() => start(item.id, installed)}>{installed ? 'Переместить' : 'Установить'}</button>}
              {sheet === 'inventory' && installed && <button onClick={() => apply(current => removeRoomObject(current, roomId, item.id), 'Предмет возвращён в инвентарь.')}>Убрать</button>}
            </article>;
          })}
          {sheet === 'inventory' && !room.purchased.length && <p>Пока пусто. Купи первый предмет в магазине.</p>}
        </div>}
        <p className="room3d-sheet-status" role="status">{message}</p>
      </section>
    </div>}
  </section>, document.body);
}
