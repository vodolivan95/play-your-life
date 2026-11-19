import test from 'node:test';
import assert from 'node:assert/strict';
import { shownSphereProgress, sphereProgress } from '../src/sphereProgress.ts';
import { cleanStageName, hasDuplicatedStageNames, tidyPlanStageNames } from '../src/planImport.ts';
import type { GameState } from '../src/game.ts';

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

test('этап из одного префикса не зацикливает миграцию', () => {
  const state = { goals: [{ id: 'pi-1', stages: [{ id: 's1', name: 'Этап 1.' }, { id: 's2', name: 'Этап 2 · Теория' }] }] } as unknown as GameState;
  assert.equal(hasDuplicatedStageNames(state), true);
  const once = tidyPlanStageNames(state);
  assert.deepEqual(once.goals[0].stages?.map((s) => s.name), ['Этап 1.', 'Теория']);
  assert.equal(hasDuplicatedStageNames(once), false);
  assert.equal(tidyPlanStageNames(once), once);
});
