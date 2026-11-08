import assert from 'node:assert/strict';
import test from 'node:test';
import { newAccountGame } from '../src/accountGame.ts';
import { completeQuest, removeQuest, reopenQuest } from '../src/game.ts';
import { duplicateQuest, progressQuest } from '../src/personalQuests.ts';
import { quickPlanningTask, setTaskDependencies, setTaskWorkflow } from '../src/planner.ts';
import { dependencyBlockers, validDependencyGraph } from '../src/taskDependencies.ts';
import { validateState } from '../src/stateValidation.ts';
import { backupText, restoreBackup } from '../src/backup.ts';
import { mergeStates } from '../src/stateMerge.ts';
import { updateTaskSettings } from '../src/taskSettings.ts';

function setup() {
  let s = quickPlanningTask(newAccountGame('Проверка'), 'Предшественник', 'u');
  s = quickPlanningTask(s, 'Следующий шаг', 'u');
  return s;
}
test('зависимости блокируют начало, прогресс и завершение через общие обработчики', () => {
  let s = setup(); const [a, b] = s.quests;
  s = setTaskDependencies(s, b.id, [a.id], 'u');
  assert.equal(dependencyBlockers(s.quests, s.quests[1]).length, 1);
  assert.equal(completeQuest(s, b.id), s);
  assert.throws(() => setTaskWorkflow(s, b.id, 'doing', 'u'), /предшественники/);
  assert.throws(() => progressQuest(s, b.id, 1, 'u'), /предшественники/);
  assert.equal(s.xp, 0);
  s = progressQuest(s, a.id, 1, 'u');
  s = progressQuest(s, b.id, 1, 'u');
  const earned = s.xp;
  s = reopenQuest(s, b.id); s = progressQuest(s, b.id, 1, 'u');
  assert.equal(s.xp, earned);
  assert.equal(s.quests[1].done, true);
});
test('циклы, самоссылки, дубликаты и чужие предшественники отклоняются до изменения', () => {
  let s = setup(); const [a, b] = s.quests;
  s = setTaskDependencies(s, b.id, [a.id], 'u');
  const before = JSON.stringify(s);
  assert.throws(() => setTaskDependencies(s, a.id, [b.id], 'u'), /цикл/);
  assert.throws(() => updateTaskSettings(s, a.id, { planning: { dependencyIds: [b.id] } }), /цикл/);
  assert.throws(() => setTaskDependencies(s, a.id, [a.id], 'u'));
  assert.throws(() => setTaskDependencies(s, b.id, [a.id, a.id], 'u'));
  assert.throws(() => setTaskDependencies(s, b.id, [a.id], 'other'));
  assert.equal(JSON.stringify(s), before);
});
test('удалённая задача остаётся явной блокировкой, связь можно убрать', () => {
  let s = setup(); const [a, b] = s.quests;
  s = setTaskDependencies(s, b.id, [a.id], 'u');
  s = removeQuest(s, a.id);
  assert.equal(dependencyBlockers(s.quests, s.quests[0])[0].missing, true);
  assert.equal(completeQuest(s, b.id), s);
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
  s = setTaskDependencies(s, b.id, [], 'u');
  assert.equal(progressQuest(s, b.id, 1, 'u').quests[0].done, true);
});
test('backup и копирование сохраняют связи, циклический импорт отклоняется', () => {
  let s = setup(); const [a, b] = s.quests;
  s = setTaskDependencies(s, b.id, [a.id], 'u');
  assert.deepEqual(restoreBackup(backupText(s)).quests[1].planning?.dependencyIds, [a.id]);
  assert.deepEqual(duplicateQuest(s, b.id, 'u').quests[2].planning?.dependencyIds, [a.id]);
  const invalid = structuredClone(s); invalid.quests[0].planning = { dependencyIds: [b.id] };
  assert.throws(() => restoreBackup(backupText(invalid)));
});
test('одновременные связи двух клиентов не сохраняются как цикл', () => {
  const base = setup(); const [a, b] = base.quests;
  const local = setTaskDependencies(base, a.id, [b.id], 'u');
  const remote = setTaskDependencies(base, b.id, [a.id], 'u');
  assert.throws(() => validateState(mergeStates(base, local, remote)));
  assert.doesNotThrow(() => validateState(local));
  assert.doesNotThrow(() => validateState(remote));
});
test('проверка длинной цепочки и цикла не переполняет стек', () => {
  const template = setup().quests[0];
  const qs = Array.from({ length: 12000 }, (_, i) => ({ ...template, id: String(i), planning: { dependencyIds: i ? [String(i - 1)] : [] } }));
  assert.equal(validDependencyGraph(qs), true);
  qs[0].planning.dependencyIds = ['11999'];
  assert.equal(validDependencyGraph(qs), false);
});
