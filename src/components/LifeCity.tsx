import { useState } from 'react';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import Icon from './Icon';
import cityImage from '../assets/life-city.webp';
import './LifeCity.css';
const districts: Record<string, { name: string; x: number; y: number }> = {
  health: { name: 'Центр здоровья', x: 20, y: 35 },
  sport: { name: 'Спортивный клуб', x: 50, y: 35 },
  growth: { name: 'Библиотека знаний', x: 80, y: 35 },
  english: { name: 'Языковая академия', x: 20, y: 59 },
  finance: { name: 'Банк возможностей', x: 50, y: 59 },
  together: { name: 'Дом общих дел', x: 80, y: 59 },
  driving: { name: 'Автошкола', x: 20, y: 83 },
  tasks: { name: 'Мастерская планов', x: 50, y: 83 },
  hobby: { name: 'Дом творчества', x: 80, y: 83 },
};
export default function LifeCity({
  state,
  onOpen,
}: {
  state: GameState;
  onOpen: (id: string) => void;
}) {
  const [view, setView] = useState<'map' | 'list'>('map');
  const average = (
    spheres.reduce((sum, s) => sum + state.spheres[s.id].score, 0) /
    spheres.length
  ).toFixed(1);
  return (
    <section className="life-city" aria-label="Город сфер жизни">
      <div className="city-intro">
        <div>
          <span className="eyebrow">ТВОЙ ГОРОД. ТВОЙ ПРОГРЕСС.</span>
          <h2>Построй жизнь, в которой хочется жить</h2>
          <p>Каждое здание — отдельная сфера. Выбери свой следующий шаг.</p>
        </div>
        <div className="city-summary">
          <span>
            <b>9</b> районов
          </span>
          <span>
            <b>{average}/9</b> Life Score
          </span>
        </div>
      </div>
      <div className="city-toolbar">
        <div className="city-view-switch" aria-label="Вид города">
          <button
            className={view === 'map' ? 'active' : ''}
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
          >
            <Icon name="city" size={18} />
            Карта города
          </button>
          <button
            className={view === 'list' ? 'active' : ''}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <Icon name="spheres" size={18} />
            Все здания
          </button>
        </div>
        <span>Нажми на здание, чтобы открыть сферу</span>
      </div>
      {view === 'map' && (
        <>
          <div
            className="city-map-scroll"
            tabIndex={0}
            aria-label="Карта города: на телефоне прокрутите по горизонтали"
          >
            <div className="city-map">
              <img
                src={cityImage}
                alt="Солнечный город на острове: центр здоровья, спортивный клуб, библиотека, языковая академия, банк, дом общих дел, автошкола, мастерская и театр"
                draggable={false}
              />
              <div className="city-map-badge">
                <Icon name="city" size={20} />
                <span>
                  PLAY YOUR LIFE<small>Город твоих возможностей</small>
                </span>
              </div>
              {spheres.map((s) => {
                const d = districts[s.id];
                const data = state.spheres[s.id];
                return (
                  <button
                    key={s.id}
                    className="city-building"
                    style={
                      {
                        left: `${d.x}%`,
                        top: `${d.y}%`,
                        '--district-color': s.color,
                      } as CSSProperties
                    }
                    aria-label={`Открыть сферу ${s.name}`}
                    onClick={() => onOpen(s.id)}
                  >
                    <span className="city-building-marker" aria-hidden="true">
                      {s.icon}
                    </span>
                    <span className="city-building-label">
                      <strong>{s.name}</strong>
                      <small>{d.name}</small>
                      <span className="city-building-stats">
                        LVL {Math.floor(data.xp / 200) + 1}
                        <i />
                        Life Score {data.score}/9
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="city-mobile-hint">
            ↔ Проведи по карте, чтобы увидеть весь город. Или открой «Все
            здания».
          </p>
        </>
      )}
      <div
        className={`city-district-list ${view === 'map' ? 'city-list-compact' : ''}`}
        aria-label="Здания и сферы"
      >
        {spheres.map((s) => {
          const data = state.spheres[s.id];
          return (
            <button
              key={s.id}
              className="city-district-card"
              onClick={() => onOpen(s.id)}
              style={{ '--district-color': s.color } as CSSProperties}
            >
              <span className="city-district-icon">{s.icon}</span>
              <div>
                <strong>{districts[s.id].name}</strong>
                <span>{s.name}</span>
                <small>
                  Уровень {Math.floor(data.xp / 200) + 1} · {data.xp} XP · Life
                  Score {data.score}/9
                </small>
              </div>
              <Icon name="arrow" size={18} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
