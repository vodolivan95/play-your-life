import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation, LanePath, QualityManager, qualityBudgets, readRoutes, routeStorageKey } from '../src/cityLive/simulation.ts';
import { defaultRoutes, validRoutes } from '../src/cityLive/paths.ts';
import type { CityRoute } from '../src/cityLive/paths.ts';
import { timeLighting } from '../src/cityLive/render.ts';

test('Нормализованные пути замкнуты без скачков; повреждённый импорт не подменяет маршруты',()=>{
  assert.equal(validRoutes(defaultRoutes),true);
  for (const r of defaultRoutes) {
    const p=new LanePath(r);
    for (let d=0;d<p.length;d+=1) {
      const a=p.at(d),b=p.at(d+1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<=1.01);
    }
    if (r.closed) {
      const a=p.at(p.length-.1),b=p.at(.1);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.21);
    }
  }
  assert.equal(validRoutes([{...defaultRoutes[0],points:[{x:2,y:0}]}]),false);
  assert.equal(validRoutes([...defaultRoutes,defaultRoutes[0]]),false);
  assert.deepEqual(readRoutes({getItem:()=>'{invalid'}),defaultRoutes);
  let key='';readRoutes({getItem:k=>{key=k;return null;}});assert.equal(key,routeStorageKey);
  assert.ok(!routeStorageKey.includes('play-your-life-v1'));
});

test('Транспорт не пересекает радиусы безопасности и продолжает движение через пять минут',()=>{
  for (const seed of [1,42,8721]) {
    const sim=new CitySimulation(defaultRoutes,seed);sim.initialize(qualityBudgets.high);
    let motion=0;
    for (let step=0;step<9000;step++) {
      sim.step(1/30,qualityBudgets.high);
      if (step%10!==0) continue;
      for (let i=0;i<sim.agents.length;i++) {
        const a=sim.agents[i];if (a.kind==='pedestrian') continue;
        for (const b of sim.agents.slice(i+1)) {
          if (b.kind!==a.kind)continue;
          assert.ok(Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)>=a.safeRadius+b.safeRadius-.01,`${a.id}/${b.id} ${a.path.route.id}/${b.path.route.id}`);
        }
      }
      if (step>8100) motion+=sim.agents.filter(a=>a.kind==='road'&&!a.path.route.training&&a.currentSpeed>2).length;
    }
    assert.ok(motion>100,'Городской транспорт не должен постоянно стоять');
    assert.ok(sim.agents.some(a=>a.kind==='water'&&a.currentSpeed>1),'Водный транспорт продолжает работать');
  }
});

test('Следующий автомобиль плавно тормозит перед остановившимся и снова разгоняется',()=>{
  const r:CityRoute={id:'test-lane',kind:'road',points:[{x:.1,y:.1},{x:.5,y:.1},{x:.9,y:.1}],closed:false,speed:20,capacity:2};
  const sim=new CitySimulation([r]);
  assert.equal(sim.spawn(sim.paths[0],120),true);assert.equal(sim.spawn(sim.paths[0],70),true);
  const leader=sim.agents[0],follower=sim.agents[1];leader.targetSpeed=0;
  for (let i=0;i<300;i++)sim.step(1/30,{road:2,water:0,pedestrian:0});
  assert.ok(follower.currentSpeed<1);assert.ok(leader.distance-follower.distance>=leader.safeRadius+follower.safeRadius);
  leader.targetSpeed=20;
  for (let i=0;i<60;i++)sim.step(1/30,{road:2,water:0,pedestrian:0});
  assert.ok(follower.currentSpeed>1&&follower.currentSpeed<20);
});

test('AUTO уменьшает качество при устойчивом падении FPS; мобильный бюджет ограничен',()=>{
  const quality=new QualityManager('auto',false);
  for (let i=0;i<160;i++)quality.observe(.05);
  assert.equal(quality.low,true);
  const mobile=new QualityManager('auto',true);assert.equal(mobile.level,'medium');
  const medium=new QualityManager('medium',false);assert.equal(medium.level,'medium');
  const high=new QualityManager('high',true);assert.equal(high.low,false);
  assert.ok(mobile.budget.road<=12&&mobile.budget.water<=5&&mobile.budget.pedestrian<=15);
});

test('После снижения качества остаётся мобильный бюджет, цикл освещения плавный и повторяемый',()=>{
  const sim=new CitySimulation();sim.initialize(qualityBudgets.high);
  for(let i=0;i<120;i++)sim.step(1/30,qualityBudgets.low);
  for(const kind of ['road','water','pedestrian'] as const)assert.ok(sim.agents.filter(a=>a.kind===kind).length<=qualityBudgets.low[kind]);
  assert.equal(timeLighting('auto',0).night,0);assert.equal(timeLighting('auto',240).night,1);
  assert.deepEqual(timeLighting('auto',0),timeLighting('auto',480));
  assert.ok(Math.abs(timeLighting('auto',239).night-timeLighting('auto',240).night)<.001);
  assert.equal(timeLighting('night',100).night,1);assert.equal(timeLighting('day',100).night,0);
});
