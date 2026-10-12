import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import SportsDisplay from './SportsDisplay';
import { BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, MeshStandardMaterial, Group, DoubleSide } from 'three';
import type { ObjectId, Vec3 } from '../../roomEngine';

export default function Model3D({ id, ghost, active = false, reduced = false }: {
  id: ObjectId; ghost?: 'valid' | 'invalid'; active?: boolean; reduced?: boolean;
}) {
  const plant = useRef<Group>(null);
  const globe = useRef<Group>(null);
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(.5, .5, 1, 12), sphere: new SphereGeometry(.5, 24, 16), cone: new CylinderGeometry(.28, .5, 1, 20, 1, true), ring: new TorusGeometry(.5, .025, 8, 40, Math.PI * 1.4) }), []);
  const materials = useMemo(() => {
    const make = (color: string, metalness = 0, roughness = .65) => new MeshStandardMaterial({ color: ghost ? ghost === 'valid' ? '#57caff' : '#ff7777' : color, metalness, roughness, transparent: !!ghost, opacity: ghost ? .45 : 1, depthWrite: !ghost });
    return { dark: make('#202731', .6, .35), steel: make('#a5afba', .85, .25), fabric: make('#36556d', 0, .9), rubber: make('#242d3b', 0, .9), leaf: make('#417858', 0, .8), wood: make('#b09072'), ball: make('#5c9daa', .15, .38), oak: make('#8a5a36', 0, .62), walnut: make('#4a2f1e', 0, .55), brass: make('#c79a4b', .85, .3), leather: make('#7a3b2a', 0, .55), paper: make('#f1ece1', 0, .9),
      red: make('#a8423a', 0, .7), blue: make('#2f5d8c', 0, .7), green: make('#3f7a5a', 0, .7), gold: make('#d1a24a', .2, .5), cream: make('#e7dcc4', 0, .8), ocean: make('#2f7fb3', .1, .45),
      shade: new MeshStandardMaterial({ color: ghost ? ghost === 'valid' ? '#57caff' : '#ff7777' : '#f3e2bd', emissive: active && !ghost ? '#ffc56b' : '#000000', emissiveIntensity: active ? 1.4 : 0, transparent: true, opacity: ghost ? .45 : .92, side: DoubleSide }),
      screen: new MeshStandardMaterial({ color: active ? '#69ebff' : '#142d3c', emissive: active ? '#23d6ee' : '#081421', emissiveIntensity: active ? 1 : .15, transparent: !!ghost, opacity: ghost ? .45 : 1 }) };
  }, [ghost, active]);
  useEffect(() => () => { Object.values(materials).forEach(material => material.dispose()); }, [materials]);
  useEffect(() => () => { Object.values(geometries).forEach(geometry => geometry.dispose()); }, [geometries]);
  useFrame(({ clock }, delta) => {
    if (plant.current && !reduced) plant.current.rotation.z = Math.sin(clock.elapsedTime * .6) * .012;
    if (globe.current && !reduced) globe.current.rotation.y += delta * (active ? 1.6 : .12);
  });
  const box = (pos: Vec3, size: Vec3, mat = materials.dark, rotation: Vec3 = [0, 0, 0]) => <mesh position={pos} scale={size} rotation={rotation} geometry={geometries.box} material={mat} castShadow={!ghost} receiveShadow />;
  const sphere = (pos: Vec3, size: Vec3, mat = materials.gold) => <mesh position={pos} scale={size} geometry={geometries.sphere} material={mat} castShadow={!ghost} receiveShadow />;
  const cylinder = (pos: Vec3, size: Vec3, mat = materials.steel, rotation: Vec3 = [0, 0, 0]) => <mesh position={pos} scale={size} rotation={rotation} geometry={geometries.cylinder} material={mat} castShadow={!ghost} receiveShadow />;

  return <group dispose={null}>
    {id === 'mat' && box([0, .035, 0], [1.8, .07, .8], materials.fabric)}
    {id === 'dumbbells' && [-.22, .22].map(z => <group key={z}>
      {cylinder([0, .16, z], [.08, .65, .08], materials.steel, [0, 0, Math.PI / 2])}
      {[-.28, .28].map(x => <group key={x}>{cylinder([x, .16, z], [.3, .12, .3], materials.rubber, [0, 0, Math.PI / 2])}</group>)}
    </group>)}
    {id === 'bench' && <>
      {box([0, .63, 0], [1.8, .2, .65], materials.fabric)}
      {box([0, .46, 0], [1.75, .12, .4], materials.steel)}
      {[-.62, .62].map(x => <group key={x}>{box([x, .25, 0], [.12, .5, .4], materials.dark)}{box([x, .06, 0], [.45, .12, .8], materials.rubber)}</group>)}
    </>}
    {id === 'ball' && <mesh position={[0, .45, 0]} scale={[.9, .9, .9]} geometry={geometries.sphere} material={materials.ball} castShadow={!ghost} receiveShadow />}
    {id === 'plant' && <>
      {cylinder([0, .25, 0], [.65, .5, .65], materials.wood)}
      <group ref={plant} position={[0, .48, 0]}>
        {cylinder([0, .6, 0], [.025, 1.2, .025], materials.wood)}
        {[0, 1, 2, 3, 4, 5].map(i => <group key={i} rotation={[0, i * Math.PI / 3, 0]} position={[0, .32 + i * .1, 0]}>
          <mesh position={[.17, .1, 0]} rotation={[0, 0, -.7]} scale={[.18, .55, .09]} geometry={geometries.sphere} material={materials.leaf} castShadow={!ghost} />
        </group>)}
      </group>
    </>}
    {id === 'treadmill' && <>
      {[-.53, .53].map(x => [-.75, 1.05].map(z => <group key={`${x}:${z}`}>{box([x, .05, z], [.2, .1, .25], materials.rubber)}</group>))}
      {box([0, .19, .15], [1.35, .22, 2.35], materials.steel)}
      {box([0, .32, .25], [.95, .06, 1.9], materials.rubber)}
      {[-.59, .59].map(x => <group key={x}>{box([x, .75, -.9], [.1, 1.2, .1], materials.steel, [-.15, 0, 0])}{box([x, 1.05, -.35], [.1, .1, 1.3], materials.dark)}</group>)}
      {box([0, 1.4, -1], [1.2, .3, .42], materials.dark, [-.3, 0, 0])}
      {!ghost && <SportsDisplay active={active} />}
      {box([0, 1.22, -.57], [1.2, .09, .09], materials.dark)}
    </>}
    {id === 'bookshelf' && <>
      {box([0, 1.05, -.25], [1.8, 2.1, .04], materials.walnut)}
      {[-.88, .88].map(x => <group key={x}>{box([x, 1.05, 0], [.06, 2.1, .5], materials.oak)}</group>)}
      {[.06, .55, 1.05, 1.55, 2.07].map(y => <group key={y}>{box([0, y, 0], [1.76, .05, .5], materials.oak)}</group>)}
      {[.08, .58, 1.08, 1.58].map((y, row) => Array.from({ length: 11 }, (_, i) => {
        const tall = .3 + ((i * 7 + row * 3) % 5) * .03, wide = .07 + ((i + row) % 3) * .02;
        const mat = [materials.red, materials.blue, materials.green, materials.gold, materials.cream][(i * 3 + row) % 5];
        return i === 8 - row ? null : <group key={`${row}:${i}`}>{box([-.76 + i * .142, y + tall / 2, .02], [wide, tall, .34], mat, [0, 0, i === 9 - row ? .25 : 0])}</group>;
      }))}
      {sphere([.62, 1.66, .05], [.14, .14, .14], materials.brass)}
    </>}
    {id === 'desk' && <>
      {box([0, .76, 0], [1.8, .06, .78], materials.walnut)}
      {[-.82, .82].map(x => [-.32, .32].map(z => <group key={`${x}:${z}`}>{box([x, .37, z], [.07, .74, .07], materials.walnut)}</group>))}
      {box([.55, .55, .02], [.6, .34, .7], materials.oak)}
      {[.47, .63].map(y => <group key={y}>{box([.55, y, .38], [.5, .12, .02], materials.walnut)}{sphere([.55, y, .4], [.04, .04, .04], materials.brass)}</group>)}
      {box([-.25, .8, -.05], [.46, .02, .32], materials.dark)}
      {box([-.25, .96, -.21], [.46, .3, .02], materials.dark, [-.25, 0, 0])}
      {box([-.25, .97, -.2], [.42, .26, .005], materials.screen, [-.25, 0, 0])}
      {box([.45, .82, -.2], [.26, .06, .2], materials.red)}{box([.47, .87, -.2], [.24, .04, .19], materials.blue)}
      {box([.2, .795, .15], [.24, .01, .3], materials.paper, [0, .3, 0])}
      {cylinder([.75, .83, .12], [.08, .12, .08], materials.cream)}
    </>}
    {id === 'armchair' && <>
      {box([0, .3, .05], [.78, .24, .7], materials.leather)}
      {box([0, .44, .06], [.62, .12, .6], materials.leather)}
      {box([0, .72, -.3], [.78, .72, .16], materials.leather, [-.12, 0, 0])}
      {[-.38, .38].map(x => <group key={x}>{box([x, .5, .03], [.14, .26, .72], materials.leather)}</group>)}
      {[-.32, .32].map(x => [-.28, .32].map(z => <group key={`${x}:${z}`}>{cylinder([x, .09, z], [.06, .18, .06], materials.walnut)}</group>))}
      {box([.05, .53, .18], [.3, .04, .22], materials.blue, [0, .4, 0])}
    </>}
    {id === 'floorLamp' && <>
      {cylinder([0, .025, 0], [.42, .05, .42], materials.dark)}
      {cylinder([0, .85, 0], [.035, 1.6, .035], materials.brass)}
      <mesh position={[0, 1.72, 0]} scale={[.62, .38, .62]} geometry={geometries.cone} material={materials.shade} castShadow={!ghost} />
      {sphere([0, 1.62, 0], [.1, .1, .1], materials.shade)}
      {active && !ghost && <pointLight position={[0, 1.55, 0]} intensity={4} distance={5.5} decay={2} color="#ffc98a" />}
    </>}
    {id === 'globe' && <>
      {cylinder([0, .04, 0], [.46, .08, .46], materials.walnut)}
      {[0, 2, 4].map(i => <group key={i} rotation={[0, i * Math.PI / 3, 0]}>{box([.16, .32, 0], [.04, .55, .04], materials.walnut, [0, 0, -.25])}</group>)}
      {cylinder([0, .6, 0], [.3, .04, .3], materials.walnut)}
      <group position={[0, 1.02, 0]} rotation={[0, 0, .41]}>
        <mesh scale={[.68, .68, .68]} geometry={geometries.ring} material={materials.brass} rotation={[0, Math.PI / 2, -.6]} castShadow={!ghost} />
        <group ref={globe}>
          {sphere([0, 0, 0], [.6, .6, .6], materials.ocean)}
          {([[.2, .12, .18, .14], [-.18, -.08, .2, .16], [.05, -.2, .17, .1], [-.12, .2, .16, .1]] as const).map(([x, y, z, r], i) => <group key={i}>{sphere([x, y, z], [r, r * .7, r], materials.green)}</group>)}
        </group>
        {cylinder([0, 0, 0], [.02, .76, .02], materials.brass)}
      </group>
    </>}
    {id === 'board' && <>
      {[-.75, .75].map(x => <group key={x}>{box([x, .85, 0], [.06, 1.7, .06], materials.oak)}{box([x, .03, 0], [.08, .06, .6], materials.oak)}</group>)}
      {box([0, 1.08, 0], [1.6, 1.02, .05], materials.oak)}
      {box([0, 1.08, .03], [1.5, .92, .01], materials.paper)}
      {box([0, .6, .06], [1.5, .03, .1], materials.oak)}
      {([[-.5, 1.32, materials.gold], [-.22, 1.36, materials.green], [.1, 1.3, materials.red], [-.48, .98, materials.blue], [-.15, .96, materials.gold]] as const).map(([x, y, mat], i) => <group key={i}>{box([x, y, .04], [.2, .2, .005], mat, [0, 0, (i % 2 ? .06 : -.05)])}</group>)}
      {box([.42, 1.12, .04], [.42, .02, .005], materials.dark)}{box([.42, 1.02, .04], [.32, .02, .005], materials.dark)}{box([.38, .92, .04], [.36, .02, .005], materials.dark)}
      {box([.35, 1.3, .04], [.5, .03, .005], materials.red)}
      {cylinder([.5, .64, .07], [.03, .14, .03], materials.blue, [0, 0, Math.PI / 2])}
    </>}
  </group>;
}
