import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { islandBuildings, islandProfile } from '../src/cityLive/islandMap.ts';
import { initialState } from '../src/game.ts';
import { buildingState, changeBuildingStyle, validCity, cityRooms } from '../src/city.ts';
import { backupText, restoreBackup } from '../src/backup.ts';

test('Новая карта: здание психологии есть, отдельных парковых зон и маркеров нет', () => {
  assert.equal(islandBuildings.filter(building => building.id === 'psychology').length, 1);
  assert.ok(islandProfile.routes.some(route => route.kind === 'pedestrian'));
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
