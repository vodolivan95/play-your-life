import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { spheres } from '../game';
import { wideBuildings } from '../coastalCity';
import { buildingState } from '../city';
import type { GameState } from '../game';
import './CityIsland3D.css';

/**
 * 0.49.0 — первый набросок 3D-острова для приложения: макет расположения зданий
 * (из тех же координат, что у плоской карты), коробки вместо фотографий, камера
 * крутится и приближается пальцем. Это проверка ощущения «настоящей игры», а не
 * финальная картинка — машины, пешеходы, детальные модели зданий сюда не входят.
 */
type Props = { state: GameState; onOpen: (id: string) => void };

// 0..100% исходной карты → координаты сцены: остров занимает примерно 36×20 единиц.
const toScene = (xPercent: number, yPercent: number): [number, number] => [
  (xPercent / 100) * 36 - 18,
  (yPercent / 100) * 20 - 10,
];

function Building({ id, position, size, color, name, level, onOpen }: {
  id: string; position: [number, number]; size: { width: number; height: number };
  color: string; name: string; level: number; onOpen: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const width = Math.max(2.2, size.width / 100 * 36 * .82);
  const depth = Math.max(2.2, size.height / 100 * 20 * .82);
  const height = 2.4 + Math.min(level, 20) * .18;
  return <group position={[position[0], 0, position[1]]}>
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow
      onPointerOver={e => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={e => { e.stopPropagation(); onOpen(id); }}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={.6} emissive={color} emissiveIntensity={hovered ? .35 : .08} />
    </mesh>
    <mesh position={[0, height + .05, 0]}>
      <boxGeometry args={[width * .94, .12, depth * .94]} />
      <meshStandardMaterial color="#ffffff" roughness={.8} />
    </mesh>
    <Html position={[0, height + .5, 0]} center distanceFactor={18} occlude={false}>
      <button className="city3d-label" data-level={level} onClick={() => onOpen(id)}>{name}</button>
    </Html>
  </group>;
}

export default function CityIsland3D({ state, onOpen }: Props) {
  const buildings = useMemo(() => wideBuildings.map(building => {
    const sphere = spheres.find(s => s.id === building.id)!;
    const tier = buildingState(state, building.id).tier;
    const [x, z] = toScene(building.x + building.width / 2, building.y + building.height / 2);
    return { id: building.id, position: [x, z] as [number, number], size: building, color: sphere.color, name: sphere.name, level: tier };
  }), [state]);
  return <div className="city3d-wrap">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 22, 24], fov: 48, near: .5, far: 200 }} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <color attach="background" args={['#1a3a52']} />
      <fog attach="fog" args={['#1a3a52', 30, 90]} />
      <ambientLight intensity={.55} />
      <directionalLight position={[16, 24, 10]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.05, 0]} receiveShadow>
        <circleGeometry args={[26, 48]} />
        <meshStandardMaterial color="#2f6f4f" roughness={.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.3, 0]}>
        <circleGeometry args={[60, 48]} />
        <meshStandardMaterial color="#1f5c86" roughness={.5} metalness={.1} />
      </mesh>
      <Suspense fallback={null}>
        {buildings.map(building => <Building key={building.id} {...building} onOpen={onOpen} />)}
      </Suspense>
      <OrbitControls enablePan={false} minDistance={10} maxDistance={55} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  </div>;
}
