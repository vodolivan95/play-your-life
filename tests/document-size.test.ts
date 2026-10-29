import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDocumentFits, DOCUMENT_SIZE_LIMIT } from '../src/firebaseSave.ts';

test('assertDocumentFits: небольшой документ проходит без ошибки', () => {
  assert.doesNotThrow(() =>
    assertDocumentFits({ state: { xp: 1 }, economyRecords: {}, revision: 1 }),
  );
});

test('assertDocumentFits: документ у предела Firestore даёт понятную ошибку, а не падает молча', () => {
  // Единственный источник неограниченного роста сейчас — economyRecords (по записи
  // на каждую когда-либо созданную задачу/привычку, никогда не уменьшается).
  const economyRecords: Record<string, unknown> = {};
  for (let i = 0; i < 6000; i++)
    economyRecords[`quest:${i}`] = {
      type: 'quest', coins: 50, xp: 40, item: '', sphere: 'health',
      locked: true, completed: true, progress: 1, claims: {}, offset: 0,
      weekdays: [], active: true, createdDay: 0,
    };
  assert.throws(
    () => assertDocumentFits({ state: { xp: 1 }, economyRecords, revision: 1 }),
    /предела Firestore/,
  );
});

test('DOCUMENT_SIZE_LIMIT оставляет запас под реальный предел документа Firestore (1 048 576 байт)', () => {
  assert.ok(DOCUMENT_SIZE_LIMIT < 1048576);
  assert.ok(1048576 - DOCUMENT_SIZE_LIMIT > 50000, 'запас меньше 50 КБ — слишком узко для накладных расходов Firestore');
});
