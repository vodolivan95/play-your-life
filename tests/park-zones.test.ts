import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { islandBuildings, islandProfile } from '../src/cityLive/islandMap.ts';
import { initialState } from '../src/game.ts';
import { buildingState, changeBuildingStyle, validCity, cityRooms } from '../src/city.ts';
import { backupText, restoreBackup } from '../src/backup.ts';

test('Парк: изолированная терраса, одиннадцать фонтанов и вход психологии сохранены без экранных точек', () => {
  const psychology = islandBuildings.find(building => building.id === 'psychology')!;
  assert.equal(islandBuildings.filter(building => building.id === 'psychology').length, 1);
  assert.equal(islandProfile.fountains.length, 11);
  const fountain = islandProfile.fountains.find(value => value.id === 'park-front')!;
  const buildingFountain = islandProfile.fountains.find(value => value.id === 'psychology')!;
  assert.ok(Math.hypot(fountain.center.x - buildingFountain.center.x, fountain.center.y - buildingFountain.center.y) > .1);
  const walk = islandProfile.routes.find(route => route.id === 'islands-walk-park')!;
  assert.equal(walk.kind, 'pedestrian');
  assert.ok(walk.points.every(point => point.x < psychology.x / 100), 'Пешеходный маршрут парка отделён от входа психологии');
  const source = readFileSync(new URL('../src/components/CoastalCity.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:ParkZones|ParkMarkers|ParkPanel|parkZones)\b/);
  assert.doesNotMatch(source, /(?:park-marker|park-tooltip|park-panel|park-walk-path|data-park-zone)/);
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
