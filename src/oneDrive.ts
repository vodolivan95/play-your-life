export type DriveItem = {
  id: string; name: string; size?: number; lastModifiedDateTime?: string; createdDateTime?: string; webUrl?: string; eTag?: string;
  folder?: { childCount?: number }; file?: { mimeType?: string }; deleted?: object;
  parentReference?: { id?: string; driveId?: string; path?: string };
};
export type DriveInfo = { id: string; quota?: { used?: number; total?: number } };
export type DrivePage = { value: DriveItem[]; '@odata.nextLink'?: string; '@odata.deltaLink'?: string };
export const rootPath = (id?: string) => id ? `/me/drive/items/${encodeURIComponent(id)}` : '/me/drive/root';
export class GraphError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function friendlyError(error: unknown): string {
  if (error instanceof GraphError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') return 'Операция отменена.';
  return navigator.onLine ? 'Не удалось связаться с OneDrive. Повторите запрос.' : 'Нет подключения к интернету. Изменения не отправлены.';
}
function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export function retryDelay(value: string | null, attempt: number): number {
  if (!value) return 1000 * 2 ** attempt;
  const seconds = Number(value);
  return Math.max(0, Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now()) || 1000;
}
export function sortDriveItems(items: DriveItem[], field: 'name' | 'size' | 'date', descending: boolean) {
  return [...items].sort((a, b) => Number(!!b.folder) - Number(!!a.folder) ||
    (descending ? -1 : 1) * (field === 'name' ? a.name.localeCompare(b.name, 'ru', { numeric: true }) :
      field === 'size' ? (a.size || 0) - (b.size || 0) : (a.lastModifiedDateTime || '').localeCompare(b.lastModifiedDateTime || '')));
}
export function mergeDriveItems(previous: DriveItem[], changed: DriveItem[]) {
  const map = new Map(previous.map(item => [item.id, item]));
  for (const item of changed) { if (item.deleted) map.delete(item.id); else map.set(item.id, item); }
  return [...map.values()];
}

/** A client belongs to one mounted Firebase user. No Microsoft credentials or content cache in browser storage. */
export class OneDriveClient {
  private base: string;
  private getToken: () => Promise<string>;
  private uploads = new Map<string, string>();
  private delta?: string;
  readonly cache = new Map<string, { page: DrivePage; saved: number }>();
  constructor(getToken: () => Promise<string>, base = import.meta.env?.VITE_ONEDRIVE_BRIDGE_URL as string | undefined) {
    this.getToken = getToken; this.base = base || '';
  }
  private origin() {
    if (!this.base) throw new GraphError(503, 'OneDrive ещё не настроен. Нужен адрес сервера подключения (VITE_ONEDRIVE_BRIDGE_URL).');
    const base = new URL(this.base);
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new GraphError(503, 'Укажите HTTPS-адрес сервера OneDrive.');
    if (base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new GraphError(503, 'Некорректный адрес сервера OneDrive.');
    return base.origin;
  }
  async request(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
    const origin = this.origin();
    for (let attempt = 0; ; attempt++) {
      signal?.throwIfAborted();
      const response = await fetch(`${origin}${path}`, { ...init, credentials: 'omit', cache: 'no-store',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
        headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${await this.getToken()}` } });
      if (!response.ok) {
        const delay = retryDelay(response.headers.get('Retry-After'), attempt);
        // A mutation is never replayed automatically. Long Retry-After remains a visible error.
        if ((!init.method || init.method === 'GET') && [429, 502, 503, 504].includes(response.status) && attempt < 2 && delay <= 10000) { await pause(delay, signal); continue; }
        const data = await response.json().catch(() => ({}));
        throw new GraphError(response.status, typeof data.error === 'string' ? data.error : 'OneDrive не подтвердил выполнение операции.');
      }
      return response;
    }
  }
  async json<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
    const response = await this.request(path, init, signal);
    return response.status === 204 ? null as T : response.json();
  }
  graph<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
    return this.json<T>(`/graph?path=${encodeURIComponent(path)}`, init, signal);
  }
  status(signal?: AbortSignal) { return this.json<{ connected: boolean; username?: string }>('/status', {}, signal); }
  async connect() {
    const origin = this.origin(), credential = await this.getToken();
    // A top-level POST sets the HttpOnly OAuth cookie without depending on third-party cookies.
    // Firebase credential travels in the HTTPS body, never a URL; Microsoft credentials stay on the server.
    const form = document.createElement('form'); form.method = 'POST'; form.action = `${origin}/authorize`;
    const field = document.createElement('input'); field.type = 'hidden'; field.name = 'credential'; field.value = credential;
    form.append(field); document.body.append(form); form.submit(); form.remove();
  }
  async disconnect() { await this.json('/disconnect', { method: 'POST' }); this.cache.clear(); this.uploads.clear(); this.delta = undefined; }
  async pollChanges(signal?: AbortSignal): Promise<boolean> {
    try {
      const page = await this.graph<DrivePage>(this.delta || '/me/drive/root/delta?token=latest', {}, signal);
      this.delta = page['@odata.nextLink'] || page['@odata.deltaLink'];
      if (page.value.length) this.cache.clear();
      return !!page.value.length;
    } catch (e) {
      if (e instanceof GraphError && [400, 410, 501].includes(e.status)) { this.delta = undefined; return true; }
      throw e;
    }
  }
  children(id?: string, next?: string, signal?: AbortSignal): Promise<DrivePage> {
    return this.graph(next || `${rootPath(id)}/children?$top=100&$select=id,name,size,lastModifiedDateTime,createdDateTime,webUrl,eTag,folder,file,parentReference`, {}, signal);
  }
  search(query: string, next?: string, signal?: AbortSignal): Promise<DrivePage> {
    return this.graph(next || `/me/drive/root/search(q='${encodeURIComponent(query.replaceAll("'", "''"))}')?$top=100`, {}, signal);
  }
  createFolder(parent: string | undefined, name: string) {
    return this.graph(`${rootPath(parent)}/children`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) });
  }
  update(item: DriveItem, fields: { name?: string; parentReference?: { id: string } }) {
    return this.graph(rootPath(item.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(item.eTag ? { 'If-Match': item.eTag } : {}) }, body: JSON.stringify(fields) });
  }
  remove(id: string, eTag?: string) { return this.graph(rootPath(id), { method: 'DELETE', headers: eTag ? { 'If-Match': eTag } : undefined }); }
  async content(item: DriveItem, signal?: AbortSignal, thumbnail = false): Promise<Blob> {
    const base = item.parentReference?.driveId ? `/drives/${encodeURIComponent(item.parentReference.driveId)}/items/${encodeURIComponent(item.id)}` : rootPath(item.id);
    const path = `${base}/${thumbnail ? 'thumbnails/0/medium/content' : 'content'}`;
    return (await this.request(`/graph?path=${encodeURIComponent(path)}`, {}, signal)).blob();
  }
  async download(item: DriveItem) {
    const url = URL.createObjectURL(await this.content(item)); const a = document.createElement('a');
    a.href = url; a.download = item.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  /** Keep an interrupted session in this mounted client; selecting the same file resumes using server offsets. */
  async upload(parent: string | undefined, file: File, progress: (p: number) => void, signal?: AbortSignal) {
    const key = JSON.stringify([parent, file.name, file.size, file.lastModified]);
    const path = `${rootPath(parent)}:/${encodeURIComponent(file.name)}:`;
    if (!file.size) { await this.graph(`${path}/content?@microsoft.graph.conflictBehavior=fail`, { method: 'PUT', body: file }, signal); progress(100); return; }
    let id = this.uploads.get(key);
    if (!id) { const session = await this.json<{ id: string }>('/uploads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `${path}/createUploadSession`, size: file.size }) }, signal); id = session.id; this.uploads.set(key, id); }
    try {
      const state = await this.json<{ nextExpectedRanges: string[] }>(`/uploads/${id}`, {}, signal);
      let start = Number(state.nextExpectedRanges[0]?.split('-')[0]);
      if (!Number.isSafeInteger(start) || start < 0 || start >= file.size) throw new GraphError(410, 'Не удалось определить состояние загрузки. Обновите список файлов.');
      while (start < file.size) {
        const end = Math.min(start + 5 * 1024 * 1024, file.size);
        const response = await this.json<DriveItem & { nextExpectedRanges?: string[] }>(`/uploads/${id}`, { method: 'PUT', headers: { 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` }, body: file.slice(start, end) }, signal);
        if (response.id) { this.uploads.delete(key); progress(100); return; }
        const offset = Number(response.nextExpectedRanges?.[0]?.split('-')[0]);
        if (!Number.isSafeInteger(offset) || offset <= start || offset > file.size) throw new GraphError(502, 'Microsoft не подтвердил часть файла. Выберите файл повторно для продолжения.');
        start = offset; progress(Math.floor(start / file.size * 100));
      }
      throw new GraphError(502, 'Microsoft не подтвердил завершение загрузки. Обновите список файлов.');
    } catch (error) {
      if (signal?.aborted) { await this.json(`/uploads/${id}`, { method: 'DELETE' }).catch(() => {}); this.uploads.delete(key); }
      if (error instanceof GraphError && error.status === 410) this.uploads.delete(key);
      throw error;
    }
  }
}
