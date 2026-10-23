import test from 'node:test';
import assert from 'node:assert/strict';
import { islandBuildings, islandProfile, ISLAND_HEIGHT, ISLAND_WIDTH, ISLAND_IMAGE_WIDTH, ISLAND_IMAGE_HEIGHT } from '../src/cityLive/islandMap.ts';
import { validRoutes } from '../src/cityLive/paths.ts';
import { CitySimulation, LanePath, QualityManager, readRoutes, routeStorageKey } from '../src/cityLive/simulation.ts';
import { boatsByRoute } from '../src/cityLive/vehicles.ts';

test('Острова: валидные маршруты, точный ratio и отдельное хранилище', () => {
  assert.equal(ISLAND_WIDTH, 2000);
  assert.equal(ISLAND_IMAGE_WIDTH, 1678);
  assert.equal(ISLAND_IMAGE_HEIGHT, 937);
  assert.equal(ISLAND_HEIGHT, 2000 * ISLAND_IMAGE_HEIGHT / ISLAND_IMAGE_WIDTH);
  assert.equal(islandProfile.width, ISLAND_WIDTH);
  assert.equal(islandProfile.height, ISLAND_HEIGHT);
  assert.equal(islandProfile.id, 'islands');
  assert.equal(validRoutes(islandProfile.routes), true);
  assert.equal(islandProfile.storageKey, 'play-your-life-live-city-routes-islands-v2');
  assert.notEqual(islandProfile.storageKey, routeStorageKey);

  let usedKey = '';
  assert.deepEqual(readRoutes({ getItem: key => { usedKey = key; return null; } }, islandProfile), islandProfile.routes);
  assert.equal(usedKey, islandProfile.storageKey);
  for (const kind of ['road', 'water', 'pedestrian'] as const) {
    assert.ok(islandProfile.routes.some(route => route.kind === kind), `нет маршрутов ${kind}`);
  }
  for (const route of islandProfile.routes.filter(route => route.kind === 'water')) {
    assert.ok(boatsByRoute[route.id]?.length, `${route.id} должен выбирать существующий флот`);
  }
});

test('Острова: десять фасадов с психологией и отдельным парком; формы эффектов корректны', () => {
  assert.equal(islandBuildings.length, 10);
  const ids = islandBuildings.map(building => building.id);
  assert.equal(new Set(ids).size, 10);
  assert.deepEqual([...ids].sort(), ['driving', 'english', 'finance', 'growth', 'health', 'hobby', 'psychology', 'sport', 'tasks', 'together']);
  assert.ok(ids.includes('psychology'));
  for (const box of islandBuildings) {
    assert.ok(box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0, box.id);
    assert.ok(box.x + box.width <= 100 && box.y + box.height <= 100, box.id);
  }

  assert.equal(islandProfile.fountains.length, 11);
  assert.ok(islandProfile.fountains.some(fountain => fountain.id === 'park-front'));
  assert.ok(islandProfile.fountains.some(fountain => fountain.id === 'psychology'));
  for (const fountain of islandProfile.fountains) {
    assert.ok(fountain.center.x >= 0 && fountain.center.x <= 1 && fountain.center.y >= 0 && fountain.center.y <= 1, fountain.id);
    assert.ok(fountain.rx > 0 && fountain.ry > 0 && fountain.height > 0, fountain.id);
  }
  assert.ok(islandProfile.waterfalls.length >= 10);
  assert.ok(islandProfile.waterRegions.length >= 3);
  for (const region of islandProfile.waterRegions) {
    assert.ok(region.length >= 3);
    for (const [x, y] of region) assert.ok(x >= 0 && x <= ISLAND_WIDTH && y >= 0 && y <= ISLAND_HEIGHT);
  }
  assert.deepEqual(islandProfile.bridgeMasks, []);
  assert.ok(islandProfile.occluders?.some(([x, y, rx, ry]) => x / ISLAND_WIDTH > .44 && x / ISLAND_WIDTH < .52 && y / ISLAND_HEIGHT > .38 && y / ISLAND_HEIGHT < .46 && rx > 0 && ry > 0));
});

test('Острова: траектории не выходят за карту и остаются непрерывными', () => {
  for (const route of islandProfile.routes) {
    const path = new LanePath(route, islandProfile);
    assert.ok(path.length > 10, route.id);
    for (let distance = 0; distance < path.length; distance += 1) {
      const here = path.at(distance);
      const next = path.at(Math.min(path.length, distance + 1));
      assert.ok(here.x >= 0 && here.x <= ISLAND_WIDTH && here.y >= 0 && here.y <= ISLAND_HEIGHT, route.id);
      assert.ok(Math.hypot(next.x - here.x, next.y - here.y) <= 1.01, `${route.id} имеет скачок`);
    }
    if (route.closed) {
      const end = path.at(path.length - .1), start = path.at(.1);
      assert.ok(Math.hypot(end.x - start.x, end.y - start.y) < .21, `${route.id} не замкнут`);
    }
  }
});

test('Острова: mobile MEDIUM и HIGH движут все виды без пересечения радиусов', () => {
  const modes = [
    ['mobile-medium', 'auto'],
    ['mobile-high', 'high'],
  ] as const;
  for (const [label, mode] of modes) {
    const quality = new QualityManager(mode, true, islandProfile.budgets!);
    assert.equal(quality.level, label === 'mobile-medium' ? 'medium' : 'high');
    const budget = quality.budget;
    const sim = new CitySimulation(islandProfile.routes, 8721, islandProfile);
    sim.initialize(budget);
    const moving = { road: 0, water: 0, pedestrian: 0 };
    for (let step = 0; step < 1200; step++) {
      sim.step(1 / 30, budget);
      if (step % 15) continue;
      for (const kind of ['road', 'water', 'pedestrian'] as const) {
        moving[kind] += sim.agents.filter(agent => agent.kind === kind && agent.currentSpeed > (kind === 'pedestrian' ? .4 : 1)).length;
      }
      for (const kind of ['road', 'water'] as const) {
        const agents = sim.agents.filter(agent => agent.kind === kind);
        for (const [index, agent] of agents.entries()) for (const other of agents.slice(index + 1)) {
          assert.ok(Math.hypot(agent.position.x - other.position.x, agent.position.y - other.position.y) >= agent.safeRadius + other.safeRadius - .01, `${label}: ${agent.path.route.id}/${other.path.route.id}`);
        }
      }
    }
    for (const kind of ['road', 'water', 'pedestrian'] as const) assert.ok(moving[kind] > 20, `${label}: ${kind} не движется`);
    for (const kind of ['road', 'water', 'pedestrian'] as const) assert.ok(sim.agents.filter(agent => agent.kind === kind).length <= budget[kind], `${label}: превышен ${kind}-бюджет`);
  }
});

test('Острова: лодочные траектории целиком внутри водного клипа', () => {
  const inside = (x: number, y: number, polygon: number[][]) => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
    }
    return result;
  };
  for (const route of islandProfile.routes.filter(value => value.kind === 'water')) {
    const path = new LanePath(route, islandProfile);
    for (let distance = 0; distance <= path.length; distance += 2) {
      const point = path.at(distance);
      assert.ok(islandProfile.waterRegions.some(region => inside(point.x, point.y, region)), `${route.id}: судно исчезает из водного клипа на ${distance}`);
    }
  }
});

test('Острова: ноги жителей не заходят в чаши фонтанов', () => {
  for (const route of islandProfile.routes.filter(value => value.kind === 'pedestrian')) {
    const path = new LanePath(route, islandProfile);
    for (let distance = 0; distance <= path.length; distance += 1) {
      const point = path.at(distance);
      for (const fountain of islandProfile.fountains) {
        const x = (point.x - fountain.center.x * islandProfile.width) / fountain.rx;
        const y = (point.y - fountain.center.y * islandProfile.height) / fountain.ry;
        assert.ok(x * x + y * y >= 1, `${route.id}: житель заходит в фонтан ${fountain.id}`);
      }
    }
  }
});

test('Острова: после переключения на мобильное качество лодки не блокируются встречными трассами', () => {
  const sim = new CitySimulation(islandProfile.routes, 8721, islandProfile);
  sim.initialize(islandProfile.budgets!.high);
  let samples = 0, stopped = 0;
  for (let step = 0; step < 3600; step++) {
    sim.step(1 / 30, step < 900 ? islandProfile.budgets!.high : islandProfile.budgets!.medium);
    if (step > 900 && step % 10 === 0) {
      samples++;
      if (!sim.agents.some(agent => agent.kind === 'water' && agent.currentSpeed > 1)) stopped++;
    }
  }
  assert.ok(stopped <= samples * .03, `Флот не должен останавливаться надолго: ${stopped}/${samples}`);
});
