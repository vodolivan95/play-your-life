import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
/** A separate 3D screen surface; currently fitted to the placeholder treadmill console. */
export default function SportsDisplay({ active }: { active: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#041c2c'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = active ? '#7de9ff' : '#346d86'; ctx.font = 'bold 36px sans-serif'; ctx.fillText('SPORT', 24, 50);
    ctx.font = '18px sans-serif'; ctx.fillText(active ? 'WORKOUT  •  READY' : 'TOUCH TO START', 24, 85);
    ctx.font = 'bold 64px sans-serif'; ctx.fillText(active ? '0.0' : '—', 24, 165);
    ctx.font = '16px sans-serif'; ctx.fillText('KM/H', 28, 194);
    ctx.strokeStyle = '#37d9fa'; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 200; x < 490; x++) { const y = 155 + Math.sin(x * .035) * 4 + (x % 70 > 50 ? Math.sin(x * .42) * 27 : 0); if (x === 200) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; return map;
  }, [active]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[0, 1.555, -.81]} rotation={[-Math.PI / 2 - .3, 0, 0]}><planeGeometry args={[.72, .3]} /><meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={active ? 1.4 : .3} roughness={.28} metalness={.1} /></mesh>;
}
