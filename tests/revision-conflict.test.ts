import assert from 'node:assert/strict';
import test from 'node:test';
import { revisionConflictOnDenial } from '../src/revisionConflict.ts';

test('сохранение: подтверждённая более новая ревизия превращает отказ в обычный конфликт', async () => {
  const denied = Object.assign(new Error('denied'), { code: 'permission-denied' });
  let reads = 0;
  const result = await revisionConflictOnDenial(async () => { throw denied; }, 2, async () => { reads++; return 3; });
  assert.equal(result, null);
  assert.equal(reads, 1);
});
test('сохранение: реальные отказы и недоступное чтение не маскируются конфликтом', async () => {
  const denied = Object.assign(new Error('denied'), { code: 'permission-denied' });
  for (const revision of [undefined, 1, 2, NaN]) {
    await assert.rejects(revisionConflictOnDenial(async () => { throw denied; }, 2, async () => revision), (e) => e === denied);
  }
  await assert.rejects(revisionConflictOnDenial(async () => { throw denied; }, 2, async () => { throw new Error('offline'); }), (e) => e === denied);
  const offline = Object.assign(new Error('offline'), { code: 'unavailable' });
  await assert.rejects(revisionConflictOnDenial(async () => { throw offline; }, 2, async () => { throw new Error('не должно читаться'); }), (e) => e === offline);
});
test('сохранение: успешная запись и штатный конфликт не делают дополнительного чтения', async () => {
  const read = async () => { throw new Error('не должно читаться'); };
  assert.equal(await revisionConflictOnDenial(async () => 3, 2, read), 3);
  assert.equal(await revisionConflictOnDenial(async () => null, 2, read), null);
});
