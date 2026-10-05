import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { spheres } from '../../game';
import type { GameState } from '../../game';
import type { CityTime } from '../../weatherSystem';
import { buildingState } from '../../city';
import type { WeatherRuntime } from './WeatherSystem';
import { cityPositions } from './cityConfig';
const asset = (id: string) => `${import.meta.env.BASE_URL}models/city/${id}.glb`;
function useCityModel(id: string) {
  const { scene } = useGLTF(asset(id));
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(node => { if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) { node.material = node.material.clone(); node.castShadow = true; node.receiveShadow = true; } });
    return clone;
  }, [scene]);
  useEffect(() => () => model.traverse(node => { if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) node.material.dispose(); }), [model]);
  return model;
}
function Building({ index, state, runtime, time, onOpen }: { index: number; state: GameState; runtime: WeatherRuntime; time: CityTime; onOpen: (id: string) => void }) {
  const s = spheres[index], p = cityPositions[index], building = buildingState(state, s.id), model = useCityModel(s.id);
  const materials = useMemo(() => { const list: MeshStandardMaterial[] = []; model.traverse(node => { if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) list.push(node.material); }); return list; }, [model]);
  // These cloned Three.js materials are mutable scene resources, not React state.
  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    for (const material of materials) {
      if (material.name === 'snow-roof') material.color.copy(new Color('#edeedf').lerp(new Color('#f5f8ff'), runtime.current.snowAmount));
      if (material.name === 'weather-glass') { material.emissiveIntensity = time === 'night' ? 1.1 : time === 'sunset' ? .3 : .03; material.roughness = .14 + runtime.current.cloudiness * .15; }
    }
  });
  /* eslint-enable react-hooks/immutability */
  return <group position={[p.x, .4, p.z]} scale={1 + (building.tier - 1) * .035} onClick={e => { e.stopPropagation(); onOpen(s.id); }}><primitive object={model} /></group>;
}
export function IslandLandscape({ runtime }: { runtime: WeatherRuntime }) {
  const model = useCityModel('island');
  const materials = useMemo(() => { const list: MeshStandardMaterial[] = []; model.traverse(node => { if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) list.push(node.material); }); return list; }, [model]);
  // These cloned Three.js materials are mutable scene resources, not React state.
  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    for (const material of materials) {
      if (material.name === 'wet-road') { material.roughness = .92 - runtime.current.wetness * .75; material.color.copy(new Color('#435455').lerp(new Color('#394d57'), runtime.current.wetness * .6)); }
      if (material.name === 'wet-pavement') material.roughness = .85 - runtime.current.wetness * .6;
      if (material.name === 'lawn') material.color.copy(new Color('#458345').lerp(new Color('#e6ece8'), runtime.current.snowAmount));
    }
  });
  /* eslint-enable react-hooks/immutability */
  return <primitive object={model} />;
}
export function IslandPalms({ runtime, paused, reduced }: { runtime: WeatherRuntime; paused: boolean; reduced: boolean }) {
  const { scene } = useGLTF(asset('palm')), group = useRef<Group>(null), clock = useRef(0);
  const palms = useMemo(() => Array.from({ length: 44 }, (_, i) => ({ model: (() => { const model = scene.clone(true); model.traverse(n => { if (n instanceof Mesh) n.castShadow = true; }); return model; })(), x: Math.cos(i / 44 * Math.PI * 2) * 29, z: Math.sin(i / 44 * Math.PI * 2) * 26.2, size: .8 + i % 4 * .12 })), [scene]);
  useFrame((_, dt) => {
    if (!paused && !reduced) clock.current += dt;
    group.current?.children.forEach((child, i) => { child.rotation.z = Math.sin(clock.current * 1.2 + i) * runtime.current.windStrength * .028; });
  });
  return <group ref={group}>{palms.map((p, i) => <group key={i} position={[p.x, .4, p.z]} scale={p.size} rotation={[0, i * 1.6, 0]}><primitive object={p.model} /></group>)}</group>;
}
export function IslandBoat({ paused }: { paused: boolean }) {
  const model = useCityModel('boat'), boat = useRef<Group>(null), clock = useRef(0);
  useFrame((_, dt) => { if (!paused) clock.current += dt; if (boat.current) { boat.current.position.set(-34 + Math.sin(clock.current * .02) * 2, -.5, 24 + Math.cos(clock.current * .02) * 2); boat.current.rotation.z = Math.sin(clock.current * .8) * .04; } });
  return <group ref={boat}><primitive object={model} /></group>;
}
export default function CityArchitecture({ state, runtime, time, onOpen }: { state: GameState; runtime: WeatherRuntime; time: CityTime; onOpen: (id: string) => void }) {
  return <><IslandLandscape runtime={runtime} />{spheres.map((s, index) => <Building key={s.id} index={index} state={state} runtime={runtime} time={time} onOpen={onOpen} />)}
    {[-26, 26].flatMap(x => [-20, -8, 8, 20].map(z => <group key={`${x}/${z}`} position={[x, .4, z]}><mesh position={[0, 1.8, 0]}><cylinderGeometry args={[.05, .07, 3.6, 8]} /><meshStandardMaterial color="#53626b" metalness={.6} /></mesh><mesh position={[0, 3.6, 0]}><sphereGeometry args={[.18, 10, 8]} /><meshStandardMaterial color="#fff0c6" emissive="#ffe1a1" emissiveIntensity={time === 'night' ? 3 : .2} /></mesh>{time !== 'day' && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .15, 0]}><circleGeometry args={[1.8, 16]} /><meshBasicMaterial color="#f3c886" transparent opacity={.16} depthWrite={false} /></mesh>}</group>))}
    {time !== 'day' && [-18, 18].map(x => <pointLight key={x} position={[x, 3.5, 0]} color="#ffcb8e" intensity={time === 'night' ? 22 : 6} distance={22} decay={2} />)}
  </>;
}
