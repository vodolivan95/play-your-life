import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, InstancedMesh, Material, MeshStandardMaterial, Object3D, TorusGeometry } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Вождения»: перфопанель с инструментами и дорожными знаками на глухой левой стене
// (с проходом у двери), стеллаж с шинами и неоновая полоса вдоль передней стены.
// Пол для мебели — 11 × 9 м (`roomConfigs.driving.size`).

type Item = { position: Vec3; scale: Vec3; rotation?: Vec3; color: string };
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Инструменты на перфопанели: ключи, отвёртки, молотки — силуэты из брусков. */
function tools(width: number): Item[] {
  const rnd = random(9), list: Item[] = [], colors = ['#c9ced6', '#d3202f', '#f2c230', '#2b2f36'];
  for (let row = 0; row < 3; row++) for (let x = -width / 2 + .2; x < width / 2 - .2; x += .22 + rnd() * .12) {
    const h = .25 + rnd() * .25, tilt = (rnd() - .5) * .3, y = 1.25 + row * .62;
    list.push({ position: [x, y, .03], scale: [.03 + rnd() * .03, h, .02], rotation: [0, 0, tilt], color: colors[Math.floor(rnd() * 2)] });
    list.push({ position: [x + Math.sin(-tilt) * h / 2, y + h / 2, .035], scale: [.08, .05, .025], rotation: [0, 0, tilt], color: colors[2 + Math.floor(rnd() * 2)] });
  }
  return list;
}
/** Шины на трёх полках стеллажа, стоя на ребре. */
function tires(length: number): Item[] {
  const list: Item[] = [];
  [.58, 1.46, 2.36].forEach(y => { for (let x = -length / 2 + .35; x < length / 2 - .3; x += .32) list.push({ position: [x, y, 0], scale: [1, 1, 1], rotation: [0, Math.PI / 2, 0], color: '#16181c' }); });
  return list;
}

function Instances({ items, geometry, material }: { items: Item[]; geometry: BufferGeometry; material: Material }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new Object3D(), color = new Color();
    items.forEach((item, i) => {
      dummy.position.set(...item.position); dummy.rotation.set(...(item.rotation ?? [0, 0, 0])); dummy.scale.set(...item.scale); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} receiveShadow />;
}

const WALL = 7.7, FRONT = 10.8;
export default function DrivingDecor() {
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), disc: new CylinderGeometry(.5, .5, 1, 32), tri: new CylinderGeometry(.5, .5, 1, 3), tire: new TorusGeometry(.3, .13, 10, 24) }), []);
  const materials = useMemo(() => ({
    peg: new MeshStandardMaterial({ color: '#3c4350', roughness: .8 }),
    frame: new MeshStandardMaterial({ color: '#f2c230', roughness: .5 }),
    tool: new MeshStandardMaterial({ roughness: .4, metalness: .5 }),
    rack: new MeshStandardMaterial({ color: '#2a63c9', roughness: .45, metalness: .5 }),
    rubber: new MeshStandardMaterial({ roughness: .9 }),
    white: new MeshStandardMaterial({ color: '#f4f2ee', roughness: .5 }),
    red: new MeshStandardMaterial({ color: '#d3202f', roughness: .5 }),
    blue: new MeshStandardMaterial({ color: '#1f5fc9', roughness: .5 }),
    pole: new MeshStandardMaterial({ color: '#9aa1ab', roughness: .35, metalness: .8 }),
    neon: new MeshStandardMaterial({ color: '#ffffff', emissive: '#28d7ff', emissiveIntensity: 2.2, toneMapped: false }),
    neonPink: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ff3fa4', emissiveIntensity: 2.2, toneMapped: false }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const toolset = useMemo(() => tools(4.2), []);
  const rack = useMemo(() => tires(FRONT - .2), []);
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial, rotation: Vec3 = [0, 0, 0]) =>
    <mesh key={key} position={pos} scale={scale} rotation={rotation} geometry={geometries.box} material={material} castShadow receiveShadow />;
  const disc = (key: string, pos: Vec3, r: number, material: MeshStandardMaterial) =>
    <mesh key={key} position={pos} rotation={[Math.PI / 2, 0, 0]} scale={[r, .02, r]} geometry={geometries.disc} material={material} />;
  return <group>
    <group position={[-5.83 + .05, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {/* Перфопанель с инструментами. */}
      {box('peg-frame', [-1.4, 1.95, -.01], [4.4, 2.1, .03], materials.frame)}
      {box('peg', [-1.4, 1.95, .01], [4.2, 1.95, .02], materials.peg)}
      <group position={[-1.4, 0, 0]}><Instances items={toolset} geometry={geometries.box} material={materials.tool} /></group>
      {box('bench', [-1.4, .45, .2], [4.4, .9, .45], materials.rack)}
      {box('bench-top', [-1.4, .92, .2], [4.5, .05, .5], materials.peg)}
      {/* Дорожные знаки: «Стоп», «Уступи дорогу», ограничение скорости, «Парковка». */}
      <group position={[2.3, 3.4, .03]}>{disc('limit', [0, 0, 0], .6, materials.red)}{disc('limit-in', [0, 0, .015], .46, materials.white)}{box('limit-60a', [-.08, 0, .03], [.08, .2, .01], materials.peg)}{box('limit-60b', [.08, 0, .03], [.08, .2, .01], materials.peg)}</group>
      <group position={[3.1, 2.6, .03]} rotation={[0, 0, Math.PI]}><mesh rotation={[Math.PI / 2, Math.PI / 2, 0]} scale={[.7, .02, .7]} geometry={geometries.tri} material={materials.red} /><mesh position={[0, 0, .015]} rotation={[Math.PI / 2, Math.PI / 2, 0]} scale={[.5, .02, .5]} geometry={geometries.tri} material={materials.white} /></group>
      <group position={[2.3, 1.8, .03]}>{box('park', [0, 0, 0], [.55, .55, .02], materials.blue)}{box('park-p', [-.04, 0, .015], [.08, .32, .01], materials.white)}{box('park-p2', [.05, .08, .015], [.12, .14, .01], materials.white)}</group>
      <group position={[3.1, 1.5, .03]}><mesh rotation={[Math.PI / 2, Math.PI / 8, 0]} scale={[.62, .02, .62]} geometry={geometries.disc} material={materials.red} />{box('stop', [0, 0, .015], [.36, .08, .01], materials.white)}</group>
      {box('neon-line', [0, 4.25, .03], [WALL - .4, .04, .03], materials.neon)}
    </group>
    <group position={[.45, 0, 5.04 - .25]} rotation={[0, Math.PI, 0]}>
      {[.12, 1.0, 1.9].map(y => box(`rack-${y}`, [0, y, 0], [FRONT, .05, .5], materials.rack))}
      {Array.from({ length: 7 }, (_, i) => box(`upright-${i}`, [-FRONT / 2 + i * FRONT / 6, 1.45, 0], [.06, 2.9, .5], materials.rack))}
      <group><Instances items={rack} geometry={geometries.tire} material={materials.rubber} /></group>
      {box('neon-a', [0, 3.3, .2], [FRONT - .6, .05, .03], materials.neonPink)}
      {box('neon-b', [0, 3.45, .2], [FRONT - .6, .05, .03], materials.neon)}
    </group>
  </group>;
}
