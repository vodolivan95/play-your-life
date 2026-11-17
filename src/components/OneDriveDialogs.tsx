import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { friendlyError, rootPath } from '../oneDrive';
import type { DriveItem, OneDriveClient } from '../oneDrive';

export function DriveDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = ref.current!; node.showModal(); return () => node.close(); }, []);
  return <dialog className="od-dialog" ref={ref} aria-label={title} onKeyDown={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose(); }}>
    <header><h3>{title}</h3><button aria-label="Закрыть" onClick={onClose}>×</button></header>{children}
  </dialog>;
}

export function DrivePicker({ client, mode, onChoose, onClose }: { client: OneDriveClient; mode: 'file' | 'folder'; onChoose: (item: DriveItem) => void; onClose: () => void }) {
  const [trail, setTrail] = useState<DriveItem[]>([]), [items, setItems] = useState<DriveItem[]>([]);
  const [next, setNext] = useState<string>(), [error, setError] = useState(''), [busy, setBusy] = useState(true);
  const [root, setRoot] = useState<DriveItem>();
  const parent = trail.at(-1);
  useEffect(() => {
    const controller = new AbortController();
    client.children(parent?.id, undefined, controller.signal).then(page => { setItems(page.value); setNext(page['@odata.nextLink']); setError(''); setBusy(false); })
      .catch(e => { if (!controller.signal.aborted) { setError(friendlyError(e)); setBusy(false); } });
    if (!parent) client.graph<DriveItem>(rootPath(), {}, controller.signal).then(setRoot).catch(() => {});
    return () => controller.abort();
  }, [client, parent]);
  function navigate(path: DriveItem[]) { setItems([]); setBusy(true); setTrail(path); }
  async function more() {
    setBusy(true);
    try { const page = await client.children(parent?.id, next); setItems(old => [...old, ...page.value]); setNext(page['@odata.nextLink']); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <DriveDialog title={mode === 'folder' ? 'Выберите папку OneDrive' : 'Выберите файл OneDrive'} onClose={onClose}>
    <nav className="od-breadcrumb" aria-label="Папки OneDrive"><button onClick={() => navigate([])}>Мой диск</button>{trail.map((item, i) => <button key={item.id} onClick={() => navigate(trail.slice(0, i + 1))}> / {item.name}</button>)}</nav>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">Загружаем…</p>}
    <div className="od-picker-list">{items.filter(item => mode === 'file' || item.folder).map(item => <button key={item.id} disabled={busy} onClick={() => item.folder ? navigate([...trail, item]) : onChoose(item)}>{item.folder ? '📁' : '▤'} {item.name}</button>)}</div>
    {!busy && !items.length && <p>Папка пуста.</p>}{next && <button disabled={busy} onClick={() => void more()}>Показать ещё папки и файлы</button>}
    {mode === 'folder' && <button className="od-primary" disabled={busy || !(parent || root)} onClick={() => onChoose((parent || root)!)}>Выбрать эту папку</button>}
  </DriveDialog>;
}

export function DrivePreview({ client, item, onClose }: { client: OneDriveClient; item: DriveItem; onClose: () => void }) {
  const [src, setSrc] = useState(''), [text, setText] = useState<string>(), [error, setError] = useState('');
  const name = item.name.toLowerCase();
  const type = /\.(jpg|jpeg|png|webp)$/.test(name) ? 'image' : name.endsWith('.pdf') ? 'pdf' : /\.(txt|md|markdown|csv|log|json)$/.test(name) ? 'text' : /\.(mp4|webm|ogg)$/.test(name) ? 'video' : 'office';
  const supported = type !== 'office' && (item.size ?? Infinity) <= (type === 'text' ? 2 : 50) * 1024 * 1024;
  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController(); let objectUrl = '';
    client.content(item, controller.signal).then(async blob => {
      if (controller.signal.aborted) return;
      if (type === 'text') { const value = await blob.text(); if (!controller.signal.aborted) setText(value); }
      else {
        const mime = type === 'pdf' ? 'application/pdf' : type === 'image' ? name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg' : name.endsWith('.webm') ? 'video/webm' : name.endsWith('.ogg') ? 'video/ogg' : 'video/mp4';
        objectUrl = URL.createObjectURL(new Blob([blob], { type: mime })); setSrc(objectUrl);
      }
    }).catch(e => { if (!controller.signal.aborted) setError(friendlyError(e)); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [client, item, type, name, supported]);
  return <DriveDialog title={item.name} onClose={onClose}>
    {error && <p role="alert">{error}</p>}
    {!supported ? <p>Этот документ можно открыть в Microsoft 365. Встроенный просмотр: текст до 2 МБ, изображения, PDF и видео до 50 МБ.</p> :
      text !== undefined ? <pre className="od-text">{text}</pre> : src ? type === 'image' ? <img className="od-preview" src={src} alt={item.name} /> : type === 'video' ? <video className="od-preview" controls src={src} /> : <iframe className="od-preview od-pdf" title={item.name} src={src} sandbox="allow-same-origin" /> : !error && <p role="status">Загружаем предпросмотр…</p>}
    {item.webUrl?.startsWith('https://') && <a href={item.webUrl} target="_blank" rel="noopener noreferrer">Открыть в Microsoft 365 ↗</a>}
  </DriveDialog>;
}
