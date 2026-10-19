import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { validateState } from '../src/stateValidation.ts';

const validState = (value: unknown) => {
  try {
    validateState(JSON.parse(JSON.stringify(value)));
    return true;
  } catch {
    return false;
  }
};
import {
  addMoodCheckin,
  createPlanTasks,
  finishReview,
  moodInsights,
  needsSmallerStep,
  patchSphereReview,
  previousPlans,
  reviewOf,
  saveReview,
  setMonthRating,
  smallerStep,
  softModeSuggested,
  validReview,
} from '../src/keyResults.ts';

const now = new Date(2026, 9, 20, 12);

test('итоги сферы сохраняются и проходят проверку сохранения', () => {
  let state = initialState();
  state = patchSphereReview(state, '2026-10', 'health', { achieved: 'Сдал анализы', next: 'Сон до 23:00' }, now);
  const review = reviewOf(state, '2026-10');
  assert.equal(review.spheres.health.achieved, 'Сдал анализы');
  assert.ok(validReview(review));
  assert.ok(validState(state));
});
test('количество задач по сфере вписывается вручную (например, по TickTick), а не считается в игре', () => {
  let state = initialState();
  state = patchSphereReview(state, '2026-10', 'health', { tasksDone: 5 }, now);
  assert.equal(reviewOf(state, '2026-10').spheres.health.tasksDone, 5);
  assert.ok(validState(state));
  // Пустое значение возвращает к null; дробные, отрицательные и слишком большие игнорируются (patch не проходит проверку).
  state = patchSphereReview(state, '2026-10', 'health', { tasksDone: null }, now);
  assert.equal(reviewOf(state, '2026-10').spheres.health.tasksDone, null);
  const before = state;
  assert.equal(patchSphereReview(state, '2026-10', 'health', { tasksDone: -1 }, now), before);
  assert.equal(patchSphereReview(state, '2026-10', 'health', { tasksDone: 1.5 }, now), before);
  assert.equal(patchSphereReview(state, '2026-10', 'health', { tasksDone: 1000 }, now), before);
});

test('будущий месяц и неверная сфера игнорируются', () => {
  const state = initialState();
  assert.equal(saveReview(state, '2026-12', { soft: true }, now), state);
  assert.equal(patchSphereReview(state, '2026-10', 'nope', { achieved: 'x' }, now), state);
  assert.equal(setMonthRating(state, '2026-10', 6, now), state);
});

test('фокусов не больше трёх', () => {
  const state = saveReview(initialState(), '2026-10', { focuses: ['health', 'sport', 'growth', 'english'] }, now);
  assert.equal(reviewOf(state, '2026-10').focuses.length, 3);
});

test('уверенность ниже 7 предлагает шаг поменьше', () => {
  assert.ok(needsSmallerStep({ title: '10 км без остановки', confidence: 6 }));
  assert.ok(!needsSmallerStep({ title: 'x', confidence: 7 }));
  assert.equal(smallerStep('Пробежать 10 км'), 'Пробежать 6 км');
  assert.ok(smallerStep('Читать').length > 5);
});

test('мягкий режим предлагается при оценке 1–2', () => {
  assert.ok(softModeSuggested(1) && softModeSuggested(2));
  assert.ok(!softModeSuggested(3) && !softModeSuggested(null));
});

test('план превращается в задачу один раз, без XP за сами итоги', () => {
  let state = initialState();
  const questsBefore = state.quests.length;
  const xp = state.xp;
  state = patchSphereReview(state, '2026-10', 'health', { next: 'Сон до 23:00', task: { title: 'Сон до 23:00', confidence: 8 } }, now);
  const first = createPlanTasks(state, '2026-10', 'u1', now);
  assert.equal(first.created, 1);
  assert.equal(first.state.quests.length, questsBefore + 1);
  const quest = first.state.quests[first.state.quests.length - 1];
  assert.equal(quest.sphere, 'health');
  assert.equal(quest.difficulty, 'Hard');
  assert.ok(quest.dueAt?.startsWith('2026-11-01') || new Date(quest.dueAt!).getMonth() === 10);
  const second = createPlanTasks(first.state, '2026-10', 'u1', now);
  assert.equal(second.created, 0);
  const finished = finishReview(first.state, '2026-10', now);
  assert.equal(finished.monthlyReflections!['2026-10'].status, 'completed');
  assert.equal(finished.xp, xp);
  assert.ok(validState(finished));
});

test('мягкий режим создаёт одну маленькую задачу', () => {
  const state = saveReview(initialState(), '2026-10', { soft: true, softHelped: 'сон', softStep: '10 минут прогулки' }, now);
  const result = createPlanTasks(state, '2026-10', 'u1', now);
  assert.equal(result.created, 1);
  assert.equal(createPlanTasks(result.state, '2026-10', 'u1', now).created, 0);
});

test('планы прошлого месяца берутся из слов пользователя', () => {
  const state = patchSphereReview(initialState(), '2026-09', 'sport', { next: '10 км без остановки' }, new Date(2026, 8, 30));
  const plans = previousPlans(state, '2026-10');
  assert.equal(plans.length, 1);
  assert.equal(plans[0].text, '10 км без остановки');
});

test('отметки настроения и выводы', () => {
  let state = initialState();
  for (let day = 1; day <= 8; day += 1) {
    state = addMoodCheckin(state, 3, day % 2 ? 5 : 2, new Date(2026, 9, day, 12));
  }
  state.activeDates = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07'];
  assert.ok(validState(state));
  assert.equal(addMoodCheckin(state, 9, 1, now), state);
  const insights = moodInsights(state, '2026-10');
  assert.ok(insights.some((i) => i.tag === 'СВЯЗЬ'));
  assert.equal(moodInsights(initialState(), '2026-10').length, 0);
});

test('неверные итоги отклоняет проверка сохранения', () => {
  const state = initialState();
  const bad = { ...state, monthlyReflections: { '2026-10': { highlights: '', challenges: '', lessons: '', nextMonth: '', mood: null, status: 'draft', updatedAt: now.toISOString(), review: { plans: {}, wins: [], spheres: {}, gratitude: ['a'], focuses: [], soft: false, softHelped: '', softStep: '' } } } };
  assert.ok(!validState(bad));
});
