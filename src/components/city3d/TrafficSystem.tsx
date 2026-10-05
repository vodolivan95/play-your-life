import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { CityTime } from '../../weatherSystem';
import type { WeatherRuntime } from './WeatherSystem';
export default function TrafficSystem({ runtime, time, paused, speed }: { runtime: WeatherRuntime; time: CityTime; paused: boolean; speed: number }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}models/city/car.glb`);
  const models = useMemo(() => Array.from({ length: 8 }, (_, i) => { const clone = scene.clone(true); clone.traverse(n => { if (n instanceof Mesh) { n.castShadow = true; if (n.material instanceof MeshStandardMaterial && n.material.name === 'ocean-blue') { n.material = n.material.clone(); n.material.color.set(['#edb655', '#397fae', '#f2f1de', '#cf645a'][i % 4]); } } }); return clone; }), [scene]);
  const cars = useRef<Group>(null), elapsed = useRef(0);
  useFrame((_, dt) => {
    if (!paused) elapsed.current += dt * speed * runtime.current.trafficSpeed;
    cars.current?.children.forEach((car, i) => {
      const distance = (elapsed.current * 2 + i * 14) % 196;
      let x = 0, z = 0, angle = 0;
      if (distance < 50) { x = -25 + distance; z = -25; angle = Math.PI / 2; }
      else if (distance < 98) { x = 25; z = -25 + distance - 50; }
      else if (distance < 148) { x = 25 - (distance - 98); z = 25; angle = -Math.PI / 2; }
      else { x = -25; z = 25 - (distance - 148); angle = Math.PI; }
      car.position.set(x, .5, z); car.rotation.y = angle;
      car.children[1].visible = time === 'night' || runtime.current.rainIntensity > .1 || runtime.current.fogDensity > .02;
    });
  });
  return <group ref={cars}>{Array.from({ length: 8 }, (_, i) => <group key={i}>
    <primitive object={models[i]} />
    <group>{[-.28, .28].map(x => <group key={x}><mesh position={[x, 0, .92]}><boxGeometry args={[.17, .14, .03]} /><meshStandardMaterial emissive="#fff3b5" emissiveIntensity={3} color="#fff3b5" /></mesh><mesh position={[x, 0, -.92]}><boxGeometry args={[.17, .14, .03]} /><meshStandardMaterial emissive="#e94545" emissiveIntensity={2} color="#e94545" /></mesh><mesh position={[x, -.38, 1.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.6, 1.8]} /><meshBasicMaterial color="#f6e4a6" transparent opacity={.18} depthWrite={false} /></mesh></group>)}</group>
  </group>)}</group>;
}
export function PedestrianSystem({ runtime, paused, speed }: { runtime: WeatherRuntime; paused: boolean; speed: number }) {
  const people = useRef<Group>(null), elapsed = useRef(0);
  useFrame((_, dt) => {
    if (!paused) elapsed.current += dt * speed * (.4 + runtime.current.trafficSpeed * .6);
    people.current?.children.forEach((person, i) => {
      person.visible = i / 20 < runtime.current.pedestrianDensity;
      person.position.set(-22 + (elapsed.current * .55 + i * 3.4) % 44, .7, i % 2 ? 9.8 : -9.8);
      person.children[2].visible = runtime.current.rainIntensity > .3;
    });
  });
  return <group ref={people}>{Array.from({ length: 20 }, (_, i) => <group key={i}><mesh><capsuleGeometry args={[.12, .4, 3, 5]} /><meshStandardMaterial color={['#bc8365', '#e6be7c', '#617fa4'][i % 3]} /></mesh><mesh position={[0, .45, 0]}><sphereGeometry args={[.13, 6, 5]} /><meshStandardMaterial color="#c59b7e" /></mesh><mesh position={[0, .8, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.48, .18, 8]} /><meshStandardMaterial color="#557ab0" /></mesh></group>)}</group>;
}
