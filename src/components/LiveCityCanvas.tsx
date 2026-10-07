import { useEffect, useRef } from 'react';
import spritesUrl from '../assets/city-traffic.svg';
import globeUrl from '../assets/city-globe.webp';
import { cityAssets } from '../sphereAssets';
import { CitySimulation, QualityManager } from '../cityLive/simulation';
import type { Quality } from '../cityLive/simulation';
import type { CityRoute, Point } from '../cityLive/paths';
import { fountains, MAP_HEIGHT, MAP_WIDTH, waterfalls } from '../cityLive/paths';
import { CityRenderer, timeLighting } from '../cityLive/render';
import type { CityTime, DebugFlags } from '../cityLive/render';

type Props = {
  routes: CityRoute[]; paused:boolean; speed:number; quality:Quality; time:CityTime;
  weather:string; debug:DebugFlags; draft:Point[]; editing:boolean; onPoint:(p:Point)=>void;
};
export default function LiveCityCanvas(props:Props) {
  const canvas=useRef<HTMLCanvasElement>(null),live=useRef(props),fps=useRef<HTMLOutputElement>(null);
  useEffect(()=>{live.current=props;},[props]);
  const routes=props.routes,mode=props.quality;
  useEffect(()=>{
    const node=canvas.current;
    if (!node) return;
    const ctx=node.getContext('2d',{alpha:true});
    if (!ctx) {node.dataset.error='canvas-unavailable';return;}
    const sim=new CitySimulation(routes),quality=new QualityManager(mode,window.innerWidth<=760);
    sim.initialize(quality.budget);
    const renderer=new CityRenderer(ctx);
    const background=new Image(),sprites=new Image(),globe=new Image();
    background.src=cityAssets.background;sprites.src=spritesUrl;globe.src=globeUrl;
    let frame=0,previous=0,lastStats=0,visible=true,disposed=false,ready=false,lastSignature='',renderMs=0,simulationMs=0;
    const resize=()=>{
      const width=Math.max(1,node.getBoundingClientRect().width);
      if (mode==='auto'&&window.innerWidth<=760)quality.low=true;
      const ratio=quality.low ? 1 : Math.min(1.5,window.devicePixelRatio||1);
      node.width=Math.round(Math.min(1400,width*ratio));node.height=Math.round(node.width*MAP_HEIGHT/MAP_WIDTH);
      ctx.setTransform(node.width/MAP_WIDTH,0,0,node.height/MAP_HEIGHT,0,0);
    };
    const observer=new ResizeObserver(resize);observer.observe(node);
    const tick=(now:number)=>{
      frame=0;
      if (disposed||document.hidden||!visible||!ready) {previous=0;return;}
      const settings=live.current,rawDelta=previous ? (now-previous)/1000:1/60,dt=Math.min(rawDelta,.1);previous=now;
      const wasLow=quality.low;quality.observe(rawDelta);if (wasLow!==quality.low) resize();
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const paused=settings.paused||reduced;
      const simulationStart=performance.now();
      if (!paused) sim.step(dt*settings.speed,quality.budget,['rain','thunderstorm'].includes(settings.weather));
      simulationMs=simulationMs*.9+(performance.now()-simulationStart)*.1;
      const signature=JSON.stringify([settings.time,settings.weather,settings.debug,settings.draft,node.width]);
      if (!paused||signature!==lastSignature) {
        if (paused) Object.assign(renderer,timeLighting(settings.time,sim.elapsed));
        const renderStart=performance.now();renderer.draw(sim,{...settings,low:quality.low,background,sprites,globe});renderMs=renderMs*.9+(performance.now()-renderStart)*.1;lastSignature=signature;
      }
      if (now-lastStats>1000) {
        lastStats=now;
        const stats={elapsed:Math.round(sim.elapsed*100)/100,renderMs:Math.round(renderMs*10)/10,simulationMs:Math.round(simulationMs*10)/10,fps:Math.round(quality.fps),quality:quality.low?'low':'high',
          counts:Object.fromEntries(['road','water','pedestrian'].map(kind=>[kind,sim.agents.filter(a=>a.kind===kind).length])),
          positions:sim.normalizedPositions,collisionStops:sim.collisionStops,fountains:fountains.length,waterfalls:waterfalls.length,paused};
        node.dataset.stats=JSON.stringify(stats);node.dataset.ready='true';
        if (fps.current) fps.current.value=`${stats.fps} FPS · ${stats.quality.toUpperCase()} · ${stats.counts.road} авто · ${stats.counts.water} суда · ${stats.counts.pedestrian} NPC`;
      }
      frame=requestAnimationFrame(tick);
    };
    const resume=()=>{ if (!frame&&!disposed&&ready&&!document.hidden&&visible) {previous=0;frame=requestAnimationFrame(tick);} };
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;if (!visible) {cancelAnimationFrame(frame);frame=0;}else resume();});
    intersection.observe(node);document.addEventListener('visibilitychange',resume);
    Promise.all([background.decode(),sprites.decode(),globe.decode()]).then(()=>{ready=true;resize();resume();}).catch(()=>{node.dataset.error='city-assets-unavailable';});
    return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',resume);};
  },[routes,mode]);
  return <>
    <canvas ref={canvas} className={`live-city-canvas${props.editing?' is-editing':''}`} aria-label={props.editing?'Редактор маршрутов города':'Живое окружение города'}
      data-layer="live-city" onClick={e=>{
        if (!props.editing) return;
        const bounds=e.currentTarget.getBoundingClientRect();
        props.onPoint({x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))});
      }} />
    {props.debug.fps&&<output className="live-city-fps" ref={fps} aria-live="off" />}
  </>;
}
