import { Component, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { ACESFilmicToneMapping, Vector3 } from 'three';
import type { GameState } from '../../game';
import { automaticTime, automaticWeather, initialWeather, weatherLabels } from '../../weatherSystem';
import type { CityTime, WeatherKind, WeatherParameters } from '../../weatherSystem';
import WeatherSystem from './WeatherSystem';
import CityLighting from './CityLighting';
import { EnvironmentSystem, WaterSystem } from './EnvironmentSystem';
import TrafficSystem, { PedestrianSystem } from './TrafficSystem';
import CityArchitecture from './CityArchitecture';
import { cityPositions } from './cityConfig';
import WeatherParticles from './WeatherParticles';
import './CityScene.css';
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert">3D-город не загрузился. Выбери здание в меню «Войти в здание» или обнови браузер с WebGL 2.</p> : this.props.children; }
}
const storageKey = 'play-your-life-city-weather-v1';
type Settings = { weather: WeatherKind | 'auto'; time: CityTime | 'auto'; quality: 'auto' | 'low' | 'medium' | 'high' };
function settings(): Settings {
  try { const v = JSON.parse(localStorage.getItem(storageKey) || '{}'); return { weather: v.weather === 'auto' || v.weather in weatherLabels ? v.weather : 'clear', time: ['day', 'sunset', 'night', 'auto'].includes(v.time) ? v.time : 'day', quality: ['auto', 'low', 'medium', 'high'].includes(v.quality) ? v.quality : 'auto' }; } catch { return { weather: 'clear', time: 'day', quality: 'auto' }; }
}
function CityWorld({ state, onOpen, weather, time, quality, paused, speed, reduced, telemetry }: { state: GameState; onOpen: (id: string) => void; weather: WeatherKind; time: CityTime; quality: string; paused: boolean; speed: number; reduced: boolean; telemetry: (w: WeatherParameters) => void }) {
  const runtime = useRef(initialWeather()), { gl, camera, size } = useThree(), scratch = useRef(new Vector3());
  // Three.js resources are mutable GPU/scene objects, outside React render state.
  // eslint-disable-next-line react-hooks/immutability
  useFrame(() => {
    gl.domElement.dataset.ready = 'true';
    const p = cityPositions.find(p => p.id === 'sport')!;
    scratch.current.set(p.x, 2.8, p.z).project(camera);
    gl.domElement.dataset.sportPoint = `${(scratch.current.x + 1) * size.width / 2},${(1 - scratch.current.y) * size.height / 2}`;
    gl.domElement.dataset.wetness = runtime.current.wetness.toFixed(3);
    gl.domElement.dataset.snowAmount = runtime.current.snowAmount.toFixed(3);
    gl.domElement.dataset.rain = runtime.current.rainIntensity.toFixed(3);
    gl.domElement.dataset.fog = runtime.current.fogDensity.toFixed(4);
    gl.domElement.dataset.trafficSpeed = runtime.current.trafficSpeed.toFixed(3);
  });
  return <><WeatherSystem weatherRef={runtime} kind={weather} paused={paused} onTelemetry={telemetry} /><CityLighting runtime={runtime} time={time} quality={quality} reduced={reduced} paused={paused} /><WaterSystem runtime={runtime} time={time} paused={paused} reduced={reduced} /><EnvironmentSystem runtime={runtime} paused={paused} reduced={reduced} /><CityArchitecture state={state} runtime={runtime} time={time} onOpen={onOpen} /><TrafficSystem runtime={runtime} time={time} paused={paused || reduced} speed={speed} /><PedestrianSystem runtime={runtime} paused={paused || reduced} speed={speed} /><WeatherParticles runtime={runtime} quality={quality} paused={paused} reduced={reduced} /><OrbitControls target={[0, 0, 0]} minDistance={32} maxDistance={72} minPolarAngle={.35} maxPolarAngle={1.05} enablePan={false} maxAzimuthAngle={.8} minAzimuthAngle={-.8} /></>;
}
export default function CityScene({ state, onOpen, paused, speed }: { state: GameState; onOpen: (id: string) => void; paused: boolean; speed: number }) {
  const [options, setOptions] = useState(settings), [now, setNow] = useState(() => new Date()), [slow, setSlow] = useState(false), [telemetry, setTelemetry] = useState(initialWeather);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const time = options.time === 'auto' ? automaticTime(now.getHours()) : options.time;
  const weather = options.weather === 'auto' ? automaticWeather(now.getHours() * 60 + now.getMinutes()) : options.weather;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const quality = options.quality === 'auto' ? slow || memory <= 2 ? 'low' : matchMedia('(pointer: coarse)').matches ? 'medium' : 'high' : options.quality;
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(options)); } catch { /* Погода не влияет на сохранение игрового прогресса. */ } }, [options]);
  return <><details className="city3d-dev"><summary>DEV · Погода и время суток</summary><div>
    <label>Погода<select aria-label="Погода города" value={options.weather} onChange={e => setOptions({ ...options, weather: e.target.value as Settings['weather'] })}><option value="auto">AUTO · игровой цикл</option>{Object.entries(weatherLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label>Время<select aria-label="Время 3D-города" value={options.time} onChange={e => setOptions({ ...options, time: e.target.value as Settings['time'] })}>{[['auto', 'AUTO · время устройства'], ['day', 'День'], ['sunset', 'Закат'], ['night', 'Ночь']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label>Качество<select aria-label="Качество города" value={options.quality} onChange={e => setOptions({ ...options, quality: e.target.value as Settings['quality'] })}>{['auto', 'low', 'medium', 'high'].map(id => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label>
    <small>AUTO — игровой цикл, без запроса реальной погоды. Здания, жители и транспорт пока DEV PLACEHOLDERS.</small>
  </div></details><div className="city3d-scene"><Boundary><Suspense fallback={<p role="status">Загрузка 3D-города…</p>}><Canvas camera={{ position: [18, 38, 46], fov: 52, near: .2, far: 200 }} dpr={quality === 'high' ? 1.5 : 1} shadows={quality !== 'low'} gl={{ antialias: quality !== 'low', powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping }} data-weather={weather} data-time={time} data-quality={quality}>
      {options.quality === 'auto' && <PerformanceMonitor bounds={() => [23, 45]} flipflops={2} onDecline={() => setSlow(true)} onFallback={() => setSlow(true)} />}
      <CityWorld state={state} onOpen={onOpen} weather={weather} time={time} quality={quality} paused={paused} speed={speed} reduced={reduced} telemetry={setTelemetry} />
    </Canvas></Suspense></Boundary><span className="city3d-weather-status">{weatherLabels[weather]} · {quality.toUpperCase()} · Влажность {Math.round(telemetry.wetness * 100)}%</span></div><p className="city3d-hint">Нажми на здание, чтобы войти. Один палец — осмотр, два — приближение.</p></>;
}
