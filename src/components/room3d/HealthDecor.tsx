import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Центра здоровья»: живая зелёная стена вдоль глухой левой стены
// (с проходом у двери) и белые открытые полки с травами, полотенцами и растениями вдоль передней стены.
// Пол для мебели в этой комнате 11 × 9 м (`roomConfigs.health.size`).

type Item = { position: Vec3; scale: Vec3; rotation: Vec3; color: string };
const greens = ['#2f6b3a', '#3f8a46', '#5aa04f', '#7cbf5a', '#2a5a3a', '#4a9a6a', '#8fcf72'];
const jars = ['#c9a35a', '#7a4a2a', '#9bb86a', '#d98a3a', '#b23a5a', '#e8d9a8', '#5a8a4a'];
const towels = ['#f4f2ee', '#4fb3a9', '#9fd8cf', '#e9e2d2'];

function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Листья зелёной стены в локальных координатах: длина по X, лицевая сторона в +Z. */
function leaves(length: number, bottom: number, top: number): Item[] {
  const rnd = random(31), list: Item[] = [];
  for (let y = bottom; y < top; y += .11) for (let x = -length / 2 + .06; x < length / 2 - .06; x += .12) {
    list.push({
      position: [x + (rnd() - .5) * .08, y + (rnd() - .5) * .08, .02 + rnd() * .1],
      scale: [.12 + rnd() * .08, .07 + rnd() * .05, .03],
      rotation: [(rnd() - .5) * .8, (rnd() - .5) * .6, rnd() * Math.PI],
      color: greens[Math.floor(rnd() * greens.length)],
    });
  }
  return list;
}
const SHELVES = [1.15, 1.75, 2.35, 2.95], SHELF_DEPTH = .3;
/** Предметы на полках: банки с травами, свёрнутые полотенца, горшки. */
function shelfItems(length: number): { cylinders: Item[]; spheres: Item[] } {
  const rnd = random(53), cylinders: Item[] = [], spheres: Item[] = [];
  SHELVES.forEach((y, level) => {
    let x = -length / 2 + .15;
    while (x < length / 2 - .2) {
      const kind = level === 3 ? (rnd() < .5 ? 'plant' : 'jar') : level === 0 ? 'towel' : rnd() < .75 ? 'jar' : 'plant';
      if (kind === 'jar') {
        const h = .14 + rnd() * .1, r = .05 + rnd() * .025;
        cylinders.push({ position: [x + r, y + .02 + h / 2, -.02], scale: [r * 2, h, r * 2], rotation: [0, 0, 0], color: jars[Math.floor(rnd() * jars.length)] });
        cylinders.push({ position: [x + r, y + .03 + h, -.02], scale: [r * 2.1, .03, r * 2.1], rotation: [0, 0, 0], color: '#c79a4b' });
        x += r * 2 + .03 + (rnd() < .15 ? .2 : 0);
      } else if (kind === 'towel') {
        for (let k = 0; k < 3; k++) cylinders.push({ position: [x + .09, y + .09 + k * .13, -.02], scale: [.16, .26, .16], rotation: [Math.PI / 2, 0, 0], color: towels[Math.floor(rnd() * towels.length)] });
        x += .26 + (rnd() < .3 ? .3 : 0);
      } else {
        cylinders.push({ position: [x + .08, y + .08, -.02], scale: [.15, .16, .15], rotation: [0, 0, 0], color: '#f4f2ee' });
        for (let k = 0; k < 5; k++) spheres.push({ position: [x + .08 + (rnd() - .5) * .1, y + .2 + rnd() * .1, -.02 + (rnd() - .5) * .08], scale: [.12, .1, .12], rotation: [0, 0, 0], color: greens[Math.floor(rnd() * greens.length)] });
        x += .24;
      }
    }
  });
  return { cylinders, spheres };
}

function Instances({ items, geometry, material }: { items: Item[]; geometry: BufferGeometry; material: MeshStandardMaterial }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new Object3D(), color = new Color();
    items.forEach((item, i) => {
      dummy.position.set(...item.position); dummy.rotation.set(...item.rotation); dummy.scale.set(...item.scale); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} receiveShadow />;
}

export default function HealthDecor() {
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(.5, .5, 1, 14), sphere: new SphereGeometry(.5, 10, 8) }), []);
  const materials = useMemo(() => ({
    leaf: new MeshStandardMaterial({ roughness: .7, metalness: 0 }),
    item: new MeshStandardMaterial({ roughness: .5, metalness: 0 }),
    white: new MeshStandardMaterial({ color: '#f4f2ee', roughness: .4, metalness: 0 }),
    cedar: new MeshStandardMaterial({ color: '#b07a4a', roughness: .65, metalness: 0 }),
    moss: new MeshStandardMaterial({ color: '#29452e', roughness: .95, metalness: 0 }),
    light: new MeshStandardMaterial({ color: '#fff5df', emissive: '#ffe6b0', emissiveIntensity: 1.6 }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const wallLength = 7.7, shelfLength = 10.8;
  const greenery = useMemo(() => leaves(wallLength - .2, .55, 4.3), []);
  const shelf = useMemo(() => shelfItems(shelfLength - .2), []);
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial) =>
    <mesh key={key} position={pos} scale={scale} geometry={geometries.box} material={material} castShadow receiveShadow />;
  return <group>
    {/* Зелёная стена на левой стене: от заднего окна до двери. */}
    <group position={[-5.83 + .08, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {box('frame', [0, 2.45, -.06], [wallLength, 4.1, .04], materials.cedar)}
      {box('moss', [0, 2.45, -.03], [wallLength - .16, 3.95, .03], materials.moss)}
      {box('planter', [0, .25, .04], [wallLength, .5, .26], materials.white)}
      {box('cap', [0, 4.52, .02], [wallLength + .06, .08, .2], materials.cedar)}
      {box('glow', [0, 4.46, .1], [wallLength - .2, .025, .03], materials.light)}
      <Instances items={greenery} geometry={geometries.sphere} material={materials.leaf} />
    </group>
    {/* Белые открытые полки и низкий шкаф вдоль передней стены, кроме прохода у двери. */}
    <group position={[.45, 0, 5.04 - SHELF_DEPTH / 2]} rotation={[0, Math.PI, 0]}>
      {box('cabinet', [0, .4, -.05], [shelfLength, .8, .4], materials.white)}
      {box('top', [0, .82, -.05], [shelfLength + .04, .04, .42], materials.cedar)}
      {Array.from({ length: 9 }, (_, i) => box(`door-${i}`, [-shelfLength / 2 + .6 + i * 1.2, .42, .155], [1.12, .7, .01], materials.white))}
      {SHELVES.map(y => box(`shelf-${y}`, [0, y, 0], [shelfLength, .035, SHELF_DEPTH], materials.cedar))}
      <Instances items={shelf.cylinders} geometry={geometries.cylinder} material={materials.item} />
      <Instances items={shelf.spheres} geometry={geometries.sphere} material={materials.leaf} />
    </group>
  </group>;
}
