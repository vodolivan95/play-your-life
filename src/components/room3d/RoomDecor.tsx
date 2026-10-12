import { Component, Suspense, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import { Box3, CanvasTexture, Mesh, SRGBColorSpace, Vector3 } from 'three';
import type { Vec3 } from '../../roomEngine';
import { decorUrl } from './assetSlots';

/** Данные сферы для постоянного оформления комнаты: экран, полка наград, неон. */
export type RoomStats = {
  title: string;
  level: number;
  levelProgress: number;
  weekXp: number;
  weekDone: number;
  streak: number;
  trophies: number;
  tasks: { id: string; name: string; xp: number }[];
};

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Decor({ url, position, height, rotation = 0 }: { url: string; position: Vec3; height: number; rotation?: number }) {
  const { scene } = useGLTF(url);
  const copy = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new Box3().setFromObject(clone), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const fit = height / Math.max(size.y, 0.001);
    clone.scale.setScalar(fit);
    clone.position.set(-center.x * fit, -bounds.min.y * fit, -center.z * fit);
    clone.traverse((node) => { if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    return clone;
  }, [scene, height]);
  return <group position={position} rotation={[0, rotation, 0]}><primitive object={copy} dispose={null} /></group>;
}

/** Неоновая надпись: холст с текстом и свечением, яркость растёт с уровнем сферы. */
function Neon({ text, color, level, position }: { text: string; color: string; level: number; position: Vec3 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'italic 900 150px Manrope, "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [blur, alpha] of [[48, 0.6], [22, 0.8], [6, 1]] as const) {
      ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.globalAlpha = alpha;
      ctx.fillStyle = blur === 6 ? '#fff8e8' : color; ctx.fillText(text, 512, 132);
    }
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; return map;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const glow = 0.5 + Math.min(1, level / 100) * 2.2;
  return <mesh position={position} rotation={[0, Math.PI / 2, 0]}>
    <planeGeometry args={[2.6, 0.65]} />
    <meshBasicMaterial map={texture} transparent toneMapped={false} color={[glow, glow, glow]} depthWrite={false} />
  </mesh>;
}

/** Экран на стене: реальные цифры сферы и ближайшие задания с кнопкой «Выполнить». */
function StatsScreen({ stats, onComplete, position }: { stats: RoomStats; onComplete?: (id: string) => void; position: Vec3 }) {
  return <group position={position} rotation={[0, Math.PI / 2, 0]}>
    <mesh position={[0, 0, -0.03]}><boxGeometry args={[2.5, 1.5, 0.05]} /><meshStandardMaterial color="#0b1120" metalness={0.6} roughness={0.35} /></mesh>
    <mesh position={[0, 0, -0.002]}><planeGeometry args={[2.4, 1.4]} /><meshStandardMaterial color="#06182b" emissive="#0a3a66" emissiveIntensity={0.6} /></mesh>
    <Html transform distanceFactor={1.2} position={[0, 0, 0.01]} className="room3d-screen-html" zIndexRange={[20, 0]}>
      <div className="room3d-screen">
        <header><strong>{stats.title}</strong><span>LVL {stats.level} / 100</span></header>
        <i className="room3d-screen-bar"><b style={{ width: `${Math.round(stats.levelProgress)}%` }} /></i>
        <dl>
          <div><dt>XP за неделю</dt><dd>{stats.weekXp}</dd></div>
          <div><dt>Выполнено</dt><dd>{stats.weekDone}</dd></div>
          <div><dt>Серия</dt><dd>{stats.streak} дн.</dd></div>
        </dl>
        <h3>Задания</h3>
        {stats.tasks.length ? <ul>{stats.tasks.map(task => <li key={task.id}>
          <span>{task.name}</span><small>+{task.xp} XP</small>
          {onComplete && <button type="button" onClick={(event) => { event.stopPropagation(); onComplete(task.id); }}>Выполнить</button>}
        </li>)}</ul> : <p>Все задания на сегодня выполнены</p>}
      </div>
    </Html>
  </group>;
}

/** Полка наград на деревянной стене: кубков столько, сколько реальных наград сферы. */
function TrophyShelf({ count, position }: { count: number; position: Vec3 }) {
  const shown = Math.min(12, count);
  const shelves = [0, 0.55, 1.1];
  return <group position={position}>
    {shelves.map(y => <mesh key={y} position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[0.3, 0.04, 2.6]} /><meshStandardMaterial color="#3a2a1d" roughness={0.6} /></mesh>)}
    {shelves.map(y => <mesh key={`led-${y}`} position={[0.13, y - 0.03, 0]}><boxGeometry args={[0.02, 0.012, 2.5]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffb456" emissiveIntensity={2} /></mesh>)}
    {Array.from({ length: shown }, (_, i) => {
      const shelf = Math.floor(i / 4), slot = i % 4;
      return <Decor key={i} url={decorUrl('trophy')} height={0.3 + (i % 3) * 0.06} position={[0, shelves[shelf] + 0.02, -0.95 + slot * 0.63]} rotation={-Math.PI / 2} />;
    })}
    {shown === 0 && <Html transform distanceFactor={1.2} position={[0.16, 0.25, 0]} rotation={[0, Math.PI / 2, 0]}><p className="room3d-shelf-empty">Здесь появятся кубки за цели и достижения</p></Html>}
  </group>;
}

export default function RoomDecor({ stats, onComplete }: { stats?: RoomStats; onComplete?: (id: string) => void }) {
  if (!stats) return null;
  return <Boundary><Suspense fallback={null}>
    <StatsScreen stats={stats} onComplete={onComplete} position={[-5.8, 2.55, 1.15]} />
    <TrophyShelf count={stats.trophies} position={[-5.82, 1.25, -2.55]} />
    <Neon text="NO LIMITS" color="#ffb347" level={stats.level} position={[-5.8, 3.65, -2.55]} />
    <Decor url={decorUrl('plant')} height={1.25} position={[-5.72, 0, -4.62]} />
    <Decor url={decorUrl('plant')} height={1.0} position={[5.7, 0, -4.62]} rotation={1.2} />
    <Decor url={decorUrl('plant')} height={0.9} position={[-5.72, 0, 4.55]} rotation={2.4} />
  </Suspense></Boundary>;
}
