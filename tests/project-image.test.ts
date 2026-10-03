import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { saveGoal } from '../src/planning.ts';
import { backupText, restoreBackup } from '../src/backup.ts';
import { validProjectImage } from '../src/projectImage.ts';
const image = 'data:image/jpeg;base64,/9j/AA==';
test('картинка проекта сохраняется, заменяется и убирается без изменения XP и задач', () => {
  const state = initialState();
  const goal = state.goals[0];
  const custom = saveGoal(state, { ...goal, image });
  assert.equal(custom.goals[0].image, image);
  assert.equal(custom.xp, state.xp);
  assert.deepEqual(custom.quests, state.quests);
  assert.equal(restoreBackup(backupText(custom)).goals[0].image, image);
  const removed = saveGoal(custom, { ...custom.goals[0], image: undefined });
  assert.equal(removed.goals[0].image, undefined);
  assert.equal(removed.goals[0].id, goal.id);
});
test('в проект нельзя сохранить ссылку, SVG или слишком большое изображение', () => {
  assert.equal(validProjectImage(undefined), true);
  assert.equal(validProjectImage(image), true);
  for (const bad of [
    'https://example.com/photo.jpg',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'javascript:alert(1)',
    'data:image/jpeg;base64,' + 'A'.repeat(160001),
  ]) {
    assert.equal(validProjectImage(bad), false);
    const state = initialState();
    assert.throws(() => saveGoal(state, { ...state.goals[0], image: bad }));
    state.goals[0].image = bad;
    assert.throws(() => restoreBackup(backupText(state)));
  }
});
