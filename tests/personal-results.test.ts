import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { saveReflection } from '../src/monthly.ts';
import {
  blankReview,
  blankSphereReview,
  carriedPlans,
  patchSphereReview,
  reviewOf,
  savePlanCheck,
  saveReview,
  validReview,
} from '../src/keyResults.ts';
import { personalTimeline, personalYear, victoryOf } from '../src/personalResults.ts';
import { validateState } from '../src/stateValidation.ts';

const now = new Date(2026, 9, 20, 12);
const validState = (value: unknown) => {
  try {
    validateState(JSON.parse(JSON.stringify(value)));
    return true;
  } catch {
    return false;
  }
};

test('личный год отличает пропуск от нуля и суммирует только известные завершённые месяцы', () => {
  let state = initialState();
  state = patchSphereReview(state, '2026-01', 'health', { tasksDone: 0, achieved: 'Начал год' }, now);
  state = patchSphereReview(state, '2026-02', 'health', { tasksDone: 4, keyResult: 'Закрепил режим' }, now);
  state = patchSphereReview(state, '2026-10', 'health', { tasksDone: 7, keyResult: 'Промежуточный результат' }, now);

  const year = personalYear(state, 2026, 'health', now);
  assert.equal(year.months[0].tasks, 0);
  assert.equal(year.months[2].tasks, null);
  assert.equal(year.total, 4);
  assert.equal(year.knownMonths, 2);
  assert.equal(year.elapsedMonths, 9);
  assert.equal(year.victories, 2);
  assert.equal(year.currentTasks, 7);
});

test('текущий месяц виден отдельно, а будущее не читает даже сохранённые данные', () => {
  let state = initialState();
  // Запись возможна позднее, но аналитика на 20 октября не должна раскрывать её.
  state = patchSphereReview(
    state,
    '2026-11',
    'health',
    { tasksDone: 99, keyResult: 'Будущая победа', resultEvidence: 'Будущее доказательство' },
    new Date(2026, 10, 30, 12),
  );
  state = patchSphereReview(state, '2026-10', 'health', { tasksDone: 3, resultEvidence: 'Черновик' }, now);

  const timeline = personalTimeline(state, '2026-11', 'health', 3, now);
  assert.deepEqual(timeline.map((month) => month.month), ['2026-09', '2026-10', '2026-11']);
  assert.equal(timeline[1].current, true);
  assert.equal(timeline[1].tasks, 3);
  assert.equal(timeline[1].evidence, 'Черновик');
  assert.equal(timeline[2].future, true);
  assert.equal(timeline[2].tasks, null);
  assert.equal(timeline[2].victory, '');
  assert.equal(timeline[2].evidence, '');
});

test('keyResult подставляет achieved только при отсутствии нового поля, а не при явной пустой строке', () => {
  const old = {
    ...blankReview(),
    spheres: { health: { ...blankSphereReview(), achieved: 'Старая победа' } },
  };
  assert.equal(victoryOf(old, 'health'), 'Старая победа');
  assert.equal(victoryOf({ ...old, spheres: { health: { ...old.spheres.health, keyResult: '' } } }, 'health'), '');
});

test('новые поля совместимы со старым review, очищают undefined и отвергают неверные enum/числа', () => {
  const old = blankReview();
  assert.ok(validReview(old));
  const fresh = {
    ...old,
    conclusion: 'Главный вывод',
    context: 'Болел первую неделю',
    nextPlans: [{ id: 'general-plan', title: 'Разобрать входящие', sphere: undefined }],
    planChecks: {
      checked: {
        sourceMonth: '2026-09',
        sourceText: 'Старый план',
        outcome: 'custom' as const,
        comment: 'Перенёс на следующую неделю',
      },
    },
  };
  assert.ok(validReview(fresh));
  assert.ok(!validReview({ ...fresh, nextPlans: [{ id: 'p', title: 'x', sphere: 'unknown' }] }));
  assert.ok(!validReview({ ...fresh, planChecks: { p: { ...fresh.planChecks.checked, outcome: 'maybe' } } }));
  assert.ok(!validReview({ ...fresh, planChecks: { p: { ...fresh.planChecks.checked, sourceMonth: '2026-13' } } }));

  const state = saveReview(initialState(), '2026-10', fresh, now);
  const plan = reviewOf(state, '2026-10').nextPlans![0];
  const check = reviewOf(state, '2026-10').planChecks!.checked;
  assert.ok(!Object.hasOwn(plan, 'sphere'));
  assert.ok(!Object.hasOwn(check, 'sphere'));
  assert.ok(validState(state));
});

test('ответы нескольких переносимых планов сохраняют снимки и не меняют XP, задачи или прошлый месяц', () => {
  let state = initialState();
  state = patchSphereReview(state, '2026-09', 'health', { next: 'Первый шаг\nВторой шаг' }, now);
  state = saveReflection(state, '2026-09', { nextMonth: 'Общий первый\nОбщий второй' }, now);
  const beforePlans = carriedPlans(state, '2026-10');
  assert.equal(beforePlans.length, 4);
  const xp = state.xp;
  const quests = state.quests;
  const sourceBefore = state.monthlyReflections!['2026-09'];

  state = savePlanCheck(state, '2026-10', beforePlans[0], 'done', '', now);
  state = savePlanCheck(state, '2026-10', beforePlans[1], 'custom', 'Нужна ещё неделя', now);
  assert.equal(state.xp, xp);
  assert.equal(state.quests, quests);
  assert.equal(state.monthlyReflections!['2026-09'], sourceBefore);
  assert.equal(Object.keys(reviewOf(state, '2026-10').planChecks ?? {}).length, 2);

  state = patchSphereReview(state, '2026-09', 'health', { next: 'Исправленный шаг' }, now);
  const restored = carriedPlans(state, '2026-10');
  assert.ok(restored.some((plan) => plan.id === beforePlans[0].id && plan.text === 'Первый шаг'));
  assert.ok(restored.some((plan) => plan.id === beforePlans[1].id && plan.text === 'Второй шаг'));
  assert.ok(restored.some((plan) => plan.text === 'Исправленный шаг'));
  assert.equal(reviewOf(state, '2026-10').planChecks?.[beforePlans[1].id].comment, 'Нужна ещё неделя');
});

test('nextPlans, включая пустой список, заменяет старые строки next, а reviewOf возвращает копию', () => {
  let state = patchSphereReview(initialState(), '2026-09', 'health', { next: 'Старый план' }, now);
  state = saveReview(state, '2026-09', { conclusion: 'Старый формат остаётся рабочим' }, now);
  const legacy = reviewOf(state, '2026-09');
  assert.ok(!Object.hasOwn(legacy, 'nextPlans'));
  assert.ok(!Object.hasOwn(legacy, 'planChecks'));
  assert.ok(!Object.hasOwn(legacy.spheres.health, 'keyResult'));
  assert.ok(!Object.hasOwn(legacy.spheres.health, 'resultEvidence'));
  state = saveReview(state, '2026-09', { nextPlans: [] }, now);
  assert.deepEqual(carriedPlans(state, '2026-10'), []);

  state = saveReview(state, '2026-10', { nextPlans: [{ id: 'copy', title: 'Не менять' }] }, now);
  const copy = reviewOf(state, '2026-10');
  copy.nextPlans![0].title = 'Изменено только в копии';
  assert.equal(reviewOf(state, '2026-10').nextPlans![0].title, 'Не менять');
});

test('пустой черновик плана сохраняется для ввода, но не появляется в проверке следующего месяца', () => {
  let state = saveReview(initialState(), '2026-09', { nextPlans: [{ id: 'draft', title: '' }] }, now);
  assert.equal(reviewOf(state, '2026-09').nextPlans?.[0].title, '');
  assert.ok(validState(state));
  assert.deepEqual(carriedPlans(state, '2026-10'), []);
  state = saveReview(state, '2026-09', { nextPlans: [{ id: 'draft', title: 'Один конкретный шаг', sphere: 'health' }] }, now);
  assert.equal(carriedPlans(state, '2026-10')[0].text, 'Один конкретный шаг');
  state = saveReview(state, '2026-09', { nextPlans: [{ id: 'draft', title: '   ', sphere: undefined }] }, now);
  assert.deepEqual(carriedPlans(state, '2026-10'), []);
  assert.ok(!Object.hasOwn(reviewOf(state, '2026-09').nextPlans![0], 'sphere'));
});
