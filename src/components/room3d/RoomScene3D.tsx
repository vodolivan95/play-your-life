import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, PerformanceMonitor, useProgress } from '@react-three/drei';
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace } from 'three';
import type { ObjectId, RoomId, RoomObject, Vec3 } from '../../roomEngine';
import RoomEnvironment from './RoomEnvironment';
import RoomLighting from './RoomLighting';
import { roomLighting } from './lightingPresets';
import RoomCamera from './RoomCamera';
import type { CameraPreset } from './RoomCamera';
import RoomItemRenderer from './RoomItemRenderer';
import BuildSystem from './BuildSystem';

export type RoomTime = 'day' | 'sunset' | 'night';
export type RoomQuality = 'low' | 'medium' | 'high';
type Props = {
  roomId: RoomId; objects: RoomObject[]; ghost: RoomObject | null; valid: boolean;
  build: boolean; selected: ObjectId | null; time: RoomTime; quality: RoomQuality;
  cameraPreset: CameraPreset; cameraRevision: number;
  onFloor: (position: Vec3) => void; onSelect: (id: ObjectId) => void;
};
function Rendering({ time }: { time: RoomTime }) {
  const { gl, invalidate, camera, size } = useThree();
  // WebGL renderer and canvas dataset are imperative Three/DOM resources.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { gl.outputColorSpace = SRGBColorSpace; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = time === 'day' ? 1 : time === 'night' ? .95 : 1.05; invalidate(); }, [gl, invalidate, time]);
  // The perspective lens adapts to the actual viewport, without a second camera engine.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { if (camera instanceof PerspectiveCamera) { camera.fov = size.width < size.height ? 86 : 68; camera.updateProjectionMatrix(); invalidate(); } }, [camera, size.width, size.height, invalidate]);
  return null;
}
function Ready({ onReady }: { onReady: (value: boolean) => void }) {
  const { gl } = useThree();
  // WebGL renderer and canvas dataset are imperative Three/DOM resources.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { gl.domElement.dataset.ready = 'true'; onReady(true); }, [gl, onReady]);
  return null;
}
export default function RoomScene3D({ objects, ghost, valid, build, time, quality, onFloor, onSelect, cameraPreset, cameraRevision }: Props) {
  const [ready, setReady] = useState(false);
  const { progress } = useProgress();
  const [slow, setSlow] = useState(false);
  const [active, setActive] = useState<ObjectId | null>(null);
  const [visible, setVisible] = useState(!document.hidden);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { const handle = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', handle); return () => document.removeEventListener('visibilitychange', handle); }, []);
  const effective = slow ? 'low' : quality;
  return <>{!ready && <div className="room3d-loading" role="status"><strong>PLAY YOUR LIFE</strong><span>Загрузка спортзала… {progress > 0 ? `${Math.round(progress)}%` : ''}</span><i /></div>}<Canvas shadows={effective !== 'low'} dpr={effective === 'low' ? 1 : effective === 'medium' ? 1.25 : 1.75} camera={{ position: [4.8, 3.3, 4.1], fov: 68, near: .08, far: 130 }} gl={{ antialias: quality !== 'low', powerPreference: 'low-power' }} frameloop={visible && !reduced ? 'always' : 'demand'} data-quality={effective}>
    <Rendering time={time} />
    <color attach="background" args={[roomLighting[time].sky]} />
    <PerformanceMonitor bounds={() => [24, 48]} flipflops={2} onDecline={() => setSlow(true)} onFallback={() => setSlow(true)} />
    <Suspense fallback={null}>
      <RoomEnvironment time={time} quality={effective} />
      <RoomLighting time={time} quality={effective} />
      {objects.filter(item => item.id !== ghost?.id).map(item => <group key={item.id} position={item.position} rotation={item.rotation} scale={item.scale} onClick={event => { event.stopPropagation(); onSelect(item.id); if (!build && item.id === 'treadmill') setActive(active === 'treadmill' ? null : 'treadmill'); }}>
        <RoomItemRenderer id={item.id} active={active === item.id} reduced={reduced} />
      </group>)}
      {effective === 'high' && <ContactShadows key={JSON.stringify(objects)} position={[0, -.065, 0]} opacity={.4} scale={12} blur={1.5} far={2.5} resolution={256} frames={2} color="#172027" />}
      <BuildSystem build={build} ghost={ghost} valid={valid} onFloor={onFloor} />
      <Ready onReady={setReady} />
    </Suspense>
    <RoomCamera preset={cameraPreset} revision={cameraRevision} placing={!!ghost} />
  </Canvas></>;
}
