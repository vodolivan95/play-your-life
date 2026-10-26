import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState, migrateState } from '../src/game.ts';
import { addBranch, saveNode, skillTreeOf, nodeLevel } from '../src/skillTree.ts';
import {
  completeProjectReview,
  startPracticeSession,
  togglePracticeStep,
  completePracticeSession,
} from '../src/skillPractice.ts';

const now = '2026-10-26T10:00:00.000Z';
function completedProject(id: string, base = initialState()) {
  const template = base.goals[0];
  return {
    ...template,
    id,
    name: `Проект ${id}`,
    sphere: 'english',
    current: 1,
    target: 1,
    progressMode: 'manual' as const,
    projectReview: undefined,
  };
}
function projectState() {
  const base = initialState();
  return {
    ...base,
    goals: [completedProject('project-1', base)],
    quests: [{
      id: 'task-1', name: 'Провести тренировку', sphere: 'english', xp: 20,
      done: true, completedAt: now, difficulty: 'Medium', goalId: 'project-1',
      subtasks: [{ id: 'source-step', title: 'Подготовить и выполнить', done: true }],
    }],
    skillTrees: {},
    practiceSessions: [],
  };
}

test('first project review creates an acquired skill at the bottom of a new branch', () => {
  const before = projectState();
  const reviewed = completeProjectReview(before, 'project-1', {
    whatWorked: 'Подготовка', challenge: 'Выступление', takeaway: 'Тренироваться заранее',
    skillName: 'Публичные выступления', placement: 'new', branchName: 'Коммуникация',
  }, now);
  const tree = skillTreeOf(reviewed, 'english');
  assert.equal(tree.branches.length, 1);
  assert.equal(tree.branches[0].name, 'Коммуникация');
  assert.equal(tree.nodes.length, 1);
  assert.equal(tree.nodes[0].tier, 1);
  assert.equal(tree.nodes[0].lane ?? 0, 0);
  assert.equal(tree.nodes[0].sourceGoalId, 'project-1');
  assert.equal(reviewed.goals[0].projectReview?.skillNodeId, tree.nodes[0].id);
  assert.equal(nodeLevel(reviewed, tree.nodes[0]), 1);
  assert.equal(reviewed.xp, before.xp);
  assert.equal(reviewed.coins, before.coins);
  assert.throws(() => completeProjectReview(reviewed, 'project-1', {
    skillName: 'Дубликат', placement: 'new',
  }, now), /уже сохранены/);
});

test('a skill can continue upward linearly or fork sideways from a selected skill', () => {
  let state = completeProjectReview(projectState(), 'project-1', {
    skillName: 'Основы', placement: 'new', branchName: 'Язык',
  }, now);
  const first = skillTreeOf(state, 'english').nodes[0];
  state = { ...state, goals: [...state.goals, completedProject('project-2', state), completedProject('project-3', state)] };
  state = completeProjectReview(state, 'project-2', {
    skillName: 'Продолжение', placement: 'continue', parentNodeId: first.id,
  }, now);
  const line = skillTreeOf(state, 'english').nodes[1];
  assert.equal(line.tier, 2);
  assert.equal(line.lane ?? 0, 0);
  assert.equal(line.requiresId, first.id);
  state = completeProjectReview(state, 'project-3', {
    skillName: 'Ответвление', placement: 'branch', parentNodeId: first.id,
  }, now);
  const tree = skillTreeOf(state, 'english');
  const fork = tree.nodes[2];
  assert.equal(fork.tier, 2);
  assert.notEqual(fork.lane, 0);
  assert.equal(fork.requiresId, first.id);
});

test('practice clones a completed task, advances its skill, and never pays or changes the project', () => {
  let state = completeProjectReview(projectState(), 'project-1', {
    skillName: 'Публичные выступления', placement: 'new', branchName: 'Коммуникация',
  }, now);
  const node = skillTreeOf(state, 'english').nodes[0];
  const economy = { xp: state.xp, coins: state.coins, completed: state.completed, events: state.events, goalCurrent: state.goals[0].current };
  const doPractice = (index: number) => {
    state = startPracticeSession(state, 'project-1', 'task-1', `2026-10-26T10:0${index}:00.000Z`);
    const session = state.practiceSessions.at(-1)!;
    assert.notEqual(session.subtasks[0].id, 'source-step');
    assert.equal(session.subtasks[0].done, false);
    assert.equal(state.quests[0].subtasks?.[0].done, true);
    assert.throws(() => startPracticeSession(state, 'project-1', 'task-1', now), /уже начата/);
    state = togglePracticeStep(state, session.id, session.subtasks[0].id);
    state = completePracticeSession(state, session.id, now);
  };
  doPractice(1);
  assert.equal(nodeLevel(state, node), 1);
  doPractice(2);
  assert.equal(nodeLevel(state, node), 1);
  doPractice(3);
  assert.equal(nodeLevel(state, node), 2);
  assert.deepEqual({ xp: state.xp, coins: state.coins, completed: state.completed, events: state.events, goalCurrent: state.goals[0].current }, economy);
  assert.equal(state.quests[0].done, true);
  assert.equal(state.practiceSessions.filter((session) => session.completedAt).length, 3);
});

test('old skill trees are cleared once while trees created after the migration are preserved', () => {
  const base = initialState();
  let old = addBranch(base, 'english', 'Тестовая старая ветка');
  const oldBranch = skillTreeOf(old, 'english').branches[0];
  old = saveNode(old, 'english', {
    branchId: oldBranch.id, name: 'Тестовый навык', icon: 'english', tier: 1,
    levels: 3, cost: 1,
  });
  const migrated = migrateState({ ...old, skillTreeResetVersion: undefined });
  assert.deepEqual(migrated.skillTrees, {});
  const newBranchState = addBranch(migrated, 'english', 'Новая ветка');
  const newBranch = skillTreeOf(newBranchState, 'english').branches[0];
  const newTreeState = saveNode(newBranchState, 'english', {
    branchId: newBranch.id, name: 'Приобретённый навык', icon: 'english', tier: 1,
    levels: 5, cost: 1,
  });
  assert.deepEqual(migrateState(newTreeState).skillTrees, newTreeState.skillTrees);
});
