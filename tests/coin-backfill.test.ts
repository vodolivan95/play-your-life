import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccountGame } from '../src/accountGame.ts';
import { completeQuest } from '../src/game.ts';
import { saveCustomQuest } from '../src/personalQuests.ts';
import { backfillTaskCoins, owedTaskCoins } from '../src/coinBackfill.ts';

test('новая задача по умолчанию даёт лайфкоины (XP / 5)', () => {
  const s = saveCustomQuest(newAccountGame('Тест'), { name: 'Сделать', sphere: 'tasks', difficulty: 'Medium' }, 'u1');
  assert.equal(s.quests.at(-1)!.rewardCoins, 4);
});

test('закрытые задачи без награды оплачиваются один раз', () => {
  let s = newAccountGame('Тест');
  for (let i = 0; i < 30; i += 1) s = saveCustomQuest(s, { name: `Задача ${i}`, sphere: 'tasks', difficulty: 'Very Hard', rewardCoins: 0 }, 'u1');
  for (const q of s.quests) s = completeQuest(s, q.id);
  s = saveCustomQuest(s, { name: 'Открытая', sphere: 'tasks', difficulty: 'Simple', rewardCoins: 0 }, 'u1');
  const owed = owedTaskCoins(s);
  assert.equal(owed.tasks, 30);
  assert.equal(owed.coins, 30 * 16);
  const before = s.coins;
  const r = backfillTaskCoins(s, 'u1');
  assert.equal(r.coins, 480);
  assert.equal(r.state.coins - before, 480);
  assert.equal(r.state.quests.filter((q) => q.id.startsWith('coins-backfill-') && q.done).length, 5);
  assert.ok(r.state.quests.every((q) => !q.id.startsWith('coins-backfill-') || (q.rewardCoins ?? 0) <= 100));
  assert.equal(r.state.quests.find((q) => q.name === 'Открытая')!.rewardCoins, 2);
  const again = backfillTaskCoins(r.state, 'u1');
  assert.equal(again.coins, 0);
  assert.equal(again.state, r.state);
});
