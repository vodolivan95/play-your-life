import { lazy, Suspense, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import BuildingInterior from './BuildingInterior';
import './LifeCity.css';
const CityScene = lazy(() => import('./city3d/CityScene'));
export default function LifeCity({
  state,
  onOpen,
  onChange,
  notify,
  roomNotice,
}: {
  state: GameState;
  onOpen?: (id: string) => void;
  roomNotice?: string;
  onChange: Dispatch<SetStateAction<GameState>>;
  notify: (message: string) => void;
}) {
  const [inside, setInside] = useState<string | null>(null);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  if (inside)
    return (
      <BuildingInterior
        id={inside}
        state={state}
        onChange={onChange}
        notify={notify}
        onBack={() => setInside(null)}
        onSphere={onOpen ? () => onOpen(inside) : undefined}
        roomNotice={roomNotice}
      />
    );
  return (
    <section className="life-city" aria-label="Город сфер жизни">
      <div className="city-intro">
        <div>
          <span className="eyebrow">ТВОЙ ГОРОД. ТВОИ ПРАВИЛА.</span>
          <h2>Добро пожаловать на свой остров</h2>
          <p>
            Нажми на само здание. Внутри можно обустроить пространство и
            улучшить его.
          </p>
        </div>
        <span className="city-balance">🪙 {state.coins} монет</span>
      </div>
      <div className="city-toolbar">
        <label className="city-jump">
          Войти в здание
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setInside(e.target.value);
            }}
          >
            <option value="">Выбери сферу…</option>
            {spheres.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
        </label>
        <span>Наведи на здание или нажми на него</span>
      </div>
      <div className="city-simulation-controls" aria-label="Управление окружением">
        <button aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '▶ Продолжить' : '⏸ Пауза'}</button>
        <label>Скорость <select aria-label="Скорость города" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option></select></label>
        <span>{paused ? 'Город на паузе' : 'Город живёт: жители, транспорт и вода'}</span>
      </div>
      <Suspense fallback={<p role="status">Загрузка 3D-города…</p>}><CityScene state={state} onOpen={setInside} paused={paused} speed={speed} /></Suspense>
    </section>
  );
}
