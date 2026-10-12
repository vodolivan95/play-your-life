import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, InstancedMesh, Material, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Общих дел»: фотостена с тёплой гирляндой на глухой левой стене (с проходом у двери)
// и кухонная стойка с кружками и зеленью вдоль передней стены. Пол для мебели — 11 × 9 м.

type Item = { position: Vec3; scale: Vec3; color: string };
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Рамки фотостены: разные размеры, плотная раскладка салоном. */
function photos(width: number): { frames: Item[]; pictures: Item[] } {
  const rnd = random(17), frames: Item[] = [], pictures: Item[] = [];
  const tones = ['#e8b48a', '#8fb8d8', '#a7c98a', '#d98a8a', '#c8b0e0', '#f0d48a', '#7fa8a0', '#e0a0b8'];
  for (let col = 0; col < Math.floor(width / .62); col++) for (let row = 0; row < 3; row++) {
    if (rnd() < .12) continue;
    const w = .34 + rnd() * .22, h = .3 + rnd() * .24, x = -width / 2 + .32 + col * .62 + (rnd() - .5) * .08, y = 1.5 + row * .7 + (rnd() - .5) * .1;
    frames.push({ position: [x, y, .02], scale: [w + .06, h + .06, .03], color: rnd() < .5 ? '#2a1a12' : '#f4f2ee' });
    pictures.push({ position: [x, y, .04], scale: [w, h, .005], color: tones[Math.floor(rnd() * tones.length)] });
  }
  return { frames, pictures };
}
function mugs(length: number): Item[] {
  const rnd = random(29), list: Item[] = [], colors = ['#f4f2ee', '#2d8a8a', '#d9a21b', '#e86a5a', '#1f3c78'];
  for (let x = -length / 2 + .2; x < length / 2 - .2; x += .16 + (rnd() < .2 ? .5 : 0)) list.push({ position: [x, 1.72 + .06, 0], scale: [.09, .12, .09], color: colors[Math.floor(rnd() * colors.length)] });
  return list;
}
function bulbs(width: number): Item[] {
  return Array.from({ length: 26 }, (_, i) => {
    const t = i / 25, x = -width / 2 + t * width, sag = Math.sin(t * Math.PI * 3) ** 2 * .25;
    return { position: [x, 3.85 - sag, .12] as Vec3, scale: [.07, .09, .07] as Vec3, color: '#ffd89a' };
  });
}

function Instances({ items, geometry, material }: { items: Item[]; geometry: BufferGeometry; material: Material }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new Object3D(), color = new Color();
    items.forEach((item, i) => { dummy.position.set(...item.position); dummy.scale.set(...item.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(item.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} receiveShadow />;
}

const WALL = 7.7, FRONT = 10.8;
export default function TogetherDecor() {
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), cyl: new CylinderGeometry(.5, .5, 1, 14), ball: new SphereGeometry(.5, 10, 8) }), []);
  const materials = useMemo(() => ({
    wall: new MeshStandardMaterial({ color: '#e9dfcc', roughness: .9 }),
    item: new MeshStandardMaterial({ roughness: .55 }),
    bulb: new MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb84d', emissiveIntensity: 2.4, toneMapped: false }),
    cord: new MeshStandardMaterial({ color: '#2a2a2a', roughness: .8 }),
    sage: new MeshStandardMaterial({ color: '#8fae95', roughness: .6 }),
    oak: new MeshStandardMaterial({ color: '#a0703f', roughness: .5 }),
    white: new MeshStandardMaterial({ color: '#f4f2ee', roughness: .4 }),
    leaf: new MeshStandardMaterial({ color: '#3f8a46', roughness: .7 }),
    brass: new MeshStandardMaterial({ color: '#c79a4b', roughness: .3, metalness: .9 }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const gallery = useMemo(() => photos(WALL - .6), []);
  const cups = useMemo(() => mugs(FRONT - .4), []);
  const garland = useMemo(() => bulbs(WALL - .4), []);
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial) =>
    <mesh key={key} position={pos} scale={scale} geometry={geometries.box} material={material} castShadow receiveShadow />;
  return <group>
    <group position={[-5.83 + .04, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {box('plaster', [0, 2.5, -.01], [WALL, 4.6, .02], materials.wall)}
      <Instances items={gallery.frames} geometry={geometries.box} material={materials.item} />
      <Instances items={gallery.pictures} geometry={geometries.box} material={materials.item} />
      {box('cord', [0, 3.82, .11], [WALL - .4, .012, .012], materials.cord)}
      <Instances items={garland} geometry={geometries.ball} material={materials.bulb} />
      {box('sideboard', [0, .4, .2], [WALL - .6, .8, .4], materials.oak)}
      {[-2.6, -.6, 1.6].map((x, i) => <group key={x}>{box(`pot-${i}`, [x, .95, .2], [.24, .3, .24], materials.white)}<mesh position={[x, 1.25, .2]} scale={[.4, .4, .4]} geometry={geometries.ball} material={materials.leaf} castShadow /></group>)}
    </group>
    <group position={[.45, 0, 5.04 - .3]} rotation={[0, Math.PI, 0]}>
      {box('base', [0, .45, 0], [FRONT, .9, .6], materials.sage)}
      {Array.from({ length: 12 }, (_, i) => box(`handle-${i}`, [-FRONT / 2 + .45 + i * .9, .75, .305], [.18, .02, .02], materials.brass))}
      {box('counter', [0, .92, 0], [FRONT + .04, .05, .64], materials.oak)}
      {box('splash', [0, 1.35, -.29], [FRONT, .8, .02], materials.white)}
      {box('shelf', [0, 1.72, -.15], [FRONT, .04, .3], materials.oak)}
      <group position={[0, 0, -.15]}><Instances items={cups} geometry={geometries.cyl} material={materials.item} /></group>
      {[-3.8, -1.2, 1.6, 4].map((x, i) => <group key={x}>{box(`jar-${i}`, [x, 1.05, .05], [.18, .22, .18], materials.white)}<mesh position={[x, 1.24, .05]} scale={[.26, .22, .26]} geometry={geometries.ball} material={materials.leaf} castShadow /></group>)}
    </group>
  </group>;
}
