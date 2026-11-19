import test from 'node:test';
import assert from 'node:assert/strict';
import { shownSphereProgress, sphereProgress } from '../src/sphereProgress.ts';
import { cleanStageName } from '../src/planImport.ts';

const base = { spheres: { sport: { xp: 50 }, english: { xp: 0 }, driving: { xp: 900 } }, goals: [{ id: 'g1', sphere: 'sport' }, { id: 'g2', sphere: 'driving' }, { id: 'g3', sphere: 'english' }], quests: [{ goalId: 'g1', sphere: 'sport' }, { goalId: 'g2', sphere: 'driving' }] };

test('сфера с задачами в проекте показывает LVL 1', () => {
  assert.equal(sphereProgress(50).level, 0);
  const shown = shownSphereProgress(base, 'sport');
  assert.equal(shown.level, 1);
  assert.equal(shown.currentXP, 50);
  assert.equal(shown.requiredXP, 400);
});

test('проект без задач и высокий уровень не меняются', () => {
  assert.equal(shownSphereProgress(base, 'english').level, 0);
  assert.equal(shownSphereProgress(base, 'driving').level, sphereProgress(900).level);
});

test('дубль «Этап N ·» убирается из названия этапа', () => {
  assert.equal(cleanStageName('Этап 8 · Экзамен в ГИБДД'), 'Экзамен в ГИБДД');
  assert.equal(cleanStageName('Подготовка'), 'Подготовка');
});
