import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { spheres } from '../../game';
import type { GameState } from '../../game';
import type { CityTime } from '../../weatherSystem';
import { buildingState } from '../../city';
import type { WeatherRuntime } from './WeatherSystem';
import { cityPositions } from './cityConfig';
function BuildingLabel({ name, height }: { name: string; height: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#163345'; context.fillRect(0, 0, 512, 96);
    context.strokeStyle = '#89c6df'; context.lineWidth = 3; context.strokeRect(2, 2, 508, 92);
    context.font = 'bold 34px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#ffffff'; context.fillText(name, 256, 48, 484);
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
  }, [name]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, height + 1.35, 0]} scale={[5, .94, 1]}><spriteMaterial map={texture} toneMapped={false} transparent /></sprite>;
}
function Building({ index, state, runtime, time, onOpen }: { index: number; state: GameState; runtime: WeatherRuntime; time: CityTime; onOpen: (id: string) => void }) {
  const s = spheres[index], p = cityPositions[index], building = buildingState(state, s.id);
  const roof = useRef<MeshStandardMaterial>(null), windows = useRef<MeshStandardMaterial>(null);
  const height = 2.6 + building.tier * .65 + index % 3 * .4;
  useFrame(() => {
    if (roof.current) roof.current.color.copy(new Color('#d2d9d5').lerp(new Color('#f5f8ff'), runtime.current.snowAmount));
    if (windows.current) { windows.current.emissiveIntensity = time === 'night' ? 1.7 : time === 'sunset' ? .5 : .05; windows.current.roughness = .12 + runtime.current.cloudiness * .25; }
  });
  return <group position={[p.x, 0, p.z]} onClick={e => { e.stopPropagation(); onOpen(s.id); }}>
    <mesh castShadow receiveShadow position={[0, height / 2, 0]}><boxGeometry args={[6.3, height, 4.6]} /><meshStandardMaterial color={building.style === 'modern' ? '#a8bac6' : building.style === 'tropical' ? '#cdbd9f' : '#d5d8d2'} roughness={.65} /></mesh>
    <mesh position={[0, height / 2, 0]}><boxGeometry args={[6.4, height * .7, 4.7]} /><meshStandardMaterial ref={windows} color="#578696" metalness={.65} roughness={.14} emissive="#efbd75" emissiveIntensity={.05} /></mesh>
    {[0, 1, 2].map(i => <mesh key={i} position={[0, height * (.2 + i * .3), 0]}><boxGeometry args={[6.5, .12, 4.8]} /><meshStandardMaterial color="#deded3" roughness={.6} /></mesh>)}
    <mesh castShadow position={[0, height + .1, 0]}><boxGeometry args={[6.65, .25, 4.9]} /><meshStandardMaterial ref={roof} color="#d2d9d5" roughness={.75} /></mesh>
    <mesh position={[0, height + .75, 0]}><sphereGeometry args={[.5, 12, 8]} /><meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={.2} metalness={.5} roughness={.3} /></mesh>
    <BuildingLabel name={s.name} height={height} />
  </group>;
}
export default function CityArchitecture({ state, runtime, time, onOpen }: { state: GameState; runtime: WeatherRuntime; time: CityTime; onOpen: (id: string) => void }) {
  const road = useMemo(() => new MeshStandardMaterial({ color: '#374550', metalness: .35, roughness: .9 }), []), pavement = useRef<MeshStandardMaterial>(null);
  useEffect(() => () => road.dispose(), [road]);
  // Three.js resources are mutable GPU/scene objects, outside React render state.
  // eslint-disable-next-line react-hooks/immutability
  useFrame(() => { road.roughness = .92 - runtime.current.wetness * .78; if (pavement.current) pavement.current.roughness = .8 - runtime.current.wetness * .6; });
  return <><mesh position={[0, .02, 0]} receiveShadow><boxGeometry args={[34, .12, 29]} /><meshStandardMaterial ref={pavement} color="#c0bdb1" metalness={.1} roughness={.8} /></mesh>
    {[-12, 12].map(z => <mesh key={`z${z}`} position={[0, .1, z]} receiveShadow><boxGeometry args={[33, .05, 2.5]} /><primitive object={road} attach="material" /></mesh>)}
    {[-15, 15].map(x => <mesh key={x} position={[x, .1, 0]} receiveShadow><boxGeometry args={[2.5, .05, 26]} /><primitive object={road} attach="material" /></mesh>)}
    {spheres.map((s, index) => <Building key={s.id} index={index} state={state} runtime={runtime} time={time} onOpen={onOpen} />)}
    {[-18, 18].flatMap(x => [-13, 0, 13].map(z => <group key={`${x}/${z}`} position={[x, 0, z]}><mesh position={[0, 2, 0]}><cylinderGeometry args={[.05, .07, 4, 6]} /><meshStandardMaterial color="#4f5c65" metalness={.6} /></mesh><mesh position={[0, 4, 0]}><sphereGeometry args={[.2, 8, 6]} /><meshStandardMaterial color="#fff0c6" emissive="#ffe1a1" emissiveIntensity={time === 'night' ? 3 : .2} /></mesh>{time !== 'day' && <pointLight position={[0, 3.8, 0]} color="#ffcd8f" intensity={time === 'night' ? 14 : 5} distance={10} decay={2} />} {time !== 'day' && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .18, 0]}><circleGeometry args={[1.8, 16]} /><meshBasicMaterial color="#f3c886" transparent opacity={.16} depthWrite={false} /></mesh>}</group>))}
  </>;
}
