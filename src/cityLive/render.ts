import { bridgeMasks, fountains, lightPoints, MAP_HEIGHT, MAP_WIDTH, palms, pixels, roadGraph, waterRegions, waterfalls } from './paths.ts';
import type { Point } from './paths.ts';
import type { Agent, CitySimulation } from './simulation.ts';

export type CityTime = 'day'|'sunset'|'night'|'sunrise'|'auto';
export type DebugFlags = { road:boolean;water:boolean;pedestrian:boolean;hitboxes:boolean;spawn:boolean;intersections:boolean;fps:boolean };
export type RenderOptions = {
  time: CityTime; weather:string; low:boolean; reduced?:boolean; debug:DebugFlags;
  draft:Point[]; background:HTMLImageElement; sprites:HTMLImageElement; globe:HTMLImageElement;
};
const polygon = (ctx: CanvasRenderingContext2D, points: number[][]) => {
  ctx.moveTo(points[0][0],points[0][1]); for (const [x,y] of points.slice(1)) ctx.lineTo(x,y); ctx.closePath();
};
const outline = (ctx:CanvasRenderingContext2D,points:Point[]) => {
  if (!points.length) return;
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for (const p of points.slice(1)) ctx.lineTo(p.x,p.y);ctx.stroke();
};
export function timeLighting(time: CityTime,elapsed:number) {
  if (time==='night') return {night:1,warm:0,cool:1};
  if (time==='sunset') return {night:.35,warm:1,cool:0};
  if (time==='sunrise') return {night:.15,warm:.65,cool:.15};
  if (time==='day') return {night:0,warm:0,cool:0};
  // Медленный цикл 8 минут, плавный закат и рассвет, без переключения React каждый кадр.
  const phase=(elapsed%480)/480;
  const night=(1-Math.cos(phase*Math.PI*2))/2;
  return { night:Math.pow(night,2),warm:Math.pow(Math.sin(phase*Math.PI*2),8),cool:night };
}

export class CityRenderer {
  night=0; warm=0; cool=0;
  lastTime=0;
  ctx:CanvasRenderingContext2D;
  constructor(ctx:CanvasRenderingContext2D) {this.ctx=ctx;}
  draw(sim:CitySimulation,opts:RenderOptions) {
    const ctx=this.ctx,t=sim.elapsed;
    const delta=Math.min(.1,Math.max(0,t-this.lastTime));this.lastTime=t;
    const target=timeLighting(opts.time,t),blend=1-Math.exp(-delta/2.5);
    this.night+=(target.night-this.night)*blend;this.warm+=(target.warm-this.warm)*blend;this.cool+=(target.cool-this.cool)*blend;
    ctx.clearRect(0,0,MAP_WIDTH,MAP_HEIGHT);
    this.waterLayer(t,opts);
    this.waterTrafficLayer(sim,opts);
    this.bridgeLayer(opts.background);
    this.nightLightingLayer(t,opts);
    this.roadTrafficLayer(sim,opts);
    this.pedestrianLayer(sim,opts);
    this.waterfallLayer(t,opts);
    this.fountainLayer(t,opts);
    this.buildingEffectsLayer(t,opts);
    if(!opts.reduced) {
      this.vegetationLayer(t,opts);
      this.ambientLayer(t,opts);
    }
    this.weatherLayer(t,opts);
    this.debugLayer(sim,opts);
    ctx.globalAlpha=1;
  }
  private waterLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx;
    ctx.save();ctx.beginPath();for (const region of waterRegions) polygon(ctx,region);ctx.clip();
    const count=opts.low ? 35:65;
    ctx.lineWidth=.8;
    for (let i=0;i<count;i++) {
      const x=(i*173.7)%MAP_WIDTH,y=210+(i*117.3)%(MAP_HEIGHT-210);
      const phase=t*.3+i*1.47;
      ctx.strokeStyle=`rgba(220,255,255,${.07+.1*(Math.sin(phase)+1)/2})`;
      ctx.beginPath();ctx.ellipse(x+Math.sin(phase)*3,y+Math.cos(phase*.8)*1.4,9+i%7,1.4,0,0,Math.PI);ctx.stroke();
    }
    ctx.restore();
    // Только прибой пляжа: отдельные фазы, пена постепенно растворяется.
    const beach=[[688,1163],[734,1175],[792,1180],[850,1190],[911,1207],[979,1222]];
    for (let i=0;i<beach.length-1;i++) {
      const phase=(t*.13+i*.29)%1,a=beach[i],b=beach[i+1];
      ctx.strokeStyle=`rgba(245,255,254,${Math.sin(phase*Math.PI)*.38})`;ctx.lineWidth=1+phase*2;
      ctx.beginPath();ctx.moveTo(a[0],a[1]+(1-phase)*12);ctx.quadraticCurveTo((a[0]+b[0])/2,(a[1]+b[1])/2+5+(1-phase)*12,b[0],b[1]+(1-phase)*12);ctx.stroke();
    }
  }
  private bridgeLayer(image:HTMLImageElement) {
    const ctx=this.ctx;ctx.save();ctx.beginPath();for (const mask of bridgeMasks) polygon(ctx,mask);ctx.clip();
    ctx.drawImage(image,0,0,MAP_WIDTH,MAP_HEIGHT);ctx.restore();
  }
  private sprite(agent:Agent,image:HTMLImageElement,t:number) {
    const ctx=this.ctx,p=agent.position;
    const boat=agent.kind==='water';
    const size=boat ? [28,23,25,35][agent.sprite] : [18,19,18,17,20][agent.sprite];
    const rock=boat&&agent.sprite===2 ? Math.sin(t*.65+agent.id)*.022 : 0;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle+rock);
    let alpha=Math.min(1,agent.age/2);
    if(agent.retireAt!==undefined)alpha*=Math.max(0,(agent.retireAt-agent.age)/2);
    if (!agent.path.route.closed) alpha*=Math.min(1,(agent.path.length-agent.distance)/18,agent.distance/18+.1);
    ctx.globalAlpha=alpha;
    ctx.drawImage(image,agent.sprite*64,boat?64:0,64,64,-size/2,-size/2,size,size);
    const lamp=this.night+(boat?0:.55*(this.lastWeather==='rain'||this.lastWeather==='thunderstorm'?1:0));
    if (lamp>.02) {
      ctx.globalAlpha=alpha*Math.min(1,lamp);
      if (!boat) {
        const gradient=ctx.createLinearGradient(size*.24,0,size*1.8,0);gradient.addColorStop(0,'#fff5c07a');gradient.addColorStop(1,'#fff5c000');
        ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(size*.27,-2);ctx.lineTo(size*1.8,-6);ctx.lineTo(size*1.8,6);ctx.lineTo(size*.27,2);ctx.fill();
      }
      ctx.fillStyle=boat?'#79edaf':'#fff7ce';ctx.fillRect(size*.22,-size*.09,2,1.3);ctx.fillRect(size*.22,size*.09,2,1.3);
      ctx.fillStyle='#ff6356';ctx.fillRect(-size*.3,-size*.09,1.3,1.3);ctx.fillRect(-size*.3,size*.09,1.3,1.3);
    }
    ctx.restore();
  }
  private lastWeather='clear';
  private waterTrafficLayer(sim:CitySimulation,opts:RenderOptions) {
    const ctx=this.ctx,t=sim.elapsed;
    ctx.save();ctx.beginPath();for (const region of waterRegions) polygon(ctx,region);ctx.clip();
    for (const a of sim.agents.filter(a=>a.kind==='water')) {
      const p=a.position;
      if (a.currentSpeed>1) {
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.lineWidth=.9;
        for (let i=0;i<6;i++) {
          const phase=(t*.6+i/6+a.id*.3)%1,len=(a.sprite===1?42:26)*phase+8,width=2+phase*8;
          ctx.strokeStyle=`rgba(241,255,255,${(1-phase)*.27*Math.min(1,a.currentSpeed/5)})`;
          ctx.beginPath();ctx.moveTo(-len,-width);ctx.quadraticCurveTo(-len*.6,-width*.8,-8,-2);ctx.moveTo(-len,width);ctx.quadraticCurveTo(-len*.6,width*.8,-8,2);ctx.stroke();
        }
        ctx.restore();
      }
      this.sprite(a,opts.sprites,t);
    }
    ctx.restore();
  }
  private roadTrafficLayer(sim:CitySimulation,opts:RenderOptions) {
    this.lastWeather=opts.weather;
    for (const agent of sim.agents) if (agent.kind==='road') this.sprite(agent,opts.sprites,sim.elapsed);
  }
  private pedestrianLayer(sim:CitySimulation,opts:RenderOptions) {
    const ctx=this.ctx;
    const walkers=sim.agents.filter(a=>a.kind==='pedestrian');
    for (const [i,a] of walkers.entries()) {
      const rain=opts.weather==='rain'||opts.weather==='thunderstorm';
      if (rain&&i%3===0) continue;
      const p=a.position,walk=Math.sin(a.distance*(a.path.route.runner?1.9:1.2));
      ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=Math.min(1,a.age/2)*(a.retireAt===undefined?1:Math.max(0,(a.retireAt-a.age)/2));
      ctx.fillStyle='#174b5544';ctx.beginPath();ctx.ellipse(1,3,2.8,1,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#28495c';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(-.6,1);ctx.lineTo(-1-walk*.8,3);ctx.moveTo(.6,1);ctx.lineTo(1+walk*.8,3);ctx.stroke();
      ctx.fillStyle=['#e86864','#5f9fca','#e7c76d','#b69be0','#f4e7d7'][a.sprite];ctx.fillRect(-1.4,-2,2.8,a.state==='SIT'?2:4);
      ctx.fillStyle='#dca780';ctx.beginPath();ctx.arc(0,-3,1.2,0,Math.PI*2);ctx.fill();
      if (rain) {ctx.fillStyle='#2d7bb5';ctx.beginPath();ctx.arc(0,-4,3.5,Math.PI,0);ctx.fill();}
      ctx.restore();
    }
  }
  private waterfallLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx;
    for (const [i,fall] of waterfalls.entries()) {
      const a=pixels(fall.start),b=pixels(fall.end),dx=b.x-a.x,dy=b.y-a.y;
      ctx.save();ctx.beginPath();ctx.moveTo(a.x-fall.width/2,a.y);ctx.lineTo(a.x+fall.width/2,a.y);ctx.lineTo(b.x+fall.width/2,b.y);ctx.lineTo(b.x-fall.width/2,b.y);ctx.closePath();ctx.clip();
      const count=opts.low?9:17;
      for (let j=0;j<count;j++) {
        const phase=(t*.75+j/count+i*.31)%1,offset=(j%5/4-.5)*fall.width;
        ctx.strokeStyle=`rgba(238,255,255,${.15+(j%3)*.08})`;ctx.lineWidth=1+j%2;
        ctx.beginPath();ctx.moveTo(a.x+dx*phase+offset,a.y+dy*phase);ctx.lineTo(a.x+dx*Math.min(1,phase+.2)+offset,b.y-(1-Math.min(1,phase+.2))*dy);ctx.stroke();
      }
      ctx.restore();
      for (let j=0;j<6;j++) {
        const phase=(t*.58+j/6+i*.19)%1;ctx.fillStyle=`rgba(245,255,255,${(1-phase)*.23})`;
        ctx.beginPath();ctx.ellipse(b.x+Math.sin(j*13)*fall.width*.35,b.y-phase*5,2+phase*2,.8+phase*1.3,0,0,Math.PI*2);ctx.fill();
      }
      ctx.strokeStyle='#d3ffff38';ctx.lineWidth=.9;ctx.beginPath();ctx.ellipse(b.x,b.y+3,fall.width*.6+Math.sin(t+i)*2,3,0,0,Math.PI*2);ctx.stroke();
    }
  }
  private fountainLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx;
    for (const [i,f] of fountains.entries()) {
      const p=pixels(f.center),intensity=.87+.13*Math.sin(t*.24+i*1.3);
      ctx.save();ctx.beginPath();ctx.ellipse(p.x,p.y-f.height*.45,f.rx+3,f.ry+f.height*.7,0,0,Math.PI*2);ctx.clip();
      for (let j=0;j<(opts.low?8:14);j++) {
        const angle=j*Math.PI*2/(opts.low?8:14),phase=(t*.75+j*.137+i*.37)%1;
        const x=p.x+Math.cos(angle)*f.rx*.55*phase;
        const y=p.y+Math.sin(angle)*f.ry*.7*phase-4*f.height*intensity*phase*(1-phase);
        ctx.fillStyle=`rgba(234,255,255,${.5*(1-phase*.65)})`;ctx.beginPath();ctx.ellipse(x,y,.9,1.9,angle*.1,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#dcffff45';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+Math.cos(angle)*f.rx*.25,p.y-f.height*intensity,p.x+Math.cos(angle)*f.rx*.55,p.y+Math.sin(angle)*f.ry*.7);ctx.stroke();
      }
      for (let j=0;j<3;j++) {
        const phase=(t*.24+j/3+i*.29)%1;
        ctx.strokeStyle=`rgba(213,255,255,${(1-phase)*.3})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(p.x,p.y,f.rx*(.35+.65*phase),f.ry*(.35+.65*phase),0,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
      if (this.night>.05) this.glow(p.x,p.y,f.rx*.7,`rgba(85,217,255,${this.night*.28})`);
    }
  }
  private buildingEffectsLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx;
    if (opts.globe.complete&&opts.globe.naturalWidth) {
      const frame=Math.floor(t/3)%32;ctx.drawImage(opts.globe,frame*80,0,80,80,465,462,74,74);
      this.glow(502,499,48,`rgba(121,227,255,${.03+this.night*.14})`);
    }
    // Смена блика экранов, не замена символов фасадов и не изменение UI-иконок.
    const signs=[[507,144],[287,235],[785,249],[242,414],[823,450],[304,713],[786,652],[545,836],[840,982]];
    for (let i=0;i<signs.length;i++) {
      const phase=(t+i*7)%47;
      if (phase<3) {ctx.fillStyle=`rgba(205,247,255,${Math.sin(phase/3*Math.PI)*.1})`;ctx.beginPath();ctx.ellipse(signs[i][0],signs[i][1],15,11,0,0,Math.PI*2);ctx.fill();}
    }
  }
  private vegetationLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx;
    for (let i=0;i<(opts.low?4:palms.length);i++) {
      const [x,y]=palms[i],sway=Math.sin(t*.7+i*1.71)*.6;
      // Только листья, маленькая локальная маска; ствол, земля и архитектура неподвижны.
      ctx.save();ctx.beginPath();ctx.ellipse(x,y-13,7,5,0,0,Math.PI*2);ctx.clip();
      ctx.translate(x,y-10);ctx.rotate(sway*.018);ctx.drawImage(opts.background,x-9,y-21,18,17,-9,-11,18,17);ctx.restore();
    }
  }
  private ambientLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx;
    const cycle=Math.floor(t/41),age=t%41;
    if (age<11) {
      const count=opts.low?3:5;
      for (let i=0;i<count;i++) {
        const x=-50+age*105-i*12,y=75+(cycle%3)*34+Math.sin(age*.4+i)*3+i%2*5;
        const wing=Math.sin(t*5+i)*2;
        ctx.strokeStyle='#28495c99';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-3,y+wing);ctx.quadraticCurveTo(x-1,y-2,x,y);ctx.quadraticCurveTo(x+1,y-2,x+3,y+wing);ctx.stroke();
      }
    }
  }
  private glow(x:number,y:number,radius:number,color:string) {
    const ctx=this.ctx,g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(1,'rgba(255,244,199,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
  }
  private nightLightingLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx;
    // Холодное рассеянное освещение и тёплый закат вместо чёрного слоя.
    const sky=ctx.createLinearGradient(0,0,MAP_WIDTH,MAP_HEIGHT);
    sky.addColorStop(0,`rgba(27,49,108,${this.night*.54})`);sky.addColorStop(1,`rgba(17,68,108,${this.night*.48})`);
    ctx.fillStyle=sky;ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);
    if (this.warm>.01) {
      const sunset=ctx.createLinearGradient(0,0,MAP_WIDTH,MAP_HEIGHT);sunset.addColorStop(0,`rgba(255,155,84,${this.warm*.2})`);sunset.addColorStop(1,`rgba(139,104,176,${this.warm*.09})`);ctx.fillStyle=sunset;ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);
    }
    for (const [i,[x,y]] of lightPoints.entries()) {
      const active=Math.max(0,Math.min(1,(this.night-(i%7)*.055)*2));
      if (active<.01) continue;
      this.glow(x,y,14+i%3*4,`rgba(255,216,138,${active*.32})`);
      ctx.fillStyle=`rgba(255,234,169,${active*.8})`;ctx.fillRect(x-1,y-1,2,2.3);
    }
    if (opts.weather==='rain'||opts.weather==='thunderstorm') {
      // Слабый холодный тон и локальные мокрые дорожные блики.
      ctx.fillStyle='#42658a15';ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);
      ctx.strokeStyle='#bae3f526';ctx.lineWidth=2;
      outline(ctx,[{x:488,y:650},{x:502,y:700},{x:522,y:755}]);
      const phase=(t*.8)%1;ctx.strokeStyle=`rgba(205,237,255,${phase*.08})`;
    }
  }
  private weatherLayer(t:number,opts:RenderOptions) {
    const ctx=this.ctx,cloudy=['partlyCloudy','cloudy','rain','thunderstorm','fog'].includes(opts.weather);
    if (cloudy) {
      for (let i=0;i<3;i++) {
        const x=((t*(2+i)+i*389)%(MAP_WIDTH+500))-250,y=80+i*343;
        const g=ctx.createRadialGradient(x,y,10,x,y,180);g.addColorStop(0,opts.weather==='fog'?'#eef6fb50':'#d6e1ed25');g.addColorStop(1,'#ffffff00');
        ctx.save();ctx.scale(1,.48);ctx.fillStyle=g;ctx.fillRect(x-220,y-220,440,440);ctx.restore();
      }
    }
    if (opts.weather==='fog') {
      const g=ctx.createLinearGradient(0,0,0,MAP_HEIGHT);g.addColorStop(0,'#ebf4fa0d');g.addColorStop(.6,'#ebf4fa65');g.addColorStop(1,'#e4f5fa35');ctx.fillStyle=g;ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);
    }
    if (opts.weather==='rain'||opts.weather==='thunderstorm') {
      ctx.strokeStyle='#d6f5ff65';ctx.lineWidth=.8;ctx.beginPath();
      for (let i=0;i<(opts.low?70:150);i++) {
        const y=(i*83+t*310)%MAP_HEIGHT,x=((i*157-y*.18)%MAP_WIDTH+MAP_WIDTH)%MAP_WIDTH;
        ctx.moveTo(x,y);ctx.lineTo(x-2,y+10);
      }
      ctx.stroke();
      if (opts.weather==='thunderstorm'&&t%29<.12) {ctx.fillStyle='#e4f5ff12';ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);}
    }
    if (opts.weather==='snow') {
      ctx.fillStyle='#f5fdffaa';for (let i=0;i<(opts.low?40:80);i++) {ctx.beginPath();ctx.arc((i*151+Math.sin(t+i)*7)%MAP_WIDTH,(i*113+t*23)%MAP_HEIGHT,1.1,0,Math.PI*2);ctx.fill();}
    }
  }
  private debugLayer(sim:CitySimulation,opts:RenderOptions) {
    const ctx=this.ctx,flags=opts.debug;
    for (const path of sim.paths) {
      if (!flags[path.route.kind]) continue;
      ctx.strokeStyle=path.route.kind==='road'?'#ffcb42':path.route.kind==='water'?'#66f8ff':'#f899f0';ctx.lineWidth=1.5;
      outline(ctx,path.samples);
      for (const n of path.route.points.map(pixels)) {ctx.beginPath();ctx.arc(n.x,n.y,3,0,Math.PI*2);ctx.stroke();}
    }
    if (flags.spawn) for (const path of sim.paths) {
      const p=path.at(0);ctx.fillStyle='#89ff96';ctx.fillRect(p.x-4,p.y-4,8,8);
      if (!path.route.closed) {const end=path.at(path.length);ctx.fillStyle='#ff8e88';ctx.fillRect(end.x-4,end.y-4,8,8);}
    }
    if (flags.intersections) for (const gate of roadGraph.intersections) {
      const p=pixels(gate.center);ctx.strokeStyle=sim.intersections.reservations.has(gate.id)?'#ff6262':'#88ff9b';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,gate.radius,0,Math.PI*2);ctx.stroke();
      ctx.font='9px monospace';ctx.fillStyle='#142e49';ctx.fillText(gate.id,p.x+5,p.y-5);
    }
    if (flags.hitboxes) for (const a of sim.agents) {ctx.strokeStyle='#ff5151';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(a.position.x,a.position.y,a.safeRadius,0,Math.PI*2);ctx.stroke();}
    if (opts.draft.length) {
      ctx.strokeStyle='#ff4545';ctx.lineWidth=2;outline(ctx,opts.draft.map(pixels));
      for (const p of opts.draft.map(pixels)) {ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.stroke();}
    }
  }
}
