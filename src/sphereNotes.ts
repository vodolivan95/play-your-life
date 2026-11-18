/**
 * Заметки сфер в духе Google Keep: закреп, избранное, папки, цвета, напоминания,
 * архив и корзина. Хранятся в браузере отдельно для каждого владельца и не входят
 * в игровое сохранение.
 */
import { htmlToText, kbId, wordCount } from './knowledgeBase.ts';

export const noteColors = [
  { id: 'default', name: 'Без цвета', light: '#ffffff', dark: '#16213a' },
  { id: 'red', name: 'Красный', light: '#fbd3cf', dark: '#5c2b29' },
  { id: 'orange', name: 'Оранжевый', light: '#fde2c4', dark: '#614a19' },
  { id: 'yellow', name: 'Жёлтый', light: '#fff6b8', dark: '#635d19' },
  { id: 'green', name: 'Зелёный', light: '#e2f6d3', dark: '#345920' },
  { id: 'teal', name: 'Бирюзовый', light: '#b4ddd3', dark: '#16504b' },
  { id: 'blue', name: 'Голубой', light: '#d4e4ed', dark: '#2d555e' },
  { id: 'navy', name: 'Синий', light: '#aeccdc', dark: '#1e3a5f' },
  { id: 'purple', name: 'Фиолетовый', light: '#d3bfdb', dark: '#42275e' },
  { id: 'pink', name: 'Розовый', light: '#f6e2dd', dark: '#5b2245' },
  { id: 'brown', name: 'Коричневый', light: '#e9e3d4', dark: '#442f19' },
  { id: 'gray', name: 'Серый', light: '#efeff1', dark: '#3c3f43' },
] as const;
export type NoteColor = (typeof noteColors)[number]['id'];

export type NoteVersion = { id: string; at: string; title: string; html: string };
export type NoteFolder = { id: string; sphereId: string; name: string; createdAt: string };
export type SphereNote = {
  id: string;
  sphereId: string;
  folderId: string | null;
  title: string;
  html: string;
  color: NoteColor;
  pinned: boolean;
  starred: boolean;
  archived: boolean;
  deletedAt?: string;
  reminderAt?: string;
  reminderDone?: boolean;
  createdAt: string;
  updatedAt: string;
  author: string;
  versions: NoteVersion[];
};
export type NotesData = { version: 1; notes: SphereNote[]; folders: NoteFolder[] };
export type NotesView = 'all' | 'pinned' | 'starred' | 'reminders' | 'archive' | 'trash';

export const NOTES_TRASH_DAYS = 7;
const DAY = 86_400_000;

export const emptyNotes = (): NotesData => ({ version: 1, notes: [], folders: [] });

export function createNote(data: NotesData, input: { sphereId: string; folderId?: string | null; author: string; color?: NoteColor }, now = new Date()): [NotesData, SphereNote] {
  const at = now.toISOString();
  const note: SphereNote = { id: kbId('note'), sphereId: input.sphereId, folderId: input.folderId ?? null, title: '', html: '', color: input.color ?? 'default', pinned: false, starred: false, archived: false, createdAt: at, updatedAt: at, author: input.author, versions: [] };
  return [{ ...data, notes: [note, ...data.notes] }, note];
}

export function updateNote(data: NotesData, id: string, patch: Partial<Omit<SphereNote, 'id' | 'versions'>>, now = new Date()): NotesData {
  return {
    ...data,
    notes: data.notes.map((n) => {
      if (n.id !== id) return n;
      const content = (patch.html !== undefined && patch.html !== n.html) || (patch.title !== undefined && patch.title !== n.title);
      let versions = n.versions;
      if (content && (n.html || n.title)) {
        const last = versions[versions.length - 1];
        if (!last || now.getTime() - new Date(last.at).getTime() > 5 * 60_000) versions = [...versions, { id: kbId('ver'), at: n.updatedAt, title: n.title, html: n.html }].slice(-30);
      }
      const touched = content || patch.color !== undefined || patch.folderId !== undefined || patch.reminderAt !== undefined;
      return { ...n, ...patch, title: (patch.title ?? n.title).slice(0, 200), versions, updatedAt: touched ? now.toISOString() : n.updatedAt };
    }),
  };
}

export const isEmptyNote = (n: SphereNote) => !n.title.trim() && !htmlToText(n.html).trim() && !/<img/i.test(n.html);

/** Пустая заметка, которую закрыли без текста, не остаётся в списке. */
export function dropIfEmpty(data: NotesData, id: string): NotesData {
  const n = data.notes.find((x) => x.id === id);
  return n && isEmptyNote(n) ? { ...data, notes: data.notes.filter((x) => x.id !== id) } : data;
}

export const trashNote = (data: NotesData, id: string, now = new Date()) => updateNote(data, id, { deletedAt: now.toISOString(), pinned: false });
export const restoreNote = (data: NotesData, id: string) => ({ ...data, notes: data.notes.map((n) => (n.id === id ? { ...n, deletedAt: undefined } : n)) });
export const deleteNoteForever = (data: NotesData, id: string) => ({ ...data, notes: data.notes.filter((n) => n.id !== id) });
export const emptyNotesTrash = (data: NotesData, sphereId: string) => ({ ...data, notes: data.notes.filter((n) => !(n.deletedAt && n.sphereId === sphereId)) });
export function purgeNotes(data: NotesData, now = new Date()): NotesData {
  return { ...data, notes: data.notes.filter((n) => !n.deletedAt || now.getTime() - new Date(n.deletedAt).getTime() <= NOTES_TRASH_DAYS * DAY) };
}

export function duplicateNote(data: NotesData, id: string, now = new Date()): NotesData {
  const n = data.notes.find((x) => x.id === id);
  if (!n) return data;
  const at = now.toISOString();
  const copy = { ...n, id: kbId('note'), title: n.title ? `${n.title} (копия)` : '', pinned: false, createdAt: at, updatedAt: at, versions: [] };
  const index = data.notes.indexOf(n);
  const notes = [...data.notes];
  notes.splice(index, 0, copy);
  return { ...data, notes };
}

export function addFolder(data: NotesData, sphereId: string, name: string, now = new Date()): [NotesData, NoteFolder | null] {
  const clean = name.trim().slice(0, 60);
  if (!clean) return [data, null];
  const folder = { id: kbId('folder'), sphereId, name: clean, createdAt: now.toISOString() };
  return [{ ...data, folders: [...data.folders, folder] }, folder];
}
export const renameFolder = (data: NotesData, id: string, name: string) => (name.trim() ? { ...data, folders: data.folders.map((f) => (f.id === id ? { ...f, name: name.trim().slice(0, 60) } : f)) } : data);
/** Удаление папки не удаляет заметки: они остаются во «Всех заметках». */
export const removeFolder = (data: NotesData, id: string) => ({ folders: data.folders.filter((f) => f.id !== id), notes: data.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)), version: 1 as const });

export function filterNotes(data: NotesData, sphereId: string, view: NotesView, folderId: string | null, query: string): SphereNote[] {
  const q = query.trim().toLowerCase();
  return data.notes
    .filter((n) => n.sphereId === sphereId)
    .filter((n) => {
      if (view === 'trash') return !!n.deletedAt;
      if (n.deletedAt) return false;
      if (view === 'archive') return n.archived;
      if (n.archived) return false;
      if (view === 'pinned') return n.pinned;
      if (view === 'starred') return n.starred;
      if (view === 'reminders') return !!n.reminderAt;
      return true;
    })
    .filter((n) => !folderId || n.folderId === folderId)
    .filter((n) => !q || n.title.toLowerCase().includes(q) || htmlToText(n.html).toLowerCase().includes(q))
    .sort((a, b) => (view === 'reminders' ? (a.reminderAt ?? '').localeCompare(b.reminderAt ?? '') : b.updatedAt.localeCompare(a.updatedAt)));
}

export function notesCounts(data: NotesData, sphereId: string) {
  const mine = data.notes.filter((n) => n.sphereId === sphereId);
  const live = mine.filter((n) => !n.deletedAt && !n.archived);
  return { all: live.length, pinned: live.filter((n) => n.pinned).length, starred: live.filter((n) => n.starred).length, reminders: live.filter((n) => n.reminderAt).length, archive: mine.filter((n) => n.archived && !n.deletedAt).length, trash: mine.filter((n) => n.deletedAt).length };
}

export function dueReminders(data: NotesData, now = new Date()): SphereNote[] {
  return data.notes.filter((n) => n.reminderAt && !n.reminderDone && !n.deletedAt && new Date(n.reminderAt).getTime() <= now.getTime());
}

export const noteStats = (n: SphereNote) => wordCount(n.html);

export const notesStorageKey = (owner: string) => `pyl-sphere-notes-v1:${owner}`;
export function parseNotes(raw: string | null, now = new Date()): NotesData {
  if (!raw) return emptyNotes();
  try {
    const data = JSON.parse(raw) as Partial<NotesData>;
    const notes = Array.isArray(data.notes)
      ? data.notes
          .filter((n) => n && typeof n.id === 'string' && typeof n.sphereId === 'string' && typeof n.html === 'string')
          .map((n) => ({ ...n, title: n.title ?? '', color: noteColors.some((c) => c.id === n.color) ? n.color : ('default' as NoteColor), versions: Array.isArray(n.versions) ? n.versions : [], folderId: n.folderId ?? null }))
      : [];
    const folders = Array.isArray(data.folders) ? data.folders.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string') : [];
    return purgeNotes({ version: 1, notes, folders }, now);
  } catch {
    return emptyNotes();
  }
}
