import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  completeQuest,
  syncGoalTasks,
  updateGoal,
  migrateState,
} from '../src/game.ts';
import {
  saveGoal,
  saveStage,
  saveTask,
  moveStage,
  duplicateStage,
  removeStage,
  finishStage,
} from '../src/planning.ts';
import {
  goalProgressValue,
  stageMetrics,
  stageAccess,
  stageState,
  nextGoalTask,
  goalHistory,
  stageDays,
} from '../src/goalWorkspace.ts';
import { goalRoute, readGoalRoute } from '../src/goalRoutes.ts';
import { validateState } from '../src/stateValidation.ts';
import { progressQuest } from '../src/personalQuests.ts';
import { MAX_SPHERE_LEVEL } from '../src/sphereProgress.ts';
import type { GameState } from '../src/game.ts';
function fixture() {
  let s = initialState();
  s = saveGoal(s, {
    name: 'Настоящая цель',
    sphere: 'english',
    target: 100,
    reward: 200,
    progressMode: 'tasks',
  });
  const id = s.goals.at(-1)!.id;
  s = saveStage(s, id, {
    name: 'Первый',
    status: 'active',
    description: 'Описание',
    notes: 'Заметки',
    completionMode: 'tasks',
  });
  s = saveStage(s, id, {
    name: 'Второй',
    status: 'planned',
    completionMode: 'manual',
  });
  return {
    s,
    id,
    a: s.goals.at(-1)!.stages![0].id,
    b: s.goals.at(-1)!.stages![1].id,
  };
}
function goal(s: GameState, id: string) {
  return s.goals.find((g) => g.id === id)!;
}
test('предел уровня остаётся 100; старые 68% и обложка переживают пустые этапы и миграцию', () => {
  assert.equal(MAX_SPHERE_LEVEL, 100);
  let s = updateGoal(initialState(), 'b2', 68);
  const old = { ...s.goals[0] };
  s = saveStage(s, 'b2', { name: 'Без задач' });
  assert.equal(goalProgressValue(s, s.goals[0]), 68);
  s = saveGoal(s, { ...s.goals[0], progressMode: 'tasks' });
  assert.equal(s.goals[0].current, 68);
  assert.equal(goalProgressValue(s, s.goals[0]), 68);
  const restored = migrateState(JSON.parse(JSON.stringify(s)));
  validateState(restored);
  assert.equal(restored.goals[0].current, 68);
  assert.equal(restored.goals[0].image, old.image);
  assert.deepEqual(restored.goals[0].manualProgress, {
    current: 68,
    target: 100,
  });
});
test('обязательность, веса и частичный прогресс синхронизируют цель и этап без наград', () => {
  const f = fixture();
  let s = f.s;
  const { id, a } = f;
  s = saveTask(s, {
    name: 'Частичная',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: id,
    stageId: a,
    weight: 3,
    targetValue: 10,
    currentValue: 5,
  });
  const q = s.quests.at(-1)!;
  s = saveTask(s, {
    name: 'Обычная',
    sphere: 'english',
    difficulty: 'Simple',
    goalId: id,
    stageId: a,
    weight: 1,
  });
  s = saveTask(s, {
    name: 'Дополнительная',
    sphere: 'english',
    difficulty: 'Simple',
    goalId: id,
    stageId: a,
    required: false,
  });
  assert.equal(goal(s, id).current, 37.5);
  assert.equal(
    stageMetrics(s, goal(s, id), goal(s, id).stages![0]).progress,
    37.5,
  );
  const xp = s.xp;
  s = progressQuest(s, q.id, 8, 'test');
  assert.ok(Math.abs(goal(s, id).current - 60) < 0.000001);
  assert.equal(s.xp, xp);
  assert.equal(goal(s, id).rewarded, false);
});
test('автоматическое завершение, история и награды остаются однократными после перезагрузки', () => {
  const f = fixture();
  let s = f.s;
  const { id, a } = f;
  s = saveTask(s, {
    name: 'Действие',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: id,
    stageId: a,
  });
  const task = s.quests.at(-1)!;
  const beforeXP = s.xp;
  s = completeQuest(s, task.id);
  assert.equal(goal(s, id).current, 100);
  assert.equal(goal(s, id).stages![0].status, 'completed');
  assert.ok(goal(s, id).stages![0].completedAt);
  assert.equal(s.xp - beforeXP, 205);
  assert.equal(
    goalHistory(s, goal(s, id)).filter((e) => e.kind === 'goal').length,
    1,
  );
  assert.equal(
    goalHistory(s, goal(s, id), a).filter(
      (e) => e.title === 'Завершён этап: Первый',
    ).length,
    1,
  );
  const restored = migrateState(JSON.parse(JSON.stringify(s)));
  validateState(restored);
  assert.deepEqual(completeQuest(restored, task.id), restored);
  assert.equal(syncGoalTasks(restored, id, true).xp, s.xp);
});
test('заблокированный и приостановленный этап не выдаёт XP из общих действий квеста', () => {
  const f = fixture();
  let s = f.s;
  const { id, a, b } = f;
  s = saveStage(s, id, { ...goal(s, id).stages![1], prerequisiteId: a });
  s = saveTask(s, {
    name: 'Зависимая',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: id,
    stageId: b,
  });
  const task = s.quests.at(-1)!;
  assert.match(stageAccess(s, goal(s, id), goal(s, id).stages![1]), /Первый/);
  assert.equal(stageState(s, goal(s, id), goal(s, id).stages![1]), 'locked');
  assert.deepEqual(completeQuest(s, task.id), s);
  s = saveStage(s, id, {
    ...goal(s, id).stages![1],
    prerequisiteId: undefined,
    status: 'paused',
  });
  assert.deepEqual(completeQuest(s, task.id), s);
});
test('порядок сохраняет ID и задачи; копия сбрасывает выполнение и не выдаёт наград', () => {
  const f = fixture();
  let s = f.s;
  const { id, a, b } = f;
  s = saveTask(s, {
    name: 'Оригинал',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: id,
    stageId: a,
  });
  const task = s.quests.at(-1)!;
  s = completeQuest(s, task.id);
  const xp = s.xp,
    coins = s.coins;
  s = moveStage(s, id, b, 0);
  assert.deepEqual(
    goal(s, id).stages!.map((e) => e.id),
    [b, a],
  );
  s = duplicateStage(s, id, a);
  const copy = goal(s, id).stages!.at(-1)!;
  const copied = s.quests.find((q) => q.stageId === copy.id)!;
  assert.notEqual(copy.id, a);
  assert.notEqual(copied.id, task.id);
  assert.equal(copied.done, false);
  assert.equal(copied.rewardClaimed, false);
  assert.equal(copy.completedAt, undefined);
  assert.equal(copy.notes, 'Заметки');
  assert.equal(s.xp, xp);
  assert.equal(s.coins, coins);
  s = removeStage(s, id, copy.id);
  assert.equal(s.quests.find((q) => q.id === copied.id)!.stageId, undefined);
  assert.equal(s.quests.find((q) => q.id === task.id)!.done, true);
});
test('ручное завершение доступно без задач; даты и заметки не начисляют дополнительные награды', () => {
  const f = fixture();
  let s = f.s;
  const { id, a, b } = f;
  assert.throws(() => finishStage(s, id, a), /обязательные задачи/);
  const xp = s.xp;
  s = finishStage(s, id, b);
  assert.equal(
    stageMetrics(s, goal(s, id), goal(s, id).stages![1]).progress,
    100,
  );
  assert.equal(s.xp, xp);
  assert.deepEqual(finishStage(s, id, b), s);
  assert.throws(() =>
    saveStage(s, id, { ...goal(s, id).stages![0], prerequisiteId: 'missing' }),
  );
  s = saveStage(s, id, { ...goal(s, id).stages![0], prerequisiteId: b });
  assert.throws(
    () => saveStage(s, id, { ...goal(s, id).stages![1], prerequisiteId: a }),
    /по кругу/,
  );
});
test('следующий шаг выбирает просроченную задачу активного этапа, ближайший срок и обязательную', () => {
  const f = fixture();
  let s = f.s;
  const { id, a, b } = f;
  const add = (name: string, extra = {}) => {
    s = saveTask(s, {
      name,
      sphere: 'english',
      difficulty: 'Micro',
      goalId: id,
      stageId: a,
      ...extra,
    });
  };
  add('Обязательная');
  add('Будущая', { dueAt: '2027-10-10T12:00:00Z' });
  add('Просроченная', { dueAt: '2026-10-01T12:00:00Z' });
  assert.equal(
    nextGoalTask(s, goal(s, id), new Date('2026-10-08T12:00:00Z'))!.name,
    'Просроченная',
  );
  s = saveStage(s, id, { ...goal(s, id).stages![0], status: 'paused' });
  assert.equal(nextGoalTask(s, goal(s, id)), undefined);
  s = saveTask(s, {
    name: 'Доступная',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: id,
    stageId: b,
  });
  assert.equal(nextGoalTask(s, goal(s, id))!.name, 'Доступная');
});
test('каждый этап имеет свой URL, включая необычные ID; некорректные ссылки безопасны', () => {
  const first = goalRoute('goal / один', 'stage / первый'),
    second = goalRoute('goal / один', 'stage / второй');
  assert.notEqual(first, second);
  assert.deepEqual(readGoalRoute('#' + first), {
    goalId: 'goal / один',
    stageId: 'stage / первый',
  });
  assert.deepEqual(readGoalRoute('#/goals/g'), { goalId: 'g' });
  assert.equal(readGoalRoute('#/goals/%broken'), null);
  assert.equal(readGoalRoute('#/goals/g/stages/'), null);
});
test('временная шкала использует реальные даты и дату фактического завершения', () => {
  const range = {
    startsAt: '2026-10-01T12:00:00Z',
    dueAt: '2026-10-11T12:00:00Z',
  };
  assert.deepEqual(stageDays(range, new Date('2026-10-06T12:00:00Z')), {
    elapsed: 5,
    remaining: 5,
    progress: 50,
  });
  assert.equal(
    stageDays(range, new Date('2026-10-13T12:00:00Z')).remaining,
    -2,
  );
  assert.equal(
    stageDays(
      { ...range, completedAt: '2026-10-06T12:00:00Z' },
      new Date('2027-01-01'),
    ).elapsed,
    5,
  );
  assert.equal(stageDays({}).progress, null);
});
test('история изолирована по цели и этапу; редактирование старого этапа не выдумывает дату создания', () => {
  const { s, id, a, b } = fixture();
  assert.ok(goalHistory(s, goal(s, id), a).every((e) => e.stageId === a));
  assert.ok(goalHistory(s, goal(s, id), b).every((e) => e.stageId === b));
  assert.ok(
    goalHistory(s, s.goals[0]).every((e) => e.goalId === s.goals[0].id),
  );
  const old = {
    ...s,
    goals: s.goals.map((g) =>
      g.id === id
        ? {
            ...g,
            stages: g.stages!.map((e) => ({ ...e, createdAt: undefined })),
          }
        : g,
    ),
  };
  const edited = saveStage(old, id, {
    ...goal(old, id).stages![0],
    notes: 'Новые заметки',
  });
  assert.equal(goal(edited, id).stages![0].createdAt, undefined);
  validateState(JSON.parse(JSON.stringify(edited)));
});

test('при загрузке старый расчёт по задачам исправляется без XP; ручной результат не меняется', () => {
  const f = fixture();
  let s = saveTask(f.s, {
    name: 'Выполненная',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: f.id,
    stageId: f.a,
  });
  s = completeQuest(s, s.quests.at(-1)!.id);
  const raw = {
    ...s,
    goals: s.goals.map((g) => (g.id === f.id ? { ...g, current: 0 } : g)),
  };
  const migrated = migrateState(JSON.parse(JSON.stringify(raw)));
  assert.equal(goal(migrated, f.id).current, 100);
  assert.equal(migrated.goals[0].current, raw.goals[0].current);
  assert.equal(migrated.xp, s.xp);
  assert.deepEqual(migrated.events, JSON.parse(JSON.stringify(s.events)));
});
test('новая обязательная задача открывает этап повторно и не повторяет награду цели', () => {
  const f = fixture();
  let s = saveTask(f.s, {
    name: 'Первый шаг',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: f.id,
    stageId: f.a,
  });
  s = completeQuest(s, s.quests.at(-1)!.id);
  const xp = s.xp;
  s = saveTask(s, {
    name: 'Следующий шаг',
    sphere: 'english',
    difficulty: 'Micro',
    goalId: f.id,
    stageId: f.a,
  });
  assert.equal(
    stageMetrics(s, goal(s, f.id), goal(s, f.id).stages![0]).complete,
    false,
  );
  assert.equal(goal(s, f.id).stages![0].completedAt, undefined);
  s = completeQuest(s, s.quests.at(-1)!.id);
  assert.equal(s.xp - xp, 5);
  assert.equal(
    goalHistory(s, goal(s, f.id)).filter((e) => e.kind === 'goal').length,
    1,
  );
});
