import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CitySimulation, LanePath } from '../src/cityLive/simulation.ts';
import { wideProfile } from '../src/cityLive/wideMap.ts';
import { lifeRoutes } from '../src/cityLive/wideLife.ts';

const W=wideProfile.width,H=wideProfile.height;
const inside=(x:number,y:number,poly:number[][])=>{
  let c=false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if ((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) c=!c;
  }
  return c;
};
const nearest=(path:LanePath,x:number,y:number)=>{let m=Infinity;for(let d=0;d<=path.length;d+=1){const p=path.at(d);m=Math.min(m,Math.hypot(p.x-x,p.y-y));}return m;};

test('Живой город: пути судов целиком лежат в воде карты',()=>{
  const sea=lifeRoutes.filter(r=>r.kind==='water');
  assert.ok(sea.length>=6,'добавлены новые морские маршруты');
  for (const r of sea) {
    const p=new LanePath(r,wideProfile);
    for (let d=0;d<=p.length;d+=4) {
      const q=p.at(d);
      assert.ok(wideProfile.waterRegions.some(reg=>inside(q.x,q.y,reg)),`${r.id}: точка ${Math.round(q.x)},${Math.round(q.y)} вне воды`);
    }
  }
});

test('Живой город: тротуары идут вдоль дорог, но не по проезжей части',()=>{
  const lanes=new Map(wideProfile.routes.filter(r=>r.kind==='road').map(r=>[r.id,new LanePath(r,wideProfile)]));
  const walks=lifeRoutes.filter(r=>r.id.startsWith('life-walk'));
  assert.ok(walks.length>=10);
  for (const r of walks) {
    const p=new LanePath(r,wideProfile);
    const near=[...Array(12)].map((_,i)=>{const q=p.at(p.length*(i+.5)/12);return Math.min(...[...lanes.values()].map(l=>nearest(l,q.x,q.y)));}).sort((a,b)=>a-b);
    const best=near[6];
    assert.ok(best>=3&&best<=40,`${r.id}: медианное расстояние до дороги ${best.toFixed(1)}`);
  }
});

test('Живой город: машины всё время строго на своей полосе, суда не выходят из воды',()=>{
  const budget=wideProfile.budgets!.high;
  const sim=new CitySimulation(wideProfile.routes,8721,wideProfile);sim.initialize(budget);
  let cars=0,boats=0,samples=0;
  for (let step=0;step<4500;step++) {
    sim.step(1/30,budget);
    if (step%15) continue;
    for (const a of sim.agents) {
      if (a.kind==='road') assert.ok(nearest(a.path,a.position.x,a.position.y)<.6,`${a.path.route.id}: машина сошла с полосы`);
      if (a.path.route.id.startsWith('life-sea-')&&a.age>1) assert.ok(wideProfile.waterRegions.some(reg=>inside(a.position.x,a.position.y,reg)),`${a.path.route.id}: судно вне воды`);
      assert.ok(a.position.x>=0&&a.position.x<=W&&a.position.y>=0&&a.position.y<=H);
    }
    if (step>1800) {cars+=sim.agents.filter(a=>a.kind==='road').length;boats+=sim.agents.filter(a=>a.kind==='water').length;samples++;}
  }
  assert.ok(cars/samples>=18,`машин в среднем ${(cars/samples).toFixed(1)}`);
  assert.ok(boats/samples>=10,`судов в среднем ${(boats/samples).toFixed(1)}`);
});

test('Живой город: жителей много на всех уровнях качества и они не слипаются',()=>{
  const expected={low:40,medium:70,high:110} as const;
  for (const level of ['low','medium','high'] as const) {
    const budget=wideProfile.budgets![level];assert.equal(budget.pedestrian,expected[level]);
    const sim=new CitySimulation(wideProfile.routes,8721,wideProfile);sim.initialize(budget);
    for (let step=0;step<1800;step++) sim.step(1/30,budget);
    const walkers=sim.agents.filter(a=>a.kind==='pedestrian'&&a.retireAt===undefined);
    assert.ok(walkers.length>=expected[level]-2,`${level}: ${walkers.length}`);
    const routes=new Set(walkers.map(a=>a.path.route.id));
    assert.ok(routes.size>=(level==='low'?6:10),`${level}: жители только на ${routes.size} маршрутах`);
    for (let i=0;i<walkers.length;i++) for (const b of walkers.slice(i+1))
      assert.ok(Math.hypot(walkers[i].position.x-b.position.x,walkers[i].position.y-b.position.y)>=3,'жители слиплись в одну точку');
  }
});

test('Живой город: спрайты жителей плотные — внутри силуэта нет прозрачных дыр',()=>{
  const metrics=JSON.parse(readFileSync(new URL('../scripts/city-people-metrics.json',import.meta.url),'utf8')) as Record<string,{cells:number;worstHoleShare:number;meanInteriorAlpha:number;minInteriorPixels:number}>;
  assert.deepEqual(Object.keys(metrics).sort(),['kaykit-barbarian.webp','kaykit-hooded.webp','kaykit-knight.webp','kaykit-mage.webp','kaykit-rogue.webp']);
  for (const [name,m] of Object.entries(metrics)) {
    assert.equal(m.cells,64,name);
    assert.ok(m.meanInteriorAlpha>=.99,`${name}: средняя непрозрачность ${m.meanInteriorAlpha}`);
    assert.ok(m.worstHoleShare<=.06,`${name}: дыр ${m.worstHoleShare}`);
    assert.ok(m.minInteriorPixels>=400,`${name}: фигура слишком тонкая (${m.minInteriorPixels})`);
  }
});

test('Живой город: пешеходные маршруты не уводят жителей к воде и краю моста',()=>{
  const m=JSON.parse(readFileSync(new URL('../scripts/city-routes-metrics.json',import.meta.url),'utf8')) as {maxWetShare:number;wetShare:Record<string,number>};
  const ids=wideProfile.routes.filter(r=>r.kind==='pedestrian').map(r=>r.id);
  for (const id of ids) {
    if (!id.startsWith('life-walk')&&!id.startsWith('wide-plaza')) continue;
    assert.ok(id in m.wetShare,`${id}: нет в метриках, пересоберите scripts/build-wide-life.py`);
    // Круг у глобуса идёт вдоль бассейна фонтана — вода рядом с плиткой допустима.
    assert.ok(m.wetShare[id]<=(id==='wide-plaza-globe'?.15:m.maxWetShare),`${id}: у воды ${m.wetShare[id]}`);
  }
  assert.ok(ids.length>=18);
});

test('Живой город: за 5 минут жители не толпятся и равномерно распределены по маршрутам',()=>{
  const budget=wideProfile.budgets!.high;
  const sim=new CitySimulation(wideProfile.routes,3,wideProfile);sim.initialize(budget);
  let closePairs=0;const used=new Set<string>();
  for (let step=0;step<9000;step++) {
    sim.step(1/30,budget);
    if (step%30) continue;
    const w=sim.agents.filter(a=>a.kind==='pedestrian');
    for (const a of w) used.add(a.path.route.id);
    for (let i=0;i<w.length;i++) for (const b of w.slice(i+1)) if (Math.hypot(w[i].position.x-b.position.x,w[i].position.y-b.position.y)<3) closePairs++;
  }
  assert.ok(closePairs<=150,`жители ближе 3 единиц: ${closePairs}`);
  assert.ok(used.size>=18,`жители побывали только на ${used.size} маршрутах`);
});

test('Живой город: жители не исчезают и всё время идут вперёд',()=>{
  const budget=wideProfile.budgets!.high;
  const sim=new CitySimulation(wideProfile.routes,8721,wideProfile);sim.initialize(budget);
  for (let step=0;step<900;step++) sim.step(1/30,budget);
  const before=new Map(sim.agents.filter(a=>a.kind==='pedestrian').map(a=>[a.id,{x:a.position.x,y:a.position.y}]));
  let alive=0,vanished=0,moved=0;
  for (let step=0;step<750;step++) sim.step(1/30,budget);
  const now=new Map(sim.agents.filter(a=>a.kind==='pedestrian').map(a=>[a.id,a]));
  for (const [id,p] of before) {
    const a=now.get(id);
    if (!a) { vanished++; continue; }
    alive++;
    if (Math.hypot(a.position.x-p.x,a.position.y-p.y)>20||a.path.length<60) moved++;
  }
  assert.ok(sim.agents.filter(a=>a.kind==='pedestrian'&&a.retireAt===undefined).length>=108);
  assert.ok(vanished<=before.size*.25,`за 25 с пропало ${vanished} из ${before.size}`);
  assert.ok(moved>=alive*.9,`застыли ${alive-moved} из ${alive}`);
});
