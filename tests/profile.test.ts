import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avatars,
  changeScore,
  completeQuest,
  initialState,
  migrateState,
  personalState,
  playerProgress,
  spheres,
  updateGoal,
} from '../src/game.ts';
const scores = Object.fromEntries(spheres.map((s) => [s.id, 5]));
const profile = { name: '  Иван  ', avatar: avatars[2].icon };
const goal = { name: 'Пробежать 10 километров', sphere: 'sport', target: 10 };
test('новая игра: нулевой XP, личная цель и собственные стартовые оценки', () => {
  const state = personalState(profile, scores, goal);
  assert.equal(state.xp, 0);
  assert.equal(state.coins, 0);
  assert.equal(state.quests.length, 0);
  assert.equal(state.profile.name, 'Иван');
  assert.equal(state.profile.avatar, '🦊');
  assert.equal(state.profile.mode, 'personal');
  assert.equal(state.profile.onboardingComplete, true);
  assert.equal(state.goals[0].name, goal.name);
  assert.equal(state.goals[0].current, 0);
  assert.equal(state.mainGoalId, state.goals[0].id);
  assert.equal(state.events.length, 0);
  assert.equal(state.activeDates.length, 0);
  assert.equal(state.spheres.sport.score, 5);
  assert.equal(state.spheres.sport.xp, 0);
  assert.equal(playerProgress(state).level, 1);
  assert.equal(playerProgress(state).nextXP, 200);
});
test('начальная оценка не выдаёт XP, улучшение и защита от фарма работают', () => {
  const state = personalState(profile, { ...scores, sport: 8 }, goal);
  assert.equal(changeScore(state, 'sport', 8).xp, 0);
  const improved = changeScore(state, 'sport', 9);
  assert.equal(improved.xp, 15);
  assert.equal(
    changeScore(changeScore(improved, 'sport', 4), 'sport', 9).xp,
    15,
  );
});
test('первый квест и цель повышают уровень личного игрока', () => {
  const state = personalState(profile, scores, goal);
  state.quests = [
    {
      id: 'first',
      name: 'Прогулка',
      sphere: 'sport',
      xp: 20,
      done: false,
      difficulty: 'Medium',
    },
  ];
  const done = completeQuest(state, 'first');
  assert.equal(done.xp, 20);
  assert.equal(playerProgress(done).level, 1);
  const finished = updateGoal(done, state.mainGoalId!, 10);
  assert.equal(finished.xp, 220);
  assert.equal(playerProgress(finished).level, 2);
  assert.equal(playerProgress(finished).progress, 10);
  assert.equal(updateGoal(finished, state.mainGoalId!, 10).xp, 220);
});
test('миграция V0.1 сохраняет прогресс и блокировку повторных наград', () => {
  const old = changeScore(
    completeQuest(initialState(), 'english-1'),
    'sport',
    7,
  );
  const { profile: _profile, mainGoalId: _goal, ...legacy } = old;
  void _profile;
  void _goal;
  const migrated = migrateState(legacy);
  assert.equal(migrated.profile.mode, 'demo');
  assert.equal(migrated.profile.onboardingComplete, true);
  assert.equal(migrated.xp, old.xp);
  assert.deepEqual(migrated.quests, old.quests);
  assert.deepEqual(migrated.spheres, old.spheres);
  assert.deepEqual(migrated.events, old.events);
  assert.deepEqual(migrated.activeDates, old.activeDates);
  assert.deepEqual(migrated.streakClaims, old.streakClaims);
  assert.equal(playerProgress(migrated).level, 12);
  assert.equal(completeQuest(migrated, 'english-1').xp, old.xp);
  assert.equal(changeScore(migrated, 'sport', 7).xp, old.xp);
});
test('профиль и выбранная главная цель сохраняются при перезагрузке', () => {
  const state = personalState(profile, scores, goal);
  state.goals.push({ ...state.goals[0], id: 'second', name: 'Вторая цель' });
  state.mainGoalId = 'second';
  const loaded = migrateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(loaded, state);
  assert.equal(loaded.mainGoalId, 'second');
});
test('невалидные данные не создают новую игру', () => {
  assert.throws(() => personalState({ ...profile, name: '   ' }, scores, goal));
  assert.throws(() => personalState(profile, { ...scores, sport: 10 }, goal));
  assert.throws(() => personalState(profile, scores, { ...goal, target: 0 }));
  assert.throws(() => personalState(profile, scores, { ...goal, target: 1.5 }));
});
