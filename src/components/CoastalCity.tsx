import { useState } from 'react';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { coastalBuildings } from '../coastalCity';
import { buildingState } from '../city';
import cityImage from '../assets/coastal-city.jpg';
import './CoastalCity.css';

const weatherOptions = [
  ['clear', 'Ясно'], ['partlyCloudy', 'Переменная облачность'],
  ['cloudy', 'Облачно'], ['rain', 'Дождь'], ['thunderstorm', 'Гроза'],
  ['fog', 'Туман'], ['snow', 'Снег'],
];

export default function CoastalCity({ state, onOpen, paused, speed }: {
  state: GameState; onOpen: (id: string) => void; paused: boolean; speed: number;
}) {
  const [zoom, setZoom] = useState(1);
  const [time, setTime] = useState('day');
  const [weather, setWeather] = useState('clear');
  return <div className="coastal-city">
    <div className="coastal-controls" aria-label="Вид города">
      <label>Время <select aria-label="Время города" value={time} onChange={e => setTime(e.target.value)}>
        <option value="day">День</option><option value="sunset">Вечер</option><option value="night">Ночь</option>
      </select></label>
      <label>Погода <select aria-label="Погода города" value={weather} onChange={e => setWeather(e.target.value)}>
        {weatherOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <div className="coastal-zoom" aria-label="Масштаб карты">
        <button aria-label="Уменьшить карту" disabled={zoom === 1} onClick={() => setZoom(Math.max(1, zoom - .5))}>−</button>
        <button onClick={() => setZoom(1)}>Весь остров</button>
        <button aria-label="Увеличить карту" disabled={zoom === 2.5} onClick={() => setZoom(Math.min(2.5, zoom + .5))}>+</button>
      </div>
    </div>
    <p className="coastal-hint" id="coastal-hint">Нажми на здание, чтобы войти. Увеличенную карту можно листать.</p>
    <div className="coastal-scroll" aria-label="Прибрежная карта" aria-describedby="coastal-hint">
      <div className="coastal-map" data-time={time} data-weather={weather} data-paused={paused}
        style={{ width: `${zoom * 100}%`, '--city-rate': speed } as CSSProperties}>
        <img src={cityImage} width="1005" height="1280" alt="Прибрежный город на островах: девять зданий сфер жизни, мосты, водопады и пляж" draggable={false} />
        <svg className="coastal-water" viewBox="0 0 1005 1280" aria-hidden="true">
          {[[514, 309, 30, 10], [791, 375, 25, 9], [511, 552, 54, 15], [884, 571, 27, 10], [795, 800, 27, 10], [928, 1067, 30, 11]].map(([x, y, rx, ry], i) =>
            <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} className="coastal-ripple" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${-i * .4}s` }} />)}
        </svg>
        <div className="coastal-atmosphere" aria-hidden="true" />
        {coastalBuildings.map(building => {
          const sphere = spheres.find(s => s.id === building.id)!;
          const tier = buildingState(state, building.id).tier;
          return <button key={building.id} className="coastal-building" data-building={building.id}
            aria-label={`Войти: ${sphere.name}`} onClick={() => onOpen(building.id)}
            style={{ left: `${building.x}%`, top: `${building.y}%`, width: `${building.width}%`, height: `${building.height}%` }}>
            <span>{sphere.icon} {sphere.name}{tier > 1 ? ` · Здание ${tier} ур.` : ''}</span>
          </button>;
        })}
      </div>
    </div>
  </div>;
}
