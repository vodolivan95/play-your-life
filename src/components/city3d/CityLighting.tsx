import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, DirectionalLight, FogExp2, HemisphereLight, MathUtils } from 'three';
import type { CityTime } from '../../weatherSystem';
import type { WeatherRuntime } from './WeatherSystem';
const colors = { day: ['#90c9e4', '#fff2ce'], sunset: ['#be92a0', '#ffb773'], night: ['#111f38', '#8caade'] };
export default function CityLighting({ runtime, time, quality, reduced, paused }: { runtime: WeatherRuntime; time: CityTime; quality: string; reduced: boolean; paused: boolean }) {
  const sun = useRef<DirectionalLight>(null), ambient = useRef<HemisphereLight>(null);
  const { scene } = useThree();
  const sky = useRef(new Color(colors.day[0])), flash = useRef(0), clock = useRef(0);
  // Imperative Three.js updates are intentionally mutable; React state is untouched.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const w = runtime.current;
    if (!paused) clock.current += delta;
    // One smooth flash every 24 seconds, disabled for reduced motion.
    flash.current = !reduced && w.rainIntensity > .85 ? Math.max(0, 1 - (clock.current % 24) / .65) * 2 : 0;
    const target = new Color(colors[time][0]).lerp(new Color(time === 'night' ? '#202939' : '#879ba7'), w.cloudiness * .6);
    sky.current.lerp(target, 1 - Math.exp(-delta * 2));
    scene.background = sky.current;
    if (!(scene.fog instanceof FogExp2)) scene.fog = new FogExp2(sky.current, w.fogDensity);
    scene.fog.color.copy(sky.current); scene.fog.density = w.fogDensity;
    if (sun.current) { sun.current.intensity = MathUtils.damp(sun.current.intensity, w.sunIntensity * (time === 'night' ? .16 : 1) + flash.current, flash.current ? 12 : 2, delta); sun.current.color.lerp(new Color(colors[time][1]), 1 - Math.exp(-delta * 2)); sun.current.shadow.radius = 1 + w.cloudiness * 4; }
    if (ambient.current) { ambient.current.intensity = (time === 'night' ? 1.1 : 1.5) + flash.current; ambient.current.color.copy(time === 'night' ? new Color('#799dc6') : sky.current); }
  });
  /* eslint-enable react-hooks/immutability */
  return <><hemisphereLight ref={ambient} args={['#cde9ff', '#596b65', 1.4]} /><directionalLight ref={sun} position={[-22, 35, 12]} castShadow={quality !== 'low'} shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28} shadow-normalBias={.08} shadow-bias={-.0002} /></>;
}
