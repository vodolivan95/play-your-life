import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import type { CityTime } from '../../weatherSystem';
import type { WeatherRuntime } from './WeatherSystem';
export default function TrafficSystem({ runtime, time, paused, speed }: { runtime: WeatherRuntime; time: CityTime; paused: boolean; speed: number }) {
  const cars = useRef<Group>(null), elapsed = useRef(0);
  useFrame((_, dt) => {
    if (!paused) elapsed.current += dt * speed * runtime.current.trafficSpeed;
    cars.current?.children.forEach((car, i) => {
      const distance = (elapsed.current * 2 + i * 14) % 108;
      let x = 0, z = 0, angle = 0;
      if (distance < 30) { x = -15 + distance; z = -12; angle = Math.PI / 2; }
      else if (distance < 54) { x = 15; z = -12 + distance - 30; }
      else if (distance < 84) { x = 15 - (distance - 54); z = 12; angle = -Math.PI / 2; }
      else { x = -15; z = 12 - (distance - 84); angle = Math.PI; }
      car.position.set(x, .45, z); car.rotation.y = angle;
      car.children[2].visible = time === 'night' || runtime.current.rainIntensity > .1 || runtime.current.fogDensity > .02;
    });
  });
  return <group ref={cars}>{Array.from({ length: 8 }, (_, i) => <group key={i}>
    <mesh castShadow><boxGeometry args={[.85, .45, 1.8]} /><meshStandardMaterial color={['#e9a34d', '#5078b2', '#dedfdc', '#b36a66'][i % 4]} metalness={.45} roughness={.3} /></mesh>
    <mesh position={[0, .35, -.1]}><boxGeometry args={[.7, .35, 1]} /><meshStandardMaterial color="#29404f" metalness={.4} roughness={.2} /></mesh>
    <group>{[-.28, .28].map(x => <group key={x}><mesh position={[x, 0, .92]}><boxGeometry args={[.17, .14, .03]} /><meshStandardMaterial emissive="#fff3b5" emissiveIntensity={3} color="#fff3b5" /></mesh><mesh position={[x, 0, -.92]}><boxGeometry args={[.17, .14, .03]} /><meshStandardMaterial emissive="#e94545" emissiveIntensity={2} color="#e94545" /></mesh><mesh position={[x, -.38, 1.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.6, 1.8]} /><meshBasicMaterial color="#f6e4a6" transparent opacity={.18} depthWrite={false} /></mesh></group>)}</group>
  </group>)}</group>;
}
export function PedestrianSystem({ runtime, paused, speed }: { runtime: WeatherRuntime; paused: boolean; speed: number }) {
  const people = useRef<Group>(null), elapsed = useRef(0);
  useFrame((_, dt) => {
    if (!paused) elapsed.current += dt * speed;
    people.current?.children.forEach((person, i) => {
      person.visible = i / 20 < runtime.current.pedestrianDensity;
      person.position.set(-12 + (elapsed.current * .55 + i * 2.4) % 24, .35, i % 2 ? 9.5 : -9.5);
      person.children[2].visible = runtime.current.rainIntensity > .3;
    });
  });
  return <group ref={people}>{Array.from({ length: 20 }, (_, i) => <group key={i}><mesh><capsuleGeometry args={[.12, .4, 3, 5]} /><meshStandardMaterial color={['#bc8365', '#e6be7c', '#617fa4'][i % 3]} /></mesh><mesh position={[0, .45, 0]}><sphereGeometry args={[.13, 6, 5]} /><meshStandardMaterial color="#c59b7e" /></mesh><mesh position={[0, .8, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.48, .18, 8]} /><meshStandardMaterial color="#557ab0" /></mesh></group>)}</group>;
}
