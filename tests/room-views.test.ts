import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestInView, roomViews } from '../src/roomViews.ts';

test('из кабинета «Саморазвития» окна смотрят на «Английский» (юг) и «Здоровье» (запад)', () => {
  const views = roomViews('growth');
  assert.equal(views.facing, 'south');
  assert.equal(views.back.building, 'english');
  assert.equal(views.side.building, 'health');
  assert.ok(views.back.distance < views.side.distance, 'через улицу ближе, чем вдоль квартала');
});
test('север и восток от «Саморазвития» — море, зданий нет', () => {
  assert.equal(nearestInView('growth', [0, -1]).building, null);
  assert.equal(nearestInView('growth', [1, 0]).building, null);
});
test('у каждого здания хотя бы одно окно выходит на соседа', () => {
  for (const id of ['health', 'sport', 'growth', 'finance', 'english', 'driving', 'together', 'tasks', 'hobby']) {
    const views = roomViews(id);
    assert.ok(views.back.building || views.side.building, id);
    assert.notEqual(views.back.building, id);
  }
});
