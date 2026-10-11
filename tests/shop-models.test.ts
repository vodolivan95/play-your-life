import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { shopItems } from '../src/shop.ts';
import { shopModels, shopModelFile } from '../src/shopModels.ts';

test('у каждой 3D-модели магазина есть товар и корректный GLB-файл', () => {
  for (const [id, model] of Object.entries(shopModels)) {
    assert.ok(shopItems.some((item) => item.id === id), `нет товара ${id}`);
    const path = `public/models/shop/${model!.file}`;
    const head = readFileSync(path).subarray(0, 12);
    assert.equal(head.toString('latin1', 0, 4), 'glTF', `${path} не GLB`);
    assert.equal(head.readUInt32LE(4), 2, 'нужен glTF 2.0');
    assert.ok(statSync(path).size < 3 * 1024 * 1024, `${path} тяжелее 3 МБ — сожмите текстуры`);
  }
});

test('товар без модели остаётся с прежней картинкой', () => {
  assert.equal(shopModelFile('coffee'), 'coffee.glb');
  assert.equal(shopModelFile('rest'), null);
});
