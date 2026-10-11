import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import { Box3, Mesh, Vector3 } from 'three';

/** Модель в магазине: в карточке медленно вращается, в окне товара её можно крутить и приближать. */
class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const SIZE = 1.45;

function Model({ url, onReady }: { url: string; onReady: () => void }) {
  const { scene } = useGLTF(url);
  const { copy, floor } = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const fit = SIZE / Math.max(size.x, size.y, size.z, 0.001);
    // Центр модели — в начале координат: камера и вращение всегда вокруг середины предмета.
    clone.scale.setScalar(fit);
    clone.position.set(-center.x * fit, -center.y * fit, -center.z * fit);
    clone.traverse((node) => { if (node instanceof Mesh) node.castShadow = true; });
    return { copy: clone, floor: -size.y * fit / 2 };
  }, [scene]);
  useEffect(onReady, [onReady]);
  return (
    <>
      <primitive object={copy} dispose={null} />
      <ContactShadows position={[0, floor - 0.01, 0]} opacity={0.5} scale={3.2} blur={2.4} far={1.4} resolution={256} frames={1} />
    </>
  );
}

type Controls = ComponentRef<typeof OrbitControls>;

export default function ShopModelViewer({ url, label, fallback, interactive = false }: {
  url: string; label: string; fallback: ReactNode; interactive?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls>(null);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [spin, setSpin] = useState(!reduced);
  const markReady = useMemo(() => () => setReady(true), []);
  useEffect(() => {
    const node = host.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const turn = (angle: number) => {
    const c = controls.current;
    if (!c) return;
    setSpin(false);
    c.setAzimuthalAngle(c.getAzimuthalAngle() + angle);
    c.update();
  };
  const reset = () => { controls.current?.reset(); };
  return (
    <div ref={host} className={`shop-model${interactive ? ' is-interactive' : ''}`}>
      <div className="shop-model-stage" role="img" aria-label={label}>
        {!ready && <span className="shop-model-fallback" aria-hidden="true">{fallback}</span>}
        <ModelBoundary fallback={<span className="shop-model-fallback" aria-hidden="true">{fallback}</span>}>
          <Canvas
            dpr={[1, interactive ? 2 : 1.5]}
            camera={{ position: [0, 0.8, 3.1], fov: 34 }}
            frameloop={!visible ? 'never' : spin || interactive ? 'always' : 'demand'}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          >
            <ambientLight intensity={0.9} />
            <hemisphereLight args={['#ffffff', '#8aa0d0', 0.6]} />
            <directionalLight position={[2.5, 4, 3]} intensity={2} />
            <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#9db8ff" />
            <Environment resolution={64} frames={1}>
              <Lightformer color="#ffffff" intensity={2} position={[0, 4, 2]} rotation={[-Math.PI / 3, 0, 0]} scale={[6, 3, 1]} />
              <Lightformer color="#bcd0ff" intensity={0.8} position={[-4, 1, 0]} rotation={[0, Math.PI / 2, 0]} scale={[4, 3, 1]} />
            </Environment>
            <Suspense fallback={null}>
              <Model url={url} onReady={markReady} />
            </Suspense>
            <OrbitControls
              ref={controls}
              enabled={interactive}
              enablePan={false}
              enableZoom={interactive}
              minDistance={1.9}
              maxDistance={4.4}
              minPolarAngle={0.3}
              maxPolarAngle={1.5}
              autoRotate={spin}
              autoRotateSpeed={interactive ? 1.4 : 2.2}
              enableDamping
              onStart={() => setSpin(false)}
            />
          </Canvas>
        </ModelBoundary>
        {interactive && ready && <span className="shop-model-hint" aria-hidden="true">Потяни, чтобы повернуть · колесо или два пальца — масштаб</span>}
      </div>
      {interactive && (
        <div className="shop-model-controls">
          <button type="button" onClick={() => turn(-Math.PI / 4)} aria-label="Повернуть влево">↺</button>
          <button type="button" onClick={() => turn(Math.PI / 4)} aria-label="Повернуть вправо">↻</button>
          <button type="button" aria-pressed={spin} onClick={() => setSpin(!spin)}>{spin ? 'Остановить' : 'Вращать'}</button>
          <button type="button" onClick={reset}>Сбросить вид</button>
        </div>
      )}
    </div>
  );
}
