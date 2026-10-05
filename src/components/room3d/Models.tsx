import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BoxGeometry, CylinderGeometry, SphereGeometry, MeshStandardMaterial, Group } from 'three';
import type { ObjectId, Vec3 } from '../../roomEngine';

function GLB({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const copy = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={copy} />;
}
export default function Model3D({ id, ghost, active = false, reduced = false, assetUrl }: {
  id: ObjectId; ghost?: 'valid' | 'invalid'; active?: boolean; reduced?: boolean; assetUrl?: string;
}) {
  const plant = useRef<Group>(null);
  const geometries = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(.5, .5, 1, 12), sphere: new SphereGeometry(.5, 16, 12) }), []);
  const materials = useMemo(() => {
    const make = (color: string, metalness = 0, roughness = .65) => new MeshStandardMaterial({ color: ghost ? ghost === 'valid' ? '#57caff' : '#ff7777' : color, metalness, roughness, transparent: !!ghost, opacity: ghost ? .45 : 1, depthWrite: !ghost });
    return { dark: make('#202731', .6, .35), steel: make('#a5afba', .85, .25), fabric: make('#36556d', 0, .9), rubber: make('#242d3b', 0, .9), leaf: make('#417858', 0, .8), wood: make('#b09072'), ball: make('#5c9daa', .15, .38), screen: new MeshStandardMaterial({ color: active ? '#69ebff' : '#142d3c', emissive: active ? '#23d6ee' : '#081421', emissiveIntensity: active ? 1 : .15, transparent: !!ghost, opacity: ghost ? .45 : 1 }) };
  }, [ghost, active]);
  useEffect(() => () => { Object.values(materials).forEach(material => material.dispose()); }, [materials]);
  useEffect(() => () => { Object.values(geometries).forEach(geometry => geometry.dispose()); }, [geometries]);
  useFrame(({ clock }) => { if (plant.current && !reduced) plant.current.rotation.z = Math.sin(clock.elapsedTime * .6) * .012; });
  const box = (pos: Vec3, size: Vec3, mat = materials.dark, rotation: Vec3 = [0, 0, 0]) => <mesh position={pos} scale={size} rotation={rotation} geometry={geometries.box} material={mat} castShadow={!ghost} receiveShadow />;
  const cylinder = (pos: Vec3, size: Vec3, mat = materials.steel, rotation: Vec3 = [0, 0, 0]) => <mesh position={pos} scale={size} rotation={rotation} geometry={geometries.cylinder} material={mat} castShadow={!ghost} receiveShadow />;
  if (assetUrl && !ghost) return <GLB url={assetUrl} />;
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
      {box([0, .19, .15], [1.35, .22, 2.35], materials.steel)}
      {box([0, .32, .25], [.95, .06, 1.9], materials.rubber)}
      {[-.59, .59].map(x => <group key={x}>{box([x, .75, -.9], [.1, 1.2, .1], materials.steel, [-.15, 0, 0])}{box([x, 1.05, -.35], [.1, .1, 1.3], materials.dark)}</group>)}
      {box([0, 1.4, -1], [1.2, .3, .42], materials.dark, [-.3, 0, 0])}
      {box([0, 1.5, -.82], [.6, .03, .25], materials.screen, [-.3, 0, 0])}
      {box([0, 1.22, -.57], [1.2, .09, .09], materials.dark)}
    </>}
  </group>;
}
