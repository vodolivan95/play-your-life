import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { CityTime } from '../../weatherSystem';
import type { WeatherRuntime } from './WeatherSystem';
export function WaterSystem({ runtime, time, paused, reduced }: { runtime: WeatherRuntime; time: CityTime; paused: boolean; reduced: boolean }) {
  const geometry = useMemo(() => new PlaneGeometry(180, 180, 36, 36), []);
  const material = useRef<MeshStandardMaterial>(null), elapsed = useRef(0);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Three.js resources are mutable GPU/scene objects, outside React render state.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, dt) => {
    if (!paused && !reduced) elapsed.current += dt;
    const w = runtime.current, positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      positions.setZ(i, Math.sin(x * .5 + elapsed.current) * Math.cos(y * .35 + elapsed.current * .7) * (.08 + w.windStrength * .4) + Math.sin(x * 3 + y * 2 + elapsed.current * 7) * w.rainIntensity * .03);
    }
    positions.needsUpdate = true; geometry.computeVertexNormals();
    if (material.current) { material.current.color.set(time === 'night' ? '#153c61' : time === 'sunset' ? '#4c8796' : '#188fa5'); material.current.roughness = .16 + w.windStrength * .25; }
  });
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.3, 0]} geometry={geometry} receiveShadow><meshStandardMaterial ref={material} metalness={.55} roughness={.2} /></mesh>;
}
export function EnvironmentSystem({ runtime, paused, reduced }: { runtime: WeatherRuntime; paused: boolean; reduced: boolean }) {
  const plants = useRef<Group>(null), clouds = useRef<Group>(null), lawn = useRef<MeshStandardMaterial>(null), clock = useRef(0);
  // Three.js resources are mutable GPU/scene objects, outside React render state.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, dt) => {
    if (!paused && !reduced) clock.current += dt;
    if (plants.current) for (let i = 0; i < plants.current.children.length; i++) plants.current.children[i].rotation.z = Math.sin(clock.current * 1.5 + i) * runtime.current.windStrength * .07;
    if (clouds.current) { clouds.current.position.x = Math.sin(clock.current * .015) * 10; clouds.current.visible = runtime.current.cloudiness > .08; }
    if (lawn.current) lawn.current.color.copy(new Color('#43816b').lerp(new Color('#d6e4e9'), runtime.current.snowAmount));
  });
  return <><mesh position={[0, -.15, 0]} receiveShadow><boxGeometry args={[48, .3, 40]} /><meshStandardMaterial ref={lawn} color="#43816b" roughness={.9} /></mesh>
    <group ref={plants}>{Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2; return <group key={i} position={[Math.cos(a) * 22, 0, Math.sin(a) * 18]}><mesh castShadow position={[0, 1.5, 0]}><cylinderGeometry args={[.12, .22, 3, 6]} /><meshStandardMaterial color="#8c7258" /></mesh><mesh castShadow position={[0, 3.2, 0]} scale={[1.2, .6, 1.2]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#326952" roughness={.85} /></mesh></group>; })}</group>
    <group ref={clouds}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[(i % 3 - 1) * 18, 16 + i % 2 * 2, (Math.floor(i / 3) - 1) * 16]} scale={[6, 1.5, 3]}><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#b6c2ca" roughness={1} transparent opacity={.65} depthWrite={false} /></mesh>)}</group>
  </>;
}
