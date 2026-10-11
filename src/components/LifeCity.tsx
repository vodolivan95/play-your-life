import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import BuildingInterior from './BuildingInterior';
import './LifeCity.css';
import CoastalCity from './CoastalCity';
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
  const [paused, setPaused] = useState(false);
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
      <div className="city-simulation-controls" aria-label="Управление окружением">
        <button aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '▶ Продолжить' : '⏸ Пауза'}</button>
        <label>Скорость <select aria-label="Скорость города" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option></select></label>
        <span>{paused ? 'Город на паузе — нажми «Продолжить», чтобы включить движение' : 'Транспорт, жители, вода и погода'}</span>
      </div>
      <CoastalCity state={state} onOpen={setInside} paused={paused} speed={speed} />
    </section>
  );
}
