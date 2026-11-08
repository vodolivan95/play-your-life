import assert from 'node:assert/strict';
import test from 'node:test';
import { dayDistance, timelineDays, timelinePlacement, timelineRows } from '../src/planningTimeline.ts';
import { newAccountGame } from '../src/accountGame.ts';
import { quickPlanningTask } from '../src/planner.ts';

test('шкала: границы месяца, DST и ограничение размера периода', () => {
  assert.equal(dayDistance('2026-03-28', '2026-03-30'), 2);
  assert.deepEqual(timelineDays('2026-02-28', '2026-03-01'), ['2026-02-28', '2026-03-01']);
  assert.throws(() => timelineDays('2026-02-30', '2026-03-01'));
  assert.throws(() => timelineDays('2026-01-01', '2026-12-31'));
});
test('шкала: обрезает длинные интервалы, различает отсутствие дат и выход за период', () => {
  assert.deepEqual(timelinePlacement('2026-11-01', '2026-11-30', '2026-10-10', '2026-11-03'), { offset: 0, span: 3 });
  assert.equal(timelinePlacement('2026-11-01', '2026-11-30'), undefined);
  assert.equal(timelinePlacement('2026-11-01', '2026-11-30', '2026-12-01')?.span, 0);
  assert.equal(timelinePlacement('2026-11-01', '2026-11-30', '2026-11-03')?.span, 1);
  assert.equal(timelinePlacement('2026-11-01', '2026-11-30', '2026-11-03', '2026-11-01')?.span, 0);
});
test('шкала читает существующую задачу, не создаёт вторую запись или награду', () => {
  const s = quickPlanningTask(newAccountGame('Тест'), 'Шаг', 'u', '2026-11-01');
  const before = JSON.stringify(s);
  const rows = timelineRows(s, s.quests);
  assert.equal(rows[0].task?.id, s.quests[0].id);
  assert.equal(rows[0].progress, 0);
  assert.equal(JSON.stringify(s), before);
});
