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
test('из спортзала окна смотрят на «Здоровье» (восток) и «Финансы» (юг)', () => {
  const views = roomViews('sport');
  assert.equal(views.facing, 'east');
  assert.equal(views.back.building, 'health');
  assert.equal(views.side.building, 'finance');
});
test('из «Центра здоровья» окна смотрят на «Английский» (юг) и «Спорт» (запад)', () => {
  const views = roomViews('health');
  assert.equal(views.back.building, 'english');
  assert.equal(views.side.building, 'sport');
});
test('из «Финансов» окна смотрят на «Спорт» (север) и «Здоровье» (восток)', () => {
  const views = roomViews('finance');
  assert.equal(views.facing, 'north');
  assert.equal(views.back.building, 'sport');
  assert.equal(views.side.building, 'health');
});
test('из «Английского» окна смотрят на «Общие дела» (юг) и «Здоровье» (запад)', () => {
  const views = roomViews('english');
  assert.equal(views.back.building, 'together');
  assert.equal(views.side.building, 'health');
});
test('из «Вождения» окна смотрят на «Финансы» (север) и «Задачи» (восток)', () => {
  const views = roomViews('driving');
  assert.equal(views.back.building, 'finance');
  assert.equal(views.side.building, 'tasks');
});
test('из «Общих дел» окна смотрят на «Задачи» (запад) и «Английский» (север)', () => {
  const views = roomViews('together');
  assert.equal(views.back.building, 'tasks');
  assert.equal(views.side.building, 'english');
});
test('из «Хобби» окна смотрят на «Задачи» (запад) и «Общие дела» (север)', () => {
  const views = roomViews('hobby');
  assert.equal(views.back.building, 'tasks');
  assert.equal(views.side.building, 'together');
});
