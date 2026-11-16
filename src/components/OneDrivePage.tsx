import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import { children, connectOneDrive, createFolder, deleteItem, disconnectOneDrive, downloadItem, graph, initOneDrive, search, updateItem, uploadFile } from '../oneDrive';
import type { DriveInfo, DriveItem } from '../oneDrive';
import './OneDrivePage.css';

type Kind = 'all' | 'word' | 'excel' | 'powerpoint' | 'pdf' | 'image' | 'video';
const types: { id: Kind; label: string }[] = [{ id: 'all', label: 'Все' }, { id: 'word', label: 'W' }, { id: 'excel', label: 'X' }, { id: 'powerpoint', label: 'P' }, { id: 'pdf', label: 'PDF' }, { id: 'image', label: 'Фото' }, { id: 'video', label: 'Видео' }];
const colors = ['yellow', 'blue', 'teal', 'orange', 'gray', 'purple', 'green'];
function kind(item: DriveItem): Kind {
  if (item.folder) return 'all'; const name = item.name.toLowerCase(); const mime = item.file?.mimeType || '';
  if (mime.startsWith('image/')) return 'image'; if (mime.startsWith('video/')) return 'video';
  if (/\.(doc|docx|rtf)$/.test(name)) return 'word'; if (/\.(xls|xlsx|csv)$/.test(name)) return 'excel';
  if (/\.(ppt|pptx)$/.test(name)) return 'powerpoint'; if (name.endsWith('.pdf')) return 'pdf'; return 'all';
}
function date(value?: string) { return value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : ''; }
function size(value?: number) { if (value === undefined) return '—'; return value < 1024 ? `${value} Б` : value < 1048576 ? `${(value / 1024).toFixed(1)} КБ` : value < 1073741824 ? `${(value / 1048576).toFixed(1)} МБ` : value < 1099511627776 ? `${(value / 1073741824).toFixed(1)} ГБ` : `${(value / 1099511627776).toFixed(1)} ТБ`; }
function folderFromHash() { const match = location.hash.match(/^#\/drive(?:\/([^/]+))?$/); return match?.[1] ? decodeURIComponent(match[1]) : undefined; }
function colorKey(uid: string, drive: string, id: string) { return `pyl:drive-color:${uid}:${drive}:${id}`; }
function FilePreview({ uid, item }: { uid: string; item: DriveItem }) {
  const element = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState('');
  useEffect(() => {
    const node = element.current;
    if (!node || !['image', 'pdf', 'video', 'word', 'excel', 'powerpoint'].includes(kind(item))) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      graph<{ value?: Array<{ medium?: { url?: string }; small?: { url?: string } }> }>(uid, `/me/drive/items/${encodeURIComponent(item.id)}/thumbnails`)
        .then(data => { const url = data.value?.[0]?.medium?.url || data.value?.[0]?.small?.url; if (active && url) setSrc(url); })
        .catch(() => {});
    });
    observer.observe(node);
    return () => { active = false; observer.disconnect(); };
  }, [uid, item]);
  return <div className="od-file" ref={element}>{src ? <img className="od-thumb" src={src} alt="" loading="lazy" /> : <span className={`od-file-symbol ${kind(item)}`}>{({word:'W',excel:'X',powerpoint:'P',pdf:'PDF',image:'▧',video:'▶',all:'▤'})[kind(item)]}</span>}</div>;
}
export default function OneDrivePage({ uid }: { uid?: string }) {
  const [connected, setConnected] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [drive, setDrive] = useState<DriveInfo | null>(null), [items, setItems] = useState<DriveItem[]>([]), [next, setNext] = useState<string>();
  const [folderId, setFolderId] = useState(folderFromHash), [folderName, setFolderName] = useState('');
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState(''), [tab, setTab] = useState<'files' | 'photos'>('files');
  const [filter, setFilter] = useState<Kind>('all'), [list, setList] = useState(false), [details, setDetails] = useState(false);
  const [selected, setSelected] = useState<DriveItem | null>(null), [menu, setMenu] = useState(false), [createMenu, setCreateMenu] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null), uploadAbort = useRef<AbortController | null>(null), request = useRef<AbortController | null>(null);
  const owner = uid || '';
  const refresh = useCallback(async (more = false, nextUrl?: string) => {
    if (!owner) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      const page = debounced ? await search(owner, debounced, more ? nextUrl : undefined, controller.signal) : await children(owner, folderId, more ? nextUrl : undefined, controller.signal);
      setItems(old => more ? [...old, ...page.value] : page.value); setNext(page['@odata.nextLink']);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не удалось загрузить файлы.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [owner, folderId, debounced]);
  useEffect(() => { const timeout = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(timeout); }, [query]);
  useEffect(() => {
    let active = true;
    if (!owner) { queueMicrotask(() => setReady(true)); return; }
    initOneDrive(owner).then(async account => {
      if (!active) return;
      setConnected(!!account); setReady(true);
      if (account) { const info = await graph<DriveInfo>(owner, '/me/drive'); if (active) setDrive(info); }
    }).catch(e => { if (active) { setReady(true); setError(e instanceof Error ? e.message : 'Ошибка подключения'); } });
    return () => { active = false; request.current?.abort(); };
  }, [owner]);
  useEffect(() => { if (connected) queueMicrotask(() => void refresh()); }, [connected, refresh]);
  useEffect(() => { const changed = () => setFolderId(folderFromHash()); window.addEventListener('hashchange', changed); window.addEventListener('popstate', changed); return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); }; }, []);
  useEffect(() => { if (!connected || !folderId) { queueMicrotask(() => setFolderName('')); return; } graph<DriveItem>(owner, `/me/drive/items/${encodeURIComponent(folderId)}`).then((item) => setFolderName(item.name)).catch(() => setFolderName('Папка')); }, [connected, folderId, owner]);
  const operate = async (action: () => Promise<unknown>) => { setMenu(false); setCreateMenu(false); setError(''); try { await action(); await refresh(); setNotice('Готово'); } catch (e) { setError(e instanceof Error ? e.message : 'Операция не выполнена'); } };
  const openFolder = (item: DriveItem) => { window.history.pushState(null, '', `#/drive/${encodeURIComponent(item.id)}`); setFolderId(item.id); setSelected(null); setQuery(''); };
  const openItem = (item: DriveItem) => { if (item.folder) openFolder(item); else if (item.webUrl) window.open(item.webUrl, '_blank', 'noopener,noreferrer'); };
  const doUpload = async (files: FileList | File[]) => {
    if (!files.length) return; uploadAbort.current = new AbortController(); setProgress(0);
    try { for (const file of Array.from(files)) await uploadFile(owner, folderId, file, setProgress, uploadAbort.current.signal); setNotice('Файлы загружены'); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка загрузки'); }
    finally { setProgress(null); uploadAbort.current = null; }
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void doUpload(e.target.files); e.target.value = ''; };
  const onDrop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer.files.length) void doUpload(e.dataTransfer.files); };
  const onKey = (e: KeyboardEvent, item: DriveItem) => { if (e.key === 'Enter') openItem(item); if (e.key === 'Delete') { setSelected(item); void remove(item); } if (e.key === 'Escape') { setSelected(null); setMenu(false); } };
  const remove = async (item: DriveItem) => { if (window.confirm(`Удалить «${item.name}» из OneDrive?`)) await operate(() => deleteItem(owner, item.id)); };
  const rename = async (item: DriveItem) => { const name = window.prompt('Новое название', item.name)?.trim(); if (name && name !== item.name) await operate(() => updateItem(owner, item, { name })); };
  const move = async (item: DriveItem) => { const id = window.prompt('ID папки назначения в OneDrive'); if (id?.trim()) await operate(() => updateItem(owner, item, { parentReference: { id: id.trim() } })); };
  const visible = items.filter(item => (tab === 'photos' ? kind(item) === 'image' : filter === 'all' || (item.folder ? false : kind(item) === filter))).sort((a, b) => (Number(!!b.folder) - Number(!!a.folder)) || a.name.localeCompare(b.name, 'ru'));
  const percent = drive?.quota?.total ? Math.min(100, Math.round((drive.quota.used || 0) / drive.quota.total * 100)) : 0;
  if (!ready) return <div className="od-status" role="status">Подключаем OneDrive…</div>;
  if (!connected) return <section className="od-connect"><div className="od-cloud">☁</div><h2>Мой диск</h2><p>Подключите личный OneDrive, чтобы видеть и управлять своими файлами в Play Your Life.</p>{error && <p role="alert">{error}</p>}<button disabled={!uid} onClick={() => void connectOneDrive(owner).catch(e => setError(String(e)))}>Подключить OneDrive</button>{!uid && <p>Войдите в аккаунт Play Your Life для личного подключения.</p>}</section>;
  return <section className="od-page" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
    <div className="od-header"><div className="od-title"><span className="od-cloud">☁</span><div><h2>Мой диск</h2><p>OneDrive · Использовано {size(drive?.quota?.used)} из {size(drive?.quota?.total)} ({percent}%)</p><div className="od-quota"><span style={{ width: `${percent}%` }} /></div></div></div><label className="od-search"><span>⌕</span><input aria-label="Поиск в моём диске" placeholder="Поиск в моём диске…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск">×</button>}</label></div>
    <div className="od-row"><div className="od-tabs"><button className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>Фотографии</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>Файлы</button></div><div className="od-create"><button className="od-primary" onClick={() => setCreateMenu(!createMenu)}>＋ Создать или отправить ⌄</button>{createMenu && <div className="od-pop"><button onClick={() => { const name = prompt('Название папки')?.trim(); if (name) void operate(() => createFolder(owner, folderId, name)); }}>Новая папка</button><button onClick={() => input.current?.click()}>Загрузить файлы</button></div>}</div><input type="file" multiple hidden ref={input} onChange={onFile} /></div>
    <div className="od-toolbar"><div className="od-filters">{types.map(t => <button key={t.id} className={filter === t.id ? 'active' : ''} onClick={() => setFilter(t.id)} title={t.id}>{t.label}</button>)}</div><div className="od-view"><button aria-pressed={!list} onClick={() => setList(false)}>▦</button><button aria-pressed={list} onClick={() => setList(true)}>☷</button><button onClick={() => setDetails(!details)}>ⓘ Сведения</button></div></div>
    {(folderId || debounced) && <div className="od-breadcrumb"><button onClick={() => { window.history.pushState(null, '', '#/drive'); setFolderId(undefined); setQuery(''); }}>Мой диск</button>{folderId && <> / <span>{folderName}</span></>}{debounced && <> / Поиск: {debounced}</>}</div>}
    {notice && <p role="status" className="od-notice" onClick={() => setNotice('')}>{notice} ×</p>}{error && <div role="alert" className="od-error">{error} <button onClick={() => void refresh()}>Повторить</button></div>}
    {progress !== null && <div className="od-progress" role="status">Загрузка: {progress}% <button onClick={() => uploadAbort.current?.abort()}>Отмена</button><progress max="100" value={progress} /></div>}
    <div className={details ? 'od-body details' : 'od-body'}><div>{busy && !items.length ? <div className="od-grid">{Array.from({length: 7}, (_, i) => <div className="od-skeleton" key={i} />)}</div> : !visible.length ? <p className="od-empty">{busy ? 'Загружаем…' : 'Здесь пока нет файлов'}</p> : <div className={list ? 'od-list' : 'od-grid'}>{visible.map(item => <div key={item.id} role="button" tabIndex={0} title={item.name} aria-selected={selected?.id === item.id} className="od-item" onClick={() => { setSelected(item); setMenu(false); }} onDoubleClick={() => openItem(item)} onKeyDown={e => onKey(e, item)} onContextMenu={e => { e.preventDefault(); setSelected(item); setMenu(true); }}>{item.folder ? <div className={`od-folder ${localStorage.getItem(colorKey(owner, drive?.id || '', item.id)) || 'yellow'}`}><span className="od-folder-tab" /><span className="od-folder-face" /><b>{item.folder.childCount ?? ''}</b></div> : <FilePreview uid={owner} item={item} />}<strong>{item.name}</strong><small>{date(item.lastModifiedDateTime)}</small></div>)}</div>}{next && <button className="od-more" disabled={busy} onClick={() => void refresh(true, next)}>{busy ? 'Загружаем…' : 'Показать ещё'}</button>}</div>
      {details && <aside className="od-details"><button className="od-close" onClick={() => setDetails(false)} aria-label="Закрыть">×</button><h3>Сведения</h3>{selected ? <><h4>{selected.name}</h4><dl><dt>Тип</dt><dd>{selected.folder ? 'Папка' : selected.file?.mimeType || 'Файл'}</dd><dt>Размер</dt><dd>{size(selected.size)}</dd><dt>Создан</dt><dd>{date(selected.createdDateTime)}</dd><dt>Изменён</dt><dd>{date(selected.lastModifiedDateTime)}</dd></dl><button onClick={() => openItem(selected)}>Открыть</button></> : <p>Выберите файл или папку.</p>}<button onClick={() => void disconnectOneDrive(owner)}>Отключить OneDrive</button></aside>}</div>
    {selected && menu && <div className="od-context"><button onClick={() => { openItem(selected); setMenu(false); }}>Открыть</button>{!selected.folder && <button onClick={() => void downloadItem(owner, selected).catch(e => setError(String(e)))}>Скачать</button>}<button onClick={() => void rename(selected)}>Переименовать</button><button onClick={() => void move(selected)}>Переместить</button>{selected.folder && <div className="od-colors">{colors.map(color => <button key={color} className={color} aria-label={`Цвет: ${color}`} onClick={() => { localStorage.setItem(colorKey(owner, drive?.id || '', selected.id), color); setMenu(false); setItems([...items]); }} />)}</div>}{selected.webUrl && <button onClick={() => { void navigator.clipboard.writeText(selected.webUrl!); setMenu(false); }}>Копировать ссылку</button>}<button onClick={() => { setDetails(true); setMenu(false); }}>Сведения</button><button onClick={() => void remove(selected)}>Удалить</button></div>}
  </section>;
}
