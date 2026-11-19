import assert from 'node:assert/strict';
import test from 'node:test';
import { importPlan, parsePlanFile } from '../src/planImport.ts';
import { newAccountGame } from '../src/accountGame.ts';
import { validateState } from '../src/stateValidation.ts';

const plan = JSON.stringify({
  format: 'pyl-plan', version: 1,
  projects: [
    { id: 'pi-driving', name: 'Вождение', sphere: 'driving', stages: [{ id: 'pi-driving-s1', name: 'Этап 1' }, { id: 'pi-driving-s2', name: 'Этап 2' }], tasks: [
      { id: 'pi-driving-t1', name: 'Подготовить программу', difficulty: 'Simple', stageId: 'pi-driving-s1', done: true },
      { id: 'pi-driving-t2', name: 'Выучить ПДД', difficulty: 'Medium', stageId: 'pi-driving-s2', dueAt: '2099-12-31', notes: 'Баллы: 3' },
      { id: 'pi-driving-t3', name: 'Старая задача', difficulty: 'Hard', dueAt: '2023-12-31' },
    ] },
    { id: 'pi-x', name: 'Неизвестная сфера', sphere: 'nope', tasks: [{ id: 'pi-x-t1', name: 'x', difficulty: 'Simple' }] },
  ],
});

test('загрузка плана: проекты, этапы, задачи и закрытие выполненных', () => {
  const state = newAccountGame('Тест');
  const file = parsePlanFile(plan, Object.keys(state.spheres));
  assert.equal(file.projects.length, 1, 'проект с неизвестной сферой отброшен');
  const r = importPlan(state, file, 'uid-1');
  assert.equal(r.projects, 1);
  assert.equal(r.tasks, 3);
  assert.equal(r.completed, 1);
  const goal = r.state.goals.find((g) => g.id === 'pi-driving')!;
  assert.equal(goal.stages?.length, 2);
  const done = r.state.quests.find((q) => q.id === 'pi-driving-t1')!;
  assert.equal(done.done, true);
  assert.ok(r.state.xp > state.xp, 'за выполненную задачу начислен XP');
  assert.equal(r.state.quests.find((q) => q.id === 'pi-driving-t2')!.dueAt, '2099-12-31');
  assert.equal(r.state.quests.find((q) => q.id === 'pi-driving-t3')!.dueAt, undefined, 'прошедший срок не делает задачу просроченной');
  assert.doesNotThrow(() => validateState({ ...r.state, version: 1 }), 'сохранение после загрузки проходит проверку');
  const again = importPlan(r.state, file, 'uid-1');
  assert.equal(again.tasks, 0, 'повторная загрузка без дублей');
  assert.equal(again.projects, 0);
  assert.equal(again.skipped, 3);
});

test('файл не того формата отклоняется', () => {
  assert.throws(() => parsePlanFile('{"format":"x"}', ['driving']), /не файл плана/);
  assert.throws(() => parsePlanFile('нет', ['driving']), /не JSON/);
});
