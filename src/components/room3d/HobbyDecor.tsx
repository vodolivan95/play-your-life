import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, InstancedMesh, Material, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Хобби»: галерея абстрактных картин и стена винила на глухой левой стене
// (с проходом у двери), полки с красками и клубками пряжи вдоль передней стены, брызги краски на полу.
// Пол для мебели — 11 × 9 м (`roomConfigs.hobby.size`).

type Item = { position: Vec3; scale: Vec3; rotation?: Vec3; color: string };
const paints = ['#e8443a', '#f2b632', '#2f7fd0', '#3aa86a', '#7a4ad0', '#ff7ab8', '#22c3c3', '#f4f2ee', '#15181d'];
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Четыре холста: на каждом несколько цветных пятен-блоков в духе абстракции. */
function canvases(): { frames: Item[]; blocks: Item[] } {
  const rnd = random(3), frames: Item[] = [], blocks: Item[] = [];
  ([[-3, 2.3, 1.3, 1.7], [-1.4, 2.6, 1.4, 1.1], [-1.5, 1.45, 1, .8], [.1, 2.2, 1.2, 1.5]] as const).forEach(([x, y, w, h]) => {
    frames.push({ position: [x, y, .02], scale: [w + .08, h + .08, .04], color: '#15181d' });
    frames.push({ position: [x, y, .045], scale: [w, h, .01], color: '#fbf8f0' });
    for (let k = 0; k < 6; k++) blocks.push({ position: [x + (rnd() - .5) * w * .7, y + (rnd() - .5) * h * .7, .052 + k * .001], scale: [w * (.2 + rnd() * .4), h * (.12 + rnd() * .3), .004], rotation: [0, 0, (rnd() - .5) * .6], color: paints[Math.floor(rnd() * 7)] });
  });
  return { frames, blocks };
}
function vinyls(): { discs: Item[]; labels: Item[] } {
  const rnd = random(13), discs: Item[] = [], labels: Item[] = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = 1.6 + col * .55, y = 1.4 + row * .62;
    discs.push({ position: [x, y, .03], scale: [.24, .24, 1], color: '#15181d' });
    labels.push({ position: [x, y, .032], scale: [.08, .08, 1], color: paints[Math.floor(rnd() * 7)] });
  }
  return { discs, labels };
}
function shelfStuff(length: number): { jars: Item[]; yarn: Item[] } {
  const rnd = random(37), jars: Item[] = [], yarn: Item[] = [];
  [1.0, 1.6, 2.2].forEach((y, level) => {
    for (let x = -length / 2 + .15; x < length / 2 - .15;) {
      if (level === 2 || rnd() < .35) { yarn.push({ position: [x + .1, y + .1, 0], scale: [.2, .2, .2], color: paints[Math.floor(rnd() * 7)] }); x += .23; }
      else { const c = paints[Math.floor(rnd() * paints.length)]; jars.push({ position: [x + .06, y + .08, 0], scale: [.11, .14, .11], color: c }); x += .14; }
      if (rnd() < .08) x += .3;
    }
  });
  return { jars, yarn };
}
function splatters(): Item[] {
  const rnd = random(71);
  return Array.from({ length: 70 }, () => { const r = .05 + rnd() ** 2 * .35; return { position: [(rnd() - .5) * 10, .002, (rnd() - .5) * 8], scale: [r, r * (.6 + rnd() * .4), 1], rotation: [-Math.PI / 2, 0, rnd() * Math.PI], color: paints[Math.floor(rnd() * 7)] } as Item; });
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
export default function HobbyDecor() {
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), disc: new CircleGeometry(1, 32), jar: new CylinderGeometry(.5, .5, 1, 12), ball: new SphereGeometry(.5, 12, 10) }), []);
  const materials = useMemo(() => ({
    brick: new MeshStandardMaterial({ color: '#d8d2c8', roughness: .95 }),
    item: new MeshStandardMaterial({ roughness: .6 }),
    gloss: new MeshStandardMaterial({ roughness: .25, metalness: .1 }),
    wool: new MeshStandardMaterial({ roughness: 1 }),
    plank: new MeshStandardMaterial({ color: '#8a5a36', roughness: .6 }),
    bracket: new MeshStandardMaterial({ color: '#15181d', roughness: .4, metalness: .6 }),
    spot: new MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd99a', emissiveIntensity: 2, toneMapped: false }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const art = useMemo(canvases, []);
  const records = useMemo(vinyls, []);
  const stuff = useMemo(() => shelfStuff(FRONT - .3), []);
  const paint = useMemo(splatters, []);
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial) =>
    <mesh key={key} position={pos} scale={scale} geometry={geometries.box} material={material} castShadow receiveShadow />;
  return <group>
    <Instances items={paint} geometry={geometries.disc} material={materials.gloss} />
    <group position={[-5.83 + .04, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {box('wall', [0, 2.5, -.01], [WALL, 4.6, .02], materials.brick)}
      <Instances items={art.frames} geometry={geometries.box} material={materials.item} />
      <Instances items={art.blocks} geometry={geometries.box} material={materials.item} />
      <Instances items={records.discs} geometry={geometries.disc} material={materials.gloss} />
      <Instances items={records.labels} geometry={geometries.disc} material={materials.item} />
      {box('track', [-1, 3.9, .25], [5, .04, .04], materials.bracket)}
      {[-3, -1.4, .1].map(x => <group key={x}>{box(`spot-${x}`, [x, 3.82, .25], [.12, .12, .16], materials.bracket)}<mesh position={[x, 3.75, .3]} scale={[.08, .02, .08]} geometry={geometries.jar} material={materials.spot} /></group>)}
    </group>
    <group position={[.45, 0, 5.04 - .15]} rotation={[0, Math.PI, 0]}>
      {[1.0, 1.6, 2.2].map(y => box(`plank-${y}`, [0, y, 0], [FRONT, .04, .3], materials.plank))}
      {Array.from({ length: 10 }, (_, i) => [1.0, 1.6, 2.2].map(y => box(`br-${i}-${y}`, [-FRONT / 2 + .3 + i * (FRONT - .6) / 9, y - .07, -.08], [.03, .12, .14], materials.bracket)))}
      <Instances items={stuff.jars} geometry={geometries.jar} material={materials.gloss} />
      <Instances items={stuff.yarn} geometry={geometries.ball} material={materials.wool} />
      {box('bench', [0, .4, .1], [FRONT - 1, .8, .5], materials.plank)}
    </group>
  </group>;
}
