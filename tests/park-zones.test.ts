import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parkZones } from '../src/parkZones.ts';
import { islandBuildings, islandProfile } from '../src/cityLive/islandMap.ts';
import { initialState } from '../src/game.ts';
import { buildingState, changeBuildingStyle, validCity, cityRooms } from '../src/city.ts';
import { backupText, restoreBackup } from '../src/backup.ts';

 test('Парк: три понятные интерактивные зоны находятся отдельно от входа в психологию', () => {
  assert.deepEqual(parkZones.map(zone => zone.id), ['walk', 'rest', 'fountain']);
  assert.deepEqual(parkZones.map(zone => zone.label), ['Прогулка', 'Отдых', 'Фонтан']);
  const psychology = islandBuildings.find(building => building.id === 'psychology')!;
  for (const zone of parkZones) {
    assert.ok(zone.x > 44 && zone.x < 65 && zone.y > 75 && zone.y < 95, zone.id);
    assert.ok(zone.description.length > 40 && zone.tip.length > 40, zone.id);
    assert.ok(zone.x < psychology.x, 'Зона не перекрывает здание психологии');
  }
  const walk = islandProfile.routes.find(route => route.id === 'islands-walk-park')!;
  assert.equal(walk.kind, 'pedestrian');
  assert.ok(walk.points.every(point => point.x < psychology.x / 100));
  const fountain = islandProfile.fountains.find(value => value.id === 'park-front')!;
  const buildingFountain = islandProfile.fountains.find(value => value.id === 'psychology')!;
  assert.ok(Math.hypot(fountain.center.x - buildingFountain.center.x, fountain.center.y - buildingFountain.center.y) > .1);
});

 test('Парк: круглые 44px маркеры не перекрывают друг друга или края на мобильной карте', () => {
  for (const width of [360, 390, 412, 430]) {
    const mapWidth = width * 1.75;
    const mapHeight = mapWidth * islandProfile.height / islandProfile.width;
    const centers = parkZones.map(zone => ({ id: zone.id, x: zone.x * mapWidth / 100, y: zone.y * mapHeight / 100 }));
    for (const [index, center] of centers.entries()) {
      assert.ok(center.x >= 22 && center.x <= mapWidth - 22 && center.y >= 22 && center.y <= mapHeight - 22, center.id);
      for (const other of centers.slice(index + 1)) assert.ok(Math.hypot(center.x - other.x, center.y - other.y) >= 44, `${width}: ${center.id}/${other.id}`);
    }
  }
});

 test('Психология: старый прогресс не мигрируется; новое состояние здания совместимо с backup', () => {
  const state = initialState();
  const original = JSON.stringify(state);
  assert.equal(buildingState(state, 'psychology').tier, 1);
  assert.ok(cityRooms.psychology);
  assert.equal(JSON.stringify(state), original, 'Чтение нового здания не меняет сохранение');
  const updated = changeBuildingStyle(state, 'psychology', 'modern');
  assert.equal(buildingState(updated, 'psychology').style, 'modern');
  assert.deepEqual(updated.spheres, state.spheres);
  assert.equal(updated.coins, state.coins);
  assert.equal(validCity(updated.city), true);
  assert.deepEqual(restoreBackup(backupText(updated)), updated);
});

test('Психология: пользовательская неоновая иконка имеет приоритет над общим реестром зданий', () => {
  const source = readFileSync(new URL('../src/components/GameArt.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes("../assets/psychology-icon.png"));
  const customIcon = source.indexOf("if (kind === 'psychology')");
  const genericIcon = source.indexOf('if (citySphereIds.includes');
  assert.ok(customIcon >= 0 && customIcon < genericIcon);
});
