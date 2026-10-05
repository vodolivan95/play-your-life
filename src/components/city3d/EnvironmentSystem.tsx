import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { CityTime } from '../../weatherSystem';
import type { WeatherRuntime } from './WeatherSystem';
export function WaterSystem({ runtime, time, paused, reduced }: { runtime: WeatherRuntime; time: CityTime; paused: boolean; reduced: boolean }) {
  const geometry = useMemo(() => new PlaneGeometry(180, 180, 36, 36), []);
  const material = useRef<MeshStandardMaterial>(null), elapsed = useRef(0);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Imperative Three.js updates are intentionally mutable; React state is untouched.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, dt) => {
    if (!paused && !reduced) elapsed.current += dt;
    const w = runtime.current, positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      positions.setZ(i, Math.sin(x * .5 + elapsed.current) * Math.cos(y * .35 + elapsed.current * .7) * (.08 + w.windStrength * .4) + Math.sin(x * 3 + y * 2 + elapsed.current * 7) * w.rainIntensity * .03);
    }
    positions.needsUpdate = true; geometry.computeVertexNormals();
    if (material.current) { material.current.color.set(time === 'night' ? '#153c61' : time === 'sunset' ? '#4c8796' : '#18b7cc'); material.current.roughness = .16 + w.windStrength * .25; }
  });
  /* eslint-enable react-hooks/immutability */
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.3, 0]} geometry={geometry} receiveShadow><meshStandardMaterial ref={material} metalness={.22} roughness={.2} /></mesh>;
}
export function EnvironmentSystem({ runtime, paused, reduced }: { runtime: WeatherRuntime; paused: boolean; reduced: boolean }) {
  const clouds = useRef<Group>(null), clock = useRef(0);
  useFrame((_, dt) => {
    if (!paused && !reduced) clock.current += dt;
    if (clouds.current) { clouds.current.position.x = Math.sin(clock.current * .015) * 10; clouds.current.visible = runtime.current.cloudiness > .08; for (const child of clouds.current.children) if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) child.material.opacity = runtime.current.cloudiness * .3; }
  });
  return <>
    <group ref={clouds}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[(i % 3 - 1) * 18, 30 + i % 2 * 2, (Math.floor(i / 3) - 1) * 16]} scale={[6, 1.5, 3]}><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#b6c2ca" roughness={1} transparent opacity={.65} depthWrite={false} /></mesh>)}</group>
  </>;
}
