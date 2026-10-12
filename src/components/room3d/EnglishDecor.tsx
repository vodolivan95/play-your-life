import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Material, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Английского»: карта мира и часы Лондона, Нью-Йорка и Токио на глухой левой стене
// (с проходом у двери), низкий стеллаж со словарями и гирлянда флажков вдоль передней стены.
// Пол для мебели — 11 × 9 м (`roomConfigs.english.size`).

type Item = { position: Vec3; scale: Vec3; rotation?: Vec3; color: string };
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// Материки как группы пятен на карте 1 × 1 (x — долгота, y — широта).
const continents: [number, number, number, number][] = [
  [.2, .7, .16, .14], [.24, .58, .1, .1], [.3, .32, .07, .15], [.28, .2, .05, .08],
  [.5, .74, .07, .07], [.53, .45, .09, .17], [.68, .7, .2, .14], [.75, .55, .08, .09], [.86, .28, .07, .05], [.45, .8, .03, .04],
];
function land(width: number, height: number): Item[] {
  const rnd = random(5), list: Item[] = [];
  continents.forEach(([cx, cy, rx, ry]) => {
    for (let k = 0; k < 18; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      list.push({ position: [(cx + Math.cos(a) * rx * r - .5) * width, (cy + Math.sin(a) * ry * r - .5) * height, 0], scale: [rx * width * .7, ry * height * .7, .01], color: ['#7fae6a', '#9cc27b', '#c8b47a'][Math.floor(rnd() * 3)] });
    }
  });
  return list;
}
function dictionaries(length: number): Item[] {
  const rnd = random(41), list: Item[] = [], colors = ['#c8202f', '#1f3c78', '#efe6cf', '#2f4f3a', '#d1a24a', '#15181d'];
  [.12, .62].forEach(floor => {
    let x = -length / 2 + .1;
    while (x < length / 2 - .1) {
      const w = .05 + rnd() * .05, h = .28 + rnd() * .14;
      list.push({ position: [x + w / 2, floor + h / 2, 0], scale: [w, h, .24], color: colors[Math.floor(rnd() * colors.length)] });
      x += w + .004 + (rnd() < .06 ? .25 : 0);
    }
  });
  return list;
}
function flags(length: number): Item[] {
  const colors = ['#c8202f', '#f4f2ee', '#1f3c78'];
  return Array.from({ length: Math.floor(length / .35) }, (_, i) => {
    const x = -length / 2 + .17 + i * .35, sag = Math.sin((i / (length / .35)) * Math.PI * 3) * .12;
    return { position: [x, 3.6 - Math.abs(sag), .05] as Vec3, scale: [.2, .26, .03] as Vec3, rotation: [Math.PI, 0, 0] as Vec3, color: colors[i % 3] };
  });
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
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} />;
}

const WALL = 7.7, FRONT = 10.8, MAP_W = 5.2, MAP_H = 2.6;
// Смещение часовых поясов относительно Лондона.
const clocks: [string, number][] = [['London', 0], ['New York', -5], ['Tokyo', 9]];
export default function EnglishDecor() {
  const hands = useRef<Group>(null);
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), disc: new CylinderGeometry(.5, .5, 1, 32), blob: new SphereGeometry(.5, 10, 8), flag: new CylinderGeometry(0, .5, 1, 3) }), []);
  const materials = useMemo(() => ({
    ocean: new MeshStandardMaterial({ color: '#3e6f93', roughness: .7 }),
    frame: new MeshStandardMaterial({ color: '#3a2418', roughness: .5 }),
    land: new MeshStandardMaterial({ roughness: .8 }),
    face: new MeshStandardMaterial({ color: '#f6f0e0', roughness: .4 }),
    brass: new MeshStandardMaterial({ color: '#c79a4b', roughness: .3, metalness: .9 }),
    hand: new MeshStandardMaterial({ color: '#15181d', roughness: .5 }),
    shelf: new MeshStandardMaterial({ color: '#1f2b3d', roughness: .55 }),
    item: new MeshStandardMaterial({ roughness: .7 }),
    cord: new MeshStandardMaterial({ color: '#efe6cf', roughness: .9 }),
    panel: new MeshStandardMaterial({ color: '#25344a', roughness: .8 }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const map = useMemo(() => land(MAP_W - .2, MAP_H - .2), []);
  const books = useMemo(() => dictionaries(FRONT - .2), []);
  const bunting = useMemo(() => flags(FRONT - .4), []);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Стрелки идут по реальному времени с поправкой на пояс.
  useFrame(() => {
    if (!hands.current || reduced) return;
    const now = new Date(), utc = now.getUTCHours() + now.getUTCMinutes() / 60;
    hands.current.children.forEach((clock, i) => {
      const h = (utc + clocks[i][1] + 24) % 12, m = now.getUTCMinutes();
      clock.children[0].rotation.z = -h / 12 * Math.PI * 2; clock.children[1].rotation.z = -m / 60 * Math.PI * 2;
    });
  });
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial) =>
    <mesh key={key} position={pos} scale={scale} geometry={geometries.box} material={material} castShadow receiveShadow />;
  return <group>
    <group position={[-5.83 + .05, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {box('panel', [0, 2.4, -.02], [WALL, 4.4, .02], materials.panel)}
      {box('map-frame', [-.9, 2.15, .01], [MAP_W + .16, MAP_H + .16, .04], materials.frame)}
      {box('map', [-.9, 2.15, .035], [MAP_W, MAP_H, .01], materials.ocean)}
      <group position={[-.9, 2.15, .045]}><Instances items={map} geometry={geometries.blob} material={materials.land} /></group>
      <group ref={hands}>
        {clocks.map(([, ], i) => <group key={i} position={[2.75, 3.5 - i * .95, .06]}>
          <group position={[0, 0, .02]}><mesh position={[0, .06, 0]} geometry={geometries.box} material={materials.hand} scale={[.03, .14, .01]} /></group>
          <group position={[0, 0, .025]}><mesh position={[0, .09, 0]} geometry={geometries.box} material={materials.hand} scale={[.02, .2, .01]} /></group>
        </group>)}
      </group>
      {clocks.map(([, ], i) => <group key={`face-${i}`} position={[2.75, 3.5 - i * .95, .03]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[.62, .04, .62]} geometry={geometries.disc} material={materials.brass} />
        <mesh position={[0, 0, .02]} rotation={[Math.PI / 2, 0, 0]} scale={[.54, .02, .54]} geometry={geometries.disc} material={materials.face} />
        {Array.from({ length: 12 }, (_, k) => <mesh key={k} position={[Math.sin(k / 6 * Math.PI) * .22, Math.cos(k / 6 * Math.PI) * .22, .035]} scale={[.015, k % 3 ? .03 : .05, .005]} rotation={[0, 0, -k / 6 * Math.PI]} geometry={geometries.box} material={materials.hand} />)}
      </group>)}
    </group>
    <group position={[.45, 0, 5.04 - .15]} rotation={[0, Math.PI, 0]}>
      {box('case', [0, .55, -.02], [FRONT, 1.1, .3], materials.shelf)}
      {box('mid', [0, .6, .02], [FRONT, .03, .26], materials.frame)}
      {box('top', [0, 1.12, 0], [FRONT + .04, .04, .32], materials.frame)}
      <group position={[0, 0, .02]}><Instances items={books} geometry={geometries.box} material={materials.item} /></group>
      {box('cord', [0, 3.72, .05], [FRONT - .3, .015, .015], materials.cord)}
      <Instances items={bunting} geometry={geometries.flag} material={materials.item} />
    </group>
  </group>;
}
