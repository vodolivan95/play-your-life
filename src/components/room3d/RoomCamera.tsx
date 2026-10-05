import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ComponentRef } from 'react';
import { Vector3 } from 'three';
export type CameraPreset = 'overview' | 'left' | 'center' | 'right';
const views: Record<CameraPreset, [number, number, number]> = { overview: [4.8, 3.3, 4.1], left: [-4.8, 3.1, 3.9], center: [0, 3.1, 4.3], right: [4.7, 3, 2.8] };
export default function RoomCamera({ preset, revision, placing }: { preset: CameraPreset; revision: number; placing: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const transition = useRef({ key: '', moving: true });
  useFrame(({ camera, gl, invalidate }, delta) => {
    const key = `${preset}:${revision}`;
    if (transition.current.key !== key) transition.current = { key, moving: true };
    const c = controls.current;
    if (!c) return;
    if (transition.current.moving) {
      invalidate();
      const goal = new Vector3(...views[preset]);
      camera.position.lerp(goal, 1 - Math.exp(-delta * 7));
      c.target.lerp(new Vector3(0, 1.1, -1), 1 - Math.exp(-delta * 7));
      if (camera.position.distanceTo(goal) < .025) transition.current.moving = false;
    }
    camera.position.x = Math.max(-5.35, Math.min(5.35, camera.position.x));
    camera.position.z = Math.max(-4.35, Math.min(4.35, camera.position.z));
    camera.position.y = Math.max(2.2, Math.min(4.65, camera.position.y));
    c.enabled = !transition.current.moving;
    c.update();
    gl.domElement.dataset.camera = camera.position.toArray().map(n => n.toFixed(2)).join(',');
  });
  return <OrbitControls ref={controls} makeDefault target={[0, 1.1, -1]} enablePan={false} enableRotate={!placing} minDistance={4.5} maxDistance={8} minPolarAngle={.75} maxPolarAngle={1.35} minAzimuthAngle={-1.1} maxAzimuthAngle={1.1} enableDamping dampingFactor={.08} />;
}
