/** One Durable Object per verified Firebase UID. No administrator route, browser tokens or arbitrary proxy. */
import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { firebaseIdentity } from '../ticktick/firebaseIdentity.ts';
import { DriveError, errorMessage, graphPath, random, safeMetadata, seal, unseal, uploadUrl } from './security.ts';
import { authDiagnostic, OneDriveAuthError, publicConfiguration, requiresReconnect, scopes } from './auth.ts';
import type { AuthDiagnostic, AuthStage } from './auth.ts';

export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<unknown>;
  deleteAll(): Promise<void>;
}
export interface Env {
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  FIREBASE_PROJECT_ID: string;
  APP_URL: string;
  BRIDGE_URL: string;
  MICROSOFT_TENANT?: string;
  ACCOUNTS: {
    idFromName(name: string): { toString(): string };
    idFromString(id: string): { toString(): string };
    get(id: { toString(): string }): { fetch(request: Request): Promise<Response> };
  };
}
type Pending = { nonce: string; oidcNonce: string; verifier: string; expires: number };
type Connection = { cache: string; homeAccountId: string; username: string; displayName?: string; driveId?: string };
type Upload = { url: string; expires: number; size: number };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
function fail(error: unknown) {
  return json({ error: error instanceof DriveError ? error.message : 'Не удалось выполнить операцию OneDrive.', ...(error instanceof OneDriveAuthError ? { diagnostic: error.diagnostic } : {}) }, error instanceof DriveError ? error.status : 502);
}
async function payload(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 16000) throw new DriveError(413, 'Слишком большой запрос.');
  try { const data = JSON.parse(text); if (data && typeof data === 'object' && !Array.isArray(data)) return data; } catch { /* safe error below */ }
  throw new DriveError(400, 'Некорректный запрос.');
}
function cookie(nonce: string, clear = false) {
  return `pyl_onedrive_oauth=${nonce}; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear ? 0 : 600}`;
}
function returned(env: Env) {
  return new Response(null, { status: 303, headers: { Location: `${env.APP_URL}#/drive`, 'Set-Cookie': cookie('', true), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
export class OneDriveAccount {
  private storage: Storage;
  private env: Env;
  private owner: string;
  private serial: Promise<unknown> = Promise.resolve();
  constructor(state: { storage: Storage; id: { toString(): string } }, env: Env) {
    this.storage = state.storage; this.env = env; this.owner = state.id.toString();
  }
  fetch(request: Request): Promise<Response> {
    const result = this.serial.then(() => this.handle(request)).catch(fail);
    this.serial = result; return result;
  }
  private async read<T>(key: string) {
    const value = await this.storage.get<string>(key);
    return value ? unseal<T>(value, this.env.TOKEN_ENCRYPTION_KEY, this.owner) : undefined;
  }
  private async write(key: string, value: unknown) { await this.storage.put(key, await seal(value, this.env.TOKEN_ENCRYPTION_KEY, this.owner)); }
  private msal() {
    return new ConfidentialClientApplication({ auth: {
      clientId: this.env.MICROSOFT_CLIENT_ID, clientSecret: this.env.MICROSOFT_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${this.env.MICROSOFT_TENANT || 'consumers'}`,
    }, system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } } });
  }
  private async token() {
    const saved = await this.read<Connection>('connection');
    if (!saved) throw new DriveError(401, 'Подключите OneDrive.');
    const app = this.msal(); app.getTokenCache().deserialize(saved.cache);
    const account = await app.getTokenCache().getAccountByHomeId(saved.homeAccountId);
    if (!account) throw new OneDriveAuthError(authDiagnostic({ errorCode: 'login_required' }, 'refresh'));
    try {
      const result = await app.acquireTokenSilent({ scopes, account });
      if (!result?.accessToken) throw new OneDriveAuthError(authDiagnostic({ errorCode: 'login_required' }, 'refresh'));
      await this.write('connection', { ...saved, cache: app.getTokenCache().serialize() });
      return result.accessToken;
    } catch (error) {
      const diagnostic = error instanceof OneDriveAuthError ? error.diagnostic : authDiagnostic(error, 'refresh');
      console.warn('onedrive_auth', { code: diagnostic.code, stage: diagnostic.stage, correlationId: diagnostic.correlationId });
      throw new OneDriveAuthError(diagnostic, requiresReconnect(diagnostic) ? 401 : 503);
    }
  }
  private async probe(accessToken: string) {
    const read = async <T>(path: string, stage: AuthStage): Promise<T> => {
      try {
        const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new OneDriveAuthError(authDiagnostic({ status: response.status }, stage), response.status);
        return await response.json();
      } catch (error) { if (error instanceof OneDriveAuthError) throw error; throw new OneDriveAuthError(authDiagnostic(error, stage), 503); }
    };
    const profile = await read<{ id: string; displayName?: string; mail?: string; userPrincipalName?: string }>('/me?$select=id,displayName,mail,userPrincipalName', 'graph_profile');
    const drive = await read<{ id: string }>('/me/drive?$select=id', 'graph_drive');
    const root = await read<{ value: unknown[] }>('/me/drive/root/children?$top=1&$select=id', 'graph_files');
    if (!profile.id || !drive.id || !Array.isArray(root.value)) throw new DriveError(502, 'Microsoft не подтвердил профиль и доступ к файлам.');
    return { displayName: profile.displayName?.slice(0, 200), username: (profile.mail || profile.userPrincipalName)?.slice(0, 320), driveId: drive.id };
  }
  private async authFailed(error: unknown, stage: AuthStage) {
    const diagnostic = error instanceof OneDriveAuthError ? error.diagnostic : authDiagnostic(error, stage);
    await this.write('authError', diagnostic);
    await this.storage.delete('pending');
    console.warn('onedrive_auth', { code: diagnostic.code, stage: diagnostic.stage, correlationId: diagnostic.correlationId });
    return returned(this.env);
  }
  private async graph(path: string, method: string, body?: BodyInit | null, headers?: HeadersInit) {
    const url = graphPath(path);
    const result = await fetch(url, { method, body, headers: { ...Object.fromEntries(new Headers(headers)), Authorization: `Bearer ${await this.token()}` }, redirect: 'error', signal: AbortSignal.timeout(30000) });
    return result;
  }
  private async response(response: Response) {
    if (!response.ok) {
      const result = json({ error: errorMessage(response.status) }, response.status);
      const retry = response.headers.get('Retry-After'); if (retry) result.headers.set('Retry-After', retry);
      return result;
    }
    if (response.status === 204) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    return json(safeMetadata(await response.json()), response.status);
  }
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url), method = request.method;
    if (url.pathname === '/authorize' && method === 'POST') {
      const nonce = random(), oidcNonce = random(), codes = await new CryptoProvider().generatePkceCodes();
      await this.write('pending', { nonce, oidcNonce, verifier: codes.verifier, expires: Date.now() + 600000 } satisfies Pending);
      try {
        const authUrl = await this.msal().getAuthCodeUrl({ scopes, nonce: oidcNonce, redirectUri: `${this.env.BRIDGE_URL}/callback`, state: `${this.owner}.${nonce}`, codeChallenge: codes.challenge, codeChallengeMethod: 'S256', prompt: 'select_account' });
        const response = json({ url: authUrl }); response.headers.set('Set-Cookie', cookie(nonce)); return response;
      } catch (error) { return this.authFailed(error, 'authorize'); }
    }
    if (url.pathname === '/callback' && method === 'GET') {
      const pending = await this.read<Pending>('pending');
      const state = url.searchParams.get('state');
      if (!pending || pending.expires < Date.now() || state !== `${this.owner}.${pending.nonce}` ||
        !request.headers.get('Cookie')?.split(';').some(c => c.trim() === `pyl_onedrive_oauth=${pending.nonce}`))
        throw new DriveError(400, 'Подключение не подтверждено. Повторите вход из Play Your Life; разрешите cookie сервера подключения.');
      await this.storage.delete('pending'); // one use, including cancelled/failed authorizations
      if (!url.searchParams.get('code') || url.searchParams.has('error')) {
        return this.authFailed({ error: url.searchParams.get('error'), error_description: url.searchParams.get('error_description') }, 'callback');
      }
      try {
        const app = this.msal();
        const result = await app.acquireTokenByCode({ code: url.searchParams.get('code')!, scopes, redirectUri: `${this.env.BRIDGE_URL}/callback`, codeVerifier: pending.verifier });
        if (!result?.account || !result.accessToken) throw new DriveError(401, errorMessage(401));
        const claims = result.idTokenClaims as { nonce?: unknown } | undefined;
        if (!pending.oidcNonce || claims?.nonce !== pending.oidcNonce) throw new OneDriveAuthError(authDiagnostic({ errorCode: 'OAUTH_NONCE_MISMATCH' }, 'nonce'));
        const verified = await this.probe(result.accessToken);
        // Accept only a validated account. Failed reconnection preserves the previous connection.
        await this.storage.deleteAll();
        await this.write('connection', { cache: app.getTokenCache().serialize(), homeAccountId: result.account.homeAccountId, ...verified, username: verified.username || result.account.username } satisfies Connection);
        return returned(this.env);
      } catch (error) { return this.authFailed(error, 'token_exchange'); }
    }
    if (url.pathname === '/status' && method === 'GET') {
      const saved = await this.read<Connection>('connection');
      const authError = await this.read<AuthDiagnostic>('authError');
      if (!saved) return json({ connected: false, ...(authError ? { authError } : {}) });
      try {
        const token = await this.token();
        const verified = saved.driveId ? saved : { ...saved, ...await this.probe(token) };
        if (!saved.driveId) {
          const refreshed = await this.read<Connection>('connection');
          await this.write('connection', { ...verified, cache: refreshed!.cache });
        }
        return json({ connected: true, username: verified.username, displayName: verified.displayName, driveId: verified.driveId, ...(authError ? { authError } : {}) });
      } catch (error) {
        if (error instanceof OneDriveAuthError && error.status === 401) return json({ connected: false, authError: error.diagnostic });
        throw error;
      }
    }
    if (url.pathname === '/disconnect' && method === 'POST') { await this.storage.deleteAll(); return json({ connected: false }); }
    if (url.pathname === '/graph' && ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      const path = graphPath(url.searchParams.get('path') || '');
      const suffix = new URL(path).pathname;
      if (method !== 'GET' && !(
        method === 'POST' && suffix.endsWith('/children') ||
        ['PATCH', 'DELETE'].includes(method) && /\/items\/[^/]+$/.test(suffix) ||
        method === 'PUT' && suffix.endsWith('/content')
      )) throw new DriveError(400, 'Операция недоступна.');
      const content = method === 'PUT' ? await request.arrayBuffer() : ['POST', 'PATCH'].includes(method) ? JSON.stringify(await payload(request)) : undefined;
      if (content instanceof ArrayBuffer && content.byteLength > 4 * 1024 * 1024) throw new DriveError(413, errorMessage(413));
      // Download/thumbnail redirects are followed without sending our bearer to the CDN.
      if (method === 'GET' && /\/(content|thumbnails\/0\/medium\/content)$/.test(suffix)) {
        return this.download(path);
      }
      const headers = new Headers({ 'Content-Type': method === 'PUT' ? 'application/octet-stream' : 'application/json' });
      const etag = request.headers.get('If-Match'); if (etag && ['PATCH', 'DELETE'].includes(method)) headers.set('If-Match', etag);
      return this.response(await this.graph(path, method, content, headers));
    }
    if (url.pathname === '/uploads' && method === 'POST') {
      const data = await payload(request);
      if (typeof data.path !== 'string' || !Number.isSafeInteger(data.size) || Number(data.size) <= 0 || Number(data.size) > 250 * 1024 ** 3)
        throw new DriveError(400, 'Некорректный размер файла.');
      const path = graphPath(data.path);
      if (!new URL(path).pathname.endsWith('/createUploadSession')) throw new DriveError(400, 'Некорректный запрос загрузки.');
      const response = await this.graph(path, 'POST', JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }), { 'Content-Type': 'application/json' });
      if (!response.ok) return this.response(response);
      const session = await response.json() as { uploadUrl: string; expirationDateTime: string };
      const id = random();
      await this.write(`upload:${id}`, { url: uploadUrl(session.uploadUrl), expires: Date.parse(session.expirationDateTime), size: Number(data.size) } satisfies Upload);
      return json({ id, nextExpectedRanges: ['0-'] });
    }
    const handle = url.pathname.match(/^\/uploads\/([a-f0-9]{64})$/)?.[1];
    if (handle && ['GET', 'PUT', 'DELETE'].includes(method)) {
      const session = await this.read<Upload>(`upload:${handle}`);
      if (!session || session.expires < Date.now()) { await this.storage.delete(`upload:${handle}`); throw new DriveError(410, errorMessage(410)); }
      await this.token(); // recheck connection even though upload URLs carry provider authorization
      let content: ArrayBuffer | undefined;
      const headers = new Headers();
      if (method === 'PUT') {
        content = await request.arrayBuffer();
        const range = request.headers.get('Content-Range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
        if (!range || Number(range[3]) !== session.size || Number(range[2]) - Number(range[1]) + 1 !== content.byteLength ||
          content.byteLength > 5 * 1024 * 1024 || Number(range[1]) % 327680 !== 0 || Number(range[2]) >= session.size ||
          Number(range[2]) + 1 < session.size && content.byteLength % 327680 !== 0)
          throw new DriveError(400, 'Некорректная часть файла.');
        headers.set('Content-Range', range[0]);
      }
      const response = await fetch(uploadUrl(session.url), { method, body: content, headers, redirect: 'error', signal: AbortSignal.timeout(45000) });
      if (method === 'DELETE' && response.ok || method === 'PUT' && [200, 201].includes(response.status)) await this.storage.delete(`upload:${handle}`);
      if (method === 'DELETE' && response.ok) return json({ cancelled: true });
      return this.response(response);
    }
    throw new DriveError(404, 'Операция не найдена.');
  }
  private async download(path: string) {
    const response = await fetch(graphPath(path), { headers: { Authorization: `Bearer ${await this.token()}` }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if (response.ok) return new Response(response.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    if (![301, 302, 303, 307, 308].includes(response.status)) return this.response(response);
    const location = new URL(response.headers.get('Location') || '');
    if (location.protocol !== 'https:' || location.username || location.password ||
      !['.1drv.com', '.onedrive.com', '.sharepoint.com', '.files.1drv.com'].some(suffix => location.hostname.endsWith(suffix)))
      throw new DriveError(502, 'Microsoft вернул недопустимый адрес файла.');
    const file = await fetch(location.href, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    if (!file.ok) throw new DriveError(file.status, errorMessage(file.status));
    return new Response(file.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let origin = '';
    try {
      origin = new URL(env.APP_URL).origin;
      if (!env.FIREBASE_PROJECT_ID)
        throw new DriveError(503, 'Сервер OneDrive ещё не настроен.');
      const configuration = publicConfiguration(env);
      const requireConfiguration = () => {
        if (!configuration.configured) throw new DriveError(503, configuration.issues[0].message);
        if (env.BRIDGE_URL !== url.origin) throw new DriveError(503, 'Адрес сервера не совпадает с BRIDGE_URL. Проверьте redirect URI.');
      };
      if (url.pathname === '/callback' && request.method === 'GET') {
        requireConfiguration();
        const state = url.searchParams.get('state');
        if (!state || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(state)) throw new DriveError(400, 'Недопустимое состояние подключения.');
        return await env.ACCOUNTS.get(env.ACCOUNTS.idFromString(state.split('.')[0])).fetch(request);
      }
      if (request.headers.get('Origin') !== origin) throw new DriveError(403, 'Недопустимый источник запроса.');
      let response: Response;
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
      else {
        let bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
        const formLogin = url.pathname === '/authorize' && request.method === 'POST' && request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded');
        if (formLogin) {
          const text = await request.clone().text();
          if (text.length > 16000) throw new DriveError(413, 'Слишком большой запрос.');
          bearer = new URLSearchParams(text).get('credential') || undefined;
        }
        let uid: string;
        try { if (!bearer) throw new Error(); uid = await firebaseIdentity(bearer, env.FIREBASE_PROJECT_ID); }
        catch { throw new DriveError(401, 'Войдите в аккаунт Play Your Life заново.'); }
        if (url.pathname === '/diagnostics' && request.method === 'GET') response = json(configuration);
        else {
          try { requireConfiguration(); }
          catch (error) { if (formLogin) return returned(env); throw error; }
          // Client-supplied uid/userId/headers cannot select an account object.
          response = await env.ACCOUNTS.get(env.ACCOUNTS.idFromName(uid)).fetch(request);
          if (formLogin && response.ok) {
            const target = await response.json() as { url: string };
            return new Response(null, { status: 303, headers: { Location: target.url, 'Set-Cookie': response.headers.get('Set-Cookie')!, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
          }
        }
      }
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', origin); headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Range, If-Match');
      headers.set('Access-Control-Expose-Headers', 'Retry-After'); headers.set('Vary', 'Origin'); headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      const response = fail(error);
      if (origin && request.headers.get('Origin') === origin) { response.headers.set('Access-Control-Allow-Origin', origin); response.headers.set('Access-Control-Allow-Credentials', 'true'); }
      return response;
    }
  },
};
