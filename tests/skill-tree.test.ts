import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { saveGoal, saveTask } from '../src/planning.ts';
import { validateState } from '../src/stateValidation.ts';
import {
  addBranch,
  addTemplateBranch,
  lowerSkill,
  nodeLevel,
  nodeStatus,
  raiseSkill,
  removeBranch,
  removeNode,
  renameBranch,
  resetBranch,
  saveNode,
  skillGate,
  skillPointsFree,
  skillPointsSpent,
  skillPointsTotal,
  skillTreeOf,
  validSkillTrees,
} from '../src/skillTree.ts';
import type { GameState } from '../src/game.ts';

// 2400 XP is level 12 in a sphere: 24 skill points.
function base(): GameState {
  const s = initialState();
  return {
    ...s,
    spheres: {
      ...s.spheres,
      english: { ...s.spheres.english, xp: 2400 },
    },
  };
}
const node = (branchId: string, name: string, tier: number, extra = {}) => ({
  branchId,
  name,
  icon: 'english',
  tier,
  levels: 5,
  cost: 1,
  ...extra,
});
function withTree() {
  let s = addBranch(base(), 'english', 'Речь');
  const branch = skillTreeOf(s, 'english').branches[0];
  s = saveNode(s, 'english', node(branch.id, 'Произношение', 1));
  const first = skillTreeOf(s, 'english').nodes[0];
  s = saveNode(
    s,
    'english',
    node(branch.id, 'Диалоги', 2, { requiresId: first.id, requiresLevel: 3 }),
  );
  const second = skillTreeOf(s, 'english').nodes[1];
  return { s, branch, first, second };
}

test('очки навыков идут от уровня сферы, ярусы открываются каждые 5 уровней', () => {
  const s = base();
  assert.equal(skillPointsTotal(s, 'english'), 24);
  assert.equal(skillPointsFree(s, 'english'), 24);
  assert.deepEqual([1, 2, 3, 4].map(skillGate), [0, 5, 10, 15]);
});

test('ветки: создание, переименование, запрет повторов и удаление', () => {
  let s = addBranch(base(), 'english', '  Слова ');
  assert.equal(skillTreeOf(s, 'english').branches[0].name, 'Слова');
  assert.throws(() => addBranch(s, 'english', 'слова'), /уже есть/);
  assert.throws(() => addBranch(s, 'english', '   '), /название/);
  const id = skillTreeOf(s, 'english').branches[0].id;
  s = renameBranch(s, 'english', id, 'Лексика');
  assert.equal(skillTreeOf(s, 'english').branches[0].name, 'Лексика');
  s = removeBranch(s, 'english', id);
  assert.equal(skillTreeOf(s, 'english').branches.length, 0);
  assert.throws(() => addBranch(base(), 'nope', 'Ветка'), /сфера/);
});

test('навык: проверки яруса, уровней, цены и одной клетки', () => {
  const { s, branch, first } = withTree();
  assert.throws(() => saveNode(s, 'english', node(branch.id, 'Новый', 1)), /ярусе/);
  assert.throws(() => saveNode(s, 'english', node(branch.id, 'Новый', 7)), /Ярус/);
  assert.throws(() => saveNode(s, 'english', node(branch.id, 'Новый', 3, { levels: 11 })), /Уровней/);
  assert.throws(() => saveNode(s, 'english', node(branch.id, 'Новый', 3, { cost: 4 })), /Цена/);
  assert.throws(() => saveNode(s, 'english', node(branch.id, 'Произношение', 3)), /названием/);
  assert.throws(() => saveNode(s, 'english', node('нет', 'Новый', 3)), /ветку/);
  assert.throws(
    () => saveNode(s, 'english', { ...node(branch.id, 'Первый', 1), id: first.id, requiresId: first.id }),
    /другой навык/,
  );
});

test('очки: вложение, нехватка очков, откат и зависимости', () => {
  const tree = withTree();
  const first = tree.first;
  let { s, second } = tree;
  assert.equal(nodeStatus(s, 'english', first), 'available');
  assert.equal(nodeStatus(s, 'english', second), 'locked');
  assert.throws(() => raiseSkill(s, 'english', second.id), /закрыт/);
  for (let i = 0; i < 3; i++) s = raiseSkill(s, 'english', first.id);
  assert.equal(skillPointsSpent(s, 'english'), 3);
  assert.equal(skillPointsFree(s, 'english'), 21);
  second = skillTreeOf(s, 'english').nodes[1];
  assert.equal(nodeStatus(s, 'english', second), 'available');
  s = raiseSkill(s, 'english', second.id);
  assert.throws(() => lowerSkill(s, 'english', first.id), /зависит/);
  s = lowerSkill(s, 'english', second.id);
  s = lowerSkill(s, 'english', first.id);
  assert.equal(skillPointsSpent(s, 'english'), 2);
  assert.throws(() => lowerSkill(s, 'english', second.id), /не вложены/);
  s = raiseSkill(s, 'english', first.id);
  s = raiseSkill(s, 'english', first.id);
  assert.equal(nodeStatus(s, 'english', skillTreeOf(s, 'english').nodes[0]), 'learning');
  s = resetBranch(s, 'english', first.branchId);
  assert.equal(skillPointsSpent(s, 'english'), 0);
});

test('нельзя вложить больше очков, чем есть, и выше максимума', () => {
  const poor = initialState();
  let s = addBranch(
    { ...poor, spheres: { ...poor.spheres, english: { ...poor.spheres.english, xp: 0 } } },
    'english',
    'Речь',
  );
  const branch = skillTreeOf(s, 'english').branches[0];
  s = saveNode(s, 'english', node(branch.id, 'Первый', 1));
  const id = skillTreeOf(s, 'english').nodes[0].id;
  assert.throws(() => raiseSkill(s, 'english', id), /очков/);
  let rich = base();
  rich = addBranch(rich, 'english', 'Речь');
  const b = skillTreeOf(rich, 'english').branches[0];
  rich = saveNode(rich, 'english', node(b.id, 'Первый', 1, { levels: 2 }));
  const nid = skillTreeOf(rich, 'english').nodes[0].id;
  rich = raiseSkill(raiseSkill(rich, 'english', nid), 'english', nid);
  assert.throws(() => raiseSkill(rich, 'english', nid), /максимуме/);
  assert.equal(nodeStatus(rich, 'english', skillTreeOf(rich, 'english').nodes[0]), 'max');
});

test('ярус закрыт, пока не хватает уровня сферы', () => {
  let s = addBranch(base(), 'english', 'Речь');
  const branch = skillTreeOf(s, 'english').branches[0];
  s = saveNode(s, 'english', node(branch.id, 'Высокий', 4));
  const high = skillTreeOf(s, 'english').nodes[0];
  assert.equal(nodeStatus(s, 'english', high), 'locked');
  assert.throws(() => raiseSkill(s, 'english', high.id), /уровень сферы 15/);
});

test('удаление навыка снимает условия у зависимых, цикл запрещён', () => {
  const tree = withTree();
  const { first, second } = tree;
  let s = tree.s;
  assert.throws(
    () => saveNode(s, 'english', { ...node(first.branchId, 'Произношение', 1), id: first.id, requiresId: second.id }),
    /по кругу/,
  );
  s = removeNode(s, 'english', first.id);
  const left = skillTreeOf(s, 'english').nodes[0];
  assert.equal(left.id, second.id);
  assert.equal(left.requiresId, undefined);
});

test('шаблон создаёт ветку из четырёх навыков по цепочке', () => {
  const s = addTemplateBranch(base(), 'english', 'exam');
  const tree = skillTreeOf(s, 'english');
  assert.equal(tree.branches[0].name, 'Экзамен');
  assert.deepEqual(
    tree.nodes.map((n) => [n.name, n.tier]),
    [['Теория', 1], ['Практика', 2], ['Пробный тест', 3], ['Сдача', 4]],
  );
  assert.equal(tree.nodes[1].requiresId, tree.nodes[0].id);
  assert.throws(() => addTemplateBranch(s, 'english', 'exam'), /уже есть/);
  assert.throws(() => addTemplateBranch(s, 'english', 'нет'), /Шаблон/);
});

test('навык с целью растёт от прогресса цели и не тратит очки', () => {
  let s = base();
  s = saveGoal(s, { name: 'Говорить', sphere: 'english', target: 100, reward: 100, progressMode: 'tasks' });
  const goal = s.goals.at(-1)!;
  s = saveTask(s, { name: 'Один', difficulty: 'Micro', sphere: 'english', goalId: goal.id });
  s = saveTask(s, { name: 'Два', difficulty: 'Micro', sphere: 'english', goalId: goal.id });
  s = addBranch(s, 'english', 'Речь');
  const branch = skillTreeOf(s, 'english').branches[0];
  s = saveNode(s, 'english', node(branch.id, 'Практика', 1, { goalId: goal.id, levels: 4 }));
  const linked = () => skillTreeOf(s, 'english').nodes[0];
  assert.equal(nodeLevel(s, linked()), 0);
  assert.throws(() => raiseSkill(s, 'english', linked().id), /цел/);
  s = { ...s, quests: s.quests.map((q, i) => (q.goalId === goal.id && i === s.quests.findIndex((x) => x.goalId === goal.id) ? { ...q, done: true } : q)) };
  assert.ok(nodeLevel(s, linked()) >= 1);
  assert.equal(skillPointsSpent(s, 'english'), 0);
  const other = saveGoal(s, { name: 'Другая', sphere: 'health', target: 100, reward: 100 });
  assert.throws(
    () => saveNode(s, 'english', { ...node(branch.id, 'Практика', 1), id: linked().id, goalId: other.goals.at(-1)!.id }),
    /этой же сферы/,
  );
});

test('проверка структуры дерева при загрузке сохранения', () => {
  const { s } = withTree();
  assert.equal(validSkillTrees(s.skillTrees), true);
  assert.doesNotThrow(() => validateState(s));
  const broken = structuredClone(s) as GameState;
  broken.skillTrees!.english.nodes[0].level = 99;
  assert.throws(() => validateState(broken), /повреждённые/);
  const loop = structuredClone(s) as GameState;
  loop.skillTrees!.english.nodes[0].requiresId = loop.skillTrees!.english.nodes[1].id;
  assert.equal(validSkillTrees(loop.skillTrees), false);
  assert.equal(validSkillTrees({ unknown: { branches: [], nodes: [] } }), false);
});
