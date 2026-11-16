import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { validProjectMaterials, updateProjectMaterial, MAX_MATERIAL_FILE_BYTES } from '../src/projectMaterials.ts';
const note = { id: 'note-1', kind: 'note' as const, title: 'Смета', text: 'Материалы', starred: false, updatedAt: '2026-11-16T10:00:00Z' };
test('материалы: совместимость, ограничения и отсутствие файлов в сохранении', () => {
 assert.equal(validProjectMaterials(undefined), true);
 assert.equal(validProjectMaterials([note]), true);
 for (const value of [[note, note], [{ ...note, text: 'x'.repeat(5001) }], [{ ...note, title: ' ' }], [{ ...note, kind: 'file', text: undefined, size: MAX_MATERIAL_FILE_BYTES + 1, mime: '' }]]) assert.equal(validProjectMaterials(value), false);
});
test('избранное и удаление материала сохраняют остальные данные проекта', () => {
 const state = initialState();
 state.goals = [{ id: 'g', name: 'Проект', sphere: 'health', target: 100, current: 0, reward: 10 }];
 const added = updateProjectMaterial(state, 'g', note);
 const starred = updateProjectMaterial(added, 'g', { ...note, starred: true });
 assert.equal(starred.goals[0].materials?.[0].starred, true);
 assert.equal(state.goals[0].materials, undefined);
 assert.deepEqual(updateProjectMaterial(starred, 'g', { id: note.id, remove: true }).goals[0], { ...state.goals[0], materials: [] });
 assert.throws(() => updateProjectMaterial(state, 'missing', note));
});
