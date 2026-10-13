import { defaultRoutes, portraitProfile, validRoutes } from './paths.ts';
import { boatFallback, boatsByRoute, boatTypes, CAR_TYPES } from './vehicles.ts';
import type { CityProfile, CityRoute, Point, QualityBudget } from './paths.ts';

export type Sample = Point & { distance: number; angle: number };
export class LanePath {
  samples: Sample[] = [];
  length = 0;
  route: CityRoute;
  constructor(route: CityRoute, profile: CityProfile = portraitProfile) {
    this.route=route;
    const nodes = route.points.map(p => ({ x:p.x*profile.width, y:p.y*profile.height }));
    // Квадратичные кривые с контролем в вершине: без выбросов за дорогу.
    const dense: Point[] = [];
    const count = nodes.length;
    const mix = (a: Point, b: Point, t: number) => ({ x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t });
    if (!route.closed) dense.push(nodes[0]);
    for (let i = route.closed ? 0 : 1; i < (route.closed ? count : count-1); i++) {
      const prev = nodes[(i+count-1)%count], node = nodes[i], next = nodes[(i+1)%count];
      const entry = mix(node, prev, .23), exit = mix(node, next, .23);
      dense.push(entry);
      for (let k=1; k<=12; k++) {
        const t = k/12;
        dense.push(mix(mix(entry,node,t),mix(node,exit,t),t));
      }
    }
    dense.push(route.closed ? dense[0] : nodes[count-1]);
    // Таблица длины пути рассчитывается один раз; симуляция использует бинарный поиск.
    for (let i=0; i<dense.length; i++) {
      if (i) this.length += Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y);
      const next = dense[Math.min(i+1,dense.length-1)], prev = dense[Math.max(0,i-1)];
      this.samples.push({...dense[i],distance:this.length,angle:Math.atan2(next.y-prev.y,next.x-prev.x)});
    }
  }
  at(distance: number): Sample {
    const d = this.route.closed ? ((distance%this.length)+this.length)%this.length : Math.max(0,Math.min(this.length,distance));
    let lo=0, hi=this.samples.length-1;
    while (lo+1<hi) { const mid=(lo+hi)>>1; if (this.samples[mid].distance<=d) lo=mid; else hi=mid; }
    const a=this.samples[lo], b=this.samples[hi], t=(d-a.distance)/(b.distance-a.distance || 1);
    return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, angle:Math.atan2(b.y-a.y,b.x-a.x), distance:d };
  }
}

export type Agent = {
  id: number; kind: CityRoute['kind']; path: LanePath; distance: number; position: Sample;
  currentSpeed: number; targetSpeed: number; acceleration: number; deceleration: number;
  safeDistance: number; safeRadius: number; vehicleAhead: number | null;
  sprite: number; state: 'WALK'|'IDLE'|'LOOK'|'SIT'; wait: number; age: number; retireAt?:number; stuck?: number;
};
export class IntersectionController {
  reservations = new Map<string,number>();
  private profile: CityProfile;
  constructor(profile: CityProfile = portraitProfile) { this.profile = profile; }
  private center(gate: CityProfile['intersections'][number]) { return { x:gate.center.x*this.profile.width, y:gate.center.y*this.profile.height }; }
  update(agents: Agent[]) {
    for (const gate of this.profile.intersections) {
      const owner = agents.find(a=>a.id===this.reservations.get(gate.id));
      const p=this.center(gate);
      if (!owner || Math.hypot(owner.position.x-p.x,owner.position.y-p.y)>gate.radius+25) this.reservations.delete(gate.id);
    }
  }
  canEnter(agent: Agent, ahead: Sample): boolean {
    if (agent.kind!=='road' || agent.path.route.training) return true;
    for (const gate of this.profile.intersections) {
      const p=this.center(gate);
      const distance=Math.hypot(ahead.x-p.x,ahead.y-p.y);
      if (distance>gate.radius+12) continue;
      const owner=this.reservations.get(gate.id);
      if (owner!==undefined && owner!==agent.id) return false;
      this.reservations.set(gate.id,agent.id);
    }
    return true;
  }
}
export type Quality = 'auto'|'high'|'medium'|'low';
export const qualityBudgets = { low:{road:6,water:3,pedestrian:10},medium:{road:9,water:4,pedestrian:15},high:{road:14,water:5,pedestrian:28} };
export class QualityManager {
  low: boolean;
  medium: boolean;
  slowSeconds = 0;
  fps = 60;
  mode: Quality;
  budgets = qualityBudgets;
  constructor(mode: Quality, mobile: boolean, budgets: Record<'low' | 'medium' | 'high', QualityBudget> = qualityBudgets) { this.budgets=budgets;this.mode=mode;this.low=mode==='low';this.medium=mode==='medium'||(mode==='auto'&&mobile); }
  observe(frameTime: number) {
    this.fps=this.fps*.94+Math.min(120,1/Math.max(.001,frameTime))*.06;
    if (this.mode!=='auto'||this.low) return;
    this.slowSeconds=this.fps<27 ? this.slowSeconds+frameTime : 0;
    if (this.slowSeconds>3) {
      if (this.medium) this.low=true;
      else this.medium=true;
      this.slowSeconds=0;
    }
  }
  get level() { return this.low?'low':this.medium?'medium':'high'; }
  get budget() { return this.budgets[this.level]; }
}

export class CitySimulation {
  agents: Agent[] = [];
  pool: Agent[] = [];
  paths: LanePath[];
  intersections: IntersectionController;
  profile: CityProfile;
  elapsed = 0;
  seed: number;
  nextId = 1;
  nextSpawn = 0;
  collisionStops = 0;
  constructor(routes: CityRoute[]=defaultRoutes, seed=8721, profile: CityProfile=portraitProfile) {
    this.profile=profile; this.intersections=new IntersectionController(profile);
    this.paths=routes.map(r=>new LanePath(r,profile)); this.seed=seed;
  }
  random() { this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0; return this.seed/4294967296; }
  spawn(path: LanePath, distance=0): boolean {
    if (this.agents.filter(a=>a.path===path).length>=path.route.capacity) return false;
    const position=path.at(distance), kind=path.route.kind;
    const fleet=boatsByRoute[path.route.id]??boatFallback;
    const sprite=kind==='water' ? fleet[Math.floor(this.random()*fleet.length)] : kind==='road' ? Math.floor(this.random()*CAR_TYPES) : Math.floor(this.random()*5);
    const scale=this.profile.vehicleScale,radius=(kind==='water' ? boatTypes[sprite].radius : kind==='road' ? 6 : 8)*(kind==='pedestrian'?1:scale);
    if (this.agents.some(a=>a.kind===kind&&Math.hypot(position.x-a.position.x,position.y-a.position.y)<radius+a.safeRadius+24)) return false;
    const agent=this.pool.pop() ?? {} as Agent;
    Object.assign(agent,{ id:this.nextId++,kind,path,distance,position,currentSpeed:0,
      targetSpeed:path.route.speed*(.86+this.random()*.15),acceleration:kind==='road'?6:kind==='water'?2:4,
      deceleration:kind==='road'?15:kind==='water'?5:8,safeDistance:(kind==='water'?70:kind==='road'?27:9)*(kind==='pedestrian'?1:scale),
      safeRadius:radius,vehicleAhead:null,sprite,state:'WALK',wait:0,age:0,stuck:0 });
    delete agent.retireAt;
    this.agents.push(agent); return true;
  }
  initialize(budget=qualityBudgets.low) {
    for (const kind of ['road','water','pedestrian'] as const) {
      const paths=this.paths.filter(p=>p.route.kind===kind);
      for (let i=0,attempts=0; i<budget[kind]&&attempts<Math.max(100,budget[kind]*5); attempts++) {
        const path=paths[attempts%paths.length];
        if (path && this.spawn(path,path.length*(.07+this.random()*.82))) i++;
      }
    }
  }
  step(delta: number, budget=qualityBudgets.low, rain=false) {
    // Подшаги не дают быстрому транспорту проскочить через другого агента.
    const steps=Math.ceil(Math.min(delta,.15)/.025);
    for (let i=0;i<steps;i++) this.update(Math.min(delta,.15)/steps,budget,rain);
  }
  private update(dt: number,budget: typeof qualityBudgets.low,rain: boolean) {
    this.elapsed+=dt;
    for (const kind of ['road','water','pedestrian'] as const) {
      const target=kind==='pedestrian'&&rain ? Math.ceil(budget[kind]*.65) : budget[kind];
      const active=this.agents.filter(a=>a.kind===kind&&a.retireAt===undefined);
      for (const a of active.slice(target)) a.retireAt=a.age+2;
    }
    this.intersections.update(this.agents);
    for (const agent of this.agents) {
      agent.age+=dt;
      let target=agent.targetSpeed*(rain ? .83 : 1);
      agent.vehicleAhead=null;
      if (agent.kind==='pedestrian'&&!agent.path.route.runner) {
        agent.wait-=dt;
        if (agent.state!=='WALK') {
          target=0;
          if (agent.wait<=0) agent.state='WALK';
        } else if (agent.age>8 && this.random()<dt*.045) {
          agent.state=(['IDLE','LOOK','SIT'] as const)[Math.floor(this.random()*3)];
          agent.wait=2+this.random()*5;
        }
      }
      const look=agent.path.at(agent.distance+Math.max(agent.safeDistance,agent.currentSpeed*1.5));
      if (!this.intersections.canEnter(agent,look)) target=0;
      for (const other of this.agents) {
        if (other===agent) continue;
        if (agent.kind!==other.kind) {
          // Пешеход на проезжей части имеет приоритет, если редактором добавлен переход.
          if (agent.kind==='road'&&other.kind==='pedestrian'&&Math.hypot(look.x-other.position.x,look.y-other.position.y)<14) target=0;
          continue;
        }
        let gap=Infinity;
        if (other.path===agent.path) {
          gap=other.distance-agent.distance;
          if (agent.path.route.closed && gap<0) gap+=agent.path.length;
          if (gap<=0) gap=Infinity;
        } else {
          const dx=other.position.x-agent.position.x,dy=other.position.y-agent.position.y;
          const forward=dx*Math.cos(agent.position.angle)+dy*Math.sin(agent.position.angle);
          const sideways=Math.abs(-dx*Math.sin(agent.position.angle)+dy*Math.cos(agent.position.angle));
          if (forward>0&&sideways<agent.safeRadius+other.safeRadius+8&&Math.cos(agent.position.angle-other.position.angle)>.25) gap=forward;
        }
        if (gap<agent.safeDistance+agent.currentSpeed*1.2) {
          agent.vehicleAhead=other.id;
          const min=agent.safeRadius+other.safeRadius+5;
          target=Math.min(target,Math.max(0,(gap-min)/1.8));
        }
      }
      const change=(target>agent.currentSpeed ? agent.acceleration : agent.deceleration)*dt;
      agent.currentSpeed+=Math.max(-change,Math.min(change,target-agent.currentSpeed));
      const distance=agent.distance+agent.currentSpeed*dt;
      const next=agent.path.at(distance);
      const blocked=this.agents.some(other=>other!==agent&&other.kind===agent.kind&&
        Math.hypot(next.x-other.position.x,next.y-other.position.y)<agent.safeRadius+other.safeRadius+1);
      if (blocked) { agent.currentSpeed=0;this.collisionStops++; }
      else { agent.distance=agent.path.route.closed ? distance%agent.path.length : distance;agent.position=next; }
      // Пробка на перекрёстке или суда на пересекающихся путях не должны стоять вечно: застрявший транспорт плавно уходит со сцены.
      if ((agent.kind==='road'&&!agent.path.route.training)||agent.kind==='water') {
        agent.stuck=agent.currentSpeed<.5 ? (agent.stuck??0)+dt : 0;
        if (agent.stuck>9&&agent.retireAt===undefined) agent.retireAt=agent.age+2;
      }
    }
    for (let i=this.agents.length-1;i>=0;i--) {
      const a=this.agents[i];
      if ((a.retireAt!==undefined&&a.age>=a.retireAt)||(!a.path.route.closed&&a.distance>=a.path.length-.1)) { this.pool.push(a);this.agents.splice(i,1); }
    }
    if (this.elapsed>this.nextSpawn) {
      this.nextSpawn=this.elapsed+.2+this.random()*.4;
      // Следующим появляется тот вид, у которого ещё есть место: полный лимит пешеходов не отнимает события у судов и машин.
      const open=(['road','water','pedestrian'] as const).filter(k=>{
        const limit=k==='pedestrian'&&rain ? Math.ceil(budget[k]*.65) : budget[k];
        return this.agents.filter(a=>a.kind===k).length<limit;
      });
      const kind=open[Math.floor(this.random()*open.length)];
      if (kind) {
        const paths=this.paths.filter(p=>p.route.kind===kind),path=paths[Math.floor(this.random()*paths.length)];
        if (path) this.spawn(path);
      }
    }
  }
  get normalizedPositions() { return this.agents.map(a=>({id:a.id,kind:a.kind,x:a.position.x/this.profile.width,y:a.position.y/this.profile.height,speed:a.currentSpeed,route:a.path.route.id})); }
}

export const routeStorageKey = portraitProfile.storageKey;
export function readRoutes(storage: Pick<Storage,'getItem'>, profile: CityProfile = portraitProfile): CityRoute[] {
  try { const value=JSON.parse(storage.getItem(profile.storageKey) ?? 'null'); return validRoutes(value) ? value : profile.routes; }
  catch { return profile.routes; }
}
