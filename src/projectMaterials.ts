import type { GameState } from './game.ts';
import { validDriveLink } from './oneDriveLinks.ts';
import type { DriveLink } from './oneDriveLinks.ts';

export type ProjectMaterial = {
  id: string;
  kind: 'note' | 'file' | 'onedrive';
  title: string;
  text?: string;
  starred: boolean;
  updatedAt: string;
  size?: number;
  mime?: string;
  oneDrive?: DriveLink;
};
export const MAX_PROJECT_MATERIALS = 50;
export const MAX_MATERIAL_FILE_BYTES = 20 * 1024 * 1024;
export function validProjectMaterials(value: unknown): value is ProjectMaterial[] | undefined {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > MAX_PROJECT_MATERIALS) return false;
  return new Set(value.map(m => m?.id)).size === value.length &&
    value.reduce((sum, m) => sum + (typeof m?.text === 'string' ? m.text.length : 0), 0) <= 100000 &&
    value.every(m => m && typeof m === 'object' && typeof m.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(m.id) &&
      typeof m.title === 'string' && !!m.title.trim() && m.title.length <= 200 && typeof m.starred === 'boolean' &&
      typeof m.updatedAt === 'string' && Number.isFinite(Date.parse(m.updatedAt)) &&
      (m.kind === 'onedrive' ? validDriveLink(m.oneDrive) && m.text === undefined && m.size === undefined && m.mime === undefined : m.oneDrive === undefined && (m.kind === 'note' ? typeof m.text === 'string' && m.text.length <= 5000 && m.size === undefined && m.mime === undefined :
        m.kind === 'file' && m.text === undefined && Number.isInteger(m.size) && m.size >= 0 && m.size <= MAX_MATERIAL_FILE_BYTES &&
        typeof m.mime === 'string' && m.mime.length <= 150)));
}
export function updateProjectMaterial(state: GameState, goalId: string, material: ProjectMaterial | { id: string; remove: true }): GameState {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) throw new Error('Проект не найден.');
  const previous = goal.materials ?? [];
  const materials = 'remove' in material ? previous.filter(m => m.id !== material.id) :
    previous.some(m => m.id === material.id) ? previous.map(m => m.id === material.id ? material : m) : [...previous, material];
  if (!validProjectMaterials(materials)) throw new Error('Не удалось сохранить материал: не больше 50 материалов, 5000 символов в заметке и 100 000 символов суммарно.');
  return { ...state, goals: state.goals.map(g => g.id === goalId ? { ...g, materials } : g) };
}
