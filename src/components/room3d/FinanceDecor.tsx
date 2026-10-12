import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Material, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Финансов»: стена-экран с биржевым графиком и бегущей строкой на глухой левой стене
// (с проходом у двери) и витрины тёмного дерева с золотыми слитками и стопками монет вдоль передней стены.
// Пол для мебели — 11 × 9 м (`roomConfigs.finance.size`).

type Item = { position: Vec3; scale: Vec3; color: string };
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Свечи графика: растущий тренд с откатами; зелёные — рост, красные — падение. */
function candles(width: number, height: number): Item[] {
  const rnd = random(11), list: Item[] = [], count = 46, step = width / count;
  let price = .25;
  for (let i = 0; i < count; i++) {
    const open = price, close = Math.min(.92, Math.max(.08, price + (rnd() - .38) * .09));
    const top = Math.max(open, close), bottom = Math.min(open, close), up = close >= open;
    const x = -width / 2 + (i + .5) * step, color = up ? '#2fd08a' : '#ff5d6c';
    list.push({ position: [x, (bottom + top) / 2 * height, 0], scale: [step * .6, Math.max(.02, (top - bottom) * height), .01], color });
    list.push({ position: [x, (bottom + top) / 2 * height, 0], scale: [.012, (top - bottom) * height + .08 + rnd() * .1, .008], color });
    price = close;
  }
  return list;
}
/** Слитки пирамидками и стопки монет на полках витрин. */
function treasure(length: number, shelves: number[]): { bars: Item[]; coins: Item[] } {
  const rnd = random(23), bars: Item[] = [], coins: Item[] = [];
  shelves.forEach(y => {
    let x = -length / 2 + .2;
    while (x < length / 2 - .3) {
      if (rnd() < .5) {
        for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - row; k++) bars.push({ position: [x + .08 + k * .15 + row * .075, y + .045 + row * .06, -.02], scale: [.13, .055, .24], color: rnd() < .15 ? '#d9dde3' : '#e8b93a' });
        x += .55;
      } else {
        for (let s = 0; s < 3; s++) { const h = 3 + Math.floor(rnd() * 7); for (let k = 0; k < h; k++) coins.push({ position: [x + .07 + s * .13, y + .02 + k * .022 + .011, -.02 + (rnd() - .5) * .02], scale: [.1, .018, .1], color: '#e8b93a' }); }
        x += .5;
      }
      x += .15 + rnd() * .2;
    }
  });
  return { bars, coins };
}

function Instances({ items, geometry, material }: { items: Item[]; geometry: BufferGeometry; material: Material }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new Object3D(), color = new Color();
    items.forEach((item, i) => {
      dummy.position.set(...item.position); dummy.scale.set(...item.scale); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh key={items.length} ref={ref} args={[geometry, material, items.length]} />;
}

const SHELVES = [1.0, 1.55, 2.1], CABINET_DEPTH = .4, WALL = 7.7, FRONT = 10.8, TICKS = 28;
export default function FinanceDecor() {
  const ticker = useRef<Group>(null);
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), coin: new CylinderGeometry(.5, .5, 1, 16) }), []);
  const materials = useMemo(() => ({
    screen: new MeshStandardMaterial({ color: '#06101c', roughness: .3, metalness: .2 }),
    candle: new MeshBasicMaterial({ toneMapped: false }),
    grid: new MeshStandardMaterial({ color: '#13263b', emissive: '#16324f', emissiveIntensity: .6 }),
    tick: new MeshStandardMaterial({ color: '#ffcf5a', emissive: '#ffb020', emissiveIntensity: 1.4, toneMapped: false }),
    wood: new MeshStandardMaterial({ color: '#2b1a12', roughness: .45, metalness: 0 }),
    brass: new MeshStandardMaterial({ color: '#c79a4b', roughness: .28, metalness: .9 }),
    gold: new MeshStandardMaterial({ roughness: .22, metalness: 1 }),
    glass: new MeshStandardMaterial({ color: '#cfe6f2', transparent: true, opacity: .12, roughness: .05, depthWrite: false }),
    shelfLight: new MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd99a', emissiveIntensity: 1.8 }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const chart = useMemo(() => candles(WALL - 1.4, 2.1), []);
  const loot = useMemo(() => treasure(FRONT - .2, SHELVES), []);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Бегущая строка: каждый знак сдвигается влево и возвращается в начало в пределах экрана.
  const span = WALL - .7;
  useFrame(({ clock }) => {
    if (!ticker.current || reduced) return;
    ticker.current.children.forEach((child, i) => { child.position.x = ((i * span / TICKS - clock.elapsedTime * .6) % span + span) % span - span / 2; });
  });
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial) =>
    <mesh key={key} position={pos} scale={scale} geometry={geometries.box} material={material} castShadow receiveShadow />;
  return <group>
    {/* Стена-экран: график свечей, сетка, бегущая строка котировок. */}
    <group position={[-5.83 + .08, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {box('bezel', [0, 2.55, -.04], [WALL, 3.3, .06], materials.wood)}
      {box('panel', [0, 2.7, 0], [WALL - .5, 2.7, .02], materials.screen)}
      {Array.from({ length: 5 }, (_, i) => box(`grid-${i}`, [0, 1.6 + i * .5, .012], [WALL - .9, .008, .004], materials.grid))}
      <group position={[0, 1.45, .02]}><Instances items={chart} geometry={geometries.box} material={materials.candle} /></group>
      {box('ticker-bg', [0, 1.1, .01], [WALL - .5, .22, .02], materials.screen)}
      <group position={[0, 1.1, .025]}>
        <group ref={ticker}>{Array.from({ length: TICKS }, (_, i) => <mesh key={i} position={[i * (WALL - .7) / TICKS - (WALL - .7) / 2, 0, 0]} scale={[i % 4 === 3 ? .04 : .16, .07, .004]} geometry={geometries.box} material={materials.tick} />)}</group>
      </group>
      {box('sill', [0, .45, .05], [WALL, .9, .2], materials.wood)}
      {box('sill-top', [0, .91, .06], [WALL + .04, .03, .24], materials.brass)}
    </group>
    {/* Витрины с золотом вдоль передней стены, кроме прохода у двери. */}
    <group position={[.45, 0, 5.04 - CABINET_DEPTH / 2]} rotation={[0, Math.PI, 0]}>
      {box('base', [0, .4, 0], [FRONT, .8, CABINET_DEPTH], materials.wood)}
      {box('back', [0, 1.8, -.19], [FRONT, 2, .02], materials.wood)}
      {SHELVES.map(y => box(`shelf-${y}`, [0, y, 0], [FRONT, .03, CABINET_DEPTH - .04], materials.wood))}
      {box('crown', [0, 2.82, 0], [FRONT + .1, .1, CABINET_DEPTH + .06], materials.wood)}
      {box('light', [0, 2.75, .05], [FRONT - .2, .02, .04], materials.shelfLight)}
      {Array.from({ length: 10 }, (_, i) => box(`post-${i}`, [-FRONT / 2 + i * FRONT / 9, 1.8, .19], [.04, 2, .03], materials.brass))}
      <mesh position={[0, 1.8, .2]} scale={[FRONT, 1.95, .01]} geometry={geometries.box} material={materials.glass} />
      <Instances items={loot.bars} geometry={geometries.box} material={materials.gold} />
      <Instances items={loot.coins} geometry={geometries.coin} material={materials.gold} />
    </group>
  </group>;
}
