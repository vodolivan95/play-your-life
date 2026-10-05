import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { backupText, restoreBackup } from '../src/backup.ts';
import { moveRoomObject, placementValid, placeRoomObject, purchaseRoomObject, removeRoomObject, roomData, validRooms } from '../src/roomEngine.ts';
import type { RoomObject } from '../src/roomEngine.ts';
function player() { const state = newAccountGame('3D тест'); state.coins = 1450; state.spheres.sport.xp = 3600; return state; }
const treadmill: RoomObject = { id: 'treadmill', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
test('пустая новая комната, покупка за 800 Coins и защита от повторного списания', () => {
  const state = player();
  assert.deepEqual(roomData(state, 'sport'), { purchased: [], objects: [] });
  const bought = purchaseRoomObject(state, 'sport', 'treadmill');
  assert.equal(bought.coins, 650);
  assert.equal(state.coins, 1450);
  assert.equal(roomData(bought, 'sport').objects.length, 0);
  assert.throws(() => purchaseRoomObject(bought, 'sport', 'treadmill'), /уже куплен/);
  assert.throws(() => purchaseRoomObject({ ...state, coins: 799 }, 'sport', 'treadmill'), /Недостаточно/);
  const locked = player(); locked.spheres.sport.xp = 0;
  assert.throws(() => purchaseRoomObject(locked, 'sport', 'treadmill'), /уровень/);
  assert.throws(() => purchaseRoomObject(state, 'health', 'treadmill'), /недоступен/);
});
test('установка, перенос, поворот, инвентарь и перезагрузка через резервную копию', () => {
  let state = purchaseRoomObject(player(), 'sport', 'treadmill');
  assert.throws(() => placeRoomObject(player(), 'sport', treadmill), /купи/);
  state = placeRoomObject(state, 'sport', treadmill);
  assert.throws(() => placeRoomObject(state, 'sport', treadmill), /уже установлен/);
  const moved = { ...treadmill, position: [2, 0, 1] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] };
  state = moveRoomObject(state, 'sport', moved);
  const restored = restoreBackup(backupText(state));
  assert.deepEqual(roomData(restored, 'sport').objects[0], moved);
  assert.equal(restored.coins, 650);
  const removed = removeRoomObject(restored, 'sport', 'treadmill');
  assert.equal(roomData(removed, 'sport').objects.length, 0);
  assert.deepEqual(roomData(removed, 'sport').purchased, ['treadmill']);
  assert.equal(removed.coins, 650);
});
test('пересечения, стены, дробная сетка, наклон и масштаб не допускаются', () => {
  let state = purchaseRoomObject(player(), 'sport', 'treadmill');
  state = placeRoomObject(state, 'sport', treadmill);
  state = purchaseRoomObject(state, 'sport', 'mat');
  const mat: RoomObject = { id: 'mat', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  assert.throws(() => placeRoomObject(state, 'sport', mat), /занято/);
  assert.equal(placementValid(roomData(state, 'sport'), { ...treadmill, position: [5, 0, 4] }, 'sport'), false);
  assert.equal(placementValid(roomData(state, 'sport'), { ...mat, position: [3.5, 0, 2] }, 'sport'), false);
  assert.equal(placementValid(roomData(state, 'sport'), { ...mat, rotation: [0, .3, 0] }, 'sport'), false);
  assert.equal(placementValid(roomData(state, 'sport'), { ...mat, scale: [2, 2, 2] }, 'sport'), false);
  assert.equal(placementValid(roomData(state, 'sport'), { ...mat, position: [3, 0, 2] }, 'sport'), true);
});
test('валидация отклоняет повреждённые и пересекающиеся сохранения', () => {
  assert.equal(validRooms({ sport: { purchased: ['treadmill'], objects: [null] } }), false);
  assert.equal(validRooms({ constructor: { purchased: [], objects: [] } }), false);
  assert.equal(validRooms({ sport: { purchased: [], objects: [treadmill] } }), false);
  assert.equal(validRooms({ sport: { purchased: ['treadmill', 'mat'], objects: [treadmill, { ...treadmill, id: 'mat' }] } }), false);
  assert.equal(validRooms({ sport: { purchased: ['treadmill'], objects: [treadmill] } }), true);
});
