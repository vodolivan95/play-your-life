import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { advanceWeather, initialWeather } from '../../weatherSystem';
import type { WeatherKind, WeatherParameters } from '../../weatherSystem';
export type WeatherRuntime = MutableRefObject<WeatherParameters>;
export function useWeatherRuntime() { return useRef(initialWeather()); }
export default function WeatherSystem({ runtime, kind, paused, onTelemetry }: { runtime: WeatherRuntime; kind: WeatherKind; paused: boolean; onTelemetry: (weather: WeatherParameters) => void }) {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (paused) return;
    runtime.current = advanceWeather(runtime.current, kind, delta);
    elapsed.current += delta;
    if (elapsed.current > 1) { elapsed.current = 0; onTelemetry(runtime.current); }
  }, -2);
  return null;
}
