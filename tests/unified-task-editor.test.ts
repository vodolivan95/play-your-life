import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, completeQuest } from '../src/game.ts';
import { saveCustomQuest } from '../src/personalQuests.ts';
import { saveTask } from '../src/planning.ts';
import { updateTaskSettings } from '../src/taskSettings.ts';
import { validateState } from '../src/stateValidation.ts';
import { validTaskDetails, safeEmbeddedFile } from '../src/taskDetails.ts';
import { toggleTaskChecklist, validateTaskEditorFields } from '../src/taskEditor.ts';
import { acceptIncomingTask } from '../src/ticktickInbox.ts';
import { newConnection, remotePayload } from '../src/ticktick.ts';
import { dueTaskReminders } from '../src/taskReminders.ts';

function setup() { const s = initialState(); s.quests = []; s.goals = []; s.events = []; return s; }
const details = { motivation: 'Сделать дом удобным', participants: [{ id: 'p', name: 'Анна', phone: '+79990000000', role: 'assignee' as const }], reminders: [0, 60], notes: [{ id: 'n', text: 'Проверить план', updatedAt: '2026-01-01T10:00:00Z' }] };
test('создание сохраняет все новые поля и roundtrip не теряет данные', () => {
  const s = saveCustomQuest(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', details,
    startsAt: '2026-01-01T10:00:00Z', dueAt: '2026-01-01T12:00:00Z', deadlineAt: '2026-01-02T18:00:00Z',
    estimateMinutes: 60, repeat: 'weekly', weight: 2, required: false, subtasks: [{ id: 'a', title: 'Схема', done: false }] }, 'local');
  validateState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(s.quests[0].details, details);
  assert.equal(s.quests[0].subtasks?.length, 1);
  assert.equal(s.quests[0].estimateMinutes, 60);
  assert.equal(s.quests[0].weight, 2);
  assert.equal(s.quests[0].required, false);
  assert.equal(s.quests[0].repeat, 'weekly');
  assert.equal(s.quests[0].deadlineAt, '2026-01-02T18:00:00Z');
});
test('дедлайн независим от окончания и сохраняет время', () => {
  let s = saveTask(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', dueAt: '2026-01-01' });
  s = updateTaskSettings(s, s.quests[0].id, { deadlineAt: '2026-01-02T18:00' });
  assert.equal(s.quests[0].dueAt, '2026-01-01');
  assert.equal(Date.parse(s.quests[0].deadlineAt!), Date.parse('2026-01-02T18:00'));
  assert.throws(() => updateTaskSettings(s, s.quests[0].id, { deadlineAt: '2025-12-31' }), /дедлайна/);
  assert.throws(() => validateTaskEditorFields({ startsAt: '2026-02-30' }), /даты/);
});
test('последний пункт завершает родителя, начисляет награду один раз и не создаёт задачи', () => {
  let s = saveCustomQuest(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', rewardCoins: 4,
    subtasks: [{ id: 'a', title: 'Схема', done: false }, { id: 'b', title: 'Проверка', done: false }] }, 'local');
  const id = s.quests[0].id; const coins = s.coins;
  s = toggleTaskChecklist(s, id, 'a', true);
  assert.equal(s.quests[0].done, false);
  assert.equal(s.coins, coins);
  s = toggleTaskChecklist(s, id, 'b', true);
  assert.equal(s.quests.length, 1); assert.equal(s.quests[0].done, true); assert.equal(s.coins, coins + 4);
  assert.equal(s.events.filter(e => e.kind === 'quest' && e.sourceId === id).length, 1);
  assert.equal(toggleTaskChecklist(s, id, 'b', true), s);
  assert.equal(completeQuest(s, id), s);
});
test('пустой чек-лист и удаление пунктов не завершают задачу; недоступная задача не закрывается', () => {
  const s = saveCustomQuest(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', startsAt: '2099-01-01',
    subtasks: [{ id: 'a', title: 'Схема', done: false }] }, 'local');
  assert.throws(() => toggleTaskChecklist(s, s.quests[0].id, 'a', true), /недоступна/);
  assert.equal(s.quests[0].subtasks?.[0].done, false);
  const empty = updateTaskSettings(s, s.quests[0].id, { subtasks: [] });
  assert.equal(empty.quests[0].done, false);
});
test('участники, заметки и вложения проверяются до изменения сохранения', () => {
  assert.equal(validTaskDetails({ participants: [{ id: 'p', name: '', role: 'participant' }] }), false);
  assert.equal(validTaskDetails({ participants: [details.participants[0], { ...details.participants[0], id: 'p2' }] }), false);
  assert.equal(validTaskDetails({ reminders: [-1] }), false);
  assert.equal(validTaskDetails({ reminders: [60, 60] }), false);
  assert.equal(safeEmbeddedFile('data:text/html;base64,PHNjcmlwdD4='), false);
  assert.equal(safeEmbeddedFile('data:application/pdf;base64,JVBERg=='), true);
  assert.throws(() => saveTask(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', details: { motivation: 'x'.repeat(2001) } }));
});
test('разбор TickTick сохраняет редактор, связь и общие изменения, импорт без награды', () => {
  const s = setup(); const connection = newConnection('https://example.org');
  const incoming = { projectId: 'remote-list', sphere: 'tasks', remote: { id: 'remote', projectId: 'remote-list', title: 'Входящая', content: 'Описание', dueDate: '2026-01-02T12:00:00Z' } };
  const accepted = acceptIncomingTask(s, connection, incoming, { sphere: 'tasks', goalId: '', editor: {
    name: 'Исправленное название', difficulty: 'Hard', notes: 'Новый текст', priority: 'high', details,
    startsAt: '2026-01-01', dueAt: undefined, deadlineAt: '2026-01-04', estimateMinutes: 30,
  } }, 'accepted');
  assert.equal(accepted.state.quests.length, 1);
  assert.deepEqual(accepted.task.details, details);
  assert.equal(accepted.task.dueAt, undefined);
  assert.equal(accepted.task.deadlineAt, '2026-01-04');
  assert.equal(accepted.remoteUpdate?.title, 'Исправленное название');
  assert.equal(accepted.remoteUpdate?.priority, 5);
  assert.equal(accepted.connection.links.accepted.remoteId, 'remote');
  assert.equal(accepted.state.coins, s.coins);
  assert.equal(accepted.task.done, false);
  const payload = remotePayload(accepted.task, accepted.state, connection);
  assert.equal('details' in payload, false); assert.equal('deadlineAt' in payload, false);
  validateState(JSON.parse(JSON.stringify(accepted.state)));
});
test('напоминания срабатывают по времени начала, не для завершённых и не задним числом', () => {
  const s = saveTask(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', startsAt: '2026-01-01T10:00:00Z', details: { reminders: [60, 0] } });
  assert.equal(dueTaskReminders(s.quests, Date.parse('2026-01-01T09:00:01Z')).length, 1);
  assert.equal(dueTaskReminders(s.quests, Date.parse('2026-01-01T09:10:00Z')).length, 0);
  assert.equal(dueTaskReminders([{ ...s.quests[0], done: true }], Date.parse('2026-01-01T10:00:01Z')).length, 0);
});
test('повтор TickTick не получает второй локальный повтор', () => {
  const s = saveTask(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', tickTickRepeatFlag: 'RRULE:FREQ=DAILY' });
  assert.throws(() => updateTaskSettings(s, s.quests[0].id, { repeat: 'daily' }), /TickTick/);
  assert.equal(updateTaskSettings(s, s.quests[0].id, { repeat: null }).quests[0].repeat, undefined);
});
test('обмен сохраняет локальный дедлайн, даже если план TickTick перенесён позже', () => {
  const s = saveTask(setup(), { name: 'План', sphere: 'tasks', difficulty: 'Medium', dueAt: '2026-01-01', deadlineAt: '2026-01-02' });
  const next = saveTask(s, { ...s.quests[0], dueAt: '2026-01-03' }, { allowOutsidePlanRange: true });
  assert.equal(next.quests[0].deadlineAt, '2026-01-02');
  assert.equal(next.quests[0].dueAt, '2026-01-03');
});
