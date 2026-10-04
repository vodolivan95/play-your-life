import { useState } from 'react';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import Icon from './Icon';
import BuildingInterior from './BuildingInterior';
import cityImage from '../assets/life-city.webp';
import { buildingState } from '../city';
import './LifeCity.css';
const districts: Record<string, { name: string; x: number; y: number }> =
  {
    health: { name: 'Центр здоровья', x: 20, y: 19 },
    sport: { name: 'Спортивный клуб', x: 50, y: 20 },
    growth: { name: 'Библиотека знаний', x: 80, y: 19 },
    english: { name: 'Языковая академия', x: 20, y: 43 },
    finance: { name: 'Банк возможностей', x: 50, y: 43 },
    together: { name: 'Дом общих дел', x: 80, y: 43 },
    driving: { name: 'Автошкола', x: 20, y: 71 },
    tasks: { name: 'Мастерская планов', x: 50, y: 71 },
    hobby: { name: 'Дом творчества', x: 80, y: 71 },
  };
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
      <div
        className="city-map-scroll"
        tabIndex={0}
        aria-label="Карта острова: прокручивайте по горизонтали на телефоне"
      >
        <div className="city-map">
          <img
            src={cityImage}
            alt="Девять зданий сфер жизни на солнечном острове"
            draggable={false}
          />
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
                {building.slots.map(
                  (item, i) =>
                    item && (
                      <span
                        className={`city-placed-decor decor-${i}`}
                        key={i}
                        aria-hidden="true"
                      >
                        {
                          {
                            palm: '🌴',
                            bench: '🪑',
                            flowers: '🌺',
                            lamp: '💡',
                            fountain: '⛲',
                            statue: '🗿',
                          }[item]
                        }
                      </span>
                    ),
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

