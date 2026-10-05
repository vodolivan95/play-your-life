import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { Environment, Lightformer, useTexture } from '@react-three/drei';
import type { Vec3 } from '../../roomEngine';
import type { RoomQuality, RoomTime } from './RoomScene3D';

function surface(kind: 'stone' | 'wood', normal = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const data = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const noise = ((x * 73 + y * 131 + x * y * 17) % 97) / 97;
    const grain = Math.sin(x * .42 + Math.sin(y * .027) * 4) * 5;
    const seam = kind === 'stone' && (x < 2 || y < 2);
    const v = kind === 'stone' ? (seam ? 38 : 112 + noise * 12 + Math.sin(x * .07 + y * .03) * 4) : 94 + grain + noise * 12;
    const i = (y * 256 + x) * 4;
    data.data[i] = normal ? 128 + grain * .4 : v;
    data.data[i + 1] = normal ? 128 + (noise - .5) * 5 : v * (kind === 'wood' ? .68 : .96);
    data.data[i + 2] = normal ? 250 : v * (kind === 'wood' ? .44 : .91);
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const texture = new CanvasTexture(canvas); texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(kind === 'stone' ? 8 : 2, kind === 'stone' ? 7 : 5);
  if (!normal) texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function Skyline({ time }: { time: RoomTime }) {
  const texture = useTexture(`${import.meta.env.BASE_URL}environments/sport-city${time === 'sunset' ? '' : `-${time}`}.jpg`);
  // Three textures are imperative GPU resources, not React state.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { texture.colorSpace = SRGBColorSpace; }, [texture]);
  return <group><mesh position={[0, 3.5, -27]}>
    <planeGeometry args={[96, 48]} />
    <meshBasicMaterial map={texture} color="#ffffff" toneMapped={false} />
  </mesh><mesh position={[27, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[96, 48]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh></group>;
}
export default function RoomEnvironment({ time, quality }: { time: RoomTime; quality: RoomQuality }) {
  const maps = useMemo(() => ({ stone: surface('stone'), normal: surface('stone', true), wood: surface('wood') }), []);
  useEffect(() => () => Object.values(maps).forEach(texture => texture.dispose()), [maps]);
  const block = (pos: Vec3, scale: Vec3, color = '#222b31', metalness = .5, roughness = .45) => <mesh position={pos} scale={scale} castShadow receiveShadow><boxGeometry /><meshStandardMaterial color={color} metalness={metalness} roughness={roughness} /></mesh>;
  return <group>
    <Environment key={time} resolution={quality === 'low' ? 64 : 128} frames={1}>
      <Lightformer position={[0, 4, -8]} scale={[12, 5, 1]} intensity={time === 'night' ? .5 : 2} color={time === 'day' ? '#dceeff' : '#ffba80'} />
      <Lightformer position={[-8, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} intensity={1.5} color="#ffcf99" />
      <Lightformer position={[6, 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} intensity={1} color="#94c9e5" />
    </Environment>
    <Skyline time={time} />
    <mesh position={[0, -.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[12.4, 10.4]} /><meshStandardMaterial map={maps.stone} normalMap={maps.normal} normalScale={[.2, .2]} roughness={.32} metalness={.12} envMapIntensity={1.3} /></mesh>
    {block([-6.1, 2.7, 0], [.2, 5.4, 10.4], '#82776b', 0, .9)}
    <mesh position={[-5.985, 2.5, -1]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[7.5, 4.8]} /><meshStandardMaterial map={maps.wood} roughness={.62} /></mesh>
    {Array.from({ length: 26 }, (_, i) => <group key={i}>{block([-5.9, 2.5, -4.6 + i * .28], [.1, 4.8, .04], '#785435', .05, .65)}</group>)}
    {block([-5.87, 1.4, 3.7], [.12, 2.8, 1.35], '#19272d', .7, .27)}
    {block([-5.78, 1.4, 3.7], [.05, 2.65, 1.18], '#4c3d30', .05, .65)}
    {block([-5.7, 1.25, 3.3], [.1, .045, .22], '#b5b7b6', .9, .23)}
    {block([0, 5.35, 0], [12.4, .15, 10.4], '#454441', .05, .85)}
    {[-4.8, -2.4, 0, 2.4, 4.8].map(z => <group key={z}>
      {block([0, 5.08, z], [12, .35, .14], '#242a2c', .65, .36)}
      {[-3.8, 0, 3.8].map(x => <group key={x}>
        {block([x, 4.84, z], [.14, .3, .18], '#131b20', .75, .3)}
        <mesh position={[x, 4.68, z]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[.055, 12]} /><meshStandardMaterial color="#ffddb2" emissive="#ffbd72" emissiveIntensity={2} /></mesh>
      </group>)}
    </group>)}
    {[-5.9, -3, 0, 3, 5.9].map(x => <group key={x}>{block([x, 2.65, -5], [.085, 5.3, .15], '#172027', .85, .3)}</group>)}
    {[-4.9, -2.5, 0, 2.5, 4.9].map(z => <group key={`side-${z}`}>{block([6, 2.65, z], [.15, 5.3, .085], '#172027', .85, .3)}</group>)}
    {[.12, 5.1].map(y => <group key={`side-${y}`}>{block([6, y, 0], [.15, .12, 10], '#172027', .85, .3)}</group>)}
    <mesh position={[6.02, 2.65, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[9.8, 5]} /><meshPhysicalMaterial color="#d1e9f4" transparent opacity={.045} roughness={.12} metalness={.1} depthWrite={false} /></mesh>
    {block([0, 2.7, 5.14], [12.4, 5.4, .2], '#716961', 0, .85)}
    {[.12, 5.1].map(y => <group key={y}>{block([0, y, -5], [12, .12, .15], '#172027', .85, .3)}</group>)}
    <mesh position={[0, 2.65, -5.02]}><planeGeometry args={[11.8, 5]} /><meshPhysicalMaterial color="#d1e9f4" transparent opacity={.045} roughness={.12} metalness={.1} depthWrite={false} /></mesh>
    {[-5.84, 5.84].map(x => <group key={x}>
      {block([x, 4.87, 0], [.12, .12, 10], '#1c252a', .6)}
      <mesh position={[x, 4.78, 0]} scale={[.045, .025, 9.8]}><boxGeometry /><meshStandardMaterial color="#ffe1b1" emissive="#ffb456" emissiveIntensity={2.5} /></mesh>
    </group>)}
    {[.12, 4.95].map(y => <mesh key={y} position={[0, y, -4.9]} scale={[11.8, .025, .025]}><boxGeometry /><meshStandardMaterial color="#ffe1b1" emissive="#ffb456" emissiveIntensity={2.2} /></mesh>)}
    <mesh position={[-5.82, .1, 0]} scale={[.03, .03, 9.7]}><boxGeometry /><meshStandardMaterial emissive="#ffb456" emissiveIntensity={1.6} color="#ffd29a" /></mesh>
  </group>;
}
