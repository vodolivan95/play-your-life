import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, InstancedMesh, Material, MeshStandardMaterial, Object3D } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Задач»: большая канбан-доска «Надо / В работе / Готово» и календарь месяца
// на глухой левой стене (с проходом у двери), шкафы с цветными папками вдоль передней стены.
// Пол для мебели — 11 × 9 м (`roomConfigs.tasks.size`).

type Item = { position: Vec3; scale: Vec3; rotation?: Vec3; color: string };
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const BOARD_W = 4.2, BOARD_H = 2.4, BOARD_X = -1.4, BOARD_Y = 2.45;
/** Стикеры: в «Надо» больше всего, в «Готово» — зелёные. */
function stickies(): Item[] {
  const rnd = random(19), list: Item[] = [], colW = BOARD_W / 3;
  [[9, ['#ffe066', '#ff9ec4', '#9cc8ff']], [5, ['#ffe066', '#ffb35c']], [7, ['#7bdcb5']]].forEach(([count, colors], col) => {
    for (let i = 0; i < (count as number); i++) {
      const x = BOARD_X - BOARD_W / 2 + colW * col + .25 + (i % 3) * .42 + (rnd() - .5) * .05;
      const y = BOARD_Y + BOARD_H / 2 - .5 - Math.floor(i / 3) * .42 + (rnd() - .5) * .05;
      const palette = colors as string[];
      list.push({ position: [x, y, .045], scale: [.32, .3, .006], rotation: [0, 0, (rnd() - .5) * .12], color: palette[Math.floor(rnd() * palette.length)] });
    }
  });
  return list;
}
/** Календарь 7 × 5: прошедшие дни отмечены зелёным, сегодня — золотым. */
function calendar(): Item[] {
  const list: Item[] = [], today = 12;
  for (let d = 0; d < 35; d++) {
    const x = 2.0 + (d % 7) * .25, y = 3.15 - Math.floor(d / 7) * .25, day = d - 2;
    const color = day < 1 || day > 31 ? '#e6e8ec' : day < today ? '#7bdcb5' : day === today ? '#f2b632' : '#ffffff';
    list.push({ position: [x, y, .04], scale: [.21, .21, .006], color });
  }
  return list;
}
function binders(length: number): Item[] {
  const rnd = random(61), list: Item[] = [], colors = ['#2f5fd0', '#e8443a', '#f2b632', '#3aa86a', '#7a4ad0', '#15181d', '#22c3c3'];
  [.95, 1.55, 2.15].forEach(y => {
    for (let x = -length / 2 + .1; x < length / 2 - .1;) {
      const w = .07 + rnd() * .03;
      list.push({ position: [x + w / 2, y + .17, 0], scale: [w, .32, .26], rotation: [0, 0, rnd() < .05 ? .2 : 0], color: colors[Math.floor(rnd() * colors.length)] });
      x += w + .005 + (rnd() < .06 ? .35 : 0);
    }
  });
  return list;
}

function Instances({ items, geometry, material }: { items: Item[]; geometry: BufferGeometry; material: Material }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new Object3D(), color = new Color();
    items.forEach((item, i) => { dummy.position.set(...item.position); dummy.rotation.set(...(item.rotation ?? [0, 0, 0])); dummy.scale.set(...item.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(item.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} receiveShadow />;
}

const WALL = 7.7, FRONT = 10.8;
export default function TasksDecor() {
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const materials = useMemo(() => ({
    wall: new MeshStandardMaterial({ color: '#dfe6ef', roughness: .9 }),
    board: new MeshStandardMaterial({ color: '#fbfbf8', roughness: .25 }),
    frame: new MeshStandardMaterial({ color: '#9aa1ab', roughness: .35, metalness: .7 }),
    line: new MeshStandardMaterial({ color: '#2f5fd0', roughness: .5 }),
    paper: new MeshStandardMaterial({ roughness: .85 }),
    cabinet: new MeshStandardMaterial({ color: '#4a5568', roughness: .5, metalness: .3 }),
    shelf: new MeshStandardMaterial({ color: '#cfd6df', roughness: .4 }),
    title: new MeshStandardMaterial({ color: '#15181d', roughness: .5 }),
    glow: new MeshStandardMaterial({ color: '#ffffff', emissive: '#7fb2ff', emissiveIntensity: 1.8, toneMapped: false }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); geometry.dispose(); }, [materials, geometry]);
  const notes = useMemo(() => stickies(), []);
  const days = useMemo(() => calendar(), []);
  const files = useMemo(() => binders(FRONT - .3), []);
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial) =>
    <mesh key={key} position={pos} scale={scale} geometry={geometry} material={material} castShadow receiveShadow />;
  return <group>
    <group position={[-5.83 + .04, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {box('wall', [0, 2.5, -.01], [WALL, 4.6, .02], materials.wall)}
      {box('board-frame', [BOARD_X, BOARD_Y, .01], [BOARD_W + .1, BOARD_H + .1, .03], materials.frame)}
      {box('board', [BOARD_X, BOARD_Y, .03], [BOARD_W, BOARD_H, .01], materials.board)}
      {[-1, 1].map(k => box(`col-${k}`, [BOARD_X + k * BOARD_W / 6, BOARD_Y, .04], [.02, BOARD_H - .1, .004], materials.line))}
      {[0, 1, 2].map(k => box(`head-${k}`, [BOARD_X - BOARD_W / 3 + k * BOARD_W / 3, BOARD_Y + BOARD_H / 2 - .16, .04], [BOARD_W / 3 - .3, .1, .004], k === 2 ? materials.line : materials.title))}
      <Instances items={notes} geometry={geometry} material={materials.paper} />
      {box('cal', [2.75, 2.75, .02], [1.95, 1.65, .03], materials.board)}
      {box('cal-head', [2.75, 3.43, .04], [1.85, .2, .006], materials.line)}
      <Instances items={days} geometry={geometry} material={materials.paper} />
      {box('glow', [0, 4.1, .05], [WALL - .4, .03, .03], materials.glow)}
    </group>
    <group position={[.45, 0, 5.04 - .2]} rotation={[0, Math.PI, 0]}>
      {box('base', [0, .4, 0], [FRONT, .8, .4], materials.cabinet)}
      {Array.from({ length: 9 }, (_, i) => box(`drawer-${i}`, [-FRONT / 2 + .6 + i * 1.2, .55, .205], [1.1, .03, .01], materials.shelf))}
      {[.93, 1.53, 2.13].map(y => box(`shelf-${y}`, [0, y, -.05], [FRONT, .035, .3], materials.shelf))}
      {Array.from({ length: 10 }, (_, i) => box(`side-${i}`, [-FRONT / 2 + i * FRONT / 9, 1.55, -.05], [.04, 1.3, .3], materials.shelf))}
      <group position={[0, 0, -.05]}><Instances items={files} geometry={geometry} material={materials.paper} /></group>
    </group>
  </group>;
}
