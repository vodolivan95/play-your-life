import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeQuest, initialState, spheres, todayEarnings, weekCompletedQuests } from '../src/game.ts';

test('todayEarnings считает XP и монеты только за сегодня', () => {
  const before = initialState();
  const quest = before.quests.find((q) => !q.done);
  assert.ok(quest, 'в начальном состоянии должна быть хотя бы одна невыполненная задача');
  const after = completeQuest(before, quest!.id);
  const now = new Date();
  const earnings = todayEarnings(after, now);
  assert.equal(earnings.xp, quest!.xp);
  // Монеты начисляются только если у задачи есть rewardCoins/награда — проверяем неотрицательность и согласованность с coinTransactions.
  assert.ok(earnings.coins >= 0);
  const todaysSum = (after.coinTransactions ?? [])
    .filter((t) => t.createdAt.slice(0, 10) === now.toISOString().slice(0, 10))
    .reduce((sum, t) => sum + t.amount, 0);
  assert.equal(earnings.coins, todaysSum);
  // Задача из другого дня не должна попадать в сегодняшний баланс.
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const backdated = {
    ...after,
    events: after.events.map((e) => ({ ...e, date: yesterday.toISOString() })),
  };
  assert.equal(todayEarnings(backdated, now).xp, 0);
});

test('todayEarnings считает выполненные сегодня привычки из запланированных на сегодня', () => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const state = {
    ...initialState(),
    habits: [
      { timezoneMinutes: 0, id: 'h1', ownerId: 'u', title: 'A', sphere: 'health', iconId: 'x', targetValue: 1, unit: '', weekdays: [0, 1, 2, 3, 4, 5, 6], rewardCoins: 1, rewardXp: 1, isActive: true, currentStreak: 0, bestStreak: 0, totalCompletions: 0, createdAt: now.toISOString(), rewardLocked: false },
      { timezoneMinutes: 0, id: 'h2', ownerId: 'u', title: 'B', sphere: 'health', iconId: 'x', targetValue: 1, unit: '', weekdays: [0, 1, 2, 3, 4, 5, 6], rewardCoins: 1, rewardXp: 1, isActive: true, currentStreak: 0, bestStreak: 0, totalCompletions: 0, createdAt: now.toISOString(), rewardLocked: false },
      { timezoneMinutes: 0, id: 'h3', ownerId: 'u', title: 'C (неактивна)', sphere: 'health', iconId: 'x', targetValue: 1, unit: '', weekdays: [0, 1, 2, 3, 4, 5, 6], rewardCoins: 1, rewardXp: 1, isActive: false, currentStreak: 0, bestStreak: 0, totalCompletions: 0, createdAt: now.toISOString(), rewardLocked: false },
    ],
    habitCompletions: [
      { id: 'c1', habitId: 'h1', ownerId: 'u', dayOrdinal: 0, day: today, value: 1, completedAt: now.toISOString(), rewardClaimed: true },
    ],
  };
  const earnings = todayEarnings(state, now);
  assert.equal(earnings.habitsTotal, 2); // только активные
  assert.equal(earnings.habitsDone, 1);
});

test('weekCompletedQuests группирует выполненные задачи по дням недели (Пн–Вс) и находит сферу-лидера', () => {
  const state = initialState();
  const quests = state.quests.filter((q) => !q.done).slice(0, 2);
  assert.ok(quests.length >= 2, 'нужно хотя бы две невыполненные задачи для теста');
  let next = state;
  for (const q of quests) next = completeQuest(next, q.id);
  const now = new Date();
  const week = weekCompletedQuests(next, now);
  assert.equal(week.days.length, 7);
  assert.equal(week.total, quests.length);
  const todayIndex = (now.getDay() + 6) % 7;
  assert.equal(week.counts[todayIndex], quests.length);
  assert.ok(week.counts.reduce((a, b) => a + b, 0) === week.total);
  if (quests[0].sphere === quests[1].sphere) {
    assert.equal(week.topSphereName, spheres.find((s) => s.id === quests[0].sphere)?.name);
  } else {
    assert.ok([quests[0].sphere, quests[1].sphere]
      .map((id) => spheres.find((s) => s.id === id)?.name)
      .includes(week.topSphereName));
  }
});
