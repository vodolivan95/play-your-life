import { useEffect, useMemo } from 'react';
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, RingGeometry } from 'three';
import type { Vec3 } from '../../roomEngine';

// Неподвижная обстановка «Психологии»: стена с тёплыми книжными полками и рамками
// слева, мягкая штора и подвесные плафоны у передней стены. Пол для мебели — 11 × 9 м
// (`roomConfigs.psychology.size`).

const FRONT = 10.8;
export default function PsychologyDecor() {
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), disc: new CylinderGeometry(.5, .5, 1, 32), ring: new RingGeometry(.5, .58, 32) }), []);
  const materials = useMemo(() => ({
    frame: new MeshStandardMaterial({ color: '#5a4a86', roughness: .6 }),
    shelf: new MeshStandardMaterial({ color: '#3c2f52', roughness: .7 }),
    book1: new MeshStandardMaterial({ color: '#6a4fd6', roughness: .55 }),
    book2: new MeshStandardMaterial({ color: '#8fae8a', roughness: .55 }),
    book3: new MeshStandardMaterial({ color: '#cabdf2', roughness: .55 }),
    book4: new MeshStandardMaterial({ color: '#e8a66b', roughness: .55 }),
    glow: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffd9a0', emissiveIntensity: 1.8, toneMapped: false }),
    curtain: new MeshStandardMaterial({ color: '#b9a9e8', roughness: .85 }),
    ring: new MeshStandardMaterial({ color: '#cabdf2', emissive: '#6a4fd6', emissiveIntensity: .8, toneMapped: false, side: 2 }),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const books = useMemo(() => {
    const palette = [materials.book1, materials.book2, materials.book3, materials.book4];
    const list: { pos: Vec3; scale: Vec3; mat: MeshStandardMaterial }[] = [];
    for (let row = 0; row < 3; row++) {
      let cursor = -1.9;
      let i = 0;
      while (cursor < 1.9) {
        const w = .08 + ((row * 7 + i) % 4) * .02, h = .3 + ((row * 5 + i) % 3) * .06;
        list.push({ pos: [cursor + w / 2, 1.3 + row * .62 + h / 2 - .3, .03], scale: [w, h, .22], mat: palette[(row + i) % palette.length] });
        cursor += w + .015; i++;
      }
    }
    return list;
  }, [materials]);
  const box = (key: string, pos: Vec3, scale: Vec3, material: MeshStandardMaterial, rotation: Vec3 = [0, 0, 0]) =>
    <mesh key={key} position={pos} scale={scale} rotation={rotation} geometry={geometries.box} material={material} castShadow receiveShadow />;
  return <group>
    <group position={[-5.83 + .05, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
      {/* Книжные полки с мягким чтением. */}
      {[1.0, 1.62, 2.24].map(y => box(`shelf-${y}`, [0, y, .02], [4.2, .04, .26], materials.shelf))}
      {books.map((b, i) => box(`book-${i}`, b.pos, b.scale, b.mat))}
      {box('frame-a', [-1.4, 3.1, .02], [.9, .7, .03], materials.frame)}
      {box('frame-b', [0, 3.1, .02], [.9, .7, .03], materials.frame)}
      {box('frame-c', [1.4, 3.1, .02], [.9, .7, .03], materials.frame)}
      <mesh position={[0, 4.25, .03]} rotation={[Math.PI / 2, 0, 0]} scale={[.9, .9, .9]} geometry={geometries.ring} material={materials.ring} />
    </group>
    <group position={[.45, 0, 5.04 - .25]} rotation={[0, Math.PI, 0]}>
      {/* Мягкая штора по передней стене и тёплые подвесные плафоны. */}
      {Array.from({ length: 9 }, (_, i) => box(`fold-${i}`, [-FRONT / 2 + .3 + i * (FRONT - .6) / 8, 1.9, .05], [.26, 3.6, .1], materials.curtain))}
      {[-2.4, 0, 2.4].map(x => <group key={`lamp-${x}`}>
        {box(`cord-${x}`, [x, 4.6, .2], [.015, 1, .015], materials.shelf)}
        <mesh position={[x, 4.1, .2]} scale={[.22, .16, .22]} geometry={geometries.disc} material={materials.glow} />
        <pointLight position={[x, 4.0, .2]} color="#ffd9a0" intensity={1.4} distance={3.2} decay={2} />
      </group>)}
    </group>
  </group>;
}
