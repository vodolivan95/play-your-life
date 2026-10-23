import { useEffect, useRef, useState } from 'react';
import spritesUrl from '../assets/city-cars.webp';
import boatsUrl from '../assets/city-boats.webp';
import globeUrl from '../assets/city-globe.webp';
import knightUrl from '../assets/city-people/kaykit-knight.webp';
import barbarianUrl from '../assets/city-people/kaykit-barbarian.webp';
import mageUrl from '../assets/city-people/kaykit-mage.webp';
import rogueUrl from '../assets/city-people/kaykit-rogue.webp';
import hoodedUrl from '../assets/city-people/kaykit-hooded.webp';
import { cityAssets } from '../sphereAssets';
import wideMapUrl from '../assets/city-wide.webp';
import islandMapUrl from '../assets/city-islands.webp';
import { CitySimulation, QualityManager } from '../cityLive/simulation';
import { isConstrainedDevice } from '../cityLive/device';
import type { Quality } from '../cityLive/simulation';
import type { CityProfile, CityRoute, Point } from '../cityLive/paths';
import { CityRenderer, timeLighting } from '../cityLive/render';
import type { CityTime, DebugFlags } from '../cityLive/render';
// Жители — герои KayKit Adventurers (Kay Lousberg, CC0); атласы собирает scripts/build-city-people.py.
const peopleUrls=[knightUrl,barbarianUrl,mageUrl,rogueUrl,hoodedUrl];

type Props = {
  profile:CityProfile; routes: CityRoute[]; paused:boolean; speed:number; quality:Quality; time:CityTime;
  weather:string; debug:DebugFlags; draft:Point[]; editing:boolean; onPoint:(p:Point)=>void
};
export default function LiveCityCanvas(props:Props) {
  const [loadError,setLoadError]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null),live=useRef(props),fps=useRef<HTMLOutputElement>(null);
  useEffect(()=>{live.current=props;},[props]);
  const routes=props.routes,mode=props.quality,profile=props.profile,MAP_WIDTH=profile.width,MAP_HEIGHT=profile.height;
  useEffect(()=>{
    const node=canvas.current;
    if (!node) return;
    const ctx=node.getContext('2d',{alpha:true});
    if (!ctx) {node.dataset.error='canvas-unavailable';return;}
    let constrained=isConstrainedDevice();const reducedQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sim=new CitySimulation(routes,8721,profile),quality=new QualityManager(mode,constrained,profile.budgets);
    sim.initialize(quality.budget);
    const renderer=new CityRenderer(ctx,profile);
    const background=new Image(),sprites=new Image(),boats=new Image(),globe=new Image(),clean=new Image();
    const people=peopleUrls.map(url=>{const img=new Image();img.src=url;return img;});
    background.src=profile.id==='islands'?islandMapUrl:profile.id==='wide'?wideMapUrl:cityAssets.background;sprites.src=spritesUrl;boats.src=boatsUrl;if(profile.globe)globe.src=globeUrl;if(profile.cleanSurfaces)clean.src=cityAssets.cleanSurfaces;
    let unitPx=1,frame=0,previous=0,lastStats=0,visible=true,disposed=false,ready=false,lastSignature='',renderMs=0,simulationMs=0;
    const resize=()=>{
      const width=Math.max(1,node.getBoundingClientRect().width);unitPx=width/MAP_WIDTH;
      // Поворот экрана и смена размера окна пересчитывают тип устройства: телефон в ландшафте остаётся «слабым».
      constrained=isConstrainedDevice();
      if (mode==='auto'&&constrained)quality.medium=true;
      // LOW reduces object/effect counts, not the sharpness of the mobile canvas.
      const ratio=Math.min(2,window.devicePixelRatio||1);
      // Холст не ограничен 1400 px: при приближении карты (щипок, колёсико) ширина растёт, и жители с машинами остаются чёткими. Потолок защищает слабые устройства.
      const maxWidth=quality.low?1400:constrained?2400:3200;
      node.width=Math.round(Math.min(maxWidth,width*ratio));node.height=Math.round(node.width*MAP_HEIGHT/MAP_WIDTH);
      ctx.setTransform(node.width/MAP_WIDTH,0,0,node.height/MAP_HEIGHT,0,0);
      // Смена размера очищает холст: при щипке/колёсике это шло каждый кадр, и машины, люди и суда мигали до следующего тика. Перерисовываем сразу.
      if (ready&&!disposed) paint(live.current);
    };
    const paint=(settings:Props)=>{
      const reduced=reducedQuery.matches;
      renderer.draw(sim,{...settings,low:quality.level!=='high',reduced,background,sprites,boats,globe,clean,people,unitPx});
    };
    const observer=new ResizeObserver(resize);observer.observe(node);
    const tick=(now:number)=>{
      frame=0;
      if (disposed||document.hidden||!visible||!ready) {previous=0;return;}
      // Телефон рисует город 30 раз в секунду (экономия батареи и нагрева), остальные — не чаще 60 даже на экранах 120 Гц.
      const capped=constrained&&quality.level!=='high';
      if (previous&&now-previous<(capped?32:15)) {frame=requestAnimationFrame(tick);return;}
      const settings=live.current,rawDelta=previous ? (now-previous)/1000:1/60,dt=Math.min(rawDelta,.1);previous=now;
      quality.capped=capped;
      const wasLow=quality.low;quality.observe(rawDelta);if (wasLow!==quality.low) resize();
      const reduced=reducedQuery.matches;
      if(reduced)quality.low=true;
      const paused=settings.paused;
      const simulationStart=performance.now();
      if (!paused) sim.step(dt*settings.speed,quality.budget,['rain','thunderstorm'].includes(settings.weather));
      simulationMs=simulationMs*.9+(performance.now()-simulationStart)*.1;
      // Подпись настроек нужна только на паузе: на ходу город и так перерисовывается каждый кадр.
      const signature=paused ? JSON.stringify([settings.time,settings.weather,settings.debug,settings.draft,node.width]) : '';
      if (!paused||signature!==lastSignature) {
        if (paused) Object.assign(renderer,timeLighting(settings.time,sim.elapsed));
        const renderStart=performance.now();paint(settings);renderMs=renderMs*.9+(performance.now()-renderStart)*.1;lastSignature=signature;
      }
      if (now-lastStats>1000) {
        lastStats=now;
        const stats={elapsed:Math.round(sim.elapsed*100)/100,renderMs:Math.round(renderMs*10)/10,simulationMs:Math.round(simulationMs*10)/10,fps:Math.round(quality.fps),quality:quality.level,
          counts:Object.fromEntries(['road','water','pedestrian'].map(kind=>[kind,sim.agents.filter(a=>a.kind===kind).length])),
          profile:profile.id,positions:sim.normalizedPositions,collisionStops:sim.collisionStops,fountains:profile.fountains.length,waterfalls:profile.waterfalls.length,paused,reduced,level:quality.level};
        node.dataset.stats=JSON.stringify(stats);node.dataset.ready='true';
        if (fps.current) fps.current.value=`${stats.fps} FPS · ${stats.quality.toUpperCase()} · ${stats.counts.road} авто · ${stats.counts.water} суда · ${stats.counts.pedestrian} NPC`;
      }
      frame=requestAnimationFrame(tick);
    };
    const resume=()=>{ if (!frame&&!disposed&&ready&&!document.hidden&&visible) {previous=0;frame=requestAnimationFrame(tick);} };
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;if (!visible) {cancelAnimationFrame(frame);frame=0;}else resume();});
    intersection.observe(node);document.addEventListener('visibilitychange',resume);
    // Анимация стартует сразу после карты: спрайты, суда, шар и жители дорисовываются по мере загрузки (render пропускает незагруженные).
    const optional=[sprites,boats,...(profile.globe?[globe]:[]),...(profile.cleanSurfaces?[clean]:[])];
    optional.forEach(img=>{img.decode().catch(()=>undefined);});
    background.decode().then(()=>{ready=true;resize();resume();}).catch(()=>{node.dataset.error='city-assets-unavailable';if(!disposed)setLoadError(true);});
    return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',resume);};
  },[routes,mode,profile,MAP_WIDTH,MAP_HEIGHT]);
  return <>
    <canvas ref={canvas} className={`live-city-canvas${props.editing?' is-editing':''}`} aria-label={props.editing?'Редактор маршрутов города':'Живое окружение города'}
      data-layer="live-city" onClick={e=>{
        if (!props.editing) return;
        const bounds=e.currentTarget.getBoundingClientRect();
        props.onPoint({x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))});
      }} />
    {props.debug.fps&&<output className="live-city-fps" ref={fps} aria-live="off" />}
    {loadError&&<div className="city-load-error" role="status">Анимация не загрузилась. <button onClick={()=>window.location.reload()}>Обновить страницу</button></div>}
  </>;
}
