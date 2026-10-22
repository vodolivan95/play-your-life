import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState, migrateState, completeQuest, removeQuest } from '../src/game.ts';
import { saveGoal, saveStage, saveTask, deleteGoal } from '../src/planning.ts';
import { validateState } from '../src/stateValidation.ts';
import { restoreBackup } from '../src/backup.ts';
import { updateTaskSettings } from '../src/taskSettings.ts';
import { newConnection, syncTickTick, applyTickTickResult } from '../src/ticktick.ts';
import { acceptIncomingTask, findIncomingTasks } from '../src/ticktickInbox.ts';

// Главное требование: любое состояние, которое создаёт приложение, должно проходить проверку и переживать сохранение и загрузку.
function personal() {
  const s = initialState();
  s.profile = { ...s.profile, mode: 'personal', onboardingComplete: true };
  s.goals = [];
  s.quests = [];
  s.mainGoalId = null;
  return s;
}
function roundtrip(state: ReturnType<typeof initialState>) {
  validateState(state);
  const restored = restoreBackup(JSON.stringify(state));
  return migrateState(JSON.parse(JSON.stringify(restored)));
}
test('цели «Вылечить зубы» и «Бросить курить» с этапами и задачами переживают сохранение и загрузку', () => {
  let s = personal();
  s = saveGoal(s, { name: 'Вылечить зубы', sphere: 'health', target: 100, reward: 100, progressMode: 'tasks' });
  s = saveGoal(s, { name: 'Бросить курить', sphere: 'health', target: 100, reward: 100, progressMode: 'tasks' });
  const teeth = s.goals.find((g) => g.name === 'Вылечить зубы')!;
  s = saveStage(s, teeth.id, { name: 'Лечение', status: 'active' });
  const stage = s.goals.find((g) => g.id === teeth.id)!.stages!.at(-1)!;
  s = saveTask(s, { id: 't1', name: 'Запись к врачу', sphere: 'health', difficulty: 'Medium', goalId: teeth.id, stageId: stage.id, dueAt: '2026-11-05T09:00:00.000Z' });
  s = saveTask(s, { id: 't2', name: 'Одиночная', sphere: 'health', difficulty: 'Hard', sourceType: 'USER_CREATED', ownerId: 'u1', rewardCoins: 0 });
  s = updateTaskSettings(s, 't2', { sync: false });
  const back = roundtrip(s);
  assert.deepEqual(back.goals.map((g) => g.name).sort(), ['Бросить курить', 'Вылечить зубы']);
  assert.equal(back.quests.length, 2);
  // Выполнение и удаление задач не удаляют цель.
  let next = completeQuest(back, 't1');
  next = removeQuest(next, 't2');
  assert.equal(roundtrip(next).goals.length, 2);
});
test('цель не пропадает после приёма всех задач из входящих, выполнения и удаления в TickTick', async () => {
  let s = personal();
  s = saveGoal(s, { name: 'Вылечить зубы', sphere: 'health', target: 100, reward: 100, progressMode: 'tasks' });
  const goal = s.goals[0];
  const connection = newConnection('https://bridge.example/');
  connection.projectId = 'life';
  connection.sphereLists = { health: 'life' };
  const remote = { id: 'r1', projectId: 'life', title: 'Запись к врачу', status: 0, dueDate: '2026-11-05T09:00:00+0000' };
  const incoming = findIncomingTasks(connection, { life: [remote] })[0];
  const accepted = acceptIncomingTask(s, connection, incoming, { sphere: 'health', goalId: goal.id }, 'a1');
  s = roundtrip(accepted.state);
  assert.equal(s.goals.length, 1);
  // Задачу удалили в TickTick: цель и сохранение остаются.
  const request = async <T,>(path: string): Promise<T> => {
    if (/\/data$/.test(path)) return { tasks: [] } as T;
    throw new Error('Не найдено (404)');
  };
  const result = applyTickTickResult(s, await syncTickTick(s, accepted.connection, request));
  assert.equal(result.state.quests.length, 0);
  assert.equal(roundtrip(result.state).goals.length, 1);
  // Цель, у которой нет задач, остаётся видимой и не считается выполненной.
  const g = result.state.goals[0];
  assert.ok(g.current < g.target, 'цель без задач не должна становиться выполненной');
});
test('удаление цели возможно только явным действием', () => {
  let s = personal();
  s = saveGoal(s, { name: 'Бросить курить', sphere: 'health', target: 100, reward: 100, progressMode: 'tasks' });
  const id = s.goals[0].id;
  assert.equal(s.goals.length, 1);
  assert.equal(deleteGoal(s, id).goals.length, 0);
});

test('одиночная задача из входящих проходит проверку и сохраняется', () => {
  const s = personal();
  const connection = newConnection('https://bridge.example/');
  connection.projectId = 'life';
  connection.sphereLists = { health: 'life' };
  const incoming = findIncomingTasks(connection, { life: [{ id: 'r1', projectId: 'life', title: 'X', status: 0 }] })[0];
  const accepted = acceptIncomingTask(s, connection, incoming, { sphere: 'health' }, 'a1', 'u1');
  assert.equal(roundtrip(accepted.state).quests.length, 1);
});
test('сохранение 0.34–0.36.1 с битой одиночной задачей чинится при загрузке, цели остаются', () => {
  let s = personal();
  s = saveGoal(s, { name: 'Бросить курить', sphere: 'health', target: 100, reward: 100, progressMode: 'tasks' });
  s = saveTask(s, { id: 'old', name: 'Старая', sphere: 'health', difficulty: 'Medium', sourceType: 'USER_CREATED' });
  assert.throws(() => validateState(JSON.parse(JSON.stringify(s))));
  const back = restoreBackup(JSON.stringify(s));
  assert.equal(back.goals.length, 1);
  assert.equal(back.quests.length, 1);
});
test('реальное облачное сохранение до «Психологии» (версия < 0.53.0) загружается, а не отклоняется валидацией', () => {
  // Воспроизводит настоящий баг на живом аккаунте: validateState() требовала запись
  // по КАЖДОЙ из 10 сфер (включая новую «psychology») и в state.spheres, и в
  // monthlyTracking.scores — любое старое сохранение, сделанное до появления
  // десятой сферы (0.53.0), не могло пройти проверку и откатывалось в экран
  // «Не удалось связаться с облаком», хотя сама сеть и Firestore работали. migrateState()
  // умел дополнять недостающие сферы, но до этого не добирался — validateState() кидала
  // исключение раньше, а accountPersistence.ts молча превращал его в этот экран.
  const s = personal();
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  delete (raw.spheres as Record<string, unknown>).psychology;
  delete ((raw.monthlyTracking as { scores: Record<string, unknown> }).scores).psychology;
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(raw))));
  const restored = restoreBackup(JSON.stringify(raw));
  assert.deepEqual(restored.spheres.psychology, { xp: 0, score: 0, highScore: 0, previousScore: 0 });
  assert.equal(restored.monthlyTracking?.scores.psychology, 0);
});
