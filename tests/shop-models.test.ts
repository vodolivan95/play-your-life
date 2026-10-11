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

test('у моделей магазина лицевые грани смотрят наружу (иначе three.js отсекает их)', () => {
  for (const model of Object.values(shopModels)) {
    const raw = readFileSync(`public/models/shop/${model!.file}`);
    const jsonLength = raw.readUInt32LE(12);
    const gltf = JSON.parse(raw.toString('utf8', 20, 20 + jsonLength));
    const bin = raw.subarray(20 + jsonLength + 8);
    const read = (index: number) => {
      const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
      const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type as 'SCALAR'] ?? 1;
      const start = bin.byteOffset + v.byteOffset;
      const buffer = bin.buffer.slice(start, start + a.count * n * (a.componentType === 5123 ? 2 : 4));
      return a.componentType === 5126 ? new Float32Array(buffer) : a.componentType === 5123 ? new Uint16Array(buffer) : new Uint32Array(buffer);
    };
    let inverted = 0, total = 0;
    for (const mesh of gltf.meshes) {
      const p = mesh.primitives[0];
      const P = read(p.attributes.POSITION), N = read(p.attributes.NORMAL), I = read(p.indices);
      for (let t = 0; t < I.length; t += 3) {
        const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
        const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], w = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
        const g = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const n = [N[a] + N[b] + N[c], N[a + 1] + N[b + 1] + N[c + 1], N[a + 2] + N[b + 2] + N[c + 2]];
        if (g[0] * n[0] + g[1] * n[1] + g[2] * n[2] < 0) inverted++;
        total++;
      }
    }
    assert.ok(inverted / total < 0.01, `${model!.file}: вывернуто ${inverted} из ${total} треугольников`);
  }
});
