import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка кабинета «Саморазвития»: стеллажи с книгами вдоль глухих стен.
// Окна (задняя и правая стены) остаются открытыми; у двери на левой стене — проход.
// Зона расстановки мебели в этой комнате уменьшена (`roomConfigs.growth.size`), чтобы предметы не входили в стеллажи.

const DEPTH = .42, BOARD = .035, LEVELS = 8, STEP = .55, BASE = .12;
const palette = ['#6e2a24', '#24395a', '#2f4f3a', '#8a6a2e', '#d9ccb0', '#4a2f22', '#1e2326', '#2d5a5c', '#7a4a2a', '#5a2f45', '#b8935a', '#38424f'];

function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
type Book = { position: Vec3; scale: Vec3; tilt: number; color: string };
/** Книги для стеллажа длиной `length` (локальная ось X, задняя стенка при z = -DEPTH / 2). */
function books(length: number, bays: number, seed: number): Book[] {
  const rnd = random(seed), list: Book[] = [], bay = length / bays;
  for (let level = 0; level < LEVELS; level++) {
    const floor = BASE + level * STEP + BOARD / 2;
    for (let b = 0; b < bays; b++) {
      let x = -length / 2 + b * bay + .05;
      const end = x + bay - .1;
      while (x < end - .04) {
        const roll = rnd();
        if (roll < .05) { x += .12 + rnd() * .14; continue; }
        if (roll < .085) {
          // Стопка книг плашмя.
          const w = .2 + rnd() * .06;
          if (x + w > end) break;
          for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) list.push({ position: [x + w / 2, floor + .025 + k * .05, -.03], scale: [w, .045, .2 + rnd() * .05], tilt: 0, color: palette[Math.floor(rnd() * palette.length)] });
          x += w + .02; continue;
        }
        const w = .035 + rnd() * .05, h = .26 + rnd() * .2, d = .2 + rnd() * .08;
        if (x + w > end) break;
        const lean = rnd() < .04 ? (rnd() < .5 ? -1 : 1) * .22 : 0;
        list.push({ position: [x + w / 2 + (lean ? lean * .2 : 0), floor + h / 2, -DEPTH / 2 + d / 2 + .02], scale: [w, h, d], tilt: lean, color: palette[Math.floor(rnd() * palette.length)] });
        x += w + .003 + (lean ? .08 : 0);
      }
    }
  }
  return list;
}

function Bookcase({ position, rotation, length, bays, seed, wood, trim, geometry }: {
  position: Vec3; rotation: number; length: number; bays: number; seed: number;
  wood: MeshStandardMaterial; trim: MeshStandardMaterial; geometry: BoxGeometry;
}) {
  const ref = useRef<InstancedMesh>(null);
  const list = useMemo(() => books(length, bays, seed), [length, bays, seed]);
  const bookMaterial = useMemo(() => new MeshStandardMaterial({ roughness: .78, metalness: 0 }), []);
  useEffect(() => () => bookMaterial.dispose(), [bookMaterial]);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new Object3D(), color = new Color();
    list.forEach((book, i) => {
      dummy.position.set(...book.position); dummy.rotation.set(0, 0, book.tilt); dummy.scale.set(...book.scale); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(book.color));
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list]);
  const top = BASE + LEVELS * STEP;
  const box = (key: string, pos: Vec3, size: Vec3, material = wood) => <mesh key={key} position={pos} scale={size} geometry={geometry} material={material} castShadow receiveShadow />;
  return <group position={position} rotation={[0, rotation, 0]}>
    {box('back', [0, top / 2, -DEPTH / 2 + .01], [length, top, .02], trim)}
    {box('plinth', [0, BASE / 2, 0], [length, BASE, DEPTH])}
    {Array.from({ length: LEVELS + 1 }, (_, i) => box(`board-${i}`, [0, BASE + i * STEP, 0], [length, BOARD, DEPTH]))}
    {Array.from({ length: bays + 1 }, (_, i) => box(`side-${i}`, [-length / 2 + i * length / bays, top / 2, .01], [.05, top, DEPTH + .02]))}
    {box('cornice', [0, top + .07, .03], [length + .1, .14, DEPTH + .08])}
    {box('crown', [0, top + .16, .05], [length + .16, .05, DEPTH + .12])}
    <instancedMesh key={list.length} ref={ref} args={[geometry, bookMaterial, list.length]} receiveShadow />
  </group>;
}

export default function StudyDecor() {
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), rod: new CylinderGeometry(.5, .5, 1, 10), vase: new SphereGeometry(.5, 16, 12) }), []);
  const materials = useMemo(() => ({
    wood: new MeshStandardMaterial({ color: '#3e2618', roughness: .55, metalness: 0 }),
    trim: new MeshStandardMaterial({ color: '#2a1a12', roughness: .8, metalness: 0 }),
    brass: new MeshStandardMaterial({ color: '#c79a4b', roughness: .3, metalness: .85 }),
    ladder: new MeshStandardMaterial({ color: '#6b4428', roughness: .6, metalness: 0 }),
    porcelain: new MeshStandardMaterial({ color: '#e9e2d2', roughness: .35, metalness: 0 }),
    jade: new MeshStandardMaterial({ color: '#3f6f5c', roughness: .35, metalness: .05 }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const top = BASE + LEVELS * STEP;
  const mesh = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial, geometry: BufferGeometry = geometries.box, rotation: Vec3 = [0, 0, 0]) =>
    <mesh key={key} position={pos} scale={scale} rotation={rotation} geometry={geometry} material={material} castShadow receiveShadow />;
  // Лестница на латунной рейке вдоль передней стены.
  const ladderX = 2.4, railZ = 5.04 - DEPTH - .06, footZ = 4.2, ladderTop = top - .2;
  const ladderLength = Math.hypot(ladderTop, railZ - footZ), ladderAngle = Math.atan2(railZ - footZ, ladderTop);
  return <group>
    {/* Левая глухая стена: от заднего окна до двери. */}
    <Bookcase position={[-5.83 + DEPTH / 2, 0, -1]} rotation={Math.PI / 2} length={7.7} bays={6} seed={7} wood={materials.wood} trim={materials.trim} geometry={geometries.box} />
    {/* Передняя стена на всю ширину, кроме прохода у двери. */}
    <Bookcase position={[.45, 0, 5.04 - DEPTH / 2]} rotation={Math.PI} length={10.8} bays={9} seed={19} wood={materials.wood} trim={materials.trim} geometry={geometries.box} />
    {mesh('rail', [.45, ladderTop + .05, railZ], [.04, 10.6, .04], materials.brass, geometries.rod, [0, 0, Math.PI / 2])}
    <group position={[ladderX, ladderTop / 2, (railZ + footZ) / 2]} rotation={[ladderAngle, 0, 0]}>
      {[-.24, .24].map(x => mesh(`stile-${x}`, [x, 0, 0], [.05, ladderLength, .06], materials.ladder))}
      {Array.from({ length: 11 }, (_, i) => mesh(`rung-${i}`, [0, -ladderLength / 2 + .3 + i * (ladderLength - .5) / 10, 0], [.03, .48, .03], materials.brass, geometries.rod, [0, 0, Math.PI / 2]))}
    </group>
    {/* Вазы и бюсты на карнизе. */}
    {([[-5.6, -4.2], [-5.6, -1.2], [-5.6, 1.8]] as const).map(([x, z], i) => mesh(`vase-l-${i}`, [x, top + .38, z], [.32, .42, .32], i % 2 ? materials.jade : materials.porcelain, geometries.vase))}
    {[-3.6, -.4, 2.8].map((x, i) => mesh(`vase-f-${i}`, [x, top + .38, 4.82], [.32, .42, .32], i % 2 ? materials.porcelain : materials.jade, geometries.vase))}
  </group>;
}
