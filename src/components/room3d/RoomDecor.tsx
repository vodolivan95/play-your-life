import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Box3, CanvasTexture, DoubleSide, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { MeshBasicMaterial } from 'three';
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

function Decor({ url, position, height, rotation = 0, ghost = false }: { url: string; position: Vec3; height: number; rotation?: number; ghost?: boolean }) {
  const { scene } = useGLTF(url);
  const copy = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new Box3().setFromObject(clone), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const fit = height / Math.max(size.y, 0.001);
    clone.scale.setScalar(fit);
    clone.position.set(-center.x * fit, -bounds.min.y * fit, -center.z * fit);
    clone.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = !ghost; node.receiveShadow = true;
      if (ghost) node.material = new MeshStandardMaterial({ color: '#8fb8ff', transparent: true, opacity: 0.16, emissive: '#3f7dff', emissiveIntensity: 0.4, depthWrite: false });
    });
    return clone;
  }, [scene, height, ghost]);
  return <group position={position} rotation={[0, rotation, 0]}><primitive object={copy} dispose={null} /></group>;
}

/** Неоновая надпись: холст с текстом и свечением, яркость растёт с уровнем сферы. */
function Neon({ text, color, level, position }: { text: string; color: string; level: number; position: Vec3 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'italic 900 150px "Manrope Variable", Manrope, "Arial Black", sans-serif';
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
    <mesh position={[0, 0, -0.03]}><boxGeometry args={[1.95, 1.2, 0.05]} /><meshStandardMaterial color="#0b1120" metalness={0.6} roughness={0.35} /></mesh>
    <mesh position={[0, 0, -0.002]}><planeGeometry args={[1.88, 1.12]} /><meshStandardMaterial color="#06182b" emissive="#0a3a66" emissiveIntensity={0.6} /></mesh>
    <Html transform distanceFactor={0.96} position={[0, 0, 0.01]} className="room3d-screen-html" zIndexRange={[20, 0]}>
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

/** Стеллаж наград: настоящие кубки за цели и этапы, пустые ячейки — полупрозрачные «будущие» кубки. */
function TrophyCase({ filled, offset, position }: { filled: number; offset: number; position: Vec3 }) {
  const shelves = [0.45, 0.95, 1.45, 1.95, 2.45];
  const slots = 3;
  return <group position={position}>
    <mesh position={[-0.02, 1.45, 0]} castShadow receiveShadow><boxGeometry args={[0.36, 2.9, 1.6]} /><meshStandardMaterial color="#141210" roughness={0.55} metalness={0.3} /></mesh>
    <mesh position={[0.165, 1.45, 0]}><boxGeometry args={[0.01, 2.8, 1.5]} /><meshStandardMaterial color="#1c1814" roughness={0.8} /></mesh>
    {shelves.map((y) => <group key={y}>
      <mesh position={[0.18, y, 0]} castShadow receiveShadow><boxGeometry args={[0.32, 0.035, 1.5]} /><meshStandardMaterial color="#3a2a1d" roughness={0.5} /></mesh>
      <mesh position={[0.33, y - 0.025, 0]}><boxGeometry args={[0.012, 0.012, 1.46]} /><meshStandardMaterial color="#ffe0b0" emissive="#ffb456" emissiveIntensity={3} toneMapped={false} /></mesh>
      {Array.from({ length: slots }, (_, k) => {
        const index = offset + (shelves.indexOf(y) * slots) + k;
        return <Decor key={k} url={decorUrl('trophy')} ghost={index >= filled} height={0.26 + ((index * 7) % 3) * 0.05} position={[0.2, y + 0.018, -0.48 + k * 0.48]} rotation={-Math.PI / 2} />;
      })}
    </group>)}
    <pointLight position={[0.6, 2.2, 0]} color="#ffbf73" intensity={2.2} distance={3.5} decay={2} />
    <Decor url={decorUrl('plant')} height={0.55} position={[0.15, 2.9, 0.45]} />
  </group>;
}

/** Голограмма бегущего человека: 16 кадров бега на холсте, голубое свечение, сканлинии и луч проектора. */
function Hologram({ position, reduced }: { position: Vec3; reduced?: boolean }) {
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 512; return c; }, []);
  const texture = useMemo(() => { const t = new CanvasTexture(canvas); t.colorSpace = SRGBColorSpace; return t; }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const phase = useRef(0), last = useRef(-1);
  const screen = useRef<MeshBasicMaterial>(null);
  const draw = (t: number) => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 512);
    // сетка и рамка
    ctx.strokeStyle = 'rgba(80,190,255,0.18)'; ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(320, y); ctx.stroke(); }
    for (let x = 0; x < 320; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(110,210,255,0.8)'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, 308, 500);
    // бегущий человек: простая кинематика ног и рук
    const a = t * Math.PI * 2;
    const hip = { x: 160, y: 250 + Math.abs(Math.sin(a)) * -10 }, chest = { x: 172, y: hip.y - 95 }, head = { x: 182, y: chest.y - 42 };
    const limb = (from: { x: number; y: number }, l1: number, l2: number, ang1: number, ang2: number) => {
      const knee = { x: from.x + Math.sin(ang1) * l1, y: from.y + Math.cos(ang1) * l1 };
      const foot = { x: knee.x + Math.sin(ang1 - ang2) * l2, y: knee.y + Math.cos(ang1 - ang2) * l2 };
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [width, color, blur] of [[22, 'rgba(60,170,255,0.35)', 24], [10, 'rgba(150,225,255,0.95)', 8]] as const) {
      ctx.lineWidth = width; ctx.strokeStyle = color; ctx.shadowColor = '#3fb6ff'; ctx.shadowBlur = blur;
      limb(hip, 88, 88, Math.sin(a) * 0.75, Math.max(0, Math.sin(a + 1.4)) * 1.4 + 0.1);
      limb(hip, 88, 88, Math.sin(a + Math.PI) * 0.75, Math.max(0, Math.sin(a + Math.PI + 1.4)) * 1.4 + 0.1);
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(chest.x, chest.y); ctx.stroke();
      limb(chest, 58, 55, Math.PI + Math.sin(a + Math.PI) * 0.9, -1.6);
      limb(chest, 58, 55, Math.PI + Math.sin(a) * 0.9, -1.6);
      ctx.beginPath(); ctx.arc(head.x, head.y, 22, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // сканлинии
    ctx.fillStyle = 'rgba(0,10,30,0.25)';
    for (let y = (t * 120) % 6; y < 512; y += 6) ctx.fillRect(0, y, 320, 2);
    ctx.fillStyle = 'rgba(140,220,255,0.9)'; ctx.font = 'bold 22px "Manrope Variable", Manrope, sans-serif'; ctx.fillText('RUN · 12.4 KM/H', 22, 480);
    // Текстура — ресурс GPU: новый кадр отмечается через материал, а не через значение React.
    const map = screen.current?.map;
    if (map) map.needsUpdate = true;
  };
  useFrame((_, dt) => {
    if (reduced && last.current >= 0) return;
    phase.current = (phase.current + dt * 0.9) % 1;
    const frame = Math.floor(phase.current * 16);
    if (frame !== last.current) { last.current = frame; draw(frame / 16); }
  });
  return <group position={position} rotation={[0, Math.PI / 2, 0]}>
    <mesh position={[0, 0, -0.04]}><boxGeometry args={[1.7, 2.7, 0.06]} /><meshStandardMaterial color="#05101c" metalness={0.7} roughness={0.25} /></mesh>
    <mesh position={[0, 0, -0.005]}><planeGeometry args={[1.6, 2.6]} /><meshBasicMaterial color="#082a4a" toneMapped={false} /></mesh>
    <mesh position={[0, 0, 0.01]}><planeGeometry args={[1.6, 2.6]} /><meshBasicMaterial ref={screen} map={texture} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    {[-0.83, 0.83].map((x) => <mesh key={x} position={[x, 0, 0.01]}><boxGeometry args={[0.02, 2.7, 0.02]} /><meshStandardMaterial color="#9fe0ff" emissive="#3fb6ff" emissiveIntensity={4} toneMapped={false} /></mesh>)}
    <mesh position={[0, -1.6, 0.35]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.32, 32]} /><meshBasicMaterial color="#3fb6ff" transparent opacity={0.35} toneMapped={false} /></mesh>
    <mesh position={[0, -0.6, 0.35]}><coneGeometry args={[0.55, 2, 32, 1, true]} /><meshBasicMaterial color="#3fb6ff" transparent opacity={0.06} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    <pointLight position={[0, 0, 0.8]} color="#43b8ff" intensity={4} distance={4.5} decay={2} />
  </group>;
}

/** Потолок премиум-зала: светящиеся линии между балками и по периметру. */
function CeilingLights() {
  const warm = <meshStandardMaterial color="#ffe6c0" emissive="#ffc27a" emissiveIntensity={3.2} toneMapped={false} />;
  return <group>
    {[-3.6, -1.2, 1.2, 3.6].map((z) => <mesh key={z} position={[0, 5.2, z]}><boxGeometry args={[10.6, 0.03, 0.06]} />{warm}</mesh>)}
    {[-4.8, 4.8].map((x) => <mesh key={x} position={[x, 5.2, 0]}><boxGeometry args={[0.06, 0.03, 9.4]} />{warm}</mesh>)}
    <mesh position={[0, 5.24, 0]}><boxGeometry args={[11.8, 0.02, 9.8]} /><meshStandardMaterial color="#1b1612" roughness={0.9} /></mesh>
  </group>;
}

export default function RoomDecor({ stats, onComplete, reduced }: { stats?: RoomStats; onComplete?: (id: string) => void; reduced?: boolean }) {
  if (!stats) return null;
  return <Boundary><Suspense fallback={null}>
    <CeilingLights />
    <TrophyCase filled={stats.trophies} offset={0} position={[-5.86, 0, -3.75]} />
    <Hologram position={[-5.8, 1.95, -1.85]} reduced={reduced} />
    <TrophyCase filled={stats.trophies} offset={15} position={[-5.86, 0, 0.05]} />
    <StatsScreen stats={stats} onComplete={onComplete} position={[-5.8, 1.85, 1.95]} />
    <Neon text="NO LIMITS" color="#ffb347" level={stats.level} position={[-5.8, 3.85, -1.85]} />
    <Decor url={decorUrl('plant')} height={1.25} position={[5.7, 0, -4.62]} rotation={1.2} />
    <Decor url={decorUrl('plant')} height={0.9} position={[-5.72, 0, 4.55]} rotation={2.4} />
  </Suspense></Boundary>;
}
