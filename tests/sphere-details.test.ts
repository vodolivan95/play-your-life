import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { initialState } from '../src/game.ts';
import { arrangeCards, nextSteps, sphereCards, sphereDetail, sphereRank, sphereStatus, sphereStreak, weeklyXP } from '../src/sphereDetails.ts';

const now = new Date(2026, 9, 11, 12, 0);
const ev = (sphere: string, daysAgo: number, xp = 20) => ({ id: sphere + daysAgo + xp, sphere, title: 'Шаг', xp, date: new Date(now.getTime() - daysAgo * 86400000).toISOString() });

test('звание и положение сферы', () => {
  assert.equal(sphereRank(0), 'Новичок');
  assert.equal(sphereRank(3), 'Ученик');
  assert.equal(sphereRank(100), 'Легенда района');
  assert.equal(sphereStatus(3, 2, true), 'strong');
  assert.equal(sphereStatus(0, 2, true), 'weak');
  assert.equal(sphereStatus(2, 2, true), 'normal');
  assert.equal(sphereStatus(0, 0, false), 'normal');
});

test('серия дней и XP по неделям считаются по событиям сферы', () => {
  const events = [ev('health', 0), ev('health', 1), ev('health', 2), ev('health', 4)];
  assert.equal(sphereStreak(events, now), 3);
  assert.equal(sphereStreak([ev('health', 1), ev('health', 2)], now), 2, 'серия не рвётся, пока сегодня нет действий');
  assert.equal(sphereStreak([ev('health', 3)], now), 0);
  const weeks = weeklyXP([ev('health', 0, 30), ev('health', 8, 10)], now);
  assert.equal(weeks.length, 8);
  assert.equal(weeks[7].xp, 30);
  assert.equal(weeks.reduce((s, w) => s + w.xp, 0), 40);
});

test('новая игра: девять районов без выдуманного прогресса', () => {
  const s = newAccountGame('Игрок');
  const cards = sphereCards(s, now);
  assert.equal(cards.length, 9);
  assert.ok(cards.every((c) => c.level === 0 && c.status === 'normal' && c.streak === 0 && c.idleDays === null && c.projects === 0));
  assert.equal(arrangeCards(cards, 'weak', 'order').length, 0);
  assert.deepEqual(nextSteps(s, 4, now), []);
});

test('демо-игра: фильтры, сортировка и открытая сфера', () => {
  const s = initialState();
  s.events.push(ev('health', 0, 15));
  const cards = sphereCards(s, now);
  const health = cards.find((c) => c.id === 'health')!;
  assert.equal(health.streak, 1);
  assert.equal(health.idleDays, 0);
  assert.ok(health.weekXP >= 15);
  const weakFirst = arrangeCards(cards, 'all', 'weak');
  assert.ok(weakFirst[0].totalXP <= weakFirst[8].totalXP);
  assert.ok(arrangeCards(cards, 'tasks', 'order').every((c) => c.tasksToday > 0));
  const detail = sphereDetail(s, 'health', now);
  assert.equal(detail.info.name, 'Здоровье');
  assert.equal(detail.history[0].xp, 15);
  assert.ok(nextSteps(s, 4, now).length <= 4);
});
