import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { friendlyError, GraphError, mergeDriveItems, OneDriveClient, rootPath, sortDriveItems } from '../oneDrive';
import type { DriveAuthDiagnostic, DriveConfiguration, DriveConnection, DriveInfo, DriveItem, DrivePage } from '../oneDrive';
import { DriveDialog, DrivePicker, DrivePreview } from './OneDriveDialogs';
import OneDriveFolder from './OneDriveFolder';
import { folderColors } from '../oneDriveLinks';
import './OneDrivePage.css';

type Kind = 'all' | 'word' | 'excel' | 'powerpoint' | 'pdf' | 'image' | 'video' | 'text';
const types: { id: Kind; label: string }[] = [{ id: 'all', label: 'Все' }, { id: 'word', label: 'Word' }, { id: 'excel', label: 'Excel' }, { id: 'powerpoint', label: 'PowerPoint' }, { id: 'pdf', label: 'PDF' }, { id: 'image', label: 'Фото' }, { id: 'video', label: 'Видео' }, { id: 'text', label: 'Текст' }];
function kind(item: DriveItem): Kind {
  if (item.folder) return 'all'; const name = item.name.toLowerCase(); const mime = item.file?.mimeType || '';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/.test(name)) return 'image'; if (mime.startsWith('video/')) return 'video';
  if (/\.(doc|docx|rtf)$/.test(name)) return 'word'; if (/\.(xls|xlsx|csv)$/.test(name)) return 'excel';
  if (/\.(ppt|pptx)$/.test(name)) return 'powerpoint'; if (name.endsWith('.pdf')) return 'pdf'; if (/\.(txt|md|markdown|log|json)$/.test(name)) return 'text'; return 'all';
}
function date(value?: string) { return value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : ''; }
function size(value?: number) { if (value === undefined) return '—'; const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']; const power = Math.min(4, Math.floor(Math.log(Math.max(1, value)) / Math.log(1024))); return `${(value / 1024 ** power).toFixed(power ? 1 : 0)} ${units[power]}`; }
function folderFromHash() { try { const match = location.hash.match(/^#\/drive(?:\/([^/?]+))?/); return match?.[1] ? decodeURIComponent(match[1]) : undefined; } catch { return undefined; } }
const colorKey = (uid: string, drive: string, id: string) => `pyl:drive-color:${uid}:${drive}:${id}`;
function FileThumbnail({ client, item }: { client: OneDriveClient; item: DriveItem }) {
  const element = useRef<HTMLDivElement>(null); const [src, setSrc] = useState('');
  useEffect(() => {
    const node = element.current; if (!node || !['image', 'pdf', 'video', 'word', 'excel', 'powerpoint'].includes(kind(item))) return;
    const controller = new AbortController(); let objectUrl = '';
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return; observer.disconnect();
      client.content(item, controller.signal, true).then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(new Blob([blob], { type: 'image/jpeg' })); setSrc(objectUrl); } }).catch(() => {});
    }); observer.observe(node);
    return () => { controller.abort(); observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [client, item]);
  return <div className="od-file" ref={element}>{src ? <img className="od-thumb" src={src} alt="" loading="lazy" /> : <span className={`od-file-symbol ${kind(item)}`}>{({ word: 'W', excel: 'X', powerpoint: 'P', pdf: 'PDF', image: '▧', video: '▶', text: '≡', all: '▤' })[kind(item)]}</span>}</div>;
}

export default function OneDrivePage({ uid, getToken }: { uid?: string; getToken?: () => Promise<string> }) {
  const [client] = useState(() => new OneDriveClient(getToken || (() => Promise.reject(new GraphError(401, 'Войдите в аккаунт Play Your Life.')))));
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  const [authDiagnostic, setAuthDiagnostic] = useState<DriveAuthDiagnostic>();
  const [configuration, setConfiguration] = useState<DriveConfiguration>();
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [mutating, setMutating] = useState(false);
  const [drive, setDrive] = useState<DriveInfo | null>(null), [items, setItems] = useState<DriveItem[]>([]), [next, setNext] = useState<string>();
  const [folderId, setFolderId] = useState(folderFromHash), [trail, setTrail] = useState<DriveItem[]>([]);
  const [linkedHash, setLinkedHash] = useState(() => location.hash);
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState(''), [filter, setFilter] = useState<Kind>('all');
  const [list, setList] = useState(false), [details, setDetails] = useState(false), [sort, setSort] = useState<'name' | 'size' | 'date'>('name'), [descending, setDescending] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]), [contextId, setContextId] = useState<string>(), [preview, setPreview] = useState<DriveItem>();
  const [moving, setMoving] = useState(false), [offline, setOffline] = useState(!navigator.onLine), [cachedAt, setCachedAt] = useState<number>();
  const [edit, setEdit] = useState<{ item?: DriveItem; name: string }>();
  const [progress, setProgress] = useState<{ name: string; percent: number }>();
  const [colors, setColors] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null), uploadAbort = useRef<AbortController | null>(null), request = useRef<AbortController | null>(null), operation = useRef(false);
  const selected = items.filter(item => selection.includes(item.id)), context = items.find(item => item.id === contextId) || selected[0];
  const cacheKey = `${folderId || 'root'}:${debounced}`;
  const refresh = useCallback(async (nextUrl?: string, preserveError = false) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const cached = client.cache.get(cacheKey);
    if (!nextUrl) { setItems(cached?.page.value || []); setNext(cached?.page['@odata.nextLink']); setCachedAt(cached?.saved); setSelection([]); setContextId(undefined); }
    setBusy(true); if (!preserveError) setError('');
    try {
      let page: DrivePage;
      const localSearchPage = !!debounced && !!nextUrl && nextUrl.includes('/children');
      try {
        page = debounced && !localSearchPage ? await client.search(debounced, nextUrl, controller.signal) : await client.children(folderId, nextUrl, controller.signal);
        if (localSearchPage) page = { ...page, value: page.value.filter(item => item.name.toLocaleLowerCase('ru').includes(debounced.toLocaleLowerCase('ru'))) };
      }
      catch (e) {
        if (!debounced || !(e instanceof GraphError) || ![400, 501].includes(e.status)) throw e;
        page = await client.children(folderId, nextUrl, controller.signal);
        page = { ...page, value: page.value.filter(item => item.name.toLocaleLowerCase('ru').includes(debounced.toLocaleLowerCase('ru'))) };
        setNotice('Поиск Microsoft недоступен. Поиск по названиям в текущей папке; следующие страницы — «Показать ещё».');
      }
      if (controller.signal.aborted) return;
      const value = nextUrl ? mergeDriveItems(cached?.page.value || [], page.value) : page.value;
      const saved = Date.now(); client.cache.set(cacheKey, { page: { ...page, value }, saved });
      if (client.cache.size > 20) client.cache.delete(client.cache.keys().next().value!);
      setItems(value); setNext(page['@odata.nextLink']); setCachedAt(undefined);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(friendlyError(e));
        if (e instanceof GraphError && e.status === 401) { setConnection({ connected: false }); setAuthDiagnostic(e.diagnostic); setItems([]); }
      }
    }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [client, cacheKey, folderId, debounced]);
  useEffect(() => { const timeout = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(timeout); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    if (!uid) { queueMicrotask(() => setConnection({ connected: false })); return; }
    // Remove credentials left by the superseded SPA implementation; never migrate them to game data.
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('msal.') || /^pyl:onedrive:.*:account$/.test(key)) sessionStorage.removeItem(key);
    client.status(controller.signal).then(info => { setConnection(info); setAuthDiagnostic(info.authError); if (info.authError) setError(info.authError.message); }).catch(e => { if (!controller.signal.aborted) { setConnection({ connected: false }); setAuthDiagnostic(e instanceof GraphError ? e.diagnostic : undefined); setError(friendlyError(e)); } });
    return () => { controller.abort(); request.current?.abort(); uploadAbort.current?.abort(); };
  }, [client, uid]);
  useEffect(() => { if (connection?.connected) queueMicrotask(() => void refresh()); return () => request.current?.abort(); }, [connection?.connected, refresh]);
  useEffect(() => {
    if (!connection?.connected) return;
    const controller = new AbortController();
    client.graph<DriveInfo>('/me/drive', {}, controller.signal).then(setDrive).catch(e => { if (!controller.signal.aborted) setError(friendlyError(e)); });
    return () => controller.abort();
  }, [client, connection?.connected]);
  useEffect(() => {
    if (!connection?.connected) return;
    const controller = new AbortController();
    const load = async () => {
      const path: DriveItem[] = []; const seen = new Set<string>(); let id = folderId;
      while (id && !seen.has(id) && path.length < 64) { seen.add(id); const item = await client.graph<DriveItem>(rootPath(id), {}, controller.signal); path.unshift(item); id = item.parentReference?.id; }
      if (!controller.signal.aborted) setTrail(path.filter(item => item.parentReference?.id));
    };
    void load().catch(e => { if (!controller.signal.aborted) setError(friendlyError(e)); });
    return () => controller.abort();
  }, [client, connection?.connected, folderId]);
  useEffect(() => {
    const changed = () => { setFolderId(folderFromHash()); setLinkedHash(location.hash); setQuery(''); };
    const online = () => { setOffline(!navigator.onLine); if (navigator.onLine && connection?.connected) void refresh(); };
    window.addEventListener('hashchange', changed); window.addEventListener('popstate', changed); window.addEventListener('online', online); window.addEventListener('offline', online);
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); window.removeEventListener('online', online); window.removeEventListener('offline', online); };
  }, [connection?.connected, refresh]);
  useEffect(() => {
    if (!connection?.connected || !drive) return;
    const params = new URLSearchParams(linkedHash.split('?')[1] || '');
    const driveId = params.get('drive'), itemId = params.get('item');
    if (!driveId || !itemId) return;
    const controller = new AbortController();
    client.graph<DriveItem>(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`, {}, controller.signal).then(item => {
      if (item.folder && driveId === drive.id) { window.history.replaceState(null, '', `#/drive/${encodeURIComponent(item.id)}`); setFolderId(item.id); }
      else setPreview(item);
    }).catch(e => { if (!controller.signal.aborted) setError(friendlyError(e)); });
    return () => controller.abort();
  }, [client, connection?.connected, drive, linkedHash]);
  useEffect(() => {
    if (!connection?.connected) return;
    const controller = new AbortController(); let checking = false;
    const check = async () => {
      if (checking || operation.current || !navigator.onLine || document.visibilityState === 'hidden') return;
      checking = true;
      try { if (await client.pollChanges(controller.signal) && !controller.signal.aborted) await refresh(); }
      catch { /* The visible read/refresh path reports errors; a background poll never clears the user's list. */ }
      finally { checking = false; }
    };
    void check(); const timer = setInterval(() => void check(), 120000);
    const visible = () => void check(); window.addEventListener('focus', visible);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', visible); };
  }, [client, connection?.connected, refresh]);
  const navigate = (id?: string) => { request.current?.abort(); window.history.pushState(null, '', id ? `#/drive/${encodeURIComponent(id)}` : '#/drive'); setFolderId(id); setQuery(''); setItems([]); setSelection([]); setContextId(undefined); };
  const open = (item: DriveItem) => item.folder ? navigate(item.id) : setPreview(item);
  const operate = async (action: () => Promise<unknown>, message = 'Готово', reload = true) => {
    if (operation.current || offline) return; operation.current = true; setMutating(true); setError(''); setNotice(''); setContextId(undefined);
    try { await action(); client.cache.clear(); setNotice(message); if (reload) await refresh(); }
    catch (e) { setError(friendlyError(e)); }
    finally { operation.current = false; setMutating(false); }
  };
  const remove = (targets: DriveItem[]) => {
    if (targets.length && window.confirm(`Удалить из OneDrive: ${targets.map(item => item.name).join(', ')}?`)) void operate(async () => {
      let completed = 0;
      try { for (const item of targets) { await client.remove(item.id, item.eTag); completed++; } }
      catch (e) { await refresh(); throw new GraphError(e instanceof GraphError ? e.status : 502, `Удалено: ${completed} из ${targets.length}. ${friendlyError(e)}`); }
    }, `Удалено: ${targets.length}`);
  };
  const upload = async (files: FileList | File[]) => {
    if (!files.length || operation.current || offline) return;
    operation.current = true; setMutating(true); setError(''); setNotice(''); const controller = new AbortController(); uploadAbort.current = controller;
    let completed = 0;
    try { for (const file of Array.from(files)) { setProgress({ name: file.name, percent: 0 }); await client.upload(folderId, file, percent => { if (!controller.signal.aborted) setProgress({ name: file.name, percent }); }, controller.signal); completed++; } setNotice(`Загружено файлов: ${completed}`); }
    catch (e) { if (!controller.signal.aborted) setError(`Загружено: ${completed}. ${friendlyError(e)} Выберите тот же файл повторно, чтобы продолжить прерванную загрузку.`); else setNotice(`Загрузка отменена. Завершено файлов: ${completed}.`); }
    finally { setProgress(undefined); uploadAbort.current = null; operation.current = false; setMutating(false); client.cache.clear(); await refresh(undefined, true); }
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; };
  const onDrop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); };
  const visible = sortDriveItems(items.filter(item => filter === 'all' || !item.folder && kind(item) === filter), sort, descending);
  const folderColor = (item: DriveItem) => {
    if (colors[item.id]) return colors[item.id];
    try { return localStorage.getItem(colorKey(uid || '', drive?.id || '', item.id)) || 'yellow'; } catch { return 'yellow'; }
  };
  const percent = drive?.quota?.total ? Math.min(100, Math.round((drive.quota.used || 0) / drive.quota.total * 100)) : 0;
  if (!connection) return <div className="od-status" role="status">Проверяем подключение OneDrive…</div>;
  if (!connection.connected) return <section className="od-connect"><div className="od-cloud">☁</div><h2>{error ? 'Не удалось подключить OneDrive' : 'Подключите OneDrive'}</h2><p>Храните документы, фотографии и другие файлы в своём облачном хранилище Microsoft.</p>{error && <p role="alert">{error}</p>}<button disabled={!uid || mutating} onClick={() => { setMutating(true); void client.connect().catch(e => { setError(friendlyError(e)); setMutating(false); }); }}>{error ? 'Повторить подключение' : 'Подключить OneDrive'}</button>{!uid && <p>Войдите в аккаунт Play Your Life для личного подключения.</p>}
    {error && uid && <details><summary>Диагностика подключения</summary>{authDiagnostic && <p>{authDiagnostic.code} · {authDiagnostic.stage} · Код обращения: {authDiagnostic.correlationId}</p>}<button onClick={() => void client.diagnostics().then(setConfiguration).catch(e => setError(friendlyError(e)))}>Проверить настройки сервера</button>{configuration && <><dl><dt>Client ID</dt><dd>{configuration.clientId || 'Не задан'}</dd><dt>Authority</dt><dd>{configuration.authority}</dd><dt>Web redirect URI</dt><dd>{configuration.redirectUri || 'Не задан'}</dd><dt>Разрешения</dt><dd>{configuration.scopes.join(', ')}</dd></dl>{configuration.issues.map(issue => <p key={issue.code}>{issue.message}</p>)}</>}</details>}
  </section>;
  return <section className={`od-page${selection.length ? ' od-selecting' : ''}${toolsOpen ? ' od-tools-open' : ''}`} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
    <div className="od-header"><div className="od-title"><span className="od-cloud">☁</span><div><h2>Мой диск</h2><p>{connection.displayName || 'OneDrive'} · Подключено</p><p>{connection.username}</p>{drive?.quota?.total !== undefined && <><p className="od-quota-meta">Использовано {size(drive.quota.used)} из {size(drive.quota.total)} ({percent}%)</p><div className="od-quota"><span style={{ width: `${percent}%` }} /></div></>}</div></div><label className="od-search"><span>⌕</span><input aria-label="Поиск в моём диске" placeholder="Поиск в моём диске…" value={query} onChange={e => { setQuery(e.target.value); setNotice(''); }} />{query && <button onClick={() => { setQuery(''); setNotice(''); }} aria-label="Очистить поиск">×</button>}</label></div>
    <div className="od-mobile-tabs"><button aria-pressed={filter === 'image'} onClick={() => setFilter('image')}>Фотографии</button><button aria-pressed={filter !== 'image'} onClick={() => setFilter('all')}>Файлы</button></div>
    <div className="od-row"><div className="od-actions"><button disabled={mutating || offline} onClick={() => setEdit({ name: '' })}>＋ Папка</button><button className="od-primary" disabled={mutating || offline} onClick={() => input.current?.click()}>Загрузить файлы</button><button disabled={busy || mutating || offline} onClick={() => { client.cache.clear(); void refresh(); }}>Обновить</button></div><input type="file" multiple hidden ref={input} onChange={onFile} /><button disabled={mutating} onClick={() => void operate(async () => { await client.disconnect(); setItems([]); setDrive(null); setConnection({ connected: false }); }, 'OneDrive отключён', false)}>Отключить OneDrive</button></div>
    <div className="od-toolbar"><div className="od-filters">{types.map(t => <button key={t.id} aria-pressed={filter === t.id} className={filter === t.id ? 'active' : ''} onClick={() => setFilter(t.id)}>{t.label}</button>)}</div><div className="od-view"><button aria-label="Плитка" aria-pressed={!list} onClick={() => setList(false)}>▦</button><button aria-label="Список" aria-pressed={list} onClick={() => setList(true)}>☷</button><button aria-pressed={details} onClick={() => setDetails(!details)}>ⓘ Сведения</button></div></div>
    <div className="od-sort"><label><span>Сортировка</span><select aria-label="Сортировка" value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="name">По названию</option><option value="size">По размеру</option><option value="date">По дате изменения</option></select></label><button aria-label="Изменить направление сортировки" onClick={() => setDescending(!descending)}>{descending ? '↓' : '↑'}</button><span>В загруженных файлах ({items.length})</span><button className="od-tools-toggle" aria-label="Инструменты" title="Инструменты" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}>⚙</button></div>
    <nav className="od-breadcrumb" aria-label="Расположение"><button onClick={() => navigate()}>Мой диск</button>{trail.map(item => <button key={item.id} onClick={() => navigate(item.id)}> / {item.name}</button>)}{debounced && <span> / Поиск: {debounced}</span>}{folderId && <button onClick={() => navigate(trail.at(-2)?.id)}>↑ На уровень выше</button>}</nav>
    {(offline || cachedAt) && <p className="od-notice" role="status">{offline ? 'Нет подключения к интернету. Облачные операции недоступны.' : 'Показаны сохранённые метаданные; обновляем…'}{cachedAt && ` Сохранено: ${new Date(cachedAt).toLocaleTimeString('ru')}.`}</p>}
    {notice && <p role="status" className="od-notice">{notice}</p>}{(error || authDiagnostic) && <div role="alert" className="od-error">{error || authDiagnostic?.message} <button disabled={busy || offline} onClick={() => void refresh()}>Повторить чтение</button><button disabled={mutating || offline} onClick={() => void client.connect().catch(e => setError(friendlyError(e)))}>Войти Microsoft заново</button></div>}
    {progress && <div className="od-progress" role="status">{progress.name}: {progress.percent}% <button onClick={() => uploadAbort.current?.abort()}>Отменить загрузку</button><progress max="100" value={progress.percent} /></div>}
    <div className="od-actions od-selection"><label><input type="checkbox" checked={!!visible.length && visible.every(item => selection.includes(item.id))} onChange={e => setSelection(e.target.checked ? visible.map(item => item.id) : [])} /> Выбрать загруженные</label>{selected.length > 0 && <><span>Выбрано: {selected.length}</span><button disabled={mutating || offline} onClick={() => setMoving(true)}>Переместить</button><button disabled={mutating || offline} onClick={() => remove(selected)}>Удалить выбранные</button>{selected.length === 1 && <><button onClick={() => open(selected[0])}>Открыть выбранное</button><button onClick={() => setContextId(contextId ? undefined : selected[0].id)}>Действия</button></>}</>}</div>
    <div className={details ? 'od-body details' : 'od-body'}><div>{busy && !items.length ? <p role="status">Загружаем файлы…</p> : !visible.length ? <p className="od-empty">{error ? 'Файлы не удалось загрузить.' : debounced || filter !== 'all' ? 'В загруженной части нет совпадений.' : 'Папка пуста.'}</p> : <div className={list ? 'od-list' : 'od-grid'}>{visible.map(item => <article key={item.id} className={`od-item${selection.includes(item.id) ? ' selected' : ''}`}>
      <button className="od-open" title={item.name} onClick={() => open(item)} onContextMenu={e => { e.preventDefault(); setSelection([item.id]); setContextId(item.id); }}>{item.folder ? <OneDriveFolder count={item.folder.childCount} color={folderColor(item)} /> : <FileThumbnail client={client} item={item} />}<strong>{item.name}</strong><small>{date(item.lastModifiedDateTime)}{!item.folder && ` · ${size(item.size)}`}</small></button>
      <div className="od-item-controls"><input type="checkbox" aria-label={`Выбрать ${item.name}`} checked={selection.includes(item.id)} onChange={e => setSelection(old => e.target.checked ? [...old, item.id] : old.filter(id => id !== item.id))} /><button aria-label={`Действия: ${item.name}`} onClick={() => { setSelection([item.id]); setContextId(item.id); }}>⋯</button></div>
    </article>)}</div>}{next && <button className="od-more" disabled={busy || offline} onClick={() => void refresh(next)}>{busy ? 'Загружаем…' : 'Показать ещё'}</button>}</div>
      {details && <aside className="od-details"><h3>Сведения</h3>{context ? <><h4>{context.name}</h4><dl><dt>Тип</dt><dd>{context.folder ? 'Папка' : context.file?.mimeType || 'Файл'}</dd><dt>Размер</dt><dd>{size(context.size)}</dd><dt>Создан</dt><dd>{date(context.createdDateTime)}</dd><dt>Изменён</dt><dd>{date(context.lastModifiedDateTime)}</dd></dl><button onClick={() => open(context)}>Открыть</button></> : <p>Выберите файл или папку.</p>}<button aria-label="Закрыть сведения" onClick={() => setDetails(false)}>Закрыть</button></aside>}</div>
    {context && contextId && <DriveDialog title={`Действия: ${context.name}`} onClose={() => setContextId(undefined)}><div className="od-menu">
      <button onClick={() => { open(context); setContextId(undefined); }}>Открыть</button>{!context.folder && <button disabled={mutating || offline} onClick={() => void operate(() => client.download(context), 'Файл подготовлен к скачиванию')}>Скачать</button>}
      <button disabled={mutating || offline} onClick={() => { setEdit({ item: context, name: context.name }); setContextId(undefined); }}>Переименовать</button><button disabled={mutating || offline} onClick={() => { setMoving(true); setContextId(undefined); }}>Переместить</button>
      {context.folder && <fieldset className="od-color-options"><legend>Цвет папки в Play Your Life</legend>{folderColors.map((color, index) => <button key={color} aria-label={`Цвет папки: ${['жёлтый', 'синий', 'бирюзовый', 'оранжевый', 'серый', 'фиолетовый', 'зелёный'][index]}`} aria-pressed={folderColor(context) === color} onClick={() => { try { localStorage.setItem(colorKey(uid || '', drive?.id || '', context.id), color); } catch { /* Color remains available in the current session. */ } setColors(old => ({ ...old, [context.id]: color })); }}><OneDriveFolder color={color} /></button>)}</fieldset>}
      {context.webUrl?.startsWith('https://') && <button onClick={() => void navigator.clipboard.writeText(context.webUrl!).then(() => { setNotice('Ссылка скопирована. Доступ определяется разрешениями Microsoft.'); setContextId(undefined); }).catch(() => setError('Не удалось скопировать ссылку.'))}>Копировать ссылку</button>}
      {debounced && context.parentReference?.id && <button onClick={() => navigate(context.parentReference!.id)}>Открыть расположение</button>}<button onClick={() => { setDetails(true); setContextId(undefined); }}>Сведения</button><button disabled={mutating || offline} onClick={() => remove([context])}>Удалить</button>
    </div></DriveDialog>}
    {edit && <DriveDialog title={edit.item ? 'Переименовать' : 'Новая папка'} onClose={() => setEdit(undefined)}><form onSubmit={e => { e.preventDefault(); const name = edit.name.trim(); if (!name || /["*:<>?/\\|]/.test(name) || /[. ]$/.test(name)) { setError('Введите допустимое название без символов " * : < > ? / \\ | и точки в конце.'); return; } setEdit(undefined); void operate(() => edit.item ? client.update(edit.item, { name }) : client.createFolder(folderId, name)); }}><label>Название<input required maxLength={255} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label><button type="submit" disabled={mutating || offline}>Сохранить</button></form></DriveDialog>}
    {moving && <DrivePicker client={client} mode="folder" onClose={() => setMoving(false)} onChoose={folder => { setMoving(false); if (selected.some(item => item.id === folder.id)) { setError('Нельзя переместить папку в себя.'); return; } void operate(async () => { let done = 0; try { for (const item of selected) { await client.update(item, { parentReference: { id: folder.id } }); done++; } } catch (e) { await refresh(); throw new GraphError(502, `Перемещено: ${done} из ${selected.length}. ${friendlyError(e)}`); } }); }} />}
    {preview && <DrivePreview client={client} item={preview} onClose={() => setPreview(undefined)} />}
  </section>;
}
