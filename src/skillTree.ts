import { goalProgressValue } from './goalWorkspace.ts';
import { sphereProgress } from './sphereProgress.ts';
import type { GameState } from './game.ts';

/** Skill points, tiers and limits of the personal skill tree of each sphere. */
export const SKILL_POINTS_PER_LEVEL = 2;
export const MAX_SKILL_TIER = 6;
export const MAX_SKILL_LEVELS = 10;
export const MAX_SKILL_COST = 3;
export const MAX_BRANCHES = 8;
export const MAX_NODES = 60;
export const MAX_SKILL_NAME = 40;

export const skillIconIds = [
  'health',
  'sport',
  'growth',
  'english',
  'finance',
  'together',
  'driving',
  'tasks',
  'hobby',
] as const;

export type SkillBranch = { id: string; name: string };
export type SkillNode = {
  id: string;
  branchId: string;
  name: string;
  icon: string;
  tier: number;
  levels: number;
  level: number;
  cost: number;
  requiresId?: string;
  requiresLevel?: number;
  goalId?: string;
};
export type SphereSkillTree = { branches: SkillBranch[]; nodes: SkillNode[] };
export type SkillTrees = Record<string, SphereSkillTree>;
export type SkillNodeInput = {
  id?: string;
  branchId: string;
  name: string;
  icon: string;
  tier: number;
  levels: number;
  cost: number;
  requiresId?: string;
  requiresLevel?: number;
  goalId?: string;
};
export type SkillStatus = 'max' | 'learning' | 'available' | 'locked';

export const skillTemplates = [
  {
    id: 'base',
    name: 'Базовый путь',
    skills: ['Первые шаги', 'Привычка', 'Уверенность', 'Мастерство'],
  },
  {
    id: 'habits',
    name: 'Привычки',
    skills: ['Старт', 'Регулярность', 'Автоматизм', 'Образ жизни'],
  },
  {
    id: 'exam',
    name: 'Экзамен',
    skills: ['Теория', 'Практика', 'Пробный тест', 'Сдача'],
  },
  {
    id: 'project',
    name: 'Проект',
    skills: ['Идея', 'План', 'Запуск', 'Результат'],
  },
] as const;

const emptyTree = (): SphereSkillTree => ({ branches: [], nodes: [] });

export function skillTreeOf(
  state: Pick<GameState, 'skillTrees'>,
  sphere: string,
): SphereSkillTree {
  return state.skillTrees?.[sphere] ?? emptyTree();
}

/** Sphere level required to use a tier: tier 1 is open, then every five levels. */
export const skillGate = (tier: number) => Math.max(0, (tier - 1) * 5);

export function sphereLevelOf(state: Pick<GameState, 'spheres'>, sphere: string) {
  return sphereProgress(state.spheres[sphere]?.xp ?? 0).level;
}

/** A node bound to a goal grows with the goal; otherwise it is paid with points. */
export function nodeLevel(
  state: Pick<GameState, 'goals' | 'quests'>,
  node: SkillNode,
) {
  if (!node.goalId) return node.level;
  const goal = state.goals.find((g) => g.id === node.goalId);
  if (!goal) return node.level;
  return Math.min(
    node.levels,
    Math.floor((goalProgressValue(state, goal) / 100) * node.levels),
  );
}

export const skillPointsTotal = (
  state: Pick<GameState, 'spheres'>,
  sphere: string,
) => sphereLevelOf(state, sphere) * SKILL_POINTS_PER_LEVEL;

export function skillPointsSpent(
  state: Pick<GameState, 'skillTrees'>,
  sphere: string,
) {
  return skillTreeOf(state, sphere)
    .nodes.filter((n) => !n.goalId)
    .reduce((sum, n) => sum + n.level * n.cost, 0);
}

export const skillPointsFree = (
  state: Pick<GameState, 'spheres' | 'skillTrees'>,
  sphere: string,
) =>
  Math.max(0, skillPointsTotal(state, sphere) - skillPointsSpent(state, sphere));

/** Why a node cannot be used yet, or undefined when it is open. */
export function nodeLock(state: GameState, sphere: string, node: SkillNode) {
  const gate = skillGate(node.tier);
  if (sphereLevelOf(state, sphere) < gate)
    return `Нужен уровень сферы ${gate}`;
  if (node.requiresId) {
    const req = skillTreeOf(state, sphere).nodes.find(
      (n) => n.id === node.requiresId,
    );
    if (req && nodeLevel(state, req) < (node.requiresLevel ?? 1))
      return `Нужно: ${req.name} ${node.requiresLevel ?? 1}+`;
  }
  return undefined;
}

export function nodeStatus(
  state: GameState,
  sphere: string,
  node: SkillNode,
): SkillStatus {
  const level = nodeLevel(state, node);
  if (level >= node.levels) return 'max';
  if (level > 0) return 'learning';
  return nodeLock(state, sphere, node) ? 'locked' : 'available';
}

function patchTree(
  state: GameState,
  sphere: string,
  change: (tree: SphereSkillTree) => SphereSkillTree,
): GameState {
  if (!skillIconIds.includes(sphere as (typeof skillIconIds)[number]))
    throw new Error('Неизвестная сфера.');
  return {
    ...state,
    skillTrees: {
      ...state.skillTrees,
      [sphere]: change(skillTreeOf(state, sphere)),
    },
  };
}

function cleanName(value: string, what: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error(`Укажи название: ${what}.`);
  if (name.length > MAX_SKILL_NAME)
    throw new Error(`Название не длиннее ${MAX_SKILL_NAME} символов.`);
  return name;
}

export function addBranch(state: GameState, sphere: string, name: string) {
  const title = cleanName(name, 'ветки');
  return patchTree(state, sphere, (tree) => {
    if (tree.branches.length >= MAX_BRANCHES)
      throw new Error(`В сфере не больше ${MAX_BRANCHES} веток.`);
    if (tree.branches.some((b) => b.name.toLowerCase() === title.toLowerCase()))
      throw new Error('Ветка с таким названием уже есть.');
    return {
      ...tree,
      branches: [...tree.branches, { id: crypto.randomUUID(), name: title }],
    };
  });
}

export function renameBranch(
  state: GameState,
  sphere: string,
  branchId: string,
  name: string,
) {
  const title = cleanName(name, 'ветки');
  return patchTree(state, sphere, (tree) => {
    if (!tree.branches.some((b) => b.id === branchId))
      throw new Error('Ветка не найдена.');
    if (
      tree.branches.some(
        (b) => b.id !== branchId && b.name.toLowerCase() === title.toLowerCase(),
      )
    )
      throw new Error('Ветка с таким названием уже есть.');
    return {
      ...tree,
      branches: tree.branches.map((b) =>
        b.id === branchId ? { ...b, name: title } : b,
      ),
    };
  });
}

/** Drop links to removed nodes so no skill waits for something that is gone. */
function unlink(nodes: SkillNode[], removed: Set<string>) {
  return nodes.map((n) =>
    n.requiresId && removed.has(n.requiresId)
      ? { ...n, requiresId: undefined, requiresLevel: undefined }
      : n,
  );
}

export function removeBranch(
  state: GameState,
  sphere: string,
  branchId: string,
) {
  return patchTree(state, sphere, (tree) => {
    if (!tree.branches.some((b) => b.id === branchId))
      throw new Error('Ветка не найдена.');
    const gone = new Set(
      tree.nodes.filter((n) => n.branchId === branchId).map((n) => n.id),
    );
    return {
      branches: tree.branches.filter((b) => b.id !== branchId),
      nodes: unlink(
        tree.nodes.filter((n) => n.branchId !== branchId),
        gone,
      ),
    };
  });
}

/** Returns all skill points of a branch (goal-bound skills keep their goal progress). */
export function resetBranch(
  state: GameState,
  sphere: string,
  branchId: string,
) {
  return patchTree(state, sphere, (tree) => ({
    ...tree,
    nodes: tree.nodes.map((n) =>
      n.branchId === branchId ? { ...n, level: 0 } : n,
    ),
  }));
}

function createsLoop(nodes: SkillNode[], id: string, requiresId?: string) {
  const seen = new Set<string>();
  let cursor = requiresId;
  while (cursor) {
    if (cursor === id || seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = nodes.find((n) => n.id === cursor)?.requiresId;
  }
  return false;
}

export function saveNode(
  state: GameState,
  sphere: string,
  input: SkillNodeInput,
) {
  const name = cleanName(input.name, 'навыка');
  const next = patchTree(state, sphere, (tree) => {
    const old = input.id ? tree.nodes.find((n) => n.id === input.id) : undefined;
    if (input.id && !old) throw new Error('Навык не найден.');
    if (!tree.branches.some((b) => b.id === input.branchId))
      throw new Error('Выбери ветку.');
    if (!skillIconIds.includes(input.icon as (typeof skillIconIds)[number]))
      throw new Error('Выбери иконку.');
    const whole = (v: number, min: number, max: number) =>
      Number.isInteger(v) && v >= min && v <= max;
    if (!whole(input.tier, 1, MAX_SKILL_TIER))
      throw new Error(`Ярус — число от 1 до ${MAX_SKILL_TIER}.`);
    if (!whole(input.levels, 1, MAX_SKILL_LEVELS))
      throw new Error(`Уровней — от 1 до ${MAX_SKILL_LEVELS}.`);
    if (!whole(input.cost, 1, MAX_SKILL_COST))
      throw new Error(`Цена уровня — от 1 до ${MAX_SKILL_COST} очков.`);
    if (!old && tree.nodes.length >= MAX_NODES)
      throw new Error(`В сфере не больше ${MAX_NODES} навыков.`);
    if (
      tree.nodes.some(
        (n) =>
          n.id !== input.id &&
          n.branchId === input.branchId &&
          n.tier === input.tier,
      )
    )
      throw new Error('В этой ветке на этом ярусе уже есть навык.');
    if (
      tree.nodes.some(
        (n) =>
          n.id !== input.id && n.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new Error('Навык с таким названием уже есть.');
    const id = old?.id ?? crypto.randomUUID();
    let requiresLevel: number | undefined;
    if (input.requiresId) {
      const req = tree.nodes.find((n) => n.id === input.requiresId);
      if (!req || input.requiresId === id)
        throw new Error('Выбери другой навык для условия.');
      if (createsLoop(tree.nodes, id, input.requiresId))
        throw new Error('Условия не должны ссылаться друг на друга по кругу.');
      requiresLevel = input.requiresLevel ?? 1;
      if (!whole(requiresLevel, 1, req.levels))
        throw new Error(`Условие — уровень от 1 до ${req.levels}.`);
    }
    if (input.goalId) {
      const goal = state.goals.find((g) => g.id === input.goalId);
      if (!goal || goal.sphere !== sphere)
        throw new Error('Выбери цель этой же сферы.');
    }
    const node: SkillNode = {
      id,
      branchId: input.branchId,
      name,
      icon: input.icon,
      tier: input.tier,
      levels: input.levels,
      level: input.goalId ? 0 : Math.min(old?.level ?? 0, input.levels),
      cost: input.cost,
      ...(input.requiresId ? { requiresId: input.requiresId, requiresLevel } : {}),
      ...(input.goalId ? { goalId: input.goalId } : {}),
    };
    return {
      ...tree,
      nodes: old
        ? tree.nodes.map((n) => (n.id === id ? node : n))
        : [...tree.nodes, node],
    };
  });
  if (skillPointsSpent(next, sphere) > skillPointsTotal(next, sphere))
    throw new Error('Не хватает очков для такой цены уровня.');
  return next;
}

export function removeNode(state: GameState, sphere: string, nodeId: string) {
  return patchTree(state, sphere, (tree) => {
    if (!tree.nodes.some((n) => n.id === nodeId))
      throw new Error('Навык не найден.');
    return {
      ...tree,
      nodes: unlink(
        tree.nodes.filter((n) => n.id !== nodeId),
        new Set([nodeId]),
      ),
    };
  });
}

/** A ready branch of four skills, each opened by the previous one. */
export function addTemplateBranch(
  state: GameState,
  sphere: string,
  templateId: string,
) {
  const template = skillTemplates.find((t) => t.id === templateId);
  if (!template) throw new Error('Шаблон не найден.');
  let next = addBranch(state, sphere, template.name);
  const branch = skillTreeOf(next, sphere).branches.at(-1)!;
  let previous: string | undefined;
  template.skills.forEach((skill, index) => {
    next = saveNode(next, sphere, {
      branchId: branch.id,
      name: skill,
      icon: sphere,
      tier: index + 1,
      levels: 3,
      cost: 1,
      requiresId: previous,
      requiresLevel: previous ? 1 : undefined,
    });
    previous = skillTreeOf(next, sphere).nodes.at(-1)!.id;
  });
  return next;
}

export function raiseSkill(state: GameState, sphere: string, nodeId: string) {
  const node = skillTreeOf(state, sphere).nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error('Навык не найден.');
  if (node.goalId)
    throw new Error('Уровень этого навыка растёт вместе с целью.');
  const lock = nodeLock(state, sphere, node);
  if (lock) throw new Error(`Навык закрыт. ${lock}.`);
  if (node.level >= node.levels) throw new Error('Навык уже на максимуме.');
  if (skillPointsFree(state, sphere) < node.cost)
    throw new Error('Не хватает очков навыков.');
  return patchTree(state, sphere, (tree) => ({
    ...tree,
    nodes: tree.nodes.map((n) =>
      n.id === nodeId ? { ...n, level: n.level + 1 } : n,
    ),
  }));
}

export function lowerSkill(state: GameState, sphere: string, nodeId: string) {
  const tree = skillTreeOf(state, sphere);
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error('Навык не найден.');
  if (node.goalId)
    throw new Error('Уровень этого навыка растёт вместе с целью.');
  if (node.level <= 0) throw new Error('Очки в этот навык не вложены.');
  const blocker = tree.nodes.find(
    (n) =>
      n.requiresId === nodeId &&
      nodeLevel(state, n) > 0 &&
      node.level - 1 < (n.requiresLevel ?? 1),
  );
  if (blocker)
    throw new Error(`От этого навыка зависит «${blocker.name}». Сначала забери очки там.`);
  return patchTree(state, sphere, (t) => ({
    ...t,
    nodes: t.nodes.map((n) =>
      n.id === nodeId ? { ...n, level: n.level - 1 } : n,
    ),
  }));
}

/** Structure check used when a save or a backup is loaded. */
export function validSkillTrees(value: unknown): value is SkillTrees {
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  if (!record(value)) return false;
  const int = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  const name = (v: unknown) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_SKILL_NAME;
  const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 80;
  return Object.entries(value).every(([sphere, tree]) => {
    if (!skillIconIds.includes(sphere as (typeof skillIconIds)[number]))
      return false;
    if (!record(tree) || !Array.isArray(tree.branches) || !Array.isArray(tree.nodes))
      return false;
    if (tree.branches.length > MAX_BRANCHES || tree.nodes.length > MAX_NODES)
      return false;
    const branches = tree.branches as unknown[];
    if (!branches.every((b) => record(b) && id(b.id) && name(b.name)))
      return false;
    const branchIds = new Set(branches.map((b) => (b as SkillBranch).id));
    if (branchIds.size !== branches.length) return false;
    const nodes = tree.nodes as unknown[];
    const ok = nodes.every(
      (n) =>
        record(n) &&
        id(n.id) &&
        typeof n.branchId === 'string' &&
        branchIds.has(n.branchId) &&
        name(n.name) &&
        skillIconIds.includes(n.icon as (typeof skillIconIds)[number]) &&
        int(n.tier, 1, MAX_SKILL_TIER) &&
        int(n.levels, 1, MAX_SKILL_LEVELS) &&
        int(n.level, 0, MAX_SKILL_LEVELS) &&
        (n.level as number) <= (n.levels as number) &&
        int(n.cost, 1, MAX_SKILL_COST) &&
        (n.requiresId === undefined || id(n.requiresId)) &&
        (n.requiresLevel === undefined || int(n.requiresLevel, 1, MAX_SKILL_LEVELS)) &&
        (n.goalId === undefined || id(n.goalId)),
    );
    if (!ok) return false;
    const list = nodes as SkillNode[];
    if (new Set(list.map((n) => n.id)).size !== list.length) return false;
    if (
      new Set(list.map((n) => `${n.branchId}:${n.tier}`)).size !== list.length
    )
      return false;
    return list.every(
      (n) =>
        (n.requiresId === undefined || list.some((m) => m.id === n.requiresId)) &&
        !createsLoop(list, n.id, n.requiresId),
    );
  });
}
