import { PublicClientApplication, BrowserCacheLocation, InteractionRequiredAuthError } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-browser';

export type DriveItem = { id: string; name: string; size?: number; lastModifiedDateTime?: string; createdDateTime?: string; webUrl?: string; folder?: { childCount?: number }; file?: { mimeType?: string }; parentReference?: { id?: string; driveId?: string; path?: string }; thumbnails?: Array<{ small?: { url: string }; medium?: { url: string } }> };
export type DriveInfo = { id: string; quota?: { used?: number; total?: number } };
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
const scopes = ['Files.ReadWrite', 'User.Read'];
let instance: PublicClientApplication | undefined;
const key = (uid: string) => `pyl:onedrive:${uid}:account`;
function application() {
  if (!clientId) throw new Error('OneDrive ещё не настроен. Укажите VITE_MICROSOFT_CLIENT_ID.');
  return instance ??= new PublicClientApplication({ auth: { clientId, authority: 'https://login.microsoftonline.com/common', redirectUri: `${location.origin}${location.pathname}` }, cache: { cacheLocation: BrowserCacheLocation.SessionStorage } });
}
export async function initOneDrive(uid: string): Promise<AccountInfo | null> {
  const app = application(); await app.initialize();
  const result = await app.handleRedirectPromise();
  if (result?.account && result.state === uid) sessionStorage.setItem(key(uid), result.account.homeAccountId);
  const id = sessionStorage.getItem(key(uid));
  return app.getAllAccounts().find(a => a.homeAccountId === id) ?? null;
}
export async function connectOneDrive(uid: string) {
  const app = application(); await app.initialize();
  await app.loginRedirect({ scopes, state: uid });
}
export async function disconnectOneDrive(uid: string) {
  const app = application(); const account = await initOneDrive(uid);
  sessionStorage.removeItem(key(uid));
  if (account) await app.logoutRedirect({ account, postLogoutRedirectUri: `${location.origin}${location.pathname}#/drive` });
}
async function token(uid: string) {
  const app = application(); const account = await initOneDrive(uid);
  if (!account) throw new Error('Подключите OneDrive.');
  try { return (await app.acquireTokenSilent({ account, scopes })).accessToken; }
  catch (e) {
    if (e instanceof InteractionRequiredAuthError) { await app.acquireTokenRedirect({ account, scopes }); throw new Error('Требуется повторный вход Microsoft.', { cause: e }); }
    throw e;
  }
}
export class GraphError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function graph<T = unknown>(uid: string, path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const url = path.startsWith('https://graph.microsoft.com/') ? path : `https://graph.microsoft.com/v1.0${path}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { ...init, signal, headers: { Authorization: `Bearer ${await token(uid)}`, ...init.headers } });
    if (response.status === 429 || response.status >= 500) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, Math.min(8000, Number(response.headers.get('Retry-After') || 2 ** attempt) * 1000))); continue; }
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new GraphError(response.status, error.error?.message || `Microsoft Graph: ${response.status}`);
    }
    if (response.status === 204) return null as T;
    return response.json();
  }
  throw new Error(`Не удалось выполнить запрос: ${url}`);
}
export const rootPath = (id?: string) => id ? `/me/drive/items/${encodeURIComponent(id)}` : '/me/drive/root';
export async function children(uid: string, id?: string, next?: string, signal?: AbortSignal): Promise<{ value: DriveItem[]; '@odata.nextLink'?: string }> {
  return graph<{ value: DriveItem[]; '@odata.nextLink'?: string }>(uid, next || `${rootPath(id)}/children?$top=100&$select=id,name,size,lastModifiedDateTime,createdDateTime,webUrl,folder,file,parentReference`, {}, signal);
}
export async function search(uid: string, query: string, next?: string, signal?: AbortSignal): Promise<{ value: DriveItem[]; '@odata.nextLink'?: string }> {
  return graph<{ value: DriveItem[]; '@odata.nextLink'?: string }>(uid, next || `/me/drive/root/search(q='${encodeURIComponent(query.replaceAll("'", "''"))}')?$top=100`, {}, signal);
}
export async function createFolder(uid: string, parent: string | undefined, name: string) {
  return graph(uid, `${rootPath(parent)}/children`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }) });
}
export async function updateItem(uid: string, item: DriveItem, fields: { name?: string; parentReference?: { id: string } }) {
  return graph(uid, `/me/drive/items/${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
}
export async function deleteItem(uid: string, id: string) { return graph(uid, `/me/drive/items/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function uploadFile(uid: string, parent: string | undefined, file: File, onProgress: (p: number) => void, signal?: AbortSignal) {
  const path = `${rootPath(parent)}:/${encodeURIComponent(file.name)}:`;
  if (file.size <= 4 * 1024 * 1024) {
    const result = await graph(uid, `${path}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file }, signal);
    onProgress(100); return result;
  }
  const session = await graph<{uploadUrl: string}>(uid, `${path}/createUploadSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }) }, signal);
  try {
    const chunk = 5 * 1024 * 1024;
    for (let start = 0; start < file.size; start += chunk) {
      const end = Math.min(start + chunk, file.size);
      const response = await fetch(session.uploadUrl, { method: 'PUT', body: file.slice(start, end), signal, headers: { 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` } });
      if (!response.ok) throw new GraphError(response.status, 'Ошибка загрузки файла');
      onProgress(Math.round(end / file.size * 100));
    }
  } catch (e) { await fetch(session.uploadUrl, { method: 'DELETE' }).catch(() => {}); throw e; }
}
export async function downloadItem(uid: string, item: DriveItem) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(item.id)}/content`, { headers: { Authorization: `Bearer ${await token(uid)}` } });
  if (!response.ok) throw new GraphError(response.status, 'Не удалось скачать файл');
  const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = item.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
