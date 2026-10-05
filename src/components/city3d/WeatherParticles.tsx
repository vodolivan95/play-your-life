import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
import type { WeatherRuntime } from './WeatherSystem';
export default function WeatherParticles({ runtime, quality, paused, reduced }: { runtime: WeatherRuntime; quality: string; paused: boolean; reduced: boolean }) {
  const clock = useRef(0);
  const count = quality === 'low' ? 180 : quality === 'medium' ? 450 : 800;
  const geometry = useMemo(() => {
    const points = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { points[i * 3] = ((i * .618033) % 1 - .5) * 54; points[i * 3 + 1] = (i * .754877 % 1) * 18; points[i * 3 + 2] = ((i * .414214) % 1 - .5) * 44; }
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(points, 3)); return g;
  }, [count]);
  const material = useMemo(() => new ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { clock: { value: 0 }, intensity: { value: 0 }, snow: { value: 0 }, wind: { value: 0 } }, vertexShader: `uniform float clock; uniform float snow; uniform float wind; void main(){ vec3 p=position; p.y=mod(p.y-clock*mix(14.,1.8,snow),18.); p.x+=sin(clock+p.z)*wind*2.; vec4 v=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*v; gl_PointSize=mix(7.,10.,snow)*65./max(10.,-v.z); }`, fragmentShader: `uniform float intensity; uniform float snow; void main(){vec2 p=gl_PointCoord-.5; float rain=step(abs(p.x),.07)*(.6-abs(p.y)); float flake=smoothstep(.5,.15,length(p)); gl_FragColor=vec4(mix(vec3(.6,.8,1.),vec3(.95),snow),mix(rain,flake,snow)*intensity);}` }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  // Three.js resources are mutable GPU/scene objects, outside React render state.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, dt) => {
    if (!paused && !reduced) clock.current += dt;
    material.uniforms.clock.value = clock.current; material.uniforms.wind.value = runtime.current.windStrength;
    material.uniforms.intensity.value = reduced ? 0 : Math.max(runtime.current.rainIntensity, runtime.current.snowIntensity);
    material.uniforms.snow.value = runtime.current.snowIntensity > runtime.current.rainIntensity ? 1 : 0;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
