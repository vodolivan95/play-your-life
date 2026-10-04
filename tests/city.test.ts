import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import {
  buildingState,
  upgradeBuilding,
  buyCityDecor,
  placeCityDecor,
  changeBuildingStyle,
  validCity,
} from '../src/city.ts';
import { backupText, restoreBackup } from '../src/backup.ts';
test('улучшение здания списывает монеты, требует уровень и не начисляет XP', () => {
  const s = initialState();
  const next = upgradeBuilding(s, 'health', 1);
  assert.equal(next.coins, s.coins - 60);
  assert.equal(buildingState(next, 'health').tier, 2);
  assert.equal(next.xp, s.xp);
  assert.deepEqual(next.spheres, s.spheres);
  assert.equal(s.city, undefined);
  assert.throws(() => upgradeBuilding(next, 'health', 1), /изменилось/);
  assert.throws(
    () => upgradeBuilding({ ...next, coins: 0 }, 'health', 2),
    /Недостаточно/,
  );
  assert.throws(
    () =>
      upgradeBuilding(
        {
          ...s,
          spheres: { ...s.spheres, health: { ...s.spheres.health, xp: 0 } },
        },
        'health',
        1,
      ),
    /уровень/,
  );
  const max = upgradeBuilding({ ...next, coins: 1000 }, 'health', 2);
  assert.throws(() => upgradeBuilding(max, 'health', 3), /Максимальное/);
});
test('предмет приобретается один раз и свободно переставляется без новых списаний', () => {
  const s = initialState();
  let next = buyCityDecor(s, 'health', 'palm');
  assert.equal(next.coins, s.coins - 15);
  assert.equal(buyCityDecor(next, 'health', 'palm'), next);
  assert.throws(
    () => buyCityDecor({ ...s, coins: 0 }, 'health', 'palm'),
    /Недостаточно/,
  );
  assert.throws(() => buyCityDecor(s, 'health', 'unknown'));
  assert.throws(() => placeCityDecor(next, 'health', 'bench', 0), /приобрети/);
  next = placeCityDecor(next, 'health', 'palm', 0);
  next = placeCityDecor(next, 'health', 'palm', 2);
  assert.deepEqual(buildingState(next, 'health').slots, [null, null, 'palm']);
  assert.equal(next.coins, s.coins - 15);
  next = placeCityDecor(next, 'health', null, 2);
  assert.deepEqual(buildingState(next, 'health').slots, [null, null, null]);
  assert.throws(() => placeCityDecor(next, 'health', 'palm', 3));
});
test('оформление и окружение независимы по сферам и сохраняются в резервной копии', () => {
  let s = changeBuildingStyle(initialState(), 'english', 'tropical');
  s = buyCityDecor(s, 'english', 'flowers');
  s = placeCityDecor(s, 'english', 'flowers', 1);
  assert.equal(buildingState(s, 'sport').style, 'coastal');
  assert.equal(buildingState(s, 'english').style, 'tropical');
  assert.deepEqual(restoreBackup(backupText(s)), s);
  assert.equal(validCity(s.city), true);
  assert.equal(
    validCity({
      buildings: {
        english: {
          tier: 2,
          style: 'tropical',
          owned: [],
          slots: ['palm', null, null],
        },
      },
    }),
    false,
  );
  assert.equal(
    validCity({
      buildings: {
        unknown: {
          tier: 1,
          style: 'coastal',
          owned: [],
          slots: [null, null, null],
        },
      },
    }),
    false,
  );
  assert.throws(() =>
    restoreBackup(
      backupText({
        ...s,
        city: {
          buildings: {
            english: {
              tier: 7,
              style: 'coastal',
              owned: [],
              slots: [null, null, null],
            },
          },
        },
      }),
    ),
  );
});
