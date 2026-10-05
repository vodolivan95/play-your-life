import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import type { ObjectId, RoomId, RoomObject, Vec3 } from '../../roomEngine';
import { objectSpec, rotateSize } from '../../roomEngine';
import Model3D from './Models';

export type RoomTime = 'day' | 'sunset' | 'night';
export type RoomQuality = 'low' | 'medium' | 'high';
type Props = {
  roomId: RoomId; objects: RoomObject[]; ghost: RoomObject | null; valid: boolean;
  build: boolean; selected: ObjectId | null; time: RoomTime; quality: RoomQuality;
  onFloor: (position: Vec3) => void; onSelect: (id: ObjectId) => void;
};
const lighting = {
  day: { sky: '#b9d7e5', sun: '#fff8e6', power: 3.2, ambient: 1.3, indoor: .5, city: '#8296a5' },
  sunset: { sky: '#bd8890', sun: '#ffb56d', power: 2.5, ambient: .8, indoor: 1.2, city: '#5b617f' },
  night: { sky: '#101a34', sun: '#678cce', power: .25, ambient: .4, indoor: 2.3, city: '#1c2940' },
};
function Architecture({ time, shadows }: { time: RoomTime; shadows: boolean }) {
  const l = lighting[time];
  const block = (position: Vec3, scale: Vec3, color: string, roughness = .65, metalness = 0) => <mesh position={position} scale={scale} castShadow={shadows} receiveShadow><boxGeometry /><meshStandardMaterial color={color} roughness={roughness} metalness={metalness} /></mesh>;
  return <group>
    <hemisphereLight args={[l.sky, '#5c4638', l.ambient]} />
    <directionalLight position={[-3, 7, -7]} color={l.sun} intensity={l.power} castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.04} />
    <pointLight position={[0, 4.6, 1]} color="#ffd1a2" intensity={l.indoor * 32} distance={16} decay={2} />
    {block([0, -.18, 0], [12.4, .3, 10.4], '#6e5140', .42)}
    {Array.from({ length: 16 }, (_, i) => <group key={i}>{block([-5.64 + i * .75, -.012, 0], [.73, .04, 10], i % 3 === 0 ? '#a27957' : i % 3 === 1 ? '#8d694f' : '#997253', .48)}</group>)}
    {block([-6.05, 2.6, 0], [.2, 5.2, 10.2], '#d6c8b8')}
    {block([0, .3, -5.05], [12, .6, .2], '#c6b6a0')}
    {block([0, 4.9, -5.05], [12, .6, .2], '#bba78d')}
    {[-5.9, -3, 0, 3, 5.9].map(x => <group key={x}>{block([x, 2.6, -5], [.09, 4.5, .12], '#25323b', .3, .75)}</group>)}
    {block([0, 2.6, -5], [12, .06, .12], '#25323b', .3, .75)}
    <mesh position={[0, 2.6, -5.02]}><planeGeometry args={[11.8, 4.1]} /><meshPhysicalMaterial color="#c6e9ef" transparent opacity={.09} roughness={.12} metalness={.05} /></mesh>
    <mesh position={[0, 5.2, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[12, 10]} /><meshStandardMaterial color="#51483f" roughness={.8} /></mesh>
    {[-4, -2, 0, 2, 4].map(z => <group key={z}>{block([0, 5.02, z], [12, .2, .12], '#35383a', .4, .65)}</group>)}
    {block([-5.86, 1.25, 3], [.1, 2.5, 1.45], '#453b35')}
    {block([-5.78, 1.25, 3], [.04, 2.35, 1.28], '#87735c')}
    {block([-5.69, 1.13, 2.6], [.12, .05, .22], '#aeb3ad', .2, .8)}
    {[-5.85, 5.85].map(x => <mesh key={x} position={[x, 4.7, 0]} scale={[.03, .035, 9.6]}><boxGeometry /><meshStandardMaterial color="#ffe0ac" emissive="#ffbf78" emissiveIntensity={time === 'night' ? 3 : 1} /></mesh>)}
    {Array.from({ length: 18 }, (_, i) => {
      const height = 4 + ((i * 7) % 11), x = -25 + i * 3, z = -14 - (i % 3) * 5;
      return <group key={i}>
        {block([x, height / 2 - 2, z], [2.1, height, 2], l.city, .5, .2)}
        {time === 'night' && Array.from({ length: 5 }, (_, j) => <mesh key={j} position={[x, j * 1.6, z + 1.02]}><planeGeometry args={[1.55, .12]} /><meshStandardMaterial color="#ffe2a2" emissive="#ffd392" emissiveIntensity={1.5} /></mesh>)}
      </group>;
    })}
  </group>;
}
export default function RoomScene3D(props: Props) {
  const { objects, ghost, valid, build, selected, time, quality, onFloor, onSelect } = props;
  const [slow, setSlow] = useState(false);
  const [active, setActive] = useState<ObjectId | null>(null);
  const [visible, setVisible] = useState(!document.hidden);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { const handle = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', handle); return () => document.removeEventListener('visibilitychange', handle); }, []);
  const shadows = quality !== 'low' && !slow;
  const footprint = ghost ? rotateSize(objectSpec(ghost.id).size, ghost.rotation[1]) : null;
  return <Canvas shadows={shadows} dpr={slow || quality === 'low' ? 1 : quality === 'medium' ? 1.25 : 1.75} camera={{ position: [3.4, 2.8, 3], fov: 75, near: .1, far: 110 }} gl={{ antialias: quality !== 'low', powerPreference: 'low-power' }} frameloop={visible && !reduced ? 'always' : 'demand'}>
    <color attach="background" args={[lighting[time].sky]} />
    <fog attach="fog" args={[lighting[time].sky, 25, 95]} />
    <PerformanceMonitor onDecline={() => setSlow(true)} />
    <Architecture time={time} shadows={shadows} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .02, 0]} onPointerMove={event => { if (ghost) { event.stopPropagation(); onFloor([Math.round(event.point.x), 0, Math.round(event.point.z)]); } }} onClick={event => { if (ghost) { event.stopPropagation(); onFloor([Math.round(event.point.x), 0, Math.round(event.point.z)]); } }}>
      <planeGeometry args={[12, 10]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    {build && <gridHelper args={[10, 10, '#85cced', '#658f9d']} position={[0, .03, 0]} />}
    {objects.filter(item => item.id !== ghost?.id).map(item => <group key={item.id} position={item.position} rotation={item.rotation} scale={item.scale} onClick={event => { event.stopPropagation(); onSelect(item.id); if (!build && item.id === 'treadmill') setActive(active === 'treadmill' ? null : 'treadmill'); }}>
      <Model3D id={item.id} active={active === item.id} reduced={reduced} />
      {selected === item.id && build && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .04, 0]}><ringGeometry args={[.55, .6, 32]} /><meshBasicMaterial color="#7dd9ff" transparent opacity={.7} /></mesh>}
    </group>)}
    {ghost && footprint && <group position={ghost.position} rotation={ghost.rotation} scale={ghost.scale}>
      <Model3D id={ghost.id} ghost={valid ? 'valid' : 'invalid'} reduced />
      <mesh position={[0, .045, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={objectSpec(ghost.id).size} /><meshBasicMaterial color={valid ? '#67ccff' : '#ff7979'} transparent opacity={.2} depthWrite={false} /></mesh>
    </group>}
    <OrbitControls makeDefault target={[0, 1.2, -.6]} enablePan={false} enableRotate={!ghost} minDistance={3} maxDistance={5.3} minPolarAngle={.8} maxPolarAngle={1.35} minAzimuthAngle={-.35} maxAzimuthAngle={1.1} enableDamping dampingFactor={.08} />
  </Canvas>;
}
