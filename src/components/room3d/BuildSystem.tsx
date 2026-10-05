import { Grid } from '@react-three/drei';
import type { RoomObject, Vec3 } from '../../roomEngine';
import { objectSpec } from '../../roomEngine';
import RoomItemRenderer from './RoomItemRenderer';
export default function BuildSystem({ build, ghost, valid, onFloor }: { build: boolean; ghost: RoomObject | null; valid: boolean; onFloor: (position: Vec3) => void }) {
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .015, 0]} onPointerMove={event => { if (ghost) { event.stopPropagation(); onFloor([Math.round(event.point.x * 2) / 2, 0, Math.round(event.point.z * 2) / 2]); } }} onClick={event => { if (ghost) { event.stopPropagation(); onFloor([Math.round(event.point.x * 2) / 2, 0, Math.round(event.point.z * 2) / 2]); } }}>
      <planeGeometry args={[12, 10]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    {build && <Grid args={[12, 10]} cellSize={.5} sectionSize={2} cellColor="#5c8998" sectionColor="#84ccdc" cellThickness={.5} sectionThickness={.8} fadeDistance={22} position={[0, .022, 0]} />}
    {ghost && <group position={ghost.position} rotation={ghost.rotation} scale={ghost.scale}>
      <RoomItemRenderer id={ghost.id} ghost={valid ? 'valid' : 'invalid'} reduced />
      <mesh position={[0, .03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={objectSpec(ghost.id).size} /><meshBasicMaterial color={valid ? '#67e4ee' : '#ff7979'} transparent opacity={.18} depthWrite={false} /></mesh>
    </group>}
  </group>;
}
