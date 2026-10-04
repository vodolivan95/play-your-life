import CityBuildingArt from './CityBuildingArt';
import { cityLandmarks as districts } from '../cityLandmarks';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import Icon from './Icon';
import BuildingInterior from './BuildingInterior';
import CityEnvironment from './CityEnvironment';
import cityImage from '../assets/life-city.webp';
import { buildingState } from '../city';
import './LifeCity.css';
export default function LifeCity({
  state,
  onOpen,
  onChange,
  notify,
}: {
  state: GameState;
  onOpen: (id: string) => void;
  onChange: (state: GameState) => void;
  notify: (message: string) => void;
}) {
  const [inside, setInside] = useState<string | null>(null);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState('day');
  if (inside)
    return (
      <BuildingInterior
        id={inside}
        state={state}
        onChange={onChange}
        notify={notify}
        onBack={() => setInside(null)}
        onSphere={() => onOpen(inside)}
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
        <label>Время суток <select aria-label="Время суток" value={time} onChange={e => setTime(e.target.value)}><option value="day">☀ День</option><option value="evening">🌅 Вечер</option><option value="night">🌙 Ночь</option></select></label>
        <span>{paused ? 'Город на паузе' : 'Город живёт: жители, транспорт и вода'}</span>
      </div>
      <div
        className="city-map-scroll"
        tabIndex={0}
        aria-label="Карта острова: прокручивайте по горизонтали на телефоне"
      >
        <div className="city-map" data-time={time} data-paused={paused} style={{ '--city-rate': speed } as CSSProperties}>
          <img
            src={cityImage}
            alt="Девять зданий сфер жизни на солнечном острове"
            draggable={false}
          />
          <svg className="city-exteriors" viewBox="0 0 900 600" aria-hidden="true">
            {spheres.map(s => {
              const b = buildingState(state, s.id);
              const d = districts[s.id];
              if (b.tier === 1 && b.style === 'coastal' && !b.slots.some(Boolean)) return null;
              return <svg key={s.id} x={(d.x - 15) * 9} y={(d.y - 12) * 6} width="270" height="165"><CityBuildingArt id={s.id} building={b} variant="map" /></svg>;
            })}
          </svg>
          <CityEnvironment paused={paused} speed={speed} />
          <div className="city-map-badge">
            <Icon name="city" size={20} />
            <span>
              PLAY YOUR LIFE<small>Твой остров развития</small>
            </span>
          </div>
          {spheres.map((s) => {
            const d = districts[s.id];
            const building = buildingState(state, s.id);
            return (
              <button
                key={s.id}
                className={`city-building-hit tier-${building.tier} style-${building.style}`}
                style={
                  {
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    '--district-color': s.color,
                  } as CSSProperties
                }
                aria-label={`Войти: ${s.name}`}
                onClick={() => setInside(s.id)}
              >
                <span className="city-hover-name">
                  {s.icon} {s.name} <small>Войти →</small>
                </span>
                {building.tier > 1 && (
                  <span
                    className="city-upgrade-badge"
                    aria-label={`Улучшение ${building.tier}`}
                  >
                    {'★'.repeat(building.tier - 1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="city-mobile-hint">
        ↔ Прокрути остров или выбери здание в меню сверху.
      </p>
    </section>
  );
}
