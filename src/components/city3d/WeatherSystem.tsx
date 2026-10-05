import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { advanceWeather } from '../../weatherSystem';
import type { WeatherKind, WeatherParameters } from '../../weatherSystem';
export type WeatherRuntime = MutableRefObject<WeatherParameters>;
export default function WeatherSystem({ weatherRef, kind, paused, onTelemetry }: { weatherRef: WeatherRuntime; kind: WeatherKind; paused: boolean; onTelemetry: (weather: WeatherParameters) => void }) {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (paused) return;
    weatherRef.current = advanceWeather(weatherRef.current, kind, delta);
    elapsed.current += delta;
    if (elapsed.current > 1) { elapsed.current = 0; onTelemetry(weatherRef.current); }
  }, -2);
  return null;
}
