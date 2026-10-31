import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchBrand } from '../src/brands.ts';

test('matchBrand находит известный бренд независимо от регистра и языка названия', () => {
  const youtube = matchBrand('YouTube Premium');
  assert.ok(youtube);
  assert.equal(youtube!.title, 'YouTube');

  const ticktick = matchBrand('подписка ticktick');
  assert.ok(ticktick);
  assert.equal(ticktick!.title, 'TickTick');
});

test('matchBrand возвращает null для платежа без известного логотипа', () => {
  assert.equal(matchBrand('Microsoft 365'), null);
  assert.equal(matchBrand('Коммуналка'), null);
  assert.equal(matchBrand(''), null);
});

test('matchBrand различает специфичные подсервисы Apple/HBO от общего бренда', () => {
  assert.equal(matchBrand('Apple Music')!.title, 'Apple Music');
  assert.equal(matchBrand('Apple TV')!.title, 'Apple TV');
  assert.equal(matchBrand('iCloud+')!.title, 'iCloud');
  assert.equal(matchBrand('Apple ID')!.title, 'Apple');
  assert.equal(matchBrand('HBO Max')!.title, 'HBO Max');
  assert.equal(matchBrand('HBO')!.title, 'HBO');
});
