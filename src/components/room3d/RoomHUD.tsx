import { MAX_SPHERE_LEVEL } from '../../sphereProgress';
import type { CameraPreset } from './RoomCamera';
export default function RoomHUD({ title, level, coins, progress, preset, onBack, onSettings, onView }: {
  title: string; level: number; coins: number; progress: number; preset: CameraPreset;
  onBack: () => void; onSettings: () => void; onView: (preset: CameraPreset) => void;
}) {
  return <>
    <header className="room3d-hud">
      <button className="room3d-back" onClick={onBack} aria-label="Вернуться из комнаты">←</button>
      <div><strong>{title}</strong><span>LVL {level} / {MAX_SPHERE_LEVEL} · {coins.toLocaleString('ru-RU')} Coins</span></div>
      <div className="room3d-completion"><b>{progress}%</b><span>Комната</span></div>
      <button className="room3d-settings" onClick={onSettings} aria-label="Настройки комнаты">⚙</button>
    </header>
    <nav className="room3d-camera" aria-label="Ракурсы камеры">
      {(['overview', 'left', 'center', 'right'] as const).map(view => <button key={view} className={preset === view ? 'active' : ''} onClick={() => onView(view)}>{({ overview: 'Общий', left: 'Левый', center: 'Центр', right: 'Правый' })[view]}</button>)}
      <button aria-label="RESET CAMERA" onClick={() => onView('overview')}>↺</button>
    </nav>
  </>;
}
