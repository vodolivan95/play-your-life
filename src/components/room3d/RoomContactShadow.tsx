import { useEffect, useMemo } from 'react';
import { CanvasTexture } from 'three';
/** Cheap, static ambient contact approximation for LOW; not a dynamic shadow map. */
export default function RoomContactShadow({ size }: { size: [number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(0,0,0,0.8)'); gradient.addColorStop(.4, 'rgba(0,0,0,0.4)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[0, -.003, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[size[0] * .9, size[1] * .9]} /><meshBasicMaterial map={texture} color="#000000" transparent opacity={.35} depthWrite={false} /></mesh>;
}
