import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Goal } from '../game';
import { MAX_MATERIAL_FILE_BYTES, updateProjectMaterial } from '../projectMaterials';
import type { ProjectMaterial } from '../projectMaterials';
import { materialFile } from '../localMaterialFiles';
import Icon from './Icon';
import { driveLinkHash } from '../oneDriveLinks';
import type { DriveLink } from '../oneDriveLinks';
const OneDriveAttachButton = lazy(() => import('./OneDriveAttachButton'));

type Props = { state: GameState; goal: Goal; ownerId: string; onChange: Dispatch<SetStateAction<GameState>>; notify: (message: string) => void; onLegacyNotes: () => void };
export function ProjectFavorites({ goal, onOpen, onLegacyNotes }: { goal: Goal; onOpen: () => void; onLegacyNotes: () => void }) {
  const starred = (goal.materials ?? []).filter(m => m.starred);
  if (!starred.length && !(goal.notesStarred && goal.notes)) return null;
  return <section className="ss-panel pw-favorites" aria-label="Избранные материалы"><h3><Icon name="star" /> Избранные материалы</h3>
    {goal.notesStarred && goal.notes && <button className="ss-tool" onClick={onLegacyNotes}><Icon name="document" /><span><strong>Заметки проекта</strong><small>{goal.notes}</small></span></button>}
    {starred.map(m => <button key={m.id} className="ss-tool" onClick={onOpen}><Icon name={m.kind === 'note' ? 'document' : 'attachment'} /><span><strong>{m.title}</strong><small>{m.kind === 'onedrive' ? 'OneDrive' : m.kind === 'file' ? 'Файл на устройстве' : m.text}</small></span></button>)}
  </section>;
}
export default function ProjectMaterials({ state, goal, ownerId, onChange, notify, onLegacyNotes }: Props) {
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(0);
  useEffect(() => { mounted.current += 1; return () => { mounted.current += 1; }; }, [ownerId, goal.id]);
  function apply(action: (s: GameState) => GameState) {
    try { action(state); } catch (e) { notify(e instanceof Error ? e.message : 'Не удалось сохранить материал.'); return false; }
    onChange(s => { try { return action(s); } catch { return s; } });
    return true;
  }
  function toggle(m: ProjectMaterial) {
    apply(s => { const latest = s.goals.find(g => g.id === goal.id)?.materials?.find(x => x.id === m.id); return latest ? updateProjectMaterial(s, goal.id, { ...latest, starred: !latest.starred }) : s; });
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    if (file.size > MAX_MATERIAL_FILE_BYTES) { notify('Максимальный размер файла — 20 МБ.'); return; }
    const m: ProjectMaterial = { id: crypto.randomUUID(), kind: 'file', title: file.name.slice(0, 200), mime: file.type.slice(0, 150), size: file.size, starred: false, updatedAt: new Date().toISOString() };
    const generation = mounted.current;
    setBusy(true);
    try {
      updateProjectMaterial(state, goal.id, m);
      await materialFile(ownerId, goal.id, m.id, 'put', file);
      if (mounted.current !== generation || !apply(s => updateProjectMaterial(s, goal.id, m))) await materialFile(ownerId, goal.id, m.id, 'delete');
    } catch (e) { notify(e instanceof Error ? e.message : 'Не удалось добавить файл.'); }
    finally { if (mounted.current === generation) setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function download(m: ProjectMaterial) {
    try {
      const blob = await materialFile(ownerId, goal.id, m.id, 'get');
      if (!blob) { notify('Этого файла нет на устройстве. Откройте проект в браузере, где файл был добавлен.'); return; }
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
      const a = document.createElement('a'); a.href = url; a.download = m.title; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { notify(e instanceof Error ? e.message : 'Файл недоступен.'); }
  }
  async function remove(m: ProjectMaterial) {
    if (!window.confirm(`Удалить материал «${m.title}»?`)) return;
    if (apply(s => updateProjectMaterial(s, goal.id, { id: m.id, remove: true })) && m.kind === 'file') {
      try { await materialFile(ownerId, goal.id, m.id, 'delete'); } catch { notify('Материал удалён из проекта; очистка файла на устройстве не удалась.'); }
    }
  }
  function attach(link: DriveLink) {
    apply(s => updateProjectMaterial(s, goal.id, { id: crypto.randomUUID(), kind: 'onedrive', title: link.name.slice(0, 200), oneDrive: link, starred: false, updatedAt: new Date().toISOString() }));
  }
  return <section className="ss-panel pw-materials"><div className="ss-panel-head"><h3><Icon name="attachment" /> Материалы проекта</h3><div className="ss-actions">
    <button className="ss-secondary" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? 'Сохраняем…' : '+ Файл'}</button>
    <Suspense fallback={null}><OneDriveAttachButton notify={notify} onSelect={attach} /><OneDriveAttachButton mode="folder" notify={notify} onSelect={attach} /></Suspense>
    <input ref={fileInput} type="file" hidden aria-label="Прикрепить файл проекта" onChange={e => void upload(e.target.files?.[0])} /></div></div>
    <p>Локальные файлы до 20 МБ доступны только в этом браузере. Ссылки OneDrive синхронизируются с проектом; доступ к ним определяется вашим аккаунтом Microsoft.</p>
    <article className="pw-material"><Icon name="document" /><button className="pw-material-copy" onClick={onLegacyNotes}><strong>Заметки проекта</strong><span>{goal.notes || 'Добавьте общие заметки по проекту'}</span></button><button className="pw-star" aria-label="Избранное: Заметки проекта" aria-pressed={!!goal.notesStarred} onClick={() => apply(s => ({ ...s, goals: s.goals.map(g => g.id === goal.id ? { ...g, notesStarred: !g.notesStarred } : g) }))}>★</button></article>
    {(goal.materials ?? []).map(m => <article className="pw-material" key={m.id} data-material={m.id}><Icon name={m.kind === 'note' ? 'document' : 'attachment'} /><button className="pw-material-copy" onClick={() => m.kind === 'onedrive' && m.oneDrive ? location.assign(driveLinkHash(m.oneDrive)) : m.kind === 'file' ? void download(m) : onLegacyNotes()}><strong>{m.title}</strong><span>{m.kind === 'onedrive' ? `${m.oneDrive?.folder ? 'Папка' : 'Файл'} · OneDrive` : m.kind === 'note' ? m.text || 'Пустая заметка' : `${Math.ceil((m.size ?? 0) / 1024)} КБ · На устройстве · Скачать`}</span></button><button className="pw-star" aria-label={`Избранное: ${m.title}`} aria-pressed={m.starred} onClick={() => toggle(m)}>★</button><button className="ss-link" aria-label={`Удалить материал: ${m.title}`} onClick={() => void remove(m)}>×</button></article>)}
  </section>;
}
