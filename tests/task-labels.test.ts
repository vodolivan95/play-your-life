import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { saveCustomQuest } from '../src/personalQuests.ts';
import { validateState } from '../src/stateValidation.ts';
import { validTaskLabels } from '../src/taskLabels.ts';

test('task labels: names are unique, trimmed, bounded and safe', () => {
  assert.equal(validTaskLabels([{ id: 'home', name: 'Дом' }]), true);
  assert.equal(validTaskLabels([{ id: 'home', name: 'Дом' }, { id: 'work', name: 'дом' }]), false);
  assert.equal(validTaskLabels([{ id: 'home', name: ' Дом' }]), false);
  assert.equal(validTaskLabels([{ id: 'bad id', name: 'Дом' }]), false);
  assert.equal(validTaskLabels([{ id: 'home', name: `x${String.fromCharCode(10)}y` }]), false);
});

test('task labels: assigned label persists and references must resolve in saved state', () => {
  const label = { id: 'training', name: 'Тренировка' };
  const state = { ...newAccountGame('Игрок'), taskLabels: [label] };
  const saved = saveCustomQuest(state, {
    name: 'Пробежка',
    sphere: 'sport',
    difficulty: 'Medium',
    labelId: label.id,
  }, 'player');
  assert.equal(saved.quests.at(-1)?.labelId, label.id);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(saved))));
  assert.throws(() => validateState(JSON.parse(JSON.stringify({
    ...saved,
    taskLabels: [],
  }))), /повреждённые/);
  assert.throws(() => saveCustomQuest({ ...state, taskLabels: [] }, {
    name: 'Вторая задача',
    sphere: 'sport',
    difficulty: 'Medium',
    labelId: label.id,
  }, 'player'), /Метка задачи не найдена/);
});
