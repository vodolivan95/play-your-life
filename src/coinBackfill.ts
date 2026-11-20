import type { GameState, Quest } from './game.ts';
import { completeQuest } from './game.ts';
import { saveCustomQuest } from './personalQuests.ts';

/* 0.90.7: лайфкоины за задачи. Раньше у своих задач (и у задач из загруженного плана) по умолчанию
 * было 0 лайфкоинов. Теперь по умолчанию — как у системных: XP / 5 с округлением вверх.
 * Уже закрытые задачи с нулевой наградой оплачиваются один раз «наградными» задачами по ≤100 лайфкоинов:
 * облачные правила принимают лайфкоины только как награду за выполненную задачу. */
export const BACKFILL_PREFIX = 'coins-backfill-';
export const defaultTaskCoins = (xp: number) => Math.max(1, Math.ceil(xp / 5));

const owesCoins = (q: Quest) => q.sourceType === 'USER_CREATED' && q.done && q.rewardClaimed && (q.rewardCoins ?? 0) === 0 && !q.id.startsWith(BACKFILL_PREFIX);

/** Сколько лайфкоинов недоплачено за закрытые задачи. */
export function owedTaskCoins(state: GameState): { tasks: number; coins: number } {
  const list = state.quests.filter(owesCoins);
  return { tasks: list.length, coins: list.reduce((s, q) => s + defaultTaskCoins(q.xp), 0) };
}

/** Один раз: начислить недоплаченное и выставить награду открытым задачам с нулём лайфкоинов. */
export function backfillTaskCoins(state: GameState, ownerId: string): { state: GameState; coins: number; tasks: number } {
  if (state.quests.some((q) => q.id.startsWith(BACKFILL_PREFIX))) return { state, coins: 0, tasks: 0 };
  // Открытые задачи без награды и без начатого прогресса — получают награду по умолчанию.
  const open = (q: Quest) => q.sourceType === 'USER_CREATED' && !q.done && !q.rewardLocked && !(q.currentValue ?? 0) && (q.rewardCoins ?? 0) === 0;
  let next: GameState = state.quests.some(open) ? { ...state, quests: state.quests.map((q) => (open(q) ? { ...q, rewardCoins: defaultTaskCoins(q.xp) } : q)) } : state;
  const owed = owedTaskCoins(next);
  if (!owed.coins) return { state: next, coins: 0, tasks: 0 };
  const parts = Math.ceil(owed.coins / 100);
  let left = owed.coins;
  for (let k = 1; k <= parts; k += 1) {
    const amount = Math.min(100, left);
    left -= amount;
    const before = new Set(next.quests.map((q) => q.id));
    next = saveCustomQuest(next, { name: `🪙 Лайфкоины за ранее закрытые задачи${parts > 1 ? ` (${k}/${parts})` : ''}`, sphere: 'tasks', difficulty: 'Micro', rewardCoins: amount, notes: `Начислено за ${owed.tasks} закрытых задач, у которых не было награды.` }, ownerId);
    const created = next.quests.find((q) => !before.has(q.id));
    if (!created) break;
    const id = `${BACKFILL_PREFIX}${k}`;
    next = { ...next, quests: next.quests.map((q) => (q.id === created.id ? { ...q, id } : q)) };
    next = completeQuest(next, id);
  }
  return { state: next, coins: owed.coins, tasks: owed.tasks };
}
