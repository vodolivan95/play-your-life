import { Component, Suspense, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { ObjectId } from '../../roomEngine';
import { objectSpec } from '../../roomEngine';
import Model3D from './Models';
import { assetUrl } from './assetSlots';
class AssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function Asset({ id, url, ghost }: { id: ObjectId; url: string; ghost?: 'valid' | 'invalid' }) {
  // Drei/GLTFLoader handles glTF PBR and Meshopt. Draco exports need a local decoder (see asset guide).
  const { scene } = useGLTF(url, `${import.meta.env.BASE_URL}decoders/draco/`, true);
  const copy = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(node => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = !ghost; node.receiveShadow = true;
      const materials = (Array.isArray(node.material) ? node.material : [node.material]).map(source => {
        const material = source.clone();
        if (ghost) { material.transparent = true; material.opacity = .4; material.depthWrite = false; if (material instanceof MeshStandardMaterial) { material.color.set(ghost === 'valid' ? '#69d9ff' : '#ff737e'); material.emissive.copy(material.color); material.emissiveIntensity = .15; } }
        return material;
      });
      node.material = Array.isArray(node.material) ? materials : materials[0];
    });
    const bounds = new Box3().setFromObject(clone), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const footprint = objectSpec(id).size;
    const fit = Math.min(1, (footprint[0] - .05) / Math.max(.01, size.x), (footprint[1] - .05) / Math.max(.01, size.z));
    clone.position.set((clone.position.x - center.x) * fit, (clone.position.y - bounds.min.y) * fit, (clone.position.z - center.z) * fit); clone.scale.multiplyScalar(fit);
    return clone;
  }, [scene, ghost, id]);
  useEffect(() => () => copy.traverse(node => { if (node instanceof Mesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => material.dispose()); }), [copy]);
  return <primitive object={copy} dispose={null} />;
}
export default function RoomItemRenderer({ id, ghost, active, reduced }: { id: ObjectId; ghost?: 'valid' | 'invalid'; active?: boolean; reduced?: boolean }) {
  const url = assetUrl(id);
  const fallback = <Model3D id={id} ghost={ghost} active={active} reduced={reduced} />;
  return url ? <AssetBoundary key={url} fallback={fallback}><Suspense fallback={fallback}><Asset id={id} url={url} ghost={ghost} /></Suspense></AssetBoundary> : fallback;
}
