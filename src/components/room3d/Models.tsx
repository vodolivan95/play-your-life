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
  const fish = useRef<Group>(null);
  const pig = useRef<Group>(null);
  const signal = useRef(-2);
  const lights = useRef<Group>(null);
  const flame = useRef<Group>(null);
  const wheel = useRef<Group>(null);
  const scope = useRef<Group>(null);
  const sand = useRef<Group>(null);
  const gongDisc = useRef<Group>(null);
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(.5, .5, 1, 12), sphere: new SphereGeometry(.5, 24, 16), cone: new CylinderGeometry(.28, .5, 1, 20, 1, true), ring: new TorusGeometry(.5, .025, 8, 40, Math.PI * 1.4), tire: new TorusGeometry(.38, .16, 10, 28) }), []);
  const materials = useMemo(() => {
    const make = (color: string, metalness = 0, roughness = .65) => new MeshStandardMaterial({ color: ghost ? ghost === 'valid' ? '#57caff' : '#ff7777' : color, metalness, roughness, transparent: !!ghost, opacity: ghost ? .45 : 1, depthWrite: !ghost });
    return { dark: make('#202731', .6, .35), steel: make('#a5afba', .85, .25), fabric: make('#36556d', 0, .9), rubber: make('#242d3b', 0, .9), leaf: make('#417858', 0, .8), wood: make('#b09072'), ball: make('#5c9daa', .15, .38), oak: make('#8a5a36', 0, .62), walnut: make('#4a2f1e', 0, .55), brass: make('#c79a4b', .85, .3), leather: make('#7a3b2a', 0, .55), paper: make('#f1ece1', 0, .9),
      red: make('#a8423a', 0, .7), blue: make('#2f5d8c', 0, .7), green: make('#3f7a5a', 0, .7), gold: make('#d1a24a', .2, .5), cream: make('#e7dcc4', 0, .8), ocean: make('#2f7fb3', .1, .45),
      white: make('#f4f2ee', 0, .35), mint: make('#4fb3a9', .05, .4), cedar: make('#b07a4a', 0, .7), orange: make('#f08a3c', .05, .5), lime: make('#8cc63f', 0, .55), berry: make('#b23a5a', 0, .5), sand: make('#e7d6b0', 0, .9),
      bronze: make('#8a5a2b', .9, .35), navy: make('#1c2a44', .1, .5), pink: make('#f29bb2', .05, .45), goldBar: make('#e8b93a', 1, .22), chestWood: make('#5a3418', 0, .6), black: make('#15181d', .4, .4),
      boardWhite: make('#fbfbf8', 0, .3), corkBlue: make('#2f5fd0', .1, .4), sticky1: make('#ffe066', 0, .8), sticky2: make('#7bdcb5', 0, .8), sticky3: make('#ff9ec4', 0, .8), sandGold: make('#e2c27a', 0, .9),
      canvasWhite: make('#fbf8f0', 0, .9), clay: make('#b8754a', 0, .8), pianoBlack: make('#0e0f12', .2, .15), keyWhite: make('#f7f5ef', 0, .3), guitarWood: make('#c77a32', .05, .35), purple: make('#7a4ad0', 0, .7),
      teal: make('#2d8a8a', 0, .85), mustard: make('#d9a21b', 0, .85), coral: make('#e86a5a', 0, .85), tableGreen: make('#1f6b4a', 0, .6), netWhite: make('#f4f2ee', 0, .8), brick: make('#9a4a32', 0, .9),
      fire: new MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a1a', emissiveIntensity: ghost ? 0 : active ? 3 : 1.6, transparent: true, opacity: ghost ? .3 : .9, toneMapped: false }),
      carRed: make('#d3202f', .6, .25), yellow: make('#f2c230', .1, .5), road: make('#2b2f36', 0, .9), chrome: make('#d9dde3', 1, .15),
      redLamp: new MeshStandardMaterial({ color: '#5a1010', emissive: '#ff2a2a', emissiveIntensity: ghost ? 0 : 1.6 }),
      amberLamp: new MeshStandardMaterial({ color: '#5a3d10', emissive: '#ffb020', emissiveIntensity: ghost ? 0 : 1.6 }),
      greenLamp: new MeshStandardMaterial({ color: '#0f4a24', emissive: '#22e06a', emissiveIntensity: ghost ? 0 : 1.6 }),
      londonRed: make('#c8202f', .1, .45), cream2: make('#efe6cf', 0, .6), stone: make('#cdbb8f', 0, .8), busGlass: make('#28323d', .5, .2),
      lamp: new MeshStandardMaterial({ color: active && !ghost ? '#fff4c9' : '#d9d2b8', emissive: active && !ghost ? '#ffd27a' : '#000000', emissiveIntensity: active ? 1.6 : 0, transparent: !!ghost, opacity: ghost ? .45 : 1 }),
      chart: new MeshStandardMaterial({ color: active && !ghost ? '#0b2a1d' : '#0a1420', emissive: ghost ? '#000000' : '#21c37a', emissiveIntensity: active ? 1.1 : .35, transparent: !!ghost, opacity: ghost ? .45 : 1 }),
      glass: new MeshStandardMaterial({ color: ghost ? ghost === 'valid' ? '#57caff' : '#ff7777' : '#bfe8f2', transparent: true, opacity: ghost ? .4 : .28, roughness: .05, metalness: .1, depthWrite: false }),
      water: new MeshStandardMaterial({ color: ghost ? ghost === 'valid' ? '#57caff' : '#ff7777' : '#4fb8e8', emissive: active && !ghost ? '#2fb6ff' : '#000000', emissiveIntensity: active ? .7 : 0, transparent: true, opacity: ghost ? .4 : .55, roughness: .1, depthWrite: false }),
      shade: new MeshStandardMaterial({ color: ghost ? ghost === 'valid' ? '#57caff' : '#ff7777' : '#f3e2bd', emissive: active && !ghost ? '#ffc56b' : '#000000', emissiveIntensity: active ? 1.4 : 0, transparent: true, opacity: ghost ? .45 : .92, side: DoubleSide }),
      screen: new MeshStandardMaterial({ color: active ? '#69ebff' : '#142d3c', emissive: active ? '#23d6ee' : '#081421', emissiveIntensity: active ? 1 : .15, transparent: !!ghost, opacity: ghost ? .45 : 1 }) };
  }, [ghost, active]);
  useEffect(() => () => { Object.values(materials).forEach(material => material.dispose()); }, [materials]);
  useEffect(() => () => { Object.values(geometries).forEach(geometry => geometry.dispose()); }, [geometries]);
  useFrame(({ clock }, delta) => {
    if (plant.current && !reduced) plant.current.rotation.z = Math.sin(clock.elapsedTime * .6) * .012;
    if (globe.current && !reduced) globe.current.rotation.y += delta * (active ? 1.6 : .12);
    if (fish.current && !reduced) fish.current.rotation.y += delta * (active ? 1.4 : .45);
    if (lights.current) {
      // Светофор: при включении — цикл красный → жёлтый → зелёный; иначе мигает жёлтый.
      const t = clock.elapsedTime, phase = active ? Math.floor(t / 1.5) % 3 : (Math.floor(t * 2) % 2 ? 1 : -1);
      if (phase !== signal.current) { signal.current = phase; lights.current.children.forEach((lamp, i) => { lamp.visible = i === phase; }); }
    }
    if (flame.current && !reduced) flame.current.children.forEach((f, i) => { f.scale.y = (active ? 1.4 : 1) * (.8 + Math.sin(clock.elapsedTime * (6 + i) + i * 2) * .2); });
    if (wheel.current && !reduced) wheel.current.rotation.y += delta * (active ? 9 : .5);
    if (scope.current && !reduced) scope.current.rotation.y = Math.sin(clock.elapsedTime * (active ? .8 : .15)) * (active ? .9 : .3);
    if (sand.current && !reduced) sand.current.rotation.z = active ? Math.min(Math.PI, sand.current.rotation.z + delta * 2) : Math.max(0, sand.current.rotation.z - delta * 2);
    if (gongDisc.current && !reduced) gongDisc.current.rotation.x = active ? Math.sin(clock.elapsedTime * 9) * .18 * Math.max(0, Math.cos(clock.elapsedTime * .5)) : 0;
    if (pig.current && !reduced) pig.current.position.y = active ? Math.abs(Math.sin(clock.elapsedTime * 6)) * .12 : 0;
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
    {id === 'massageTable' && <>
      {box([0, .7, 0], [1.85, .12, .7], materials.mint)}
      {box([0, .62, 0], [1.8, .05, .66], materials.white)}
      {box([-.72, .79, 0], [.36, .07, .45], materials.white)}
      {[-.75, .75].map(x => <group key={x}>{box([x, .31, 0], [.07, .62, .55], materials.cedar)}{box([x, .04, 0], [.12, .08, .62], materials.cedar)}</group>)}
      {box([0, .2, 0], [1.4, .05, .05], materials.cedar)}
      {[.25, .42].map(x => <group key={x}>{cylinder([x, .8, .1], [.12, .26, .12], materials.white, [Math.PI / 2, 0, 0])}</group>)}
    </>}
    {id === 'waterCooler' && <>
      {box([0, .5, 0], [.4, 1, .38], materials.white)}
      {box([0, .62, .2], [.24, .2, .02], materials.dark)}
      {[-.06, .06].map(x => <group key={x}>{cylinder([x, .72, .22], [.03, .07, .03], x < 0 ? materials.mint : materials.berry, [Math.PI / 2, 0, 0])}</group>)}
      {cylinder([0, 1.25, 0], [.32, .5, .32], materials.water)}
      {cylinder([0, 1.52, 0], [.12, .06, .12], materials.water)}
    </>}
    {id === 'smoothieBar' && <>
      {box([0, .48, 0], [1.8, .96, .6], materials.white)}
      {box([0, .48, .31], [1.7, .8, .02], materials.mint)}
      {box([0, .98, 0], [1.9, .05, .7], materials.cedar)}
      {cylinder([-.55, 1.15, -.05], [.16, .3, .16], materials.glass)}
      {cylinder([-.55, 1.08, -.05], [.14, .16, .14], materials.berry)}
      {box([-.55, 1.04, -.05], [.2, .08, .2], materials.dark)}
      {cylinder([.1, 1.04, -.05], [.5, .07, .5], materials.white)}
      {([[.0, .06, materials.orange], [.12, .07, materials.lime], [.22, .02, materials.orange], [.05, -.12, materials.berry], [.18, -.1, materials.lime]] as const).map(([x, z, mat], i) => <group key={i}>{sphere([x, 1.12, z - .05], [.11, .11, .11], mat)}</group>)}
      {[.55, .68].map((x, i) => <group key={x}>{cylinder([x, 1.08, .05], [.08, .16, .08], materials.glass)}{cylinder([x, 1.05, .05], [.07, .1, .07], i ? materials.lime : materials.orange)}</group>)}
    </>}
    {id === 'firstAid' && <>
      {[-.28, .28].map(x => <group key={x}>{box([x, .45, 0], [.05, .9, .05], materials.steel)}</group>)}
      {box([0, 1.25, 0], [.7, .8, .3], materials.white)}
      {box([0, 1.25, .16], [.64, .74, .02], materials.white)}
      {box([0, 1.3, .18], [.3, .09, .01], materials.berry)}{box([0, 1.3, .18], [.09, .3, .01], materials.berry)}
      {box([.25, 1.12, .19], [.03, .12, .02], materials.steel)}
      {box([0, .25, 0], [.6, .03, .26], materials.steel)}
      {[-.15, .05, .2].map((x, i) => <group key={x}>{cylinder([x, .33, 0], [.08, .14, .08], [materials.mint, materials.orange, materials.white][i])}</group>)}
    </>}
    {id === 'aquarium' && <>
      {box([0, .38, 0], [1.8, .76, .6], materials.dark)}
      {box([0, 1.15, 0], [1.76, .76, .56], materials.water)}
      {box([0, 1.15, 0], [1.8, .8, .6], materials.glass)}
      {box([0, .8, 0], [1.72, .06, .52], materials.sand)}
      {box([0, 1.56, 0], [1.84, .06, .64], materials.dark)}
      {[-.6, -.45, .5, .62].map((x, i) => <group key={x}>{box([x, .98 + (i % 2) * .05, -.12], [.04, .3 + (i % 2) * .12, .04], materials.lime, [0, 0, (i - 1.5) * .1])}</group>)}
      {sphere([.2, .86, .1], [.16, .1, .14], materials.steel)}
      <group ref={fish} position={[0, 1.15, 0]}>
        {([[.5, .05, materials.orange], [-.4, -.12, materials.mint], [.15, .16, materials.berry], [-.1, -.02, materials.orange]] as const).map(([r, y, mat], i) => <group key={i} rotation={[0, i * 1.7, 0]}><mesh position={[r, y, 0]} scale={[.11, .06, .035]} geometry={geometries.sphere} material={mat} /></group>)}
      </group>
    </>}
    {id === 'cedarBarrel' && <>
      {cylinder([0, .62, 0], [.8, 1.24, .8], materials.cedar)}
      {[.18, .62, 1.06].map(y => <group key={y}>{cylinder([0, y, 0], [.83, .05, .83], materials.brass)}</group>)}
      {box([0, 1.27, .1], [.62, .05, .55], materials.cedar)}
      {sphere([0, 1.45, -.18], [.22, .18, .2], materials.cedar)}
      {box([0, .55, .41], [.4, .5, .02], materials.walnut)}
      {box([.32, .62, .41], [.03, .12, .03], materials.brass)}
    </>}
    {id === 'tradingDesk' && <>
      {box([0, .74, 0], [1.85, .05, .8], materials.black)}
      {[-.85, .85].map(x => <group key={x}>{box([x, .37, 0], [.06, .74, .74], materials.steel)}</group>)}
      {([[-.55, .35], [0, 0], [.55, -.35]] as const).map(([x, r]) => <group key={x} position={[x, 1.08, -.2]} rotation={[0, r, 0]}>
        {box([0, 0, 0], [.52, .32, .03], materials.black)}
        {box([0, 0, .017], [.48, .28, .005], materials.chart)}
        {box([0, -.22, -.02], [.04, .14, .04], materials.steel)}
      </group>)}
      {box([0, .78, .15], [.45, .02, .15], materials.dark)}
      {box([.42, .78, .17], [.07, .02, .1], materials.dark)}
      {cylinder([-.7, .82, .2], [.08, .1, .08], materials.white)}
    </>}
    {id === 'safe' && <>
      {box([0, .5, 0], [.78, 1, .7], materials.black)}
      <group position={[-.33, .5, .36]} rotation={[0, active && !ghost ? -1.2 : 0, 0]}>
        {box([.33, 0, 0], [.7, .92, .06], materials.steel)}
        {cylinder([.33, .1, .05], [.2, .04, .2], materials.goldBar, [Math.PI / 2, 0, 0])}
        {box([.55, -.15, .05], [.04, .2, .04], materials.goldBar)}
      </group>
      {active && !ghost && [0, 1, 2].map(i => <group key={i}>{box([0, .2 + i * .09, 0], [.4, .07, .2], materials.goldBar)}</group>)}
      {[-.32, .32].map(x => <group key={x}>{box([x, .02, 0], [.1, .04, .6], materials.dark)}</group>)}
    </>}
    {id === 'sofa' && <>
      {box([0, .25, .05], [1.85, .3, .8], materials.chestWood)}
      {[-.45, .45].map(x => <group key={x}>{box([x, .46, .08], [.86, .14, .7], materials.leather)}</group>)}
      {box([0, .7, -.3], [1.85, .6, .2], materials.leather, [-.1, 0, 0])}
      {[-.95, .95].map(x => <group key={x}>{box([x, .5, .05], [.14, .4, .8], materials.leather)}</group>)}
      {[-.82, .82].map(x => [-.28, .38].map(z => <group key={`${x}:${z}`}>{cylinder([x, .05, z], [.06, .1, .06], materials.goldBar)}</group>))}
      {box([.5, .62, .05], [.32, .28, .1], materials.navy, [-.15, .2, .1])}
    </>}
    {id === 'piggyBank' && <>
      {cylinder([0, .2, 0], [.5, .4, .5], materials.navy)}
      {cylinder([0, .41, 0], [.54, .03, .54], materials.goldBar)}
      <group ref={pig} >
        <group position={[0, .62, 0]}>
          {sphere([0, 0, 0], [.42, .32, .3], materials.pink)}
          {sphere([.2, .03, 0], [.12, .14, .14], materials.pink)}
          {cylinder([.26, .03, 0], [.07, .04, .07], materials.pink, [0, 0, Math.PI / 2])}
          {[-.07, .07].map(z => <group key={z}>{sphere([.16, .14, z], [.06, .08, .03], materials.pink)}{sphere([.21, .08, z * .6], [.025, .025, .025], materials.black)}</group>)}
          {[-.12, .12].map(x => [-.08, .08].map(z => <group key={`${x}:${z}`}>{cylinder([x, -.17, z], [.06, .1, .06], materials.pink)}</group>))}
          {box([-.02, .16, 0], [.1, .01, .02], materials.black)}
          {active && !ghost && cylinder([-.02, .28, 0], [.09, .015, .09], materials.goldBar, [Math.PI / 2, 0, 0])}
        </group>
      </group>
    </>}
    {id === 'bullStatue' && <>
      {box([0, .15, 0], [1.6, .3, .7], materials.black)}
      {box([0, .31, .36], [.5, .06, .01], materials.goldBar)}
      <group position={[0, .3, 0]}>
        {sphere([-.1, .55, 0], [1.05, .5, .42], materials.bronze)}
        {sphere([.35, .62, 0], [.4, .52, .4], materials.bronze)}
        {sphere([.62, .5, 0], [.26, .26, .24], materials.bronze)}
        {[-.1, .1].map(z => <group key={z}>{cylinder([.68, .7, z * 2.2], [.04, .28, .04], materials.goldBar, [z > 0 ? -.9 : .9, 0, -.4])}</group>)}
        {([[-.42, -.15], [-.42, .15], [.3, -.15], [.42, .15]] as const).map(([x, z], i) => <group key={i}>{cylinder([x, .18, z], [.12, .38, .12], materials.bronze, [0, 0, i === 3 ? -.35 : 0])}</group>)}
        {cylinder([-.68, .62, 0], [.03, .4, .03], materials.bronze, [0, 0, -.9])}
      </group>
    </>}
    {id === 'goldChest' && <>
      {box([0, .25, 0], [.8, .5, .55], materials.chestWood)}
      {[-.3, .3].map(x => <group key={x}>{box([x, .26, 0], [.06, .52, .57], materials.goldBar)}</group>)}
      <group position={[0, .5, -.27]} rotation={[active && !ghost ? -1.1 : -.35, 0, 0]}>
        {box([0, .03, .27], [.8, .08, .55], materials.chestWood)}
        {box([0, .08, .27], [.82, .04, .57], materials.goldBar)}
      </group>
      {[[-.18, 0], [0, 0], [.18, 0], [-.09, .1], [.09, .1]].map(([x, y], i) => <group key={i}>{box([x, .53 + y, .02], [.16, .08, .26], materials.goldBar)}</group>)}
      {box([0, .38, .28], [.1, .12, .02], materials.goldBar)}
    </>}
    {id === 'phoneBooth' && <>
      {box([0, .05, 0], [.9, .1, .9], materials.londonRed)}
      {[-.38, .38].map(x => [-.38, .38].map(z => <group key={`${x}:${z}`}>{box([x, 1.15, z], [.1, 2.1, .1], materials.londonRed)}</group>))}
      {[-.38, .38].map(x => <group key={x}>{box([x, 1.15, 0], [.03, 2, .66], materials.glass)}</group>)}
      {box([0, 1.15, .38], [.66, 2, .03], materials.glass)}{box([0, 1.15, -.38], [.66, 2, .05], materials.londonRed)}
      {[.55, .95, 1.35, 1.75].map(y => <group key={y}>{box([0, y, .39], [.66, .04, .04], materials.londonRed)}{[-.38, .38].map(x => <group key={x}>{box([x, y, 0], [.04, .04, .66], materials.londonRed)}</group>)}</group>)}
      {box([0, 2.3, 0], [.86, .22, .86], materials.londonRed)}
      {box([0, 2.3, .44], [.6, .12, .01], materials.lamp)}
      {cylinder([0, 2.45, 0], [.9, .1, .9], materials.londonRed)}
      {box([0, 1.3, -.3], [.24, .32, .1], materials.black)}
      {active && !ghost && <pointLight position={[0, 1.9, 0]} intensity={2.5} distance={3} color="#ffe3a0" />}
    </>}
    {id === 'teaTable' && <>
      {cylinder([0, .55, 0], [.75, .04, .75], materials.walnut)}
      {cylinder([0, .28, 0], [.06, .54, .06], materials.walnut)}
      {cylinder([0, .03, 0], [.4, .05, .4], materials.walnut)}
      {sphere([0, .67, 0], [.16, .14, .16], materials.white)}
      {cylinder([.1, .68, 0], [.03, .1, .03], materials.white, [0, 0, -.9])}
      {cylinder([0, .76, 0], [.05, .03, .05], materials.white)}
      {[[.22, .12], [-.2, .15], [.0, -.22]].map(([x, z], i) => <group key={i}>{cylinder([x, .6, z], [.12, .015, .12], materials.white)}{cylinder([x, .63, z], [.07, .06, .07], materials.white)}</group>)}
    </>}
    {id === 'studyDesk' && <>
      {box([0, .72, 0], [1.7, .05, .6], materials.oak)}
      {[-.78, .78].map(x => <group key={x}>{box([x, .36, 0], [.05, .72, .55], materials.steel)}</group>)}
      {box([-.35, .76, -.05], [.4, .02, .28], materials.dark)}
      {box([-.35, .9, -.18], [.4, .26, .02], materials.dark, [-.2, 0, 0])}
      {box([-.35, .9, -.17], [.36, .22, .005], materials.screen, [-.2, 0, 0])}
      <group position={[.35, .82, 0]}>
        <mesh scale={[.3, .3, .3]} geometry={geometries.ring} material={materials.dark} rotation={[0, 0, .65]} />
        {[-.14, .14].map(x => <group key={x}>{cylinder([x, -.04, 0], [.1, .05, .1], materials.londonRed, [0, 0, Math.PI / 2])}</group>)}
      </group>
      {box([.65, .78, .12], [.2, .06, .14], materials.blue)}{box([.66, .83, .12], [.18, .04, .13], materials.londonRed)}
    </>}
    {id === 'chesterfield' && <>
      {box([0, .25, .03], [.86, .3, .78], materials.leather)}
      {box([0, .45, .08], [.66, .12, .62], materials.leather)}
      {box([0, .66, -.33], [.86, .62, .14], materials.leather)}
      {[-.38, .38].map(x => <group key={x}>{cylinder([x, .5, .03], [.18, .78, .18], materials.leather, [Math.PI / 2, 0, 0])}</group>)}
      {[-.24, 0, .24].map(x => [.55, .78].map(y => <group key={`${x}:${y}`}>{sphere([x, y, -.25], [.03, .03, .03], materials.brass)}</group>))}
      {[-.35, .35].map(x => [-.3, .36].map(z => <group key={`${x}:${z}`}>{cylinder([x, .05, z], [.06, .1, .06], materials.walnut)}</group>))}
    </>}
    {id === 'busModel' && <>
      {box([0, .2, 0], [1.6, .4, .6], materials.walnut)}
      <group position={[0, .4, 0]}>
        {box([0, .3, 0], [1.3, .5, .42], materials.londonRed)}
        {box([0, .78, 0], [1.3, .44, .42], materials.londonRed)}
        {[.32, .78].map(y => <group key={y}>{[.215, -.215].map(z => <group key={z}>{box([0, y + .05, z], [1.18, .16, .005], materials.busGlass)}</group>)}</group>)}
        {box([0, .55, 0], [1.32, .04, .44], materials.cream2)}
        {[-.42, .42].map(x => [-.2, .2].map(z => <group key={`${x}:${z}`}>{cylinder([x, .06, z], [.16, .06, .16], materials.black, [Math.PI / 2, 0, 0])}</group>))}
        {box([.66, .62, 0], [.01, .12, .3], materials.lamp)}
      </group>
    </>}
    {id === 'bigBen' && <>
      {box([0, .1, 0], [.8, .2, .8], materials.stone)}
      {box([0, 1, 0], [.5, 1.6, .5], materials.stone)}
      {[-.26, .26].map(x => <group key={x}>{box([x, 1, 0], [.03, 1.6, .54], materials.cream2)}</group>)}
      {box([0, 1.95, 0], [.58, .5, .58], materials.stone)}
      {[[0, .3, 0], [0, -.3, Math.PI], [.3, 0, Math.PI / 2], [-.3, 0, -Math.PI / 2]].map(([x, z, r], i) => <group key={i} position={[x, 1.95, z]} rotation={[0, r, 0]}>
        {cylinder([0, 0, 0], [.36, .02, .36], materials.lamp, [Math.PI / 2, 0, 0])}
        {box([0, .05, .015], [.02, .12, .01], materials.black)}{box([.04, 0, .015], [.09, .02, .01], materials.black)}
      </group>)}
      {box([0, 2.3, 0], [.5, .2, .5], materials.stone)}
      <mesh position={[0, 2.68, 0]} scale={[.5, .6, .5]} geometry={geometries.cone} material={materials.navy} rotation={[0, Math.PI / 4, 0]} />
      {cylinder([0, 3.05, 0], [.03, .2, .03], materials.goldBar)}
    </>}
    {id === 'carSimulator' && <>
      {box([0, .05, 0], [1.8, .1, .9], materials.black)}
      {box([-.3, .35, .1], [.55, .1, .55], materials.carRed)}
      {box([-.3, .7, .35], [.55, .7, .12], materials.carRed, [.2, 0, 0])}
      {box([.2, .45, .05], [.1, .7, .1], materials.steel)}
      <mesh position={[.15, .8, .05]} rotation={[0, Math.PI / 2, .5]} scale={[.42, .42, .42]} geometry={geometries.tire} material={materials.black} />
      {([[-.55, .45], [0, 0], [.55, -.45]] as const).map(([x, r]) => <group key={x} position={[x + .35, 1.1, -.3]} rotation={[0, r - Math.PI / 2, 0]}>
        {box([0, 0, 0], [.55, .34, .04], materials.black)}{box([0, 0, .022], [.5, .3, .005], materials.screen)}
      </group>)}
    </>}
    {id === 'trafficLight' && <>
      {cylinder([0, .04, 0], [.45, .08, .45], materials.dark)}
      {cylinder([0, 1.1, 0], [.08, 2.1, .08], materials.steel)}
      {box([0, 2.25, .08], [.32, .9, .26], materials.black)}
      {[2.52, 2.25, 1.98].map(y => <group key={y}>{cylinder([0, y, .22], [.2, .02, .2], materials.dark, [Math.PI / 2, 0, 0])}</group>)}
      <group ref={lights}>{[[2.52, materials.redLamp], [2.25, materials.amberLamp], [1.98, materials.greenLamp]].map(([y, mat], i) => <mesh key={i} position={[0, y as number, .235]} rotation={[Math.PI / 2, 0, 0]} scale={[.18, .01, .18]} geometry={geometries.cylinder} material={mat as MeshStandardMaterial} />)}</group>
      {box([0, 2.75, .2], [.34, .04, .2], materials.black)}
    </>}
    {id === 'tireStack' && [0, 1, 2, 3].map(i => <mesh key={i} position={[(i % 2) * .03, .17 + i * .3, 0]} rotation={[Math.PI / 2, 0, i * .4]} geometry={geometries.tire} material={materials.black} castShadow={!ghost} receiveShadow />)}
    {id === 'toolCart' && <>
      {box([0, .5, 0], [.8, .8, .5], materials.carRed)}
      {[.25, .45, .65].map(y => <group key={y}>{box([0, y, .255], [.72, .14, .01], materials.dark)}{box([0, y, .27], [.3, .025, .03], materials.chrome)}</group>)}
      {box([0, .92, 0], [.84, .04, .54], materials.black)}
      {[-.3, .3].map(x => [-.18, .18].map(z => <group key={`${x}:${z}`}>{cylinder([x, .05, z], [.1, .06, .1], materials.black, [Math.PI / 2, 0, 0])}</group>))}
      {box([-.15, .97, 0], [.3, .05, .06], materials.chrome, [0, .4, 0])}{box([.2, .96, .05], [.06, .03, .25], materials.yellow)}
    </>}
    {id === 'motorcycle' && <>
      {[-.62, .62].map(x => <mesh key={x} position={[x, .32, 0]} scale={[.8, .8, .5]} geometry={geometries.tire} material={materials.black} castShadow={!ghost} />)}
      {box([0, .55, 0], [.9, .28, .26], materials.carRed)}
      {box([-.15, .78, 0], [.55, .1, .24], materials.black)}
      {box([.25, .75, 0], [.35, .22, .3], materials.carRed)}
      {cylinder([.55, .65, 0], [.05, .65, .05], materials.chrome, [0, 0, -.45])}
      {box([.7, .98, 0], [.05, .05, .6], materials.chrome)}
      {sphere([.74, .82, 0], [.12, .12, .12], materials.lamp)}
      {cylinder([-.35, .4, .16], [.06, .5, .06], materials.chrome, [0, 0, Math.PI / 2 - .2])}
    </>}
    {id === 'sportsCar' && <>
      {box([0, .4, 0], [1.8, .4, 2.8], materials.carRed)}
      {box([0, .72, -.15], [1.5, .34, 1.3], materials.carRed)}
      {box([0, .74, .52], [1.42, .26, .04], materials.busGlass, [-.9, 0, 0])}
      {box([0, .76, -.8], [1.4, .24, .04], materials.busGlass, [.9, 0, 0])}
      {[-.76, .76].map(x => <group key={x}>{box([x, .74, -.15], [.02, .26, 1.1], materials.busGlass)}</group>)}
      {[-.86, .86].map(x => [-.95, .95].map(z => <mesh key={`${x}:${z}`} position={[x, .3, z]} rotation={[0, Math.PI / 2, 0]} scale={[.8, .8, .9]} geometry={geometries.tire} material={materials.black} castShadow={!ghost} />))}
      {[-.6, .6].map(x => <group key={x}>{box([x, .48, 1.41], [.32, .08, .02], materials.lamp)}{box([x, .5, -1.41], [.36, .06, .02], materials.redLamp)}</group>)}
      {box([0, .62, -1.35], [1.6, .04, .2], materials.black)}
      {box([0, .3, 1.42], [1.2, .1, .02], materials.chrome)}
      {active && !ghost && <spotLight position={[0, .5, 1.45]} angle={.5} intensity={6} distance={7} color="#fff1c9" />}
    </>}
    {id === 'diningTable' && <>
      {box([0, .74, 0], [1.85, .06, .9], materials.oak)}
      {[-.8, .8].map(x => [-.35, .35].map(z => <group key={`${x}:${z}`}>{box([x, .37, z], [.07, .74, .07], materials.oak)}</group>))}
      {[-.55, 0, .55].map(x => <group key={x}>{cylinder([x, .78, .22], [.22, .015, .22], materials.white)}{cylinder([x, .78, -.22], [.22, .015, .22], materials.white)}</group>)}
      {cylinder([0, .85, 0], [.2, .14, .2], materials.cream)}
      {sphere([0, .98, 0], [.24, .16, .24], materials.green)}
      {[-.12, .12].map(x => <group key={x}>{cylinder([x, .88, 0], [.03, .2, .03], materials.cream2)}</group>)}
    </>}
    {id === 'gameTable' && <>
      {cylinder([0, .5, 0], [.85, .05, .85], materials.walnut)}
      {cylinder([0, .25, 0], [.1, .5, .1], materials.walnut)}
      {box([0, .53, 0], [.5, .015, .5], materials.cream2)}
      {[[-.12, -.12, materials.red], [.12, .08, materials.blue], [-.05, .15, materials.green], [.15, -.15, materials.gold]].map(([x, z, mat], i) => <group key={i}>{cylinder([x as number, .57, z as number], [.04, .06, .04], mat as MeshStandardMaterial)}</group>)}
      {box([.3, .56, .25], [.06, .06, .06], materials.white, [0, .5, 0])}{box([-.3, .55, -.25], [.2, .04, .14], materials.coral)}
    </>}
    {id === 'beanBags' && [[-.45, materials.teal], [.45, materials.mustard]].map(([x, mat], i) => <group key={i} position={[x as number, 0, 0]} rotation={[0, i ? -.4 : .4, 0]}>
      {sphere([0, .28, 0], [.8, .55, .75], mat as MeshStandardMaterial)}
      {sphere([0, .5, -.22], [.7, .5, .35], mat as MeshStandardMaterial)}
    </group>)}
    {id === 'karaoke' && <>
      {cylinder([0, .04, 0], [.4, .06, .4], materials.dark)}
      {cylinder([0, .75, 0], [.03, 1.45, .03], materials.chrome)}
      {cylinder([0, 1.5, .06], [.05, .2, .05], materials.dark, [.4, 0, 0])}
      {sphere([0, 1.6, .1], [.1, .1, .1], materials.steel)}
      {box([.3, .3, -.15], [.3, .6, .3], materials.black)}
      {cylinder([.3, .38, .0], [.2, .02, .2], materials.dark, [Math.PI / 2, 0, 0])}
      {box([-.25, .6, -.2], [.4, .26, .03], materials.black, [-.3, 0, 0])}{box([-.25, .6, -.18], [.36, .22, .01], materials.lamp, [-.3, 0, 0])}
    </>}
    {id === 'pingPong' && <>
      {box([0, .74, 0], [1.5, .04, 2.74], materials.tableGreen)}
      {box([0, .762, 0], [.02, .005, 2.7], materials.netWhite)}
      {[-.74, .74].map(x => <group key={x}>{box([x, .762, 0], [.02, .005, 2.74], materials.netWhite)}</group>)}
      {box([0, .84, 0], [1.6, .15, .01], materials.netWhite)}
      {[-.6, .6].map(x => [-1.1, 1.1].map(z => <group key={`${x}:${z}`}>{box([x, .36, z], [.06, .72, .06], materials.dark)}</group>))}
      {cylinder([.3, .78, .7], [.15, .02, .15], materials.red)}{box([.3, .78, .82], [.03, .02, .12], materials.walnut)}
      {sphere([-.2, .8, -.4], [.04, .04, .04], materials.white)}
    </>}
    {id === 'fireplace' && <>
      {box([0, .6, -.2], [1.9, 1.2, .5], materials.brick)}
      {box([0, 1.24, -.15], [2, .08, .62], materials.walnut)}
      {box([0, .45, .02], [1, .7, .1], materials.black)}
      {box([0, .14, .25], [1.4, .1, .4], materials.stone)}
      {[-.15, .1].map(x => <group key={x}>{cylinder([x, .2, .04], [.08, .5, .08], materials.chestWood, [0, .3, Math.PI / 2])}</group>)}
      <group ref={flame} position={[0, .22, .05]}>{[-.15, 0, .15].map((x, i) => <mesh key={i} position={[x, .15, 0]} scale={[.16, .3 + (i === 1 ? .1 : 0), .1]} geometry={geometries.sphere} material={materials.fire} />)}</group>
      {active && !ghost && <pointLight position={[0, .5, .5]} intensity={3} distance={5} color="#ff9a4a" />}
      {[[-.6, materials.white], [.55, materials.cream2]].map(([x, mat], i) => <group key={i}>{box([x as number, 1.42, -.2], [.18, .28, .04], mat as MeshStandardMaterial)}</group>)}
    </>}
    {id === 'easel' && <>
      {box([-.28, .9, .15], [.05, 1.8, .05], materials.oak, [-.12, 0, .12])}
      {box([.28, .9, .15], [.05, 1.8, .05], materials.oak, [-.12, 0, -.12])}
      {box([0, .85, -.3], [.05, 1.7, .05], materials.oak, [.3, 0, 0])}
      {box([0, .72, .22], [.7, .04, .1], materials.oak)}
      {box([0, 1.15, .2], [.7, .8, .03], materials.canvasWhite, [-.12, 0, 0])}
      {[[-.15, 1.25, materials.blue, .3], [.12, 1.05, materials.coral, .25], [0, 1.3, materials.mustard, .18], [-.1, .95, materials.teal, .22]].map(([x, y, mat, r], i) => <group key={i}>{sphere([x as number, y as number, .225], [r as number, (r as number) * .7, .01], mat as MeshStandardMaterial)}</group>)}
      {box([.15, .76, .3], [.25, .02, .12], materials.white)}
    </>}
    {id === 'guitar' && <>
      {box([0, .04, 0], [.4, .04, .3], materials.black)}
      {box([0, .45, -.12], [.04, .85, .04], materials.black, [-.2, 0, 0])}
      <group position={[0, .1, .05]} rotation={[-.2, 0, 0]}>
        {sphere([0, .32, 0], [.42, .4, .12], materials.guitarWood)}
        {sphere([0, .6, 0], [.32, .3, .11], materials.guitarWood)}
        {cylinder([0, .5, .06], [.1, .01, .1], materials.black, [Math.PI / 2, 0, 0])}
        {box([0, 1.0, .02], [.06, .6, .03], materials.walnut)}
        {box([0, 1.35, .02], [.1, .14, .03], materials.walnut)}
        {box([0, .24, .065], [.14, .03, .01], materials.walnut)}
      </group>
    </>}
    {id === 'potteryWheel' && <>
      {box([0, .25, 0], [.6, .5, .6], materials.white)}
      {box([0, .45, .35], [.8, .04, .3], materials.white)}
      <group ref={wheel} position={[0, .54, 0]}>
        {cylinder([0, 0, 0], [.42, .04, .42], materials.steel)}
        {cylinder([0, .14, 0], [.2, .24, .2], materials.clay)}
        {cylinder([0, .28, 0], [.14, .06, .14], materials.clay)}
        {box([.1, .14, .1], [.02, .2, .02], materials.dark)}
      </group>
      {cylinder([-.35, .1, -.3], [.24, .2, .24], materials.steel)}
    </>}
    {id === 'craftTable' && <>
      {box([0, .74, 0], [1.8, .05, .8], materials.oak)}
      {[-.82, .82].map(x => [-.33, .33].map(z => <group key={`${x}:${z}`}>{box([x, .37, z], [.06, .74, .06], materials.oak)}</group>))}
      {box([-.4, .78, 0], [.7, .02, .5], materials.tableGreen)}
      {[[.3, .1, materials.coral], [.45, -.1, materials.purple], [.6, .12, materials.mustard], [.42, .22, materials.teal]].map(([x, z, mat], i) => <group key={i}>{sphere([x as number, .84, z as number], [.12, .12, .12], mat as MeshStandardMaterial)}</group>)}
      {box([-.5, .8, -.05], [.3, .01, .2], materials.canvasWhite, [0, .3, 0])}
      {box([-.2, .8, .1], [.02, .01, .3], materials.steel, [0, -.5, 0])}
      {cylinder([.75, .82, -.25], [.08, .14, .08], materials.glass)}
      {[-.02, .02].map(x => <group key={x}>{cylinder([.75 + x, .9, -.25], [.012, .22, .012], materials.walnut, [0, 0, x * 5])}</group>)}
    </>}
    {id === 'piano' && <>
      {box([0, .6, -.15], [1.6, 1.2, .5], materials.pianoBlack)}
      {box([0, .72, .2], [1.5, .06, .25], materials.pianoBlack)}
      {box([0, .76, .2], [1.4, .02, .2], materials.keyWhite)}
      {Array.from({ length: 20 }, (_, i) => i % 7 === 2 || i % 7 === 6 ? null : <group key={i}>{box([-.66 + i * .07, .785, .14], [.035, .025, .1], materials.pianoBlack)}</group>)}
      {[-.7, .7].map(x => <group key={x}>{box([x, .36, .22], [.08, .72, .08], materials.pianoBlack)}</group>)}
      {box([0, 1.0, .1], [.5, .3, .02], materials.canvasWhite, [-.25, 0, 0])}
      {box([0, .02, .3], [.5, .03, .3], materials.pianoBlack)}
      {active && !ghost && <pointLight position={[0, 1.4, .3]} intensity={1.6} distance={3} color="#ffe2a8" />}
    </>}
    {id === 'telescope' && <>
      {[0, 2, 4].map(i => <group key={i} rotation={[0, i * Math.PI / 3, 0]}>{box([.2, .5, 0], [.04, 1.05, .04], materials.walnut, [0, 0, -.3])}</group>)}
      {cylinder([0, 1, 0], [.12, .08, .12], materials.dark)}
      <group ref={scope} position={[0, 1.08, 0]}>
        <group rotation={[0, 0, .7]}>
          {cylinder([0, .1, 0], [.16, .95, .16], materials.navy)}
          {cylinder([0, .58, 0], [.2, .08, .2], materials.brass)}
          {cylinder([0, -.38, 0], [.06, .14, .06], materials.brass)}
          {cylinder([.1, .2, 0], [.04, .3, .04], materials.navy, [0, 0, .02])}
        </group>
      </group>
    </>}
    {id === 'standingDesk' && <>
      {box([0, 1.08, 0], [1.8, .05, .75], materials.oak)}
      {[-.7, .7].map(x => <group key={x}>{box([x, .54, 0], [.08, 1.06, .08], materials.dark)}{box([x, .03, 0], [.12, .06, .65], materials.dark)}</group>)}
      {box([0, 1.36, -.25], [.7, .4, .03], materials.black)}{box([0, 1.36, -.235], [.66, .36, .005], materials.screen)}
      {box([0, 1.12, .1], [.45, .02, .15], materials.dark)}
      {box([.6, 1.13, .1], [.25, .04, .18], materials.sticky1)}
      {cylinder([-.6, 1.16, .15], [.08, .12, .08], materials.corkBlue)}
      {box([0, .02, .55], [.6, .03, .4], materials.dark)}
    </>}
    {id === 'kanbanBoard' && <>
      {box([0, 1.15, 0], [1.7, 1.1, .05], materials.boardWhite)}
      {box([0, 1.15, -.03], [1.78, 1.18, .03], materials.steel)}
      {[-.28, .28].map(x => <group key={x}>{box([x, 1.15, .03], [.015, 1, .005], materials.dark)}</group>)}
      {[[-.56, [1.45, 1.27, 1.09, .91], materials.sticky1], [0, [1.45, 1.27, 1.09], materials.sticky3], [.56, [1.45, 1.27], materials.sticky2]].map(([x, ys, mat], col) => <group key={col}>{(ys as number[]).map((y, i) => <group key={i}>{box([(x as number) + (i % 2 ? .06 : -.06), y, .035], [.2, .14, .006], mat as MeshStandardMaterial, [0, 0, (i % 3 - 1) * .05])}</group>)}</group>)}
      {[-.75, .75].map(x => <group key={x}>{box([x, .3, 0], [.05, .6, .05], materials.steel)}{box([x, .04, 0], [.08, .05, .55], materials.steel)}{cylinder([x, .03, .22], [.06, .04, .06], materials.black, [Math.PI / 2, 0, 0])}</group>)}
      {box([0, .6, .04], [1.4, .04, .08], materials.steel)}
    </>}
    {id === 'hourglass' && <>
      {cylinder([0, .32, 0], [.45, .64, .45], materials.walnut)}
      <group ref={sand} position={[0, .95, 0]}>
        {cylinder([0, -.27, 0], [.42, .05, .42], materials.walnut)}{cylinder([0, .27, 0], [.42, .05, .42], materials.walnut)}
        {[-.17, .17].map(x => [-.17, .17].map(z => <group key={`${x}:${z}`}>{cylinder([x, 0, z], [.03, .54, .03], materials.walnut)}</group>))}
        <mesh position={[0, .12, 0]} scale={[.3, .26, .3]} geometry={geometries.cone} material={materials.glass} rotation={[Math.PI, 0, 0]} />
        <mesh position={[0, -.12, 0]} scale={[.3, .26, .3]} geometry={geometries.cone} material={materials.glass} />
        {cylinder([0, -.2, 0], [.22, .08, .22], materials.sandGold)}{cylinder([0, .17, 0], [.12, .06, .12], materials.sandGold)}
      </group>
    </>}
    {id === 'filingCabinet' && <>
      {box([0, .7, 0], [.55, 1.4, .65], materials.corkBlue)}
      {[.25, .6, .95, 1.3].map(y => <group key={y}>{box([0, y, .33], [.5, .3, .02], materials.steel)}{box([0, y + .05, .35], [.18, .03, .03], materials.chrome)}{box([0, y - .06, .345], [.14, .05, .005], materials.white)}</group>)}
      {box([0, 1.42, .05], [.3, .04, .22], materials.sticky1, [0, .3, 0])}
    </>}
    {id === 'trophyCase' && <>
      {box([0, .45, 0], [1.8, .9, .5], materials.walnut)}
      {box([0, 1.3, -.2], [1.8, .8, .04], materials.walnut)}
      {box([0, 1.72, 0], [1.84, .05, .52], materials.walnut)}
      {box([0, 1.3, .24], [1.8, .8, .01], materials.glass)}
      {[[-.6, materials.goldBar, .32], [-.15, materials.steel, .26], [.3, materials.bronze, .22], [.65, materials.goldBar, .28]].map(([x, mat, h], i) => <group key={i} position={[x as number, .92, 0]}>
        {box([0, .04, 0], [.16, .08, .16], materials.black)}
        {cylinder([0, .12, 0], [.03, .1, .03], mat as MeshStandardMaterial)}
        <mesh position={[0, .17 + (h as number) / 2, 0]} scale={[(h as number) * .7, h as number, (h as number) * .7]} geometry={geometries.cone} material={mat as MeshStandardMaterial} rotation={[Math.PI, 0, 0]} />
      </group>)}
      {box([0, .55, .26], [1.6, .06, .01], materials.goldBar)}
    </>}
    {id === 'gong' && <>
      {[-.42, .42].map(x => <group key={x}>{box([x, .8, 0], [.08, 1.6, .08], materials.chestWood)}{box([x, .04, 0], [.14, .08, .5], materials.chestWood)}</group>)}
      {box([0, 1.62, 0], [1, .1, .1], materials.chestWood)}
      <group ref={gongDisc} position={[0, 1.55, 0]}>
        {[-.15, .15].map(x => <group key={x}>{box([x, -.08, 0], [.01, .16, .01], materials.dark)}</group>)}
        {cylinder([0, -.52, 0], [.72, .04, .72], materials.brass, [Math.PI / 2, 0, 0])}
        {cylinder([0, -.52, .02], [.25, .02, .25], materials.goldBar, [Math.PI / 2, 0, 0])}
      </group>
      {box([.3, .5, .3], [.04, .5, .04], materials.walnut, [0, 0, .5])}{sphere([.42, .74, .3], [.1, .1, .1], materials.cream)}
    </>}
  </group>;
}
